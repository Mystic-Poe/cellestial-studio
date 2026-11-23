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
let bodies = [];
const stub = ({ turnstile = true, resend = true } = {}) => {
	calls = [];
	bodies = [];
	globalThis.fetch = async (url, init) => {
		const u = String(url);
		calls.push(u);
		if (u.includes('resend')) bodies.push(JSON.parse(init.body));
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
await t('star: a valid slot id is named in the email', async () => {
	stub();
	const r = await post(body({ star: 'slot-3' }));
	assert.equal(r.status, 200);
	assert.ok(bodies[0].text.endsWith('\n\nClaimed: open star 3'), bodies[0].text);
});
await t('star: an invalid value is ignored, not reflected', async () => {
	stub();
	const r = await post(body({ star: 'slot-3<img src=x>' }));
	assert.equal(r.status, 200);
	assert.ok(!bodies[0].text.includes('Claimed'));
	assert.ok(!bodies[0].text.includes('<img'));
});
await t('star: every star of the sky is named, 1 to 146', async () => {
	for (const n of [1, 9, 10, 99, 100, 120, 146]) {
		stub();
		const r = await post(body({ star: `slot-${n}` }));
		assert.equal(r.status, 200);
		assert.ok(
			bodies[0].text.endsWith(`\n\nClaimed: open star ${n}`),
			`slot-${n}: ${bodies[0].text}`,
		);
	}
});
await t('star: a number the sky does not have is ignored', async () => {
	for (const bad of ['slot-0', 'slot-147', 'slot-200', 'slot-1000', 'slot-01', 'slot-']) {
		stub();
		const r = await post(body({ star: bad }));
		assert.equal(r.status, 200);
		assert.ok(!bodies[0].text.includes('Claimed'), `${bad}: ${bodies[0].text}`);
	}
});
await t('star: absent field leaves the email unchanged', async () => {
	stub();
	await post();
	assert.equal(bodies[0].text, 'From: Ada <ada@example.com>\n\nNeed a site.');
});

// ── the shared sky: a claimed star is lit for every visitor ──
const fakeKV = ({ failPut = false } = {}) => {
	const items = new Map();
	return {
		items,
		get: async (k) => items.get(k) ?? null,
		put: async (k, v) => {
			if (failPut) throw new Error('KV is down');
			items.set(k, v);
		},
		delete: async (k) => {
			items.delete(k);
		},
		list: async ({ prefix }) => ({
			keys: [...items.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
		}),
	};
};
const get = (path, env) =>
	worker.fetch(
		new Request(`https://cellestialstudio.com${path}`, { headers: { accept: 'application/json' } }),
		env,
	);
const list = async (env) => (await (await get('/api/contact/stars.json', env)).json()).stars;
const linkIn = (text) =>
	text.match(/https:\/\/cellestialstudio\.com\/api\/contact\/star\?\S+/)?.[0];
const KEY = 'k-0123456789abcdef0123456789';

await t('shared sky: without the store nothing changes, and the list is empty', async () => {
	stub();
	const r = await get('/api/contact/stars.json', fullEnv);
	assert.equal(r.status, 200);
	assert.deepEqual(await r.json(), { stars: [] });
	const p = await post(body({ star: 'slot-3', 'claim-key': KEY }), { path: '/api/contact/place' });
	assert.equal(p.status, 503);
});
await t(
	'shared sky: a sent request lights its star for everyone, the text hidden until approved',
	async () => {
		stub();
		const env = { ...fullEnv, STARS: fakeKV() };
		const r = await post(body({ star: 'slot-120', message: 'A site for my bakery.' }), { env });
		assert.equal(r.status, 200);
		assert.deepEqual(await list(env), [{ slot: 'slot-120', ask: null }]);
		assert.ok(bodies[0].text.includes('Claimed: open star 120'));
		assert.ok(linkIn(bodies[0].text), 'the owner is given a link');
	},
);
await t('shared sky: nothing is lit by a request that was not sent', async () => {
	const env = { ...fullEnv, STARS: fakeKV() };
	stub({ turnstile: false });
	await post(body({ star: 'slot-5' }), { env });
	stub({ resend: false });
	await post(body({ star: 'slot-5' }), { env });
	await post(body({ star: null, 'claim-key': KEY }), { env });
	assert.deepEqual(await list(env), []);
	assert.equal(env.STARS.items.size, 0);
});
await t(
	'shared sky: the first claim of a star stands, and the owner is told of the second',
	async () => {
		const env = { ...fullEnv, STARS: fakeKV() };
		stub();
		await post(body({ star: 'slot-7', message: 'first' }), { env });
		stub();
		const r = await post(body({ star: 'slot-7', message: 'second' }), { env });
		assert.equal(r.status, 200, 'the second message is still delivered');
		assert.ok(bodies[0].text.includes('Another request lit this star first'));
		assert.ok(!linkIn(bodies[0].text));
		assert.equal(JSON.parse(env.STARS.items.get('star:slot-7')).ask, 'first');
	},
);
await t(
	'shared sky: the owner approves the text, hides it again, takes the star back',
	async () => {
		const env = { ...fullEnv, STARS: fakeKV() };
		stub();
		await post(body({ star: 'slot-9', message: 'A <b>shop</b> & more' }), { env });
		const link = linkIn(bodies[0].text).replace('https://cellestialstudio.com', '');
		const owner = (what) => {
			const f = new FormData();
			if (what) f.set('do', what);
			return worker.fetch(
				new Request(`https://cellestialstudio.com${link}`, what ? { method: 'POST', body: f } : {}),
				env,
			);
		};
		const seen = await owner();
		assert.equal(seen.status, 200);
		const html = await seen.text();
		assert.ok(
			html.includes('A &#60;b&#62;shop&#60;/b&#62; &#38; more'),
			'the ask is shown as text, not markup',
		);
		assert.deepEqual(
			await list(env),
			[{ slot: 'slot-9', ask: null }],
			'looking at the page approves nothing',
		);
		assert.equal((await owner('approve')).status, 200);
		assert.deepEqual(await list(env), [{ slot: 'slot-9', ask: 'A <b>shop</b> & more' }]);
		await owner('hide');
		assert.deepEqual(await list(env), [{ slot: 'slot-9', ask: null }]);
		await owner('remove');
		assert.deepEqual(await list(env), []);
		assert.equal((await owner()).status, 404, 'the link is spent with the star');
	},
);
await t('shared sky: a link that was not signed by this Worker does nothing', async () => {
	const env = { ...fullEnv, STARS: fakeKV() };
	stub();
	await post(body({ star: 'slot-9' }), { env });
	const link = linkIn(bodies[0].text).replace('https://cellestialstudio.com', '');
	for (const bad of [
		link.replace(/sig=\w{4}/, 'sig=0000'),
		link.replace('slot-9', 'slot-10'),
		'/api/contact/star?slot=slot-9',
	]) {
		const f = new FormData();
		f.set('do', 'approve');
		const r = await worker.fetch(
			new Request(`https://cellestialstudio.com${bad}`, { method: 'POST', body: f }),
			env,
		);
		assert.equal(r.status, 403, bad);
	}
	assert.deepEqual(await list(env), [{ slot: 'slot-9', ask: null }]);
});
await t(
	'shared sky: a request sent with no star takes the star its sender then chooses',
	async () => {
		const env = { ...fullEnv, STARS: fakeKV() };
		stub();
		await post(body({ star: null, 'claim-key': KEY, message: 'An app.' }), { env });
		assert.deepEqual(await list(env), [], 'nothing is lit yet');
		assert.ok(!bodies[0].text.includes('Claimed'));
		assert.ok(
			![...env.STARS.items.keys()].some((k) => k.includes(KEY)),
			'only the hash of the key is kept',
		);
		const place = (star, key = KEY) => {
			const f = new FormData();
			f.set('star', star);
			f.set('claim-key', key);
			return worker.fetch(
				new Request('https://cellestialstudio.com/api/contact/place', { method: 'POST', body: f }),
				env,
			);
		};
		stub();
		assert.equal(
			(await place('slot-40', 'another-key-0123456789abcdef')).status,
			404,
			'a key that sent nothing',
		);
		assert.equal((await place('slot-999')).status, 400);
		assert.equal((await place('slot-40')).status, 200);
		assert.deepEqual(await list(env), [{ slot: 'slot-40', ask: null }]);
		assert.ok(
			bodies[0].text.includes('Claimed: open star 40') && bodies[0].text.includes('An app.'),
		);
		assert.ok(linkIn(bodies[0].text));
		assert.equal((await place('slot-41')).status, 404, 'one request, one star');
	},
);
await t('shared sky: a star already lit cannot be taken by a waiting request', async () => {
	const env = { ...fullEnv, STARS: fakeKV() };
	stub();
	await post(body({ star: 'slot-12' }), { env });
	await post(body({ star: null, 'claim-key': KEY }), { env });
	const f = new FormData();
	f.set('star', 'slot-12');
	f.set('claim-key', KEY);
	const r = await worker.fetch(
		new Request('https://cellestialstudio.com/api/contact/place', { method: 'POST', body: f }),
		env,
	);
	assert.equal(r.status, 409);
	f.set('star', 'slot-13');
	const again = await worker.fetch(
		new Request('https://cellestialstudio.com/api/contact/place', { method: 'POST', body: f }),
		env,
	);
	assert.equal(again.status, 200, 'the request still waits, and takes another');
});
await t(
	'shared sky: every star has its own record, so the owner and a new claim never undo each other',
	async () => {
		const env = { ...fullEnv, STARS: fakeKV() };
		stub();
		await post(body({ star: 'slot-20', message: 'twenty' }), { env });
		const link = linkIn(bodies[0].text).replace('https://cellestialstudio.com', '');
		// The owner's page was opened (it read star 20), then another visitor claims star 21,
		// then the owner presses "approve": star 21 must still be there, and star 20 approved.
		stub();
		await post(body({ star: 'slot-21', message: 'twenty-one' }), { env });
		const f = new FormData();
		f.set('do', 'approve');
		await worker.fetch(
			new Request(`https://cellestialstudio.com${link}`, { method: 'POST', body: f }),
			env,
		);
		assert.deepEqual(
			(await list(env)).sort((a, b) => a.slot.localeCompare(b.slot)),
			[
				{ slot: 'slot-20', ask: 'twenty' },
				{ slot: 'slot-21', ask: null },
			],
		);
		assert.deepEqual([...env.STARS.items.keys()].sort(), ['star:slot-20', 'star:slot-21']);
	},
);
await t('shared sky: a store that fails never turns a sent message into a failure', async () => {
	const env = { ...fullEnv, STARS: fakeKV({ failPut: true }) };
	stub();
	const r = await post(body({ star: 'slot-3' }), { env });
	assert.equal(r.status, 200);
	assert.deepEqual(await r.json(), { ok: true });
});
globalThis.fetch = realFetch;
console.log(`\n${pass} checks passed`);
