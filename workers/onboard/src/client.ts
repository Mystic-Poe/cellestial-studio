// The client's own routes, keyed by the secret code in their link.
//
// GET  /api/onboard/client/<code>           their setup, and nothing else
// POST /api/onboard/client/<code>/progress  {action, step, via?}

import { applyProgress, type ProgressAction, stepIdsFor } from '../../../src/onboard/progress.ts';
import { type Ctx, json, type Limiter, readJson } from './http.ts';
import { type MailEnv, sendStepEmail } from './notify.ts';
import {
	type ClientRow,
	type D1,
	getByCode,
	type Status,
	touchSeen,
	updateClient,
} from './store.ts';

export interface ClientEnv extends MailEnv {
	DB?: D1;
	RATE?: Limiter;
	RATE_PROGRESS?: Limiter;
}

const CODE = /^[A-Za-z0-9_-]{20,64}$/;
const ACTIONS: readonly string[] = ['done', 'undo', 'goto'];

export const configOf = (c: ClientRow) => ({
	n: c.name,
	e: c.email,
	d: c.domain,
	l: c.lane,
	t: c.tier,
	m: c.mode,
});

/** Exactly what a client may see of their own record. */
export const clientView = (c: ClientRow) => ({
	name: c.name,
	email: c.email,
	domain: c.domain,
	lane: c.lane,
	tier: c.tier,
	mode: c.mode,
	step: c.step,
	done: c.done,
});

const gone = () => json(404, { error: 'This link isn’t active.' });

export async function clientRoute(
	request: Request,
	env: ClientEnv,
	ctx: Ctx,
	code: string,
	action: string | undefined,
): Promise<Response> {
	if (!env.DB) return json(503, { error: 'Not configured.' });
	if (!CODE.test(code)) return gone();

	if (action === undefined) {
		if (request.method !== 'GET') return json(405, { error: 'GET only.' });
		const c = await getByCode(env.DB, code);
		if (!c || c.status === 'archived') return gone();
		ctx.waitUntil(touchSeen(env.DB, c.id).catch(() => {}));
		return json(200, clientView(c));
	}

	if (action !== 'progress') return json(404, { error: 'Not found.' });
	if (request.method !== 'POST') return json(405, { error: 'POST only.' });

	if (env.RATE_PROGRESS) {
		const { success } = await env.RATE_PROGRESS.limit({ key: code });
		if (!success) return json(429, { error: 'Slow down.' });
	}
	const body = await readJson(request);
	if (!body) return json(400, { error: 'Unreadable body.' });
	if (!ACTIONS.includes(body.action as string)) return json(400, { error: 'Bad action.' });
	const via = body.via === 'invite' ? 'invite' : 'button';

	const c = await getByCode(env.DB, code);
	if (!c || c.status === 'archived') return gone();

	const ids = stepIdsFor(configOf(c));
	const r = applyProgress(
		{ step: c.step, done: c.done },
		body.action as ProgressAction,
		Number(body.step),
		ids,
	);
	if (!r.ok) return json(400, { error: r.error, step: c.step, done: c.done });

	const status: Status = r.progress.step >= ids.length ? 'done' : 'active';
	const now = Date.now();
	const saved = await updateClient(env.DB, c.id, { ...r.progress, status }, now);
	if (!saved) return gone();
	ctx.waitUntil(touchSeen(env.DB, c.id, now).catch(() => {}));

	if (body.action === 'done' && c.mode !== 'person') {
		// The email is a courtesy: a failure or a rate limit never undoes the step.
		let allowed = true;
		if (env.RATE) {
			const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
			allowed = (await env.RATE.limit({ key: ip })).success;
		}
		if (allowed) await sendStepEmail(env, saved, Number(body.step), via);
	}
	return json(200, { step: saved.step, done: saved.done });
}
