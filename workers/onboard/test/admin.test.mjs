// Gabriel's routes. Run: node workers/onboard/test/admin.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUD, accessToken, certs, TEAM } from './access-token.mjs';
import { fakeD1 } from './fake-d1.mjs';
import { fakeR2 } from './fake-r2.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const worker = (await import(resolve(here, '../src/index.ts'))).default;

globalThis.fetch = async (url) => {
	if (String(url).endsWith('/cdn-cgi/access/certs')) return Response.json(certs);
	return new Response('{}', { status: 500 });
};

const ORIGIN = 'https://cellestialstudio.com';
let db;
let bucket;
const env = () => ({ ACCESS_TEAM: TEAM, ACCESS_AUD: AUD, DB: db, PHOTOS: bucket });
const good = await accessToken();

const call = async (
	path,
	{ method = 'GET', json, form, token = good, e = env(), headers = {} } = {},
) => {
	const h = { ...headers };
	if (token) h['cf-access-jwt-assertion'] = token;
	let body;
	if (form) {
		body = new FormData();
		for (const [k, v] of Object.entries(form)) body.append(k, v);
		h.origin ??= ORIGIN;
		h['sec-fetch-site'] ??= 'same-origin';
	} else if (method !== 'GET') {
		h['content-type'] = 'application/json';
		if (json !== undefined) body = JSON.stringify(json);
	}
	const r = await worker.fetch(
		new Request(`${ORIGIN}/api/onboard/admin${path}`, { method, headers: h, body }),
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
	await fn();
	console.log('  ok  -', name);
	pass++;
};

const create = async (over = {}) =>
	(
		await call('/clients', {
			method: 'POST',
			json: { name: 'Test Bakery', email: 'owner@example.com', ...over },
		})
	).body;
const jpeg = (n = 10, name = 'shop.jpg', fill = 7) =>
	new File([new Uint8Array(n).fill(fill)], name, { type: 'image/jpeg' });
const upload = (id, form) => call(`/clients/${id}/photos`, { method: 'POST', form });

await t('every admin route is 503 without the Access settings, even with a token', async () => {
	for (const [path, method] of [
		['/clients', 'GET'],
		['/clients', 'POST'],
		['/clients/x', 'PATCH'],
		['/clients/x/photos.zip', 'GET'],
	]) {
		const r = await call(path, { method, json: {}, e: { DB: db, PHOTOS: bucket } });
		assert.equal(r.status, 503, `${method} ${path}`);
	}
});

await t('every admin route is 401 without a valid token', async () => {
	const expired = await accessToken({ exp: Math.floor(Date.now() / 1000) - 5 });
	for (const token of [null, 'junk', expired]) {
		assert.equal((await call('/clients', { token })).status, 401);
		assert.equal((await call('/clients/x/photos/y', { token })).status, 401);
	}
});

await t('create: name and email; live by default; link; empty photos and reviews', async () => {
	const c = await create();
	assert.equal(c.mode, 'live');
	assert.equal(c.stage, 'intake');
	assert.equal(c.link, `${ORIGIN}/start/#${c.code}`);
	assert.deepEqual(c.photos, []);
	assert.deepEqual(c.reviews, []);
	assert.equal((await create({ mode: 'test' })).mode, 'test');
});

await t('create refuses bad fields and names the field', async () => {
	for (const [k, v] of [
		['name', ''],
		['name', 'x'.repeat(81)],
		['email', 'not-an-email'],
		['mode', 'admin'],
	]) {
		const r = await call('/clients', {
			method: 'POST',
			json: { name: 'A', email: 'a@example.com', [k]: v },
		});
		assert.equal(r.status, 400, k);
		assert.equal(r.body.field, k);
	}
	assert.equal(
		(await call('/clients', { method: 'POST', json: { email: 'a@example.com' } })).body.field,
		'name',
	);
});

await t('list: active and archived, with photo counts', async () => {
	const a = await create();
	const b = await create({ name: 'Other' });
	await call(`/clients/${b.id}`, { method: 'PATCH', json: { status: 'archived' } });
	await upload(a.id, { file: jpeg() });
	const active = (await call('/clients')).body.clients;
	assert.deepEqual(
		active.map((c) => c.id),
		[a.id],
	);
	assert.equal(active[0].photo_count, 1);
	assert.equal(active[0].to_finish, 1);
	assert.ok(active[0].link);
	assert.deepEqual(
		(await call('/clients?status=archived')).body.clients.map((c) => c.id),
		[b.id],
	);
});

await t('patch: stage moves stamp the time; addresses must be https', async () => {
	const c = await create();
	const r = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { stage: 'review', preview_url: 'preview.example.com/x' },
	});
	assert.equal(r.status, 200);
	assert.equal(r.body.stage, 'review');
	assert.ok(r.body.stage_at > 0);
	assert.equal(r.body.preview_url, 'https://preview.example.com/x');
	for (const [k, v] of [
		['stage', 'done'],
		['live_url', 'http://example.com'],
		['live_url', 'javascript:alert(1)'],
	]) {
		const bad = await call(`/clients/${c.id}`, { method: 'PATCH', json: { [k]: v } });
		assert.equal(bad.status, 400, `${k}=${v}`);
		assert.equal(bad.body.field, k);
	}
	const again = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { stage: 'review', notes: 'n' },
	});
	assert.equal(again.body.stage_at, r.body.stage_at, 'same stage keeps its time');
});

