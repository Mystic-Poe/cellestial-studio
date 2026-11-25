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

const fields = {
	name: 'Test Bakery',
	email: 'owner@example.com',
	domain: 'example.com',
	lane: 'ms',
	tier: 2,
	mode: 'test',
};

await t('newCode is 43 base64url characters and never repeats', () => {
	const a = store.newCode();
	assert.match(a, /^[A-Za-z0-9_-]{43}$/);
	assert.notEqual(a, store.newCode());
});

await t('create, then find by id and by code', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields, 1000);
	assert.equal(c.name, 'Test Bakery');
	assert.equal(c.step, 0);
	assert.deepEqual(c.done, []);
	assert.deepEqual(c.checklist, { invites: false, billing: false, domain: false, card: false });
	assert.equal(c.status, 'active');
	assert.equal(c.created_at, 1000);
	assert.equal(c.last_seen_at, null);
	assert.deepEqual(await store.getById(db, c.id), c);
	assert.deepEqual(await store.getByCode(db, c.code), c);
	assert.equal(await store.getById(db, 'nope'), null);
	assert.equal(await store.getByCode(db, 'nope'), null);
});

await t('list splits archived from the rest, most recently changed first', async () => {
	const db = fakeD1();
	const a = await store.createClient(db, { ...fields, name: 'A' }, 1000);
	const b = await store.createClient(db, { ...fields, name: 'B' }, 2000);
	const c = await store.createClient(db, { ...fields, name: 'C' }, 3000);
	await store.updateClient(db, c.id, { status: 'archived' }, 4000);
	await store.updateClient(db, b.id, { status: 'done' }, 5000);
	assert.deepEqual(
		(await store.listClients(db, false)).map((x) => x.name),
		['B', 'A'],
	);
	assert.deepEqual(
		(await store.listClients(db, true)).map((x) => x.name),
		['C'],
	);
	assert.ok(a);
});

await t('update merges fields, JSON columns included, and stamps updated_at', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields, 1000);
	const u = await store.updateClient(
		db,
		c.id,
		{
			name: 'Renamed',
			step: 2,
			done: ['gh-signup', 'gh-org'],
			checklist: { invites: true, billing: false, domain: false, card: false },
			notes: 'Call Tuesday',
		},
		2000,
	);
	assert.equal(u.name, 'Renamed');
	assert.equal(u.email, fields.email);
	assert.equal(u.step, 2);
	assert.deepEqual(u.done, ['gh-signup', 'gh-org']);
	assert.equal(u.checklist.invites, true);
	assert.equal(u.notes, 'Call Tuesday');
	assert.equal(u.updated_at, 2000);
	assert.equal(u.code, c.code);
	assert.equal(await store.updateClient(db, 'nope', { name: 'x' }, 1), null);
});

await t('update ignores columns it must never set (id, code, created_at)', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields, 1000);
	const u = await store.updateClient(
		db,
		c.id,
		{ id: 'x', code: 'y', created_at: 5, name: 'N' },
		2000,
	);
	assert.equal(u.id, c.id);
	assert.equal(u.code, c.code);
	assert.equal(u.created_at, 1000);
});

await t('rotate gives a new code; the old one stops working', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields, 1000);
	const r = await store.rotateCode(db, c.id, 2000);
	assert.notEqual(r.code, c.code);
	assert.equal(await store.getByCode(db, c.code), null);
	assert.equal((await store.getByCode(db, r.code)).id, c.id);
	assert.equal(await store.rotateCode(db, 'nope', 1), null);
});

await t('touchSeen writes at most once a minute', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields, 1000);
	await store.touchSeen(db, c.id, 100_000);
	assert.equal((await store.getById(db, c.id)).last_seen_at, 100_000);
	await store.touchSeen(db, c.id, 130_000);
	assert.equal((await store.getById(db, c.id)).last_seen_at, 100_000);
	await store.touchSeen(db, c.id, 161_000);
	assert.equal((await store.getById(db, c.id)).last_seen_at, 161_000);
});

await t('delete removes the row', async () => {
	const db = fakeD1();
	const c = await store.createClient(db, fields, 1000);
	assert.equal(await store.deleteClient(db, c.id), true);
	assert.equal(await store.getById(db, c.id), null);
	assert.equal(await store.deleteClient(db, c.id), false);
});

console.log(`store: ${pass} passed`);
