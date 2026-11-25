// Run: node workers/onboard/test/onboard.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;
const store = await import(resolve(here, '../src/store.ts'));
const { fakeD1 } = await import('./fake-d1.mjs');

let allow = true;
let allowProgress = true;
let db = fakeD1();
const fullEnv = {
	INVITE_SALT: 'salt',
	CF_USER_TOKEN: 'cf_tok',
	GH_TOKEN: 'gh_tok',
	RESEND_API_KEY: 're_key',
	NOTIFY_TO: 'gabriel@example.com',
	NOTIFY_FROM: 'site@cellestialstudio.com',
	RATE: { limit: async () => ({ success: allow }) },
	RATE_PROGRESS: { limit: async () => ({ success: allowProgress }) },
	get DB() {
		return db;
	},
};

const call = (path, { env = fullEnv, method = 'GET', json } = {}) =>
	worker.fetch(
		new Request(`https://cellestialstudio.com${path}`, {
			method,
			headers: { 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4' },
			...(json !== undefined ? { body: JSON.stringify(json) } : {}),
		}),
		env,
		{ waitUntil() {} },
	);

let pass = 0;
const t = async (name, fn) => {
	await fn();
	console.log('  ok  -', name);
	pass++;
};

let calls = [];
let mails = [];
const stub = ({ cf = true, gh = true, resend = true } = {}) => {
	calls = [];
	mails = [];
	globalThis.fetch = async (url, init = {}) => {
		const u = String(url);
		calls.push({ u, headers: new Headers(init.headers) });
		if (u.includes('api.cloudflare.com'))
			return cf
				? Response.json({ success: true, result: [{ id: 'cf-inv-1' }, { id: 'cf-inv-2' }] })
				: new Response('nope', { status: 500 });
		if (u.includes('api.github.com'))
			return gh
				? Response.json([{ organization: { id: 4242, login: 'secret-client-org' } }])
				: new Response('nope', { status: 401 });
		if (u.includes('resend')) {
			mails.push(JSON.parse(init.body));
			return new Response('{}', { status: resend ? 200 : 500 });
		}
		return new Response('{}', { status: 500 });
	};
};

// Tests run outside Workers, so there is no edge cache; the Worker must cope.
globalThis.caches = undefined;

stub();
await t('other paths 404', async () => {
	assert.equal((await call('/api/onboard/nope')).status, 404);
});

await t('invites: 503 when INVITE_SALT is missing', async () => {
	const r = await call('/api/onboard/invites', { env: { ...fullEnv, INVITE_SALT: undefined } });
	assert.equal(r.status, 503);
});

await t('invites: hashed ids from both sources, never raw ids or names', async () => {
	stub();
	const r = await call('/api/onboard/invites');
	assert.equal(r.status, 200);
	const text = await r.text();
	const body = JSON.parse(text);
	assert.equal(body.cloudflare.length, 2);
	assert.equal(body.github.length, 1);
	for (const h of [...body.cloudflare, ...body.github]) assert.match(h, /^[0-9a-f]{16}$/);
	assert.ok(!text.includes('cf-inv-1') && !text.includes('4242') && !text.includes('secret'));
	const gh = calls.find((c) => c.u.includes('api.github.com'));
	assert.ok(gh.headers.get('user-agent'), 'GitHub requires a User-Agent');
	assert.equal(gh.headers.get('authorization'), 'Bearer gh_tok');
});

await t('invites: hashes are stable across calls', async () => {
	stub();
	const a = await (await call('/api/onboard/invites')).json();
	const b = await (await call('/api/onboard/invites')).json();
	assert.deepEqual(a, b);
});

await t('invites: one failing source still answers 200 with the other', async () => {
	stub({ gh: false });
	const body = await (await call('/api/onboard/invites')).json();
	assert.deepEqual(body.github, []);
	assert.equal(body.cloudflare.length, 2);
});

await t('invites: a missing token skips that source without calling it', async () => {
	stub();
	const r = await call('/api/onboard/invites', { env: { ...fullEnv, GH_TOKEN: undefined } });
	assert.deepEqual((await r.json()).github, []);
	assert.ok(!calls.some((c) => c.u.includes('api.github.com')));
});

// ── Client routes ──────────────────────────────────────────────────────────

const fields = {
	name: 'Test Bakery',
	email: 'owner@example.com',
	domain: 'example.com',
	lane: 'ms',
	tier: 2,
	mode: 'test',
};
const fresh = async (over = {}) => {
	db = fakeD1();
	return store.createClient(db, { ...fields, ...over });
};
const progress = (code, json) =>
	call(`/api/onboard/client/${code}/progress`, { method: 'POST', json });

await t('client GET returns their setup and nothing private', async () => {
	const c = await fresh();
	await store.updateClient(db, c.id, {
		notes: 'private note',
		checklist: { invites: true, billing: false, domain: false, card: false },
	});
	const r = await call(`/api/onboard/client/${c.code}`);
	assert.equal(r.status, 200);
	const text = await r.text();
	assert.deepEqual(Object.keys(JSON.parse(text)).sort(), [
		'domain',
		'done',
		'email',
		'lane',
		'mode',
		'name',
		'step',
		'tier',
	]);
	assert.ok(!text.includes('private note') && !text.includes(c.id) && !text.includes(c.code));
});

await t('client GET: unknown, malformed, archived and rotated codes are 404', async () => {
	const c = await fresh();
	assert.equal((await call('/api/onboard/client/x'.padEnd(40, 'x'))).status, 404);
	assert.equal((await call('/api/onboard/client/bad!code')).status, 404);
	const r = await store.rotateCode(db, c.id);
	assert.equal((await call(`/api/onboard/client/${c.code}`)).status, 404);
	assert.equal((await call(`/api/onboard/client/${r.code}`)).status, 200);
	await store.updateClient(db, c.id, { status: 'archived' });
	assert.equal((await call(`/api/onboard/client/${r.code}`)).status, 404);
});

await t('progress done saves and sends a [TEST] email built from the record', async () => {
	stub();
	const c = await fresh();
	const r = await progress(c.code, { action: 'done', step: 0, client: 'Injected <b>name</b>' });
	assert.equal(r.status, 200);
	assert.deepEqual(await r.json(), { step: 1, done: ['gh-signup'] });
	assert.equal(mails.length, 1);
	assert.match(
		mails[0].subject,
		/^\[TEST\] Onboarding: Test Bakery finished a step \(step 1 of 4\)$/,
	);
	assert.ok(!JSON.stringify(mails[0]).includes('Injected'));
	assert.equal(mails[0].to[0], 'gabriel@example.com');
	assert.equal((await store.getById(db, c.id)).step, 1);
});

await t('progress via invite says so; remote mode has no [TEST]', async () => {
	stub();
	const c = await fresh({ mode: 'remote' });
	await progress(c.code, { action: 'done', step: 0 });
	await progress(c.code, { action: 'done', step: 1, via: 'invite' });
	assert.equal(mails.length, 2);
	assert.match(mails[1].subject, /^Onboarding: Test Bakery sent your invite \(step 2 of 4\)$/);
});

await t('progress in person mode sends no email', async () => {
	stub();
	const c = await fresh({ mode: 'person' });
	assert.equal((await progress(c.code, { action: 'done', step: 0 })).status, 200);
	assert.equal(mails.length, 0);
});

await t('undo and goto send no email and move the step back', async () => {
	stub();
	const c = await fresh({ mode: 'person' });
	await progress(c.code, { action: 'done', step: 0 });
	await progress(c.code, { action: 'done', step: 1 });
	assert.deepEqual(await (await progress(c.code, { action: 'goto', step: 0 })).json(), {
		step: 0,
		done: ['gh-signup', 'gh-org'],
	});
	assert.deepEqual(await (await progress(c.code, { action: 'undo', step: 1 })).json(), {
		step: 1,
		done: ['gh-signup'],
	});
	assert.equal(mails.length, 0);
});

await t('a refused move is 400, carries the true state, and writes nothing', async () => {
	const c = await fresh();
	const r = await progress(c.code, { action: 'done', step: 2 });
	assert.equal(r.status, 400);
	const body = await r.json();
	assert.equal(body.step, 0);
	assert.deepEqual(body.done, []);
	assert.equal((await store.getById(db, c.id)).updated_at, c.updated_at);
	assert.equal((await progress(c.code, { action: 'jump', step: 0 })).status, 400);
});

await t('finishing marks the client done; going back makes them active again', async () => {
	const c = await fresh({ tier: 1, mode: 'person' });
	await progress(c.code, { action: 'done', step: 0 });
	await progress(c.code, { action: 'done', step: 1 });
	assert.equal((await store.getById(db, c.id)).status, 'done');
	await progress(c.code, { action: 'goto', step: 1 });
	assert.equal((await store.getById(db, c.id)).status, 'active');
});

await t('an email failure or mail rate limit never undoes the step', async () => {
	stub({ resend: false });
	const c = await fresh();
	assert.equal((await progress(c.code, { action: 'done', step: 0 })).status, 200);
	allow = false;
	stub();
	assert.equal((await progress(c.code, { action: 'done', step: 1 })).status, 200);
	assert.equal(mails.length, 0);
	allow = true;
	assert.equal((await store.getById(db, c.id)).step, 2);
});

await t('progress rate limit is 429 and writes nothing', async () => {
	const c = await fresh();
	allowProgress = false;
	assert.equal((await progress(c.code, { action: 'done', step: 0 })).status, 429);
	allowProgress = true;
	assert.equal((await store.getById(db, c.id)).step, 0);
});

await t('the old ping route is gone', async () => {
	assert.equal((await call('/api/onboard/ping', { method: 'POST', json: {} })).status, 404);
});

console.log(`onboard worker: ${pass} passed`);
