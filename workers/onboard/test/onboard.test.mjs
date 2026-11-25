// The client's routes. Run: node workers/onboard/test/onboard.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeD1 } from './fake-d1.mjs';
import { fakeR2 } from './fake-r2.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;
const store = await import(resolve(here, '../src/store.ts'));

let allowMail = true;
let allowClient = true;
let allowRead = true;
let db;
let bucket;
let mails = [];
let mailOk = true;
globalThis.fetch = async (url, init = {}) => {
	if (String(url).includes('api.resend.com')) {
		mails.push(JSON.parse(init.body));
		return new Response('{}', { status: mailOk ? 200 : 500 });
	}
	return new Response('{}', { status: 500 });
};

const env = () => ({
	RESEND_API_KEY: 're_key',
	NOTIFY_TO: 'gabriel@example.com',
	NOTIFY_FROM: 'site@cellestialstudio.com',
	RATE: { limit: async () => ({ success: allowMail }) },
	RATE_CLIENT: { limit: async () => ({ success: allowClient }) },
	RATE_READ: { limit: async () => ({ success: allowRead }) },
	DB: db,
	PHOTOS: bucket,
});

const call = async (path, { method = 'GET', json, form, e = env() } = {}) => {
	const init = { method, headers: { 'cf-connecting-ip': '1.2.3.4' } };
	if (json !== undefined) {
		init.headers['content-type'] = 'application/json';
		init.body = JSON.stringify(json);
	}
	if (form) {
		const f = new FormData();
		for (const [k, v] of Object.entries(form)) f.append(k, v);
		init.body = f;
	}
	const r = await worker.fetch(
		new Request(`https://cellestialstudio.com/api/onboard${path}`, init),
		e,
		{
			waitUntil() {},
		},
	);
	const type = r.headers.get('content-type') ?? '';
	return {
		status: r.status,
		headers: r.headers,
		body: type.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer()),
	};
};

let pass = 0;
const t = async (name, fn) => {
	db = fakeD1();
	bucket = fakeR2();
	mails = [];
	allowMail = allowClient = allowRead = mailOk = true;
	await fn();
	console.log('  ok  -', name);
	pass++;
};

const make = async (over = {}) => {
	const c = await store.createClient(db, {
		name: 'Test Bakery',
		email: 'owner@example.com',
		mode: 'test',
	});
	return Object.keys(over).length ? store.updateClient(db, c.id, over) : c;
};
const jpeg = (n = 10, name = 'shop.jpg') =>
	new File([new Uint8Array(n).fill(7)], name, { type: 'image/jpeg' });
const intake = { about: 'We bake bread.', pages: ['Services', 'Gallery'], likes: ['example.com'] };

await t('GET shows their page and nothing private', async () => {
	const c = await make({ notes: 'secret note', checklist: { paid: true } });
	await store.addReview(db, { client_id: c.id, verdict: 'changes', text: 'old' });
	const r = await call(`/client/${c.code}`);
	assert.equal(r.status, 200);
	assert.deepEqual(Object.keys(r.body).sort(), [
		'answered',
		'editable',
		'intake',
		'live_url',
		'name',
		'photos',
		'preview_url',
		'sent',
		'stage',
	]);
	assert.equal(r.body.stage, 'intake');
	assert.equal(r.body.sent, false);
	assert.equal(r.body.editable, true);
	assert.doesNotMatch(JSON.stringify(r.body), /secret note|owner@example.com|old/);
});

await t('unknown, malformed, archived and rotated codes are 404', async () => {
	const c = await make();
	assert.equal((await call('/client/short')).status, 404);
	assert.equal((await call(`/client/${'x'.repeat(43)}`)).status, 404);
	await store.updateClient(db, c.id, { status: 'archived' });
	assert.equal((await call(`/client/${c.code}`)).status, 404);
	const d = await make();
	await store.rotateCode(db, d.id);
	assert.equal((await call(`/client/${d.code}`)).status, 404);
});

await t('preview and live addresses only show from review / live', async () => {
	const c = await make({
		preview_url: 'https://preview.example/',
		live_url: 'https://example.com/',
	});
	assert.equal((await call(`/client/${c.code}`)).body.preview_url, '');
	await store.updateClient(db, c.id, { stage: 'review' });
	const r = (await call(`/client/${c.code}`)).body;
	assert.equal(r.preview_url, 'https://preview.example/');
	assert.equal(r.live_url, '');
	await store.updateClient(db, c.id, { stage: 'live' });
	assert.equal((await call(`/client/${c.code}`)).body.live_url, 'https://example.com/');
});

