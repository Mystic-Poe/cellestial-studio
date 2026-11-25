// Run: node workers/onboard/test/files.test.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = await import(resolve(here, '../src/files.ts'));

let pass = 0;
const t = async (name, fn) => {
	await fn();
	console.log('  ok  -', name);
	pass++;
};

const upload = (parts) => {
	const form = new FormData();
	for (const [k, v] of Object.entries(parts)) form.append(k, v);
	return new Request('https://x.test/', { method: 'POST', body: form });
};
const jpeg = (n = 10, name = 'a.jpg') =>
	new File([new Uint8Array(n)], name, { type: 'image/jpeg' });

await t('crc32 matches the standard check value', () => {
	assert.equal(files.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

await t('upload: a photo with a thumbnail and fields', async () => {
	const r = await files.readUpload(upload({ file: jpeg(), thumb: jpeg(5), kind: 'original' }), 100);
	assert.ok(r.ok);
	assert.equal(r.file.size, 10);
	assert.equal(r.thumb.size, 5);
	assert.equal(r.fields.kind, 'original');
});

await t('upload: refuses non-photos, too big, empty, and non-form bodies', async () => {
	const txt = new File(['hi'], 'a.txt', { type: 'text/plain' });
	assert.equal((await files.readUpload(upload({ file: txt }), 100)).status, 415);
	assert.equal((await files.readUpload(upload({ file: jpeg(101) }), 100)).status, 413);
	assert.equal((await files.readUpload(upload({ file: jpeg(0) }), 100)).status, 400);
	assert.equal((await files.readUpload(upload({ other: 'x' }), 100)).status, 400);
	const json = new Request('https://x.test/', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: '{}',
	});
	assert.equal((await files.readUpload(json, 100)).status, 400);
});

await t('upload: HEIC with no type is accepted by its name', async () => {
	const heic = new File([new Uint8Array(4)], 'IMG_0001.HEIC', { type: '' });
	assert.ok((await files.readUpload(upload({ file: heic }), 100)).ok);
});

await t('upload: a bad thumbnail is dropped, not fatal', async () => {
	const r = await files.readUpload(
		upload({ file: jpeg(), thumb: new File(['x'], 't.txt', { type: 'text/plain' }) }),
		100,
	);
	assert.ok(r.ok);
	assert.equal(r.thumb, null);
});

await t('safe names: no paths, no quotes or control characters', () => {
	assert.equal(files.safeName('../../etc/pa"ss\nwd.jpg'), 'passwd.jpg');
	assert.equal(files.safeName(''), 'photo.jpg');
	assert.deepEqual(files.zipNames(['a.jpg', 'a.jpg']), ['1-a.jpg', '2-a.jpg']);
});

await t('zip: two photos unzip intact (checked by unzip -t), missing ones skipped', async () => {
	const a = new Uint8Array(70_000).map((_, i) => i % 251);
	const b = new TextEncoder().encode('second file — ünïcode');
	const entry = (name, bytes) => ({
		name,
		open: async () => (bytes ? new Blob([bytes]).stream() : null),
	});
	const zip = new Uint8Array(
		await new Response(
			files.zipStream([entry('1-shop.jpg', a), entry('2-gone.jpg', null), entry('3-ünï.txt', b)]),
		).arrayBuffer(),
	);
	const dir = mkdtempSync(join(tmpdir(), 'ziptest-'));
	try {
		writeFileSync(join(dir, 'all.zip'), zip);
		const out = execFileSync('unzip', ['-t', join(dir, 'all.zip')], { encoding: 'utf8' });
		assert.match(out, /No errors detected/);
		// Names: Python reads the UTF-8 flag (this unzip build ignores it).
		const names = execFileSync(
			'python3',
			[
				'-c',
				'import sys,zipfile;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))',
				join(dir, 'all.zip'),
			],
			{ encoding: 'utf8' },
		);
		assert.deepEqual(names.trim().split('\n'), ['1-shop.jpg', '3-ünï.txt']);
		const bytes = (name) =>
			new Uint8Array(execFileSync('unzip', ['-p', join(dir, 'all.zip'), name]));
		assert.deepEqual(bytes('1-shop.jpg'), a);
		assert.deepEqual(bytes('3-*.txt'), b);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

console.log(`files: ${pass} passed`);
