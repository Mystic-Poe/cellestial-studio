// Gabriel's routes, behind Cloudflare Access and checked again here.
//
// GET    /admin/clients?status=active|archived
// POST   /admin/clients                          {name, email, mode?}
// GET    /admin/clients/<id>                     with photos and reviews
// PATCH  /admin/clients/<id>
// DELETE /admin/clients/<id>                     and every file
// POST   /admin/clients/<id>/rotate
// POST   /admin/clients/<id>/photos              multipart: file, thumb?, kind, of?
// GET    /admin/clients/<id>/photos.zip          every original
// GET    /admin/clients/<id>/photos/<pid>?size=thumb|full[&download=1]
// DELETE /admin/clients/<id>/photos/<pid>

import { type AccessEnv, verifyAccess } from './access.ts';
import { photoKey, type R2Like, readUpload, safeName, zipNames, zipStream } from './files.ts';
import { json, readJson } from './http.ts';
import type { MailEnv } from './notify.ts';
import { admitUpload, refuseUpload, usageView } from './quota.ts';
import {
	addPhoto,
	type ClientRow,
	createClient,
	type D1,
	deleteClient,
	deletePhoto,
	getById,
	getPhoto,
	listClients,
	listPhotos,
	listReviews,
	newId,
	type PhotoRow,
	rotateCode,
	updateClient,
} from './store.ts';
import { checkNew, checkPatch } from './validate.ts';

export interface AdminEnv extends AccessEnv, MailEnv {
	DB?: D1;
	PHOTOS?: R2Like;
}

const ORIGIN = 'https://cellestialstudio.com';
export const STUDIO_PHOTO_MAX = 100 * 1024 * 1024;

export const adminView = <T extends ClientRow>(c: T) => ({
	...c,
	link: `${ORIGIN}/start/#${c.code}`,
});

/**
 * Access signs Gabriel in with a cookie, which a browser sends even on a
 * request another site starts. JSON can't be sent cross-site without a
 * preflight; a form upload can, so uploads must positively prove they came
 * from this site.
 */
function sameSite(request: Request): boolean {
	const h = request.headers;
	const type = (h.get('content-type') ?? '').toLowerCase();
	const site = h.get('sec-fetch-site');
	const origin = h.get('origin');
	if (site && site !== 'same-origin') return false;
	if (origin && origin !== ORIGIN) return false;
	if (type.startsWith('application/json')) return true;
	if (type.startsWith('multipart/form-data')) return site === 'same-origin' || origin === ORIGIN;
	return false;
}

const missing = () => json(404, { error: 'No such client.' });
const bad = (field: string, error: string) => json(400, { field, error });
const disposition = (kind: 'inline' | 'attachment', name: string) =>
	`${kind}; filename="${safeName(name).replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safeName(name))}`;

async function removeFiles(bucket: R2Like | undefined, clientId: string, rows: PhotoRow[]) {
	if (!bucket || !rows.length) return;
	const keys = rows.flatMap((r) => [photoKey(clientId, r.id), photoKey(clientId, r.id, true)]);
	for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
}

async function detail(db: D1, c: ClientRow) {
	const [photos, reviews] = await Promise.all([listPhotos(db, c.id), listReviews(db, c.id)]);
	return { ...adminView(c), photos, reviews };
}