await t('patch: intake filled in person counts as sent, by the studio', async () => {
	const c = await create();
	const r = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { intake: { about: 'Bread', likes: ['example.com'] } },
	});
	assert.equal(r.body.intake.about, 'Bread');
	assert.equal(r.body.intake_by, 'studio');
	assert.ok(r.body.intake_at);
	const bad = await call(`/clients/${c.id}`, { method: 'PATCH', json: { intake: { likes: 'x' } } });
	assert.equal(bad.body.field, 'likes');
});

await t('patch: checklist merges; notes save; the link stays the same', async () => {
	const c = await create();
	await call(`/clients/${c.id}`, { method: 'PATCH', json: { checklist: { domain: true } } });
	const r = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { checklist: { paid: true }, notes: 'Call Tue' },
	});
	assert.equal(r.body.checklist.domain, true);
	assert.equal(r.body.checklist.paid, true);
	assert.equal(r.body.notes, 'Call Tue');
	assert.equal(r.body.code, c.code);
	const bad = await call(`/clients/${c.id}`, {
		method: 'PATCH',
		json: { checklist: { paid: 'yes' } },
	});
	assert.equal(bad.body.field, 'checklist');
});

await t('rotate gives a new link and the old one stops working', async () => {
	const c = await create();
	const r = await call(`/clients/${c.id}/rotate`, { method: 'POST', json: {} });
	assert.notEqual(r.body.code, c.code);
	const old = await worker.fetch(new Request(`${ORIGIN}/api/onboard/client/${c.code}`), env(), {
		waitUntil() {},
	});
	assert.equal(old.status, 404);
});

await t('photos: original keeps full size; finished replaces per original', async () => {
	const c = await create();
	const o = await upload(c.id, {
		file: jpeg(50, 'IMG_1.jpg'),
		thumb: jpeg(5, 't.jpg', 1),
		kind: 'original',
	});
	assert.equal(o.status, 201);
	assert.equal(o.body.kind, 'original');
	assert.equal(o.body.source, 'studio');
	assert.equal(bucket.objects.get(`c/${c.id}/${o.body.id}`).bytes.length, 50);
	const f1 = await upload(c.id, { file: jpeg(40, 'edit.jpg'), kind: 'finished', of: o.body.id });
	assert.equal(f1.body.of, o.body.id);
	const f2 = await upload(c.id, { file: jpeg(41, 'edit2.jpg'), kind: 'finished', of: o.body.id });
	const photos = (await call(`/clients/${c.id}`)).body.photos;
	assert.deepEqual(photos.map((p) => p.id).sort(), [o.body.id, f2.body.id].sort());
	assert.equal(bucket.objects.has(`c/${c.id}/${f1.body.id}`), false, 'old finished file removed');
	const list = (await call('/clients')).body.clients[0];
	assert.equal(list.to_finish, 0);
});

await t('photos: finished must point at an original of the same client', async () => {
	const c = await create();
	const d = await create({ name: 'Other' });
	const o = await upload(d.id, { file: jpeg() });
	assert.equal(
		(await upload(c.id, { file: jpeg(), kind: 'finished', of: o.body.id })).body.field,
		'of',
	);
	assert.equal((await upload(c.id, { file: jpeg(), kind: 'finished' })).body.field, 'of');
	const mine = await upload(c.id, { file: jpeg() });
	const fin = await upload(c.id, { file: jpeg(), kind: 'finished', of: mine.body.id });
	assert.equal(
		(await upload(c.id, { file: jpeg(), kind: 'finished', of: fin.body.id })).body.field,
		'of',
	);
});

await t('photos: thumb or full size, with a safe download name', async () => {
	const c = await create();
	const o = await upload(c.id, { file: jpeg(30, 'Shop "front".jpg'), thumb: jpeg(3) });
	const thumb = await call(`/clients/${c.id}/photos/${o.body.id}?size=thumb`);
	assert.equal(thumb.body.length, 3);
	const full = await call(`/clients/${c.id}/photos/${o.body.id}?download=1`);
	assert.equal(full.body.length, 30);
	assert.match(full.headers.get('content-disposition'), /^attachment; filename="Shop front.jpg"/);
	assert.equal((await call(`/clients/${c.id}/photos/nope`)).status, 404);
});

