// Walks the dashboard against the local dev server
// (workers/onboard/test/dev-server.mjs), at phone width.
// Run: node tools/onboard/check-dashboard.mjs [base] [out-dir]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4410';
const out = process.argv[3] ?? '/tmp/onboard-shots';
mkdirSync(out, { recursive: true });
const ok = (name) => console.log('  ok  -', name);
const get = async (id) => (await fetch(`${base}/api/onboard/admin/clients/${id}`)).json();

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('status of 400') && errors.push(m.text()));

const photo = Buffer.from(
	await page.evaluate(() => {
		const cv = document.createElement('canvas');
		cv.width = 3000;
		cv.height = 2000;
		const x = cv.getContext('2d');
		x.fillStyle = '#356';
		x.fillRect(0, 0, 3000, 2000);
		x.fillStyle = '#eda';
		x.fillRect(500, 400, 1200, 900);
		return cv.toDataURL('image/jpeg', 0.95).split(',')[1];
	}),
	'base64',
);

await page.goto(`${base}/dashboard/`);
await page.waitForSelector('.ob-tabs');
ok('list loads');

await page.click('[data-new-link]');
await page.fill('input[name=name]', 'Dash Test Florist');
await page.fill('input[name=email]', 'bad-email');
await page.check('input[name=test]');
await page.click('button[type=submit]');
await page.waitForSelector('[data-field=email][data-invalid]');
ok('bad email is marked on its field');
await page.fill('input[name=email]', 'owner@example.com');
await page.click('button[type=submit]');
await page.waitForFunction(() => location.hash.startsWith('#c/'));
await page.waitForSelector('.ob-qr svg');
const id = decodeURIComponent((await page.evaluate(() => location.hash)).slice(3));
let c = await get(id);
assert.equal(c.mode, 'test');
ok('created as a test client; detail shows link and QR');

await page.click('.ob-stagebar button:has-text("Design")');
await page.waitForSelector('.ob-stagebar button[aria-pressed=true]:has-text("Design")');
assert.equal((await get(id)).stage, 'design');
ok('tap a stage to move them');

await page.fill('form [name=about]', 'Wedding and event flowers.');
await page.check('form [name=pages][value=Gallery]');
await page.waitForSelector('text=Saved.');
c = await get(id);
assert.equal(c.intake.about, 'Wedding and event flowers.');
assert.deepEqual(c.intake.pages, ['Gallery']);
assert.equal(c.intake_by, 'studio');
await page.waitForSelector('text=Filled in by you');
ok('intake filled in person saves as they type, and counts as sent');

await page.setInputFiles('label:has-text("Add photos") input', [
	{ name: 'front.jpg', mimeType: 'image/jpeg', buffer: photo },
	{ name: 'inside.jpg', mimeType: 'image/jpeg', buffer: photo },
]);
await page.waitForFunction(() => document.querySelectorAll('.ob-pair').length === 2, null, { timeout: 20000 });
c = await get(id);
const originals = c.photos.filter((p) => p.kind === 'original');
assert.equal(originals.length, 2);
assert.equal(originals[0].size, photo.length, 'kept full size');
assert.ok(originals.every((p) => p.has_thumb));
assert.equal(await page.locator('.ob-pair[data-needs]').count(), 2);
ok('add photos: full size kept, thumbnails made, both marked “needs edit”');

await page.setInputFiles('.ob-pair >> nth=0 >> label:has-text("Add finished version") input', {
	name: 'front-edit.jpg',
	mimeType: 'image/jpeg',
	buffer: photo,
});
await page.waitForFunction(() => document.querySelectorAll('.ob-pair[data-needs]').length === 1, null, { timeout: 20000 });
assert.match(await page.locator('.ob-meta:has-text("still to edit")').innerText(), /1 still to edit/);
ok('add a finished version: that original no longer needs an edit');
await page.screenshot({ path: `${out}/dash-photos.png`, fullPage: true });

const zip = await page.request.get(`${base}/api/onboard/admin/clients/${id}/photos.zip`);
assert.equal(zip.status(), 200);
const dir = mkdtempSync(join(tmpdir(), 'dashzip-'));
try {
	writeFileSync(join(dir, 'z.zip'), await zip.body());
	assert.deepEqual(execFileSync('unzip', ['-Z1', join(dir, 'z.zip')], { encoding: 'utf8' }).trim().split('\n'), ['1-front.jpg', '2-inside.jpg']);
} finally {
	rmSync(dir, { recursive: true, force: true });
}
assert.equal(await page.locator('a:has-text("Download all (2)")').count(), 1);
ok('download all: a zip of both originals');

await page.fill('input[name=preview_url]', 'http://insecure.example');
await page.press('input[name=preview_url]', 'Tab');
await page.waitForSelector('label:has(input[name=preview_url])[data-invalid]');
await page.fill('input[name=preview_url]', 'preview.example.com');
await page.press('input[name=preview_url]', 'Tab');
await page.waitForFunction(() => document.querySelector('input[name=preview_url]').value === 'https://preview.example.com/');
ok('preview address must be https; a bare one gets https');

await page.click('.ob-stagebar button:has-text("Review")');
await page.waitForSelector('.ob-stagebar button[aria-pressed=true]:has-text("Review")');
await fetch(`${base}/api/onboard/client/${c.code}/review`, {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify({ verdict: 'changes', text: 'More pink.' }),
});
await page.reload();
await page.waitForSelector('.ob-review:has-text("More pink.")');
ok('the client’s review answer shows');

await page.check('label:has-text("Domain bought") input');
await page.fill('textarea[name=notes]', 'Call Tuesday');
await page.waitForFunction(async (cid) => {
	const r = await (await fetch(`/api/onboard/admin/clients/${cid}`)).json();
	return r.notes === 'Call Tuesday' && r.checklist.domain;
}, id);
ok('checklist and notes save');

await page.click('button:has-text("Copy link")');
await page.waitForSelector('text=Link copied.');
await page.click('button:has-text("New link")');
await page.click('button:has-text("The old link stops working")');
await page.waitForSelector('text=New link made.');
assert.notEqual((await get(id)).code, c.code);
ok('copy link; new link asks twice, then replaces it');

await page.goto(`${base}/dashboard/`);
await page.waitForSelector(`[data-client="${id}"]`);
assert.match(await page.locator(`[data-client="${id}"] .ob-meta`).innerText(), /Test · 2 photos · 1 to edit/);
await page.screenshot({ path: `${out}/dash-list.png`, fullPage: true });
ok('list shows stage, test, photos and what is left to edit');

await page.click(`[data-client="${id}"]`);
await page.waitForSelector('button:has-text("Archive")');
await page.click('button:has-text("Archive")');
await page.waitForSelector('button:has-text("Unarchive")');
await page.goto(`${base}/dashboard/`);
await page.click('.ob-tab:has-text("Archived")');
await page.waitForSelector(`[data-client="${id}"]`);
ok('archive moves them to the Archived tab');

await page.click(`[data-client="${id}"]`);
await page.click('button:has-text("Delete") >> nth=-1');
await page.click('button:has-text("for good")');
await page.waitForFunction(() => location.hash === '' || location.hash === '#');
assert.equal((await fetch(`${base}/api/onboard/admin/clients/${id}`)).status, 404);
ok('delete asks twice, then removes the client');

assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'no sideways scroll');
assert.deepEqual(errors, []);
ok('no page errors, no sideways scroll');
await browser.close();