await t('intake draft saves without sending or emailing', async () => {
	const c = await make();
	const r = await call(`/client/${c.code}/intake`, {
		method: 'PUT',
		json: { intake: { area: 'Springfield' } },
	});
	assert.equal(r.status, 200);
	assert.equal(r.body.intake.area, 'Springfield');
	assert.equal(r.body.sent, false);
	assert.equal(mails.length, 0);
});

await t('send needs a few words about the business', async () => {
	const c = await make();
	const r = await call(`/client/${c.code}/intake`, {
		method: 'PUT',
		json: { intake: {}, send: true },
	});
	assert.equal(r.status, 400);
	assert.equal(r.body.field, 'about');
	assert.equal((await store.getById(db, c.id)).intake_at, null);
});

await t('first send marks it sent by the client and emails once', async () => {
	const c = await make();
	const r = await call(`/client/${c.code}/intake`, { method: 'PUT', json: { intake, send: true } });
	assert.equal(r.status, 200);
	assert.equal(r.body.sent, true);
	assert.deepEqual(r.body.intake.likes, ['https://example.com']);
	const row = await store.getById(db, c.id);
	assert.equal(row.intake_by, 'client');
	assert.ok(row.intake_at);
	assert.equal(mails.length, 1);
	assert.equal(mails[0].subject, '[TEST] Onboarding: Test Bakery sent their answers');
	assert.match(mails[0].text, new RegExp(`/dashboard/#c/${c.id}`));
	await call(`/client/${c.code}/intake`, {
		method: 'PUT',
		json: { intake: { ...intake, area: 'X' }, send: true },
	});
	assert.equal(mails.length, 1);
});

await t('a bad field names itself and saves nothing', async () => {
	const c = await make();
	const r = await call(`/client/${c.code}/intake`, {
		method: 'PUT',
		json: { intake: { about: 'ok', likes: ['javascript:alert(1)'] } },
	});
	assert.equal(r.status, 400);
	assert.equal(r.body.field, 'likes');
	assert.equal((await store.getById(db, c.id)).intake.about, '');
});

await t('answers and photos lock once building starts', async () => {
	const c = await make({ stage: 'building' });
	assert.equal((await call(`/client/${c.code}`)).body.editable, false);
	assert.equal(
		(await call(`/client/${c.code}/intake`, { method: 'PUT', json: { intake } })).status,
		409,
	);
	assert.equal(
		(await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: jpeg() } })).status,
		409,
	);
});

await t('photo upload stores file and thumbnail; client sees only its own uploads', async () => {
	const c = await make();
	const r = await call(`/client/${c.code}/photos`, {
		method: 'POST',
		form: { file: jpeg(20), thumb: jpeg(5, 't.jpg') },
	});
	assert.equal(r.status, 201);
	assert.deepEqual(Object.keys(r.body).sort(), ['id', 'name']);
	assert.equal(bucket.objects.get(`c/${c.id}/${r.body.id}`).bytes.length, 20);
	assert.equal(bucket.objects.get(`c/${c.id}/${r.body.id}.thumb`).bytes.length, 5);
	const studio = await store.addPhoto(db, {
		id: store.newId(),
		client_id: c.id,
		kind: 'original',
		of: null,
		source: 'studio',
		name: 'studio.jpg',
		type: 'image/jpeg',
		size: 1,
		has_thumb: false,
	});
	const view = (await call(`/client/${c.code}`)).body;
	assert.deepEqual(
		view.photos.map((p) => p.id),
		[r.body.id],
	);
	const thumb = await call(`/client/${c.code}/photos/${r.body.id}`);
	assert.equal(thumb.status, 200);
	assert.equal(thumb.body.length, 5);
	assert.equal(thumb.headers.get('x-content-type-options'), 'nosniff');
	assert.equal((await call(`/client/${c.code}/photos/${studio.id}`)).status, 404);
});

await t('another client’s photo is never reachable', async () => {
	const a = await make();
	const b = await make();
	const up = await call(`/client/${a.code}/photos`, { method: 'POST', form: { file: jpeg() } });
	assert.equal((await call(`/client/${b.code}/photos/${up.body.id}`)).status, 404);
	assert.equal(
		(await call(`/client/${b.code}/photos/${up.body.id}`, { method: 'DELETE' })).status,
		404,
	);
});

