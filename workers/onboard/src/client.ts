// The client's own routes, keyed by the secret code in their link.
//
// GET    /api/onboard/client/<code>              what their page shows
// PUT    /api/onboard/client/<code>/intake       {intake, send?}
// POST   /api/onboard/client/<code>/photos       multipart: file, thumb?
// GET    /api/onboard/client/<code>/photos/<id>  their own upload (thumbnail)
// DELETE /api/onboard/client/<code>/photos/<id>  their own upload
// POST   /api/onboard/client/<code>/review       {verdict: ok|changes, text?}

import { cleanIntake, editable, readyToSend } from '../../../src/onboard/intake.ts';
import { photoKey, type R2Like, readUpload } from './files.ts';
import { type Ctx, json, type Limiter, readJson } from './http.ts';
import { type MailEnv, type MailKind, sendMail } from './notify.ts';
import { forgetPhotos, readPhoto } from './photo-cache.ts';
import { admitUpload, refuseUpload } from './quota.ts';
import {
	addPhoto,
	addReview,
	type ClientRow,
	countClientPhotos,
	type D1,
	deletePhoto,
	getByCode,
	getPhoto,
	listPhotos,
	listReviews,
	newId,
	type PhotoRow,
	touchSeen,
	updateClient,
} from './store.ts';

export interface ClientEnv extends MailEnv {
	DB?: D1;
	PHOTOS?: R2Like;
	RATE?: Limiter;
	RATE_CLIENT?: Limiter;
	/** Photo reads per link (120 a minute): keeps R2 reads inside the free tier. */
	RATE_READ?: Limiter;
}

const CODE = /^[A-Za-z0-9_-]{20,64}$/;
export const CLIENT_PHOTO_MAX = 25 * 1024 * 1024;
export const CLIENT_PHOTO_COUNT = 25;
const PHOTO_MAIL_GAP = 15 * 60_000;

const gone = () => json(404, { error: 'This link isn’t active.' });
const locked = () =>
	json(409, {
		error: 'Gabriel is building your site now, so this can’t change here. Message him instead.',
	});

const photoView = (p: PhotoRow) => ({ id: p.id, name: p.name });

/** Exactly what a client may see of their own record. */
export async function clientView(db: D1, c: ClientRow) {
	const [photos, reviews] = await Promise.all([listPhotos(db, c.id), listReviews(db, c.id)]);
	const latest = reviews[0];
	const atReview = c.stage === 'review' || c.stage === 'live';
	return {
		name: c.name,
		stage: c.stage,
		intake: c.intake,
		sent: c.intake_at !== null,
		editable: editable(c.stage),
		preview_url: atReview ? c.preview_url : '',
		live_url: c.stage === 'live' ? c.live_url : '',
		answered:
			c.stage === 'review' && latest && latest.created_at >= c.stage_at ? latest.verdict : null,
		photos: photos.filter((p) => p.source === 'client').map(photoView),
	};
}

async function mail(request: Request, env: ClientEnv, c: ClientRow, kind: MailKind, text = '') {
	// The email is a courtesy: a failure or a rate limit never undoes the save.
	if (env.RATE) {
		const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
		if (!(await env.RATE.limit({ key: ip })).success) return;
	}
	await sendMail(env, c, kind, text);
}

