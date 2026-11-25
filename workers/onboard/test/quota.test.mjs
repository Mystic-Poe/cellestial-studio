// The free-tier caps. Run: node workers/onboard/test/quota.test.mjs
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeD1 } from './fake-d1.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const q = await import(resolve(here, '../src/quota.ts'));
const store = await import(resolve(here, '../src/store.ts'));

let pass = 0;
const t = async (name, fn) => {
	await fn(fakeD1());
	console.log('  ok  -', name);
	pass++;
};
const DAY = Date.UTC(2026, 10, 25, 12);

const photo = async (db, size, thumb = 0) => {
	const c = await store.createClient(db, { name: 'Q', email: 'q@example.com', mode: 'test' });
	await store.addPhoto(db, {
		id: store.newId(),
		client_id: c.id,
		kind: 'original',
		of: null,
		source: 'studio',
		name: 'a.jpg',
		type: 'image/jpeg',
		size,
		has_thumb: thumb > 0,
		thumb_size: thumb,
	});
};

await t('storage counts photos and their thumbnails', async (db) => {
	assert.equal(await q.storageUsed(db), 0);
	await photo(db, 1000, 50);
	await photo(db, 2000);
	assert.equal(await q.storageUsed(db), 3050);
});

await t('an upload that would pass 8 GB is refused as full, and not counted', async (db) => {
	await photo(db, q.STORAGE_CAP - 100);
	assert.deepEqual(await q.admitUpload(db, 100, DAY), { ok: true });
	assert.deepEqual(await q.admitUpload(db, 101, DAY), { ok: false, reason: 'full' });
	assert.equal(await q.uploadsToday(db, DAY), 1);
});

await t('1,500 uploads a day, then busy until the next UTC day', async (db) => {
	await db.prepare('INSERT INTO usage (day, uploads) VALUES (?, ?)').bind('2026-11-25', 1499).run();
	assert.deepEqual(await q.admitUpload(db, 1, DAY), { ok: true });
	assert.deepEqual(await q.admitUpload(db, 1, DAY), { ok: false, reason: 'busy' });
	assert.equal(await q.uploadsToday(db, DAY), q.DAILY_UPLOADS);
	assert.deepEqual(await q.admitUpload(db, 1, DAY + 86_400_000), { ok: true });
});

await t('the full-store email goes once a day', async (db) => {
	assert.equal(await q.firstFullToday(db, DAY), true);
	assert.equal(await q.firstFullToday(db, DAY + 1000), false);
	assert.equal(await q.firstFullToday(db, DAY + 86_400_000), true);
});

await t('usage view for the dashboard', async (db) => {
	await photo(db, 500, 20);
	await q.admitUpload(db, 1, DAY);
	assert.deepEqual(await q.usageView(db, DAY), {
		bytes: 520,
		cap: q.STORAGE_CAP,
		uploads_today: 1,
		upload_cap: 1500,
	});
});

console.log(`onboard quota: ${pass} passed`);