await t('photos: deleting an original removes its finished version and both files', async () => {
	const c = await create();
	const o = await upload(c.id, { file: jpeg(), thumb: jpeg(2) });
	await upload(c.id, { file: jpeg(), kind: 'finished', of: o.body.id });
	const r = await call(`/clients/${c.id}/photos/${o.body.id}`, { method: 'DELETE' });
	assert.equal(r.status, 200);
	assert.equal(bucket.objects.size, 0);
	assert.deepEqual((await call(`/clients/${c.id}`)).body.photos, []);
});

await t('download all: a zip of every original, in order', async () => {
	const c = await create();
	const a = await upload(c.id, { file: jpeg(100, 'a.jpg', 1) });
	await upload(c.id, { file: jpeg(200, 'b.jpg', 2) });
	await upload(c.id, { file: jpeg(5, 'done.jpg'), kind: 'finished', of: a.body.id });
	const r = await call(`/clients/${c.id}/photos.zip`);
	assert.equal(r.status, 200);
	assert.match(r.headers.get('content-disposition'), /test-bakery-originals\.zip/);
	const dir = mkdtempSync(join(tmpdir(), 'zipadmin-'));
	try {
		writeFileSync(join(dir, 'z.zip'), r.body);
		const list = execFileSync('unzip', ['-Z1', join(dir, 'z.zip')], { encoding: 'utf8' });
		assert.deepEqual(list.trim().split('\n'), ['1-a.jpg', '2-b.jpg']);
		assert.match(
			execFileSync('unzip', ['-t', join(dir, 'z.zip')], { encoding: 'utf8' }),
			/No errors/,
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

await t('delete removes the client and every file', async () => {
	const c = await create();
	await upload(c.id, { file: jpeg(), thumb: jpeg(2) });
	await call(`/clients/${c.id}/rotate`, { method: 'POST', json: {} });
	assert.equal((await call(`/clients/${c.id}`, { method: 'DELETE' })).status, 200);
	assert.equal((await call(`/clients/${c.id}`)).status, 404);
	assert.equal(bucket.objects.size, 0);
});

await t('unknown admin paths and clients are 404', async () => {
	assert.equal((await call('/nope')).status, 404);
	assert.equal((await call('/clients/x')).status, 404);
	const c = await create();
	assert.equal((await call(`/clients/${c.id}/nope`, { method: 'POST', json: {} })).status, 404);
});

await t('changes from another site are refused, uploads included', async () => {
	const c = await create();
	const send = (headers, method = 'POST', path = `/clients/${c.id}/rotate`, body = '{}') =>
		worker.fetch(
			new Request(`${ORIGIN}/api/onboard/admin${path}`, {
				method,
				headers: { 'cf-access-jwt-assertion': good, ...headers },
				body: method === 'DELETE' ? undefined : body,
			}),
			env(),
			{ waitUntil() {} },
		);
	assert.equal((await send({ 'content-type': 'text/plain' })).status, 403);
	assert.equal((await send({ 'content-type': 'application/x-www-form-urlencoded' })).status, 403);
	assert.equal(
		(await send({ 'content-type': 'application/json', origin: 'https://evil.example' })).status,
		403,
	);
	assert.equal(
		(await send({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' })).status,
		403,
	);
	assert.equal((await send({}, 'DELETE', `/clients/${c.id}`)).status, 403);
	// A cross-site form upload carries cookies without a preflight: it must prove it came from here.
	const form = new FormData();
	form.append('file', jpeg());
	const asForm = (headers) =>
		worker.fetch(
			new Request(`${ORIGIN}/api/onboard/admin/clients/${c.id}/photos`, {
				method: 'POST',
				headers: { 'cf-access-jwt-assertion': good, ...headers },
				body: form,
			}),
			env(),
			{ waitUntil() {} },
		);
	assert.equal((await asForm({})).status, 403);
	assert.equal((await asForm({ origin: 'https://evil.example' })).status, 403);
	assert.equal((await asForm({ 'sec-fetch-site': 'same-site' })).status, 403);
	assert.equal(bucket.objects.size, 0);
	assert.equal((await asForm({ origin: ORIGIN })).status, 201);
	assert.equal((await call(`/clients/${c.id}`)).body.code, c.code);
});

const q = await import(resolve(here, '../src/quota.ts'));

await t('list carries storage and upload use for the dashboard', async () => {
	const c = await create();
	await upload(c.id, { file: jpeg(100), thumb: jpeg(5, 'thumb.jpg') });
	const r = await call('/clients');
	assert.deepEqual(r.body.usage, {
		bytes: 105,
		cap: q.STORAGE_CAP,
		uploads_today: 1,
		upload_cap: 1500,
	});
});

await t('studio uploads stop at the same caps', async () => {
	const c = await create();
	const day = new Date().toISOString().slice(0, 10);
	await db.prepare('INSERT INTO usage (day, uploads) VALUES (?, 1500)').bind(day).run();
	const r = await upload(c.id, { file: jpeg() });
	assert.equal(r.status, 409);
	assert.equal(r.body.error, q.BUSY_MESSAGE);
	assert.equal(bucket.objects.size, 0);
});

console.log(`onboard admin: ${pass} passed`);