await t('upload refuses non-photos and stops at 25', async () => {
	const c = await make();
	const txt = new File(['hi'], 'a.txt', { type: 'text/plain' });
	assert.equal(
		(await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: txt } })).status,
		415,
	);
	for (let i = 0; i < 25; i++)
		assert.equal(
			(await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: jpeg() } })).status,
			201,
		);
	const r = await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: jpeg() } });
	assert.equal(r.status, 409);
	assert.match(r.body.error, /25/);
});

await t('photos after sending email Gabriel, at most once per 15 minutes', async () => {
	const c = await make();
	await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: jpeg() } });
	assert.equal(mails.length, 0, 'before sending: no email');
	await call(`/client/${c.code}/intake`, { method: 'PUT', json: { intake, send: true } });
	mails = [];
	await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: jpeg() } });
	await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: jpeg() } });
	assert.deepEqual(
		mails.map((m) => m.subject),
		['[TEST] Onboarding: Test Bakery added photos'],
	);
	await store.updateClient(db, c.id, { photo_mail_at: Date.now() - 16 * 60_000 });
	await call(`/client/${c.code}/photos`, { method: 'POST', form: { file: jpeg() } });
	assert.equal(mails.length, 2);
});

await t('client can remove its own upload while editable', async () => {
	const c = await make();
	const up = await call(`/client/${c.code}/photos`, {
		method: 'POST',
		form: { file: jpeg(), thumb: jpeg(2) },
	});
	assert.equal(
		(await call(`/client/${c.code}/photos/${up.body.id}`, { method: 'DELETE' })).status,
		200,
	);
	assert.equal(bucket.objects.size, 0);
	assert.deepEqual((await call(`/client/${c.code}`)).body.photos, []);
});

await t('review: only at review; changes need words; each answer emails', async () => {
	const c = await make();
	assert.equal(
		(await call(`/client/${c.code}/review`, { method: 'POST', json: { verdict: 'ok' } })).status,
		409,
	);
	await store.updateClient(db, c.id, { stage: 'review', stage_at: Date.now() - 1000 });
	const empty = await call(`/client/${c.code}/review`, {
		method: 'POST',
		json: { verdict: 'changes', text: ' ' },
	});
	assert.equal(empty.status, 400);
	const r = await call(`/client/${c.code}/review`, {
		method: 'POST',
		json: { verdict: 'changes', text: 'Bigger logo <b>please</b>' },
	});
	assert.equal(r.status, 200);
	assert.equal(r.body.answered, 'changes');
	assert.equal(mails[0].subject, '[TEST] Onboarding: Test Bakery asked for changes');
	assert.match(mails[0].text, /Bigger logo <b>please<\/b>/);
	assert.equal(mails[0].html, undefined);
	await call(`/client/${c.code}/review`, { method: 'POST', json: { verdict: 'ok' } });
	assert.equal(mails[1].subject, '[TEST] Onboarding: Test Bakery approved their site');
});

await t('a new review round clears the old answer', async () => {
	const c = await make({ stage: 'review', stage_at: 1 });
	await call(`/client/${c.code}/review`, {
		method: 'POST',
		json: { verdict: 'changes', text: 'x' },
	});
	await store.updateClient(db, c.id, { stage: 'review', stage_at: Date.now() + 1000 });
	assert.equal((await call(`/client/${c.code}`)).body.answered, null);
});

await t('live mode emails have no [TEST]; mail failure or limit never undoes a save', async () => {
	const c = await make({ mode: 'live' });
	mailOk = false;
	const r = await call(`/client/${c.code}/intake`, { method: 'PUT', json: { intake, send: true } });
	assert.equal(r.status, 200);
	assert.equal(mails[0].subject, 'Onboarding: Test Bakery sent their answers');
	const d = await make();
	allowMail = false;
	mails = [];
	assert.equal(
		(await call(`/client/${d.code}/intake`, { method: 'PUT', json: { intake, send: true } }))
			.status,
		200,
	);
	assert.equal(mails.length, 0);
	assert.ok((await store.getById(db, d.id)).intake_at);
});

await t('write rate limit is 429 and writes nothing', async () => {
	const c = await make();
	allowClient = false;
	assert.equal(
		(await call(`/client/${c.code}/intake`, { method: 'PUT', json: { intake } })).status,
		429,
	);
	assert.equal((await store.getById(db, c.id)).intake.about, '');
	assert.equal((await call(`/client/${c.code}`)).status, 200, 'reading is never limited');
});

await t('photos answer 503 until storage is set up', async () => {
	const c = await make();
	const r = await call(`/client/${c.code}/photos`, {
		method: 'POST',
		form: { file: jpeg() },
		e: { ...env(), PHOTOS: undefined },
	});
	assert.equal(r.status, 503);
});

