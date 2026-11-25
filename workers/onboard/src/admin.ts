// Gabriel's routes, behind Cloudflare Access and checked again here.
//
// GET    /api/onboard/admin/clients?status=active|archived
// POST   /api/onboard/admin/clients
// GET    /api/onboard/admin/clients/<id>
// PATCH  /api/onboard/admin/clients/<id>
// POST   /api/onboard/admin/clients/<id>/rotate
// DELETE /api/onboard/admin/clients/<id>

import { clampProgress, stepIdsFor } from '../../../src/onboard/progress.ts';
import { buildSteps, type StepId } from '../../../src/onboard/steps.ts';
import { type AccessEnv, verifyAccess } from './access.ts';
import { configOf } from './client.ts';
import { json, readJson } from './http.ts';
import {
	type ClientFields,
	type ClientPatch,
	type ClientRow,
	createClient,
	type D1,
	deleteClient,
	getById,
	listClients,
	rotateCode,
	updateClient,
} from './store.ts';
import { checkFields } from './validate.ts';

export interface AdminEnv extends AccessEnv {
	DB?: D1;
}

const ORIGIN = 'https://cellestialstudio.com';

export const adminView = (c: ClientRow) => ({
	...c,
	link: `${ORIGIN}/start/#${c.code}`,
	steps: buildSteps(configOf(c)).map((s) => ({ id: s.id, title: s.title })),
});

function sameSite(request: Request): boolean {
	const h = request.headers;
	if (!(h.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return false;
	const site = h.get('sec-fetch-site');
	if (site && site !== 'same-origin') return false;
	const origin = h.get('origin');
	if (origin && origin !== ORIGIN) return false;
	return true;
}

const missing = () => json(404, { error: 'No such client.' });
const bad = (field: string, error: string) => json(400, { field, error });

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

	// Access signs Gabriel in with a cookie, which a browser sends even on a
	// request another site starts. Changes must come from this site, as JSON
	// (which a cross-site form can't send without a preflight).
	if (m !== 'GET' && m !== 'HEAD' && !sameSite(request))
		return json(403, { error: 'Changes must come from the dashboard.' });

	if (rest[0] !== 'clients' || rest.length > 3) return json(404, { error: 'Not found.' });

	if (rest.length === 1) {
		if (m === 'GET') {
			const archived = new URL(request.url).searchParams.get('status') === 'archived';
			return json(200, { clients: (await listClients(db, archived)).map(adminView) });
		}
		if (m === 'POST') {
			const body = await readJson(request);
			if (!body) return bad('body', 'Unreadable body.');
			const c = checkFields(body, false);
			if (!c.ok) return bad(c.field, c.error);
			const created = await createClient(db, c.value as ClientFields);
			return json(201, adminView(created));
		}
		return json(405, { error: 'Method not allowed.' });
	}

	const id = rest[1];
	if (rest.length === 3) {
		if (rest[2] !== 'rotate') return json(404, { error: 'Not found.' });
		if (m !== 'POST') return json(405, { error: 'POST only.' });
		const r = await rotateCode(db, id);
		return r ? json(200, adminView(r)) : missing();
	}

	if (m === 'GET') {
		const c = await getById(db, id);
		return c ? json(200, adminView(c)) : missing();
	}
	if (m === 'DELETE') {
		return (await deleteClient(db, id)) ? json(200, { ok: true }) : missing();
	}
	if (m !== 'PATCH') return json(405, { error: 'Method not allowed.' });

	const body = await readJson(request);
	if (!body) return bad('body', 'Unreadable body.');
	const current = await getById(db, id);
	if (!current) return missing();
	const c = checkFields(body, true);
	if (!c.ok) return bad(c.field, c.error);
	const patch: ClientPatch = { ...c.value };
	if (patch.checklist) patch.checklist = { ...current.checklist, ...patch.checklist };

	// Progress: Gabriel may set any step and any ticks, within the client's own steps.
	const merged = { ...current, ...patch };
	const ids = stepIdsFor(configOf(merged));
	let step = current.step;
	let done: StepId[] = current.done;
	if ('step' in body) {
		const s = Number(body.step);
		if (!Number.isInteger(s) || s < 0 || s > ids.length) return bad('step', 'Bad step.');
		step = s;
	}
	if ('done' in body) {
		const d = body.done;
		if (!Array.isArray(d) || d.some((x) => !ids.includes(x as StepId)))
			return bad('done', 'Bad step list.');
		done = ids.filter((x) => d.includes(x));
	}
	if (merged.tier !== current.tier || merged.lane !== current.lane) {
		({ step, done } = clampProgress({ step, done }, ids));
	}
	patch.step = step;
	patch.done = done;
	if (!('status' in body) && current.status !== 'archived') {
		patch.status = step >= ids.length ? 'done' : 'active';
	}
	const saved = await updateClient(db, id, patch);
	return saved ? json(200, adminView(saved)) : missing();
}
