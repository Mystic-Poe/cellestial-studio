// Run: node workers/onboard/test/store.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeD1 } from './fake-d1.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const store = await import(resolve(here, '../src/store.ts'));

let pass = 0;
const t = async (name, fn) => {
	await fn();
	console.log('  ok  -', name);
	pass++;
};

const fields = { name: 'Test Bakery', email: 'owner@example.com', mode: 'test' };
const photo = (client_id, over = {}) => ({
	id: store.newId(),
	client_id,
	kind: 'original',
	of: null,
	source: 'studio',
	name: 'shop.jpg',
	type: 'image/jpeg',
	size: 1000,
	has_thumb: true,
	...over,
});

await t('newCode is 43 base64url characters and never repeats', () => {
	const a = store.newCode();
	assert.match(a, /^[A-Za-z0-9_-]{43}$/);
	assert.notEqual(a, store.newCode());
});

await t('create starts at intake with an empty intake and checklist', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields, 1000);
	assert.equal(c.stage, 'intake');
	assert.equal(c.mode, 'test');
	assert.equal(c.intake.about, '');
	assert.deepEqual(c.intake.pages, []);
	assert.equal(c.checklist.domain, false);
	assert.equal(c.status, 'active');
	assert.equal(c.intake_at, null);
	assert.equal((await store.getByCode(db, c.code)).id, c.id);
});

await t('update writes only allowed columns and keeps JSON whole', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields);
	const u = await store.updateClient(db, c.id, {
		stage: 'design',
		intake: { ...c.intake, about: 'Bread' },
		checklist: { ...c.checklist, paid: true },
		code: 'hijack',
		id: 'other',
	});
	assert.equal(u.stage, 'design');
	assert.equal(u.intake.about, 'Bread');
	assert.equal(u.checklist.paid, true);
	assert.equal(u.code, c.code);
	assert.equal(u.id, c.id);
	assert.equal(await store.updateClient(db, 'nope', { notes: 'x' }), null);
});

await t('list counts originals and those still without a finished version', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields);
	const a = await store.addPhoto(db, photo(c.id));
	await store.addPhoto(db, photo(c.id));
	await store.addPhoto(db, photo(c.id, { kind: 'finished', of: a.id }));
	const [row] = await store.listClients(db, false);
	assert.equal(row.photo_count, 2);
	assert.equal(row.to_finish, 1);
	assert.deepEqual(await store.listClients(db, true), []);
});

await t('deleting an original takes its finished version with it', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields);
	const a = await store.addPhoto(db, photo(c.id));
	const f = await store.addPhoto(db, photo(c.id, { kind: 'finished', of: a.id }));
	const b = await store.addPhoto(db, photo(c.id));
	const gone = await store.deletePhoto(db, c.id, a.id);
	assert.deepEqual(gone.map((p) => p.id).sort(), [a.id, f.id].sort());
	assert.deepEqual(
		(await store.listPhotos(db, c.id)).map((p) => p.id),
		[b.id],
	);
	assert.deepEqual(await store.deletePhoto(db, 'other-client', b.id), []);
});

await t('photos are per client; client upload count only counts theirs', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields);
	const d = await store.createClient(db, fields);
	const p = await store.addPhoto(db, photo(c.id, { source: 'client' }));
	await store.addPhoto(db, photo(c.id));
	assert.equal(await store.getPhoto(db, d.id, p.id), null);
	assert.equal((await store.getPhoto(db, c.id, p.id)).has_thumb, true);
	assert.equal(await store.countClientPhotos(db, c.id), 1);
});

await t('delete removes the client, photos and reviews', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields);
	await store.addPhoto(db, photo(c.id));
	await store.addReview(db, { client_id: c.id, verdict: 'ok', text: '' });
	assert.equal(await store.deleteClient(db, c.id), true);
	assert.equal(await store.getById(db, c.id), null);
	assert.deepEqual(await store.listPhotos(db, c.id), []);
	assert.deepEqual(await store.listReviews(db, c.id), []);
	assert.equal(await store.deleteClient(db, c.id), false);
});

await t('reviews list newest first', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields);
	await store.addReview(db, { client_id: c.id, verdict: 'changes', text: 'Bigger logo' }, 1);
	await store.addReview(db, { client_id: c.id, verdict: 'ok', text: '' }, 2);
	assert.deepEqual(
		(await store.listReviews(db, c.id)).map((r) => r.verdict),
		['ok', 'changes'],
	);
});

await t('touchSeen writes at most once a minute', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields);
	await store.touchSeen(db, c.id, 100_000);
	await store.touchSeen(db, c.id, 130_000);
	assert.equal((await store.getById(db, c.id)).last_seen_at, 100_000);
	await store.touchSeen(db, c.id, 170_000);
	assert.equal((await store.getById(db, c.id)).last_seen_at, 170_000);
});

console.log(`store: ${pass} passed`);