await t('old routes are gone; other paths 404', async () => {
	assert.equal((await call('/invites')).status, 404);
	const c = await make();
	assert.equal(
		(await call(`/client/${c.code}/progress`, { method: 'POST', json: {} })).status,
		404,
	);
	assert.equal((await call('/nope')).status, 404);
});

const q = await import(resolve(here, '../src/quota.ts'));
const upload = (c, file = jpeg()) =>
	call(`/client/${c.code}/photos`, { method: 'POST', form: { file } });

await t('a full store refuses uploads, keeps nothing, and tells Gabriel once a day', async () => {
	const c = await make();
	await db
		.prepare(
			`INSERT INTO photos (id, client_id, kind, source, name, type, size, has_thumb, created_at)
			 VALUES ('big', ?, 'original', 'studio', 'big.jpg', 'image/jpeg', ?, 0, 0)`,
		)
		.bind(c.id, q.STORAGE_CAP - 5)
		.run();
	const r = await upload(c);
	assert.equal(r.status, 409);
	assert.equal(r.body.error, q.FULL_MESSAGE);
	await upload(c);
	assert.equal(bucket.objects.size, 0, 'nothing written to R2');
	assert.deepEqual(
		mails.map((m) => m.subject),
		['Onboarding: photo storage is full'],
	);
	assert.match(mails[0].text, /8 GB/);
});

await t('past 1,500 uploads today, uploads are refused until tomorrow', async () => {
	const c = await make();
	const day = new Date().toISOString().slice(0, 10);
	await db.prepare('INSERT INTO usage (day, uploads) VALUES (?, 1500)').bind(day).run();
	const r = await upload(c);
	assert.equal(r.status, 409);
	assert.equal(r.body.error, q.BUSY_MESSAGE);
	assert.equal(bucket.objects.size, 0);
	assert.deepEqual(mails, []);
});

await t('uploads count toward the day and the store, thumbnails included', async () => {
	const c = await make();
	await call(`/client/${c.code}/photos`, {
		method: 'POST',
		form: { file: jpeg(40), thumb: jpeg(7, 'thumb.jpg') },
	});
	assert.equal(await q.uploadsToday(db), 1);
	assert.equal(await q.storageUsed(db), 47);
});

await t('photo views have their own per-link limit', async () => {
	const c = await make();
	const up = await upload(c);
	allowRead = false;
	assert.equal((await call(`/client/${c.code}/photos/${up.body.id}`)).status, 429);
	allowRead = true;
	allowClient = false;
	assert.equal(
		(await call(`/client/${c.code}/photos/${up.body.id}`)).status,
		200,
		'writes limit is separate',
	);
});

await t('a repeat view comes from the edge cache, not R2; deleting drops it', async () => {
	const stored = new Map();
	globalThis.caches = {
		default: {
			async match(k) {
				const v = stored.get(k);
				return v ? new Response(v.bytes, { headers: v.headers }) : undefined;
			},
			async put(k, res) {
				stored.set(k, { bytes: new Uint8Array(await res.arrayBuffer()), headers: res.headers });
			},
			async delete(k) {
				return stored.delete(k);
			},
		},
	};
	const pending = [];
	const e = env();
	const ctxCall = async (path, init = {}) => {
		const r = await worker.fetch(
			new Request(`https://cellestialstudio.com/api/onboard${path}`, init),
			e,
			{ waitUntil: (p) => pending.push(p) },
		);
		await Promise.all(pending.splice(0));
		return r;
	};
	try {
		const c = await make();
		const up = await upload(c, jpeg(30));
		let reads = 0;
		const get = bucket.get.bind(bucket);
		bucket.get = async (k) => {
			reads++;
			return get(k);
		};
		const a = await ctxCall(`/client/${c.code}/photos/${up.body.id}`);
		assert.equal((await a.arrayBuffer()).byteLength, 30);
		const b = await ctxCall(`/client/${c.code}/photos/${up.body.id}`);
		assert.equal((await b.arrayBuffer()).byteLength, 30);
		assert.equal(b.headers.get('cache-control'), 'private, max-age=3600');
		assert.equal(reads, 1, 'second view never reached R2');
		await ctxCall(`/client/${c.code}/photos/${up.body.id}`, { method: 'DELETE' });
		assert.equal(stored.size, 0);
		assert.equal((await ctxCall(`/client/${c.code}/photos/${up.body.id}`)).status, 404);
	} finally {
		delete globalThis.caches;
	}
});

console.log(`onboard client: ${pass} passed`);