export async function adminRoute(
	request: Request,
	env: AdminEnv,
	rest: string[],
): Promise<Response> {
	const gate = await verifyAccess(request, env);
	if (gate === 'unconfigured') return json(503, { error: 'Dashboard login is not set up yet.' });
	if (gate === 'denied') return json(401, { error: 'Sign in again.' });
	if (!env.DB) return json(503, { error: 'Not configured.' });
	const db = env.DB;
	const m = request.method;

	if (m !== 'GET' && m !== 'HEAD' && !sameSite(request))
		return json(403, { error: 'Changes must come from the dashboard.' });

	if (rest[0] !== 'clients' || rest.length > 4) return json(404, { error: 'Not found.' });

	if (rest.length === 1) {
		if (m === 'GET') {
			const archived = new URL(request.url).searchParams.get('status') === 'archived';
			return json(200, {
				clients: (await listClients(db, archived)).map(adminView),
				usage: await usageView(db),
			});
		}
		if (m === 'POST') {
			const body = await readJson(request);
			if (!body) return bad('body', 'Unreadable body.');
			const c = checkNew(body);
			if (!c.ok) return bad(c.field, c.error);
			return json(201, await detail(db, await createClient(db, c.value)));
		}
		return json(405, { error: 'Method not allowed.' });
	}

	const id = rest[1];
	const current = await getById(db, id);
	if (!current) return missing();

	if (rest.length === 2) {
		if (m === 'GET') return json(200, await detail(db, current));
		if (m === 'DELETE') {
			await removeFiles(env.PHOTOS, id, await listPhotos(db, id));
			await deleteClient(db, id);
			return json(200, { ok: true });
		}
		if (m !== 'PATCH') return json(405, { error: 'Method not allowed.' });
		const body = await readJson(request);
		if (!body) return bad('body', 'Unreadable body.');
		const c = checkPatch(body);
		if (!c.ok) return bad(c.field, c.error);
		const { checklist, ...rest2 } = c.value;
		const now = Date.now();
		const saved = await updateClient(
			db,
			id,
			{
				...rest2,
				...(checklist ? { checklist: { ...current.checklist, ...checklist } } : {}),
				...(c.value.stage && c.value.stage !== current.stage ? { stage_at: now } : {}),
				// Filled in with the client in person: that counts as sent.
				...(c.value.intake && current.intake_at === null
					? { intake_by: 'studio' as const, intake_at: now }
					: {}),
			},
			now,
		);
		return saved ? json(200, await detail(db, saved)) : missing();
	}

	const sub = rest[2];
	if (sub === 'rotate' && rest.length === 3) {
		if (m !== 'POST') return json(405, { error: 'POST only.' });
		const r = await rotateCode(db, id);
		return r ? json(200, await detail(db, r)) : missing();
	}

	if (sub === 'photos.zip' && rest.length === 3) {
		if (m !== 'GET') return json(405, { error: 'GET only.' });
		if (!env.PHOTOS) return json(503, { error: 'Photo storage is not set up yet.' });
		const bucket = env.PHOTOS;
		const originals = (await listPhotos(db, id)).filter((p) => p.kind === 'original');
		const names = zipNames(originals.map((p) => p.name));
		const stream = zipStream(
			originals.map((p, i) => ({
				name: names[i],
				open: async () => (await bucket.get(photoKey(id, p.id)))?.body ?? null,
			})),
		);
		const slug =
			current.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '') || 'client';
		return new Response(stream, {
			headers: {
				'content-type': 'application/zip',
				'content-disposition': disposition('attachment', `${slug}-originals.zip`),
				'cache-control': 'no-store',
			},
		});
	}

	if (sub !== 'photos') return json(404, { error: 'Not found.' });
	if (!env.PHOTOS) return json(503, { error: 'Photo storage is not set up yet.' });
	const bucket = env.PHOTOS;

	if (rest.length === 3) {
		if (m !== 'POST') return json(405, { error: 'POST only.' });
		const up = await readUpload(request, STUDIO_PHOTO_MAX);
		if (!up.ok) return json(up.status, { error: up.error });
		const kind = up.fields.kind === 'finished' ? 'finished' : 'original';
		let of: string | null = null;
		if (kind === 'finished') {
			const original = await getPhoto(db, id, up.fields.of ?? '');
			if (!original || original.kind !== 'original')
				return bad('of', 'Pick the original this is the finished version of.');
			of = original.id;
			// One finished version per original: a new one replaces the old.
			const old = (await listPhotos(db, id)).filter((p) => p.of === of);
			for (const o of old) await deletePhoto(db, id, o.id);
			await removeFiles(bucket, id, old);
		}
		const admit = await admitUpload(db, up.file.size + (up.thumb?.size ?? 0));
		if (!admit.ok) return refuseUpload(db, env, admit.reason);
		const pid = newId();
		const meta = (f: File) => ({ httpMetadata: { contentType: f.type || 'image/jpeg' } });
		await bucket.put(photoKey(id, pid), up.file.stream(), meta(up.file));
		if (up.thumb)
			await bucket.put(photoKey(id, pid, true), await up.thumb.arrayBuffer(), meta(up.thumb));
		const p = await addPhoto(db, {
			id: pid,
			client_id: id,
			kind,
			of,
			source: 'studio',
			name: safeName(up.file.name),
			type: up.file.type || 'image/jpeg',
			size: up.file.size,
			has_thumb: Boolean(up.thumb),
			thumb_size: up.thumb?.size ?? 0,
		});
		await updateClient(db, id, {});
		return json(201, p);
	}

	const p = await getPhoto(db, id, rest[3]);
	if (!p) return json(404, { error: 'No such photo.' });
	if (m === 'GET') {
		const q = new URL(request.url).searchParams;
		const wantThumb = q.get('size') === 'thumb' && p.has_thumb;
		const obj =
			(wantThumb ? await bucket.get(photoKey(id, p.id, true)) : null) ??
			(await bucket.get(photoKey(id, p.id)));
		if (!obj) return json(404, { error: 'No such photo.' });
		return new Response(obj.body, {
			headers: {
				'content-type': obj.httpMetadata?.contentType ?? p.type,
				'content-disposition': disposition(
					q.get('download') === '1' ? 'attachment' : 'inline',
					p.name,
				),
				'cache-control': 'private, max-age=3600',
				'x-content-type-options': 'nosniff',
			},
		});
	}
	if (m === 'DELETE') {
		const removed = await deletePhoto(db, id, p.id);
		await removeFiles(bucket, id, removed);
		return json(200, { ok: true });
	}
	return json(405, { error: 'Method not allowed.' });
}
