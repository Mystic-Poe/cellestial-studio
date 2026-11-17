// Run: node workers/onboard/test/onboard.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;

let allow = true;
const fullEnv = {
	INVITE_SALT: 'salt',
	CF_USER_TOKEN: 'cf_tok',
	GH_TOKEN: 'gh_tok',
	RESEND_API_KEY: 're_key',
	NOTIFY_TO: 'gabriel@example.com',
	NOTIFY_FROM: 'site@cellestialstudio.com',
	RATE: { limit: async () => ({ success: allow }) },
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

const ping = { client: 'Enowood Carpentry', step: 2, mode: 'test', event: 'invite' };

await t('ping: test mode sends a [TEST] email to Gabriel', async () => {
	stub();
	const r = await call('/api/onboard/ping', { method: 'POST', json: ping });
	assert.equal(r.status, 200);
	assert.equal(mails.length, 1);
	assert.match(mails[0].subject, /^\[TEST\] /);
	assert.match(mails[0].subject, /Enowood Carpentry/);
	assert.deepEqual(mails[0].to, ['gabriel@example.com']);
});

await t('ping: remote mode has no [TEST] prefix', async () => {
	stub();
	await call('/api/onboard/ping', { method: 'POST', json: { ...ping, mode: 'remote' } });
	assert.ok(!mails[0].subject.startsWith('[TEST]'));
});

await t('ping: rejects bad shape without sending', async () => {
	stub();
	for (const bad of [
		{ ...ping, step: 9 },
		{ ...ping, mode: 'person' },
		{ ...ping, event: 'x' },
		{ ...ping, client: '' },
		{ ...ping, client: 'x'.repeat(61) },
	]) {
		assert.equal((await call('/api/onboard/ping', { method: 'POST', json: bad })).status, 400);
	}
	assert.equal(mails.length, 0);
});

await t('ping: strips odd characters from the client name', async () => {
	stub();
	await call('/api/onboard/ping', {
		method: 'POST',
		json: { ...ping, client: 'Bob <script>\nBcc: x' },
	});
	assert.ok(!/[<>\n]/.test(mails[0].subject));
});

await t('ping: 503 when mail is not configured', async () => {
	stub();
	const r = await call('/api/onboard/ping', {
		method: 'POST',
		json: ping,
		env: { ...fullEnv, RESEND_API_KEY: undefined },
	});
	assert.equal(r.status, 503);
});

await t('ping: 429 when rate-limited, no email', async () => {
	stub();
	allow = false;
	const r = await call('/api/onboard/ping', { method: 'POST', json: ping });
	allow = true;
	assert.equal(r.status, 429);
	assert.equal(mails.length, 0);
});

await t('ping: 502 when Resend fails', async () => {
	stub({ resend: false });
	assert.equal((await call('/api/onboard/ping', { method: 'POST', json: ping })).status, 502);
});

await t('ping: GET is refused', async () => {
	assert.equal((await call('/api/onboard/ping')).status, 405);
});

console.log(`onboard worker: ${pass} passed`);
