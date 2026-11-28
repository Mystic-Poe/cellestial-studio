// Run: node workers/survey/test/survey.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;

const fullEnv = {
	TURNSTILE_SECRET_KEY: 'ts_secret',
	RESEND_API_KEY: 're_key',
	SURVEY_TO: 'cellestial.studio@gmail.com',
	SURVEY_FROM: 'contact@cellestialstudio.com',
};

const answers = {
	business: 'Ada Bakery',
	doing: 'Mostly',
	harder: 'nothing',
	tell: 'Go for it.',
	better: "Can't think of anything",
};
const body = (over = {}) => {
	const f = new FormData();
	for (const [k, v] of Object.entries({ ...answers, 'cf-turnstile-response': 'tok', ...over }))
		if (v !== null) f.set(k, v);
	return f;
};
const post = (
	form = body(),
	{ env = fullEnv, path = '/api/survey', method = 'POST', json = true } = {},
) =>
	worker.fetch(
		new Request(`https://cellestialstudio.com${path}`, {
			method,
			headers: json ? { accept: 'application/json' } : {},
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

let calls = [];
let mails = [];
const stub = ({ turnstile = true, resend = true, resendThrows = false } = {}) => {
	calls = [];
	mails = [];
	globalThis.fetch = async (url, init) => {
		const u = String(url);
		calls.push(u);
		if (u.includes('turnstile')) return Response.json({ success: turnstile });
		if (u.includes('resend')) {
			if (resendThrows) throw new Error('network');
			mails.push(JSON.parse(init.body));
			return new Response('{}', { status: resend ? 200 : 422 });
		}
		throw new Error(`unexpected fetch ${u}`);
	};
};

console.log('survey worker');

await t('a full survey is sent, subject and every answer in plain text', async () => {
	stub();
	const r = await post();
	assert.equal(r.status, 200);
	assert.deepEqual(await r.json(), { ok: true });
	assert.equal(mails.length, 1);
	const m = mails[0];
	assert.equal(m.subject, 'Survey: Ada Bakery');
	assert.deepEqual(m.to, ['cellestial.studio@gmail.com']);
	assert.equal(m.from, 'contact@cellestialstudio.com');
	for (const line of [
		'Your business name\nAda Bakery',
		'Is the site doing its job?\nMostly',
		'What, if anything, has it made harder instead of easier?\nnothing',
		"What would you tell another owner who's thinking about getting a site from me?\nGo for it.",
		"What should I do better next time?\nCan't think of anything",
	])
		assert.ok(m.text.includes(line), line);
});

await t('Turnstile is checked before Resend', async () => {
	stub();
	await post();
	assert.ok(calls[0].includes('turnstile'));
	assert.ok(calls[1].includes('resend'));
});

for (const field of Object.keys(answers)) {
	await t(`every field is required: ${field}`, async () => {
		stub();
		const r = await post(body({ [field]: '   ' }));
		assert.equal(r.status, 400);
		assert.equal(calls.length, 0);
	});
}

await t('only Yes / Mostly / Not yet', async () => {
	stub();
	const r = await post(body({ doing: 'Sure' }));
	assert.equal(r.status, 400);
	assert.equal(calls.length, 0);
});

await t('a failed spam check sends nothing', async () => {
	stub({ turnstile: false });
	const r = await post();
	assert.equal(r.status, 400);
	assert.equal(mails.length, 0);
});

await t('a missing token sends nothing and never calls Turnstile', async () => {
	stub();
	const r = await post(body({ 'cf-turnstile-response': null }));
	assert.equal(r.status, 400);
	assert.equal(calls.length, 0);
});

await t('not configured: 503, never a false success', async () => {
	stub();
	const r = await post(body(), { env: { ...fullEnv, RESEND_API_KEY: undefined } });
	assert.equal(r.status, 503);
	assert.equal(calls.length, 0);
});

await t('Resend refuses: 502 and says the answers are still there', async () => {
	stub({ resend: false });
	const r = await post();
	assert.equal(r.status, 502);
	assert.match((await r.json()).error, /still here/);
});

await t('Resend unreachable: 502, not a crash', async () => {
	stub({ resendThrows: true });
	const r = await post();
	assert.equal(r.status, 502);
});

await t('a line break in the name cannot reach the subject', async () => {
	stub();
	await post(body({ business: 'Ada\r\nBcc: x@example.com' }));
	assert.equal(mails[0].subject, 'Survey: Ada Bcc: x@example.com');
});

await t('too long is refused', async () => {
	stub();
	const r = await post(body({ tell: 'x'.repeat(5001) }));
	assert.equal(r.status, 400);
});

await t('GET is refused; other paths 404', async () => {
	stub();
	assert.equal((await post(undefined, { method: 'GET' })).status, 405);
	assert.equal((await post(undefined, { path: '/api/survey/x' })).status, 404);
});

await t('no-JS submit gets a noindex HTML page', async () => {
	stub();
	const r = await post(body(), { json: false });
	assert.match(r.headers.get('content-type'), /text\/html/);
	const html = await r.text();
	assert.match(html, /noindex/);
	assert.match(html, /Thank you/);
});

console.log(`${pass} passed`);
