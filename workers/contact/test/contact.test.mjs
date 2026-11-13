// Run: node workers/contact/test/contact.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;

const fullEnv = {
	TURNSTILE_SECRET_KEY: 'ts_secret',
	RESEND_API_KEY: 're_key',
	CONTACT_TO: 'hello@cellestialstudio.com',
	CONTACT_FROM: 'site@cellestialstudio.com',
};

const body = (over = {}) => {
	const f = new FormData();
	const fields = {
		name: 'Ada',
		email: 'ada@example.com',
		message: 'Need a site.',
		'cf-turnstile-response': 'tok',
		...over,
	};
	for (const [k, v] of Object.entries(fields)) if (v !== null) f.set(k, v);
	return f;
};
const post = (form = body(), { env = fullEnv, path = '/api/contact', method = 'POST' } = {}) =>
	worker.fetch(
		new Request(`https://cellestialstudio.com${path}`, {
			method,
			headers: { accept: 'application/json' },
			...(method === 'POST' ? { body: form } : {}),
		}),
		env,
	);

let pass = 0;
const t = async (name, fn) => {
	await fn();
	console.log('  ok  -', name);
	pass++;
};

const realFetch = globalThis.fetch;
let calls = [];
const stub = ({ turnstile = true, resend = true } = {}) => {
	calls = [];
	globalThis.fetch = async (url) => {
		const u = String(url);
		calls.push(u);
		if (u.includes('turnstile'))
			return new Response(JSON.stringify({ success: turnstile }), {
				headers: { 'content-type': 'application/json' },
			});
		if (u.includes('resend'))
			return resend ? new Response('{}', { status: 200 }) : new Response('{}', { status: 422 });
		return new Response('{}', { status: 500 });
	};
};

stub();
await t('happy path: verifies human, then sends, returns ok', async () => {
	const r = await post();
	assert.equal(r.status, 200);
	assert.deepEqual(await r.json(), { ok: true });
	assert.ok(calls[0].includes('turnstile'), 'turnstile must be first');
	assert.ok(calls[1].includes('resend'));
});
await t('spam check failure: never touches the mail quota', async () => {
	stub({ turnstile: false });
	const r = await post();
	assert.equal(r.status, 400);
	assert.equal(calls.filter((c) => c.includes('resend')).length, 0);
});
await t('missing turnstile token: no outbound calls at all', async () => {
	stub();
	const r = await post(body({ 'cf-turnstile-response': null }));
	assert.equal(r.status, 400);
	assert.deepEqual(calls, []);
});
await t('unconfigured env: 503, and nothing is contacted', async () => {
	stub();
	const r = await post(body(), { env: { TURNSTILE_SECRET_KEY: 'x' } });
	assert.equal(r.status, 503);
	assert.deepEqual(calls, []);
});
await t('empty fields rejected before any network call', async () => {
	stub();
	for (const over of [{ name: '' }, { email: '' }, { message: '' }]) {
		const r = await post(body(over));
		assert.equal(r.status, 400);
	}
	assert.deepEqual(calls, []);
});
await t('bad email rejected', async () => {
	stub();
	const r = await post(body({ email: 'not-an-email' }));
	assert.equal(r.status, 400);
	assert.deepEqual(calls, []);
});
await t('over-long message rejected', async () => {
	stub();
	const r = await post(body({ message: 'x'.repeat(5001) }));
	assert.equal(r.status, 400);
	assert.deepEqual(calls, []);
});
await t('resend failure is reported, not swallowed as success', async () => {
	stub({ resend: false });
	const r = await post();
	assert.equal(r.status, 502);
	assert.ok((await r.json()).error);
});
await t('reply_to is the sender so replies reach them', async () => {
	let payload;
	globalThis.fetch = async (url, init) => {
		if (String(url).includes('turnstile'))
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'content-type': 'application/json' },
			});
		payload = JSON.parse(init.body);
		return new Response('{}');
	};
	await post();
	assert.equal(payload.reply_to, 'ada@example.com');
	assert.deepEqual(payload.to, ['hello@cellestialstudio.com']);
	assert.ok(payload.text.includes('Need a site.'));
});
await t('GET is 405, other paths 404', async () => {
	stub();
	assert.equal((await post(undefined, { method: 'GET' })).status, 405);
	assert.equal((await post(body(), { path: '/' })).status, 404);
});
await t('no-JS submit gets HTML, not JSON', async () => {
	stub();
	const r = await worker.fetch(
		new Request('https://cellestialstudio.com/api/contact', { method: 'POST', body: body() }),
		fullEnv,
	);
	assert.equal(r.status, 200);
	assert.ok((r.headers.get('content-type') ?? '').includes('text/html'));
	assert.ok((await r.text()).includes('Message sent'));
});
await t('error text is escaped into the HTML response', async () => {
	stub();
	const r = await worker.fetch(
		new Request('https://cellestialstudio.com/api/contact', {
			method: 'POST',
			body: body({ email: '<script>' }),
		}),
		fullEnv,
	);
	const html = await r.text();
	assert.ok(!html.includes('<script>'));
});
globalThis.fetch = realFetch;
console.log(`\n${pass} checks passed`);