export async function clientRoute(
	request: Request,
	env: ClientEnv,
	ctx: Ctx,
	code: string,
	rest: string[],
): Promise<Response> {
	if (!env.DB) return json(503, { error: 'Not configured.' });
	if (!CODE.test(code)) return gone();
	const db = env.DB;
	const m = request.method;

	const c = await getByCode(db, code);
	if (!c || c.status === 'archived') return gone();
	ctx.waitUntil(touchSeen(db, c.id).catch(() => {}));

	if (rest.length === 0) {
		if (m !== 'GET') return json(405, { error: 'GET only.' });
		return json(200, await clientView(db, c));
	}

	// Reading a thumbnail has its own, looser limit; everything else is a write.
	const isRead = rest[0] === 'photos' && rest.length === 2 && m === 'GET';
	const limiter = isRead ? env.RATE_READ : env.RATE_CLIENT;
	if (limiter) {
		const { success } = await limiter.limit({ key: code });
		if (!success) return json(429, { error: 'Slow down a moment, then try again.' });
	}

	if (rest[0] === 'intake' && rest.length === 1) {
		if (m !== 'PUT') return json(405, { error: 'PUT only.' });
		if (!editable(c.stage)) return locked();
		const body = await readJson(request);
		if (!body) return json(400, { error: 'Unreadable body.' });
		const cleaned = cleanIntake(body.intake);
		if (!cleaned.ok) return json(400, { field: cleaned.field, error: cleaned.error });
		const send = body.send === true;
		if (send) {
			const missing = readyToSend(cleaned.value);
			if (missing) return json(400, { field: 'about', error: missing });
		}
		const first = send && c.intake_at === null;
		const saved = await updateClient(db, c.id, {
			intake: cleaned.value,
			...(first ? { intake_by: 'client' as const, intake_at: Date.now() } : {}),
		});
		if (!saved) return gone();
		if (first) await mail(request, env, saved, 'intake');
		return json(200, await clientView(db, saved));
	}

	if (rest[0] === 'photos') {
		if (!env.PHOTOS) return json(503, { error: 'Photo storage is not set up yet.' });
		const bucket = env.PHOTOS;

		if (rest.length === 1) {
			if (m !== 'POST') return json(405, { error: 'POST only.' });
			if (!editable(c.stage)) return locked();
			if ((await countClientPhotos(db, c.id)) >= CLIENT_PHOTO_COUNT)
				return json(409, {
					error: `That’s the limit of ${CLIENT_PHOTO_COUNT} photos. Gabriel will take more.`,
				});
			const up = await readUpload(request, CLIENT_PHOTO_MAX);
			if (!up.ok) return json(up.status, { error: up.error });
			const admit = await admitUpload(db, up.file.size + (up.thumb?.size ?? 0));
			if (!admit.ok) return refuseUpload(db, env, admit.reason);
			const id = newId();
			const meta = (f: File) => ({ httpMetadata: { contentType: f.type || 'image/jpeg' } });
			await bucket.put(photoKey(c.id, id), await up.file.arrayBuffer(), meta(up.file));
			if (up.thumb)
				await bucket.put(photoKey(c.id, id, true), await up.thumb.arrayBuffer(), meta(up.thumb));
			const p = await addPhoto(db, {
				id,
				client_id: c.id,
				kind: 'original',
				of: null,
				source: 'client',
				name: up.file.name.slice(-120) || 'photo.jpg',
				type: up.file.type || 'image/jpeg',
				size: up.file.size,
				has_thumb: Boolean(up.thumb),
				thumb_size: up.thumb?.size ?? 0,
			});
			const now = Date.now();
			if (
				c.intake_at !== null &&
				(c.photo_mail_at === null || c.photo_mail_at < now - PHOTO_MAIL_GAP)
			) {
				const saved = await updateClient(db, c.id, { photo_mail_at: now });
				if (saved) await mail(request, env, saved, 'photos');
			}
			return json(201, photoView(p));
		}

		if (rest.length !== 2) return json(404, { error: 'Not found.' });
		const p = await getPhoto(db, c.id, rest[1]);
		if (!p || p.source !== 'client') return json(404, { error: 'No such photo.' });
		if (m === 'GET') {
			const keys = [photoKey(c.id, p.id)];
			if (p.has_thumb) keys.unshift(photoKey(c.id, p.id, true));
			const obj = await readPhoto(bucket, keys, ctx);
			if (!obj) return json(404, { error: 'No such photo.' });
			return new Response(obj.body, {
				headers: {
					'content-type': obj.type ?? 'image/jpeg',
					'cache-control': 'private, max-age=3600',
					'x-content-type-options': 'nosniff',
				},
			});
		}
		if (m === 'DELETE') {
			if (!editable(c.stage)) return locked();
			const removed = await deletePhoto(db, c.id, p.id);
			const keys = removed.flatMap((r) => [photoKey(c.id, r.id), photoKey(c.id, r.id, true)]);
			await bucket.delete(keys);
			forgetPhotos(keys, ctx);
			return json(200, { ok: true });
		}
		return json(405, { error: 'Method not allowed.' });
	}

	if (rest[0] === 'review' && rest.length === 1) {
		if (m !== 'POST') return json(405, { error: 'POST only.' });
		if (c.stage !== 'review') return json(409, { error: 'There’s nothing to review right now.' });
		const body = await readJson(request);
		if (!body) return json(400, { error: 'Unreadable body.' });
		const verdict = body.verdict;
		if (verdict !== 'ok' && verdict !== 'changes') return json(400, { error: 'Pick one.' });
		const text = typeof body.text === 'string' ? body.text.trim() : '';
		if (verdict === 'changes' && !text)
			return json(400, { field: 'text', error: 'Tell Gabriel what to change.' });
		if (text.length > 2000) return json(400, { field: 'text', error: 'Up to 2000 characters.' });
		await addReview(db, { client_id: c.id, verdict, text: verdict === 'changes' ? text : '' });
		await mail(request, env, c, verdict, text);
		return json(200, await clientView(db, c));
	}

	return json(404, { error: 'Not found.' });
}
