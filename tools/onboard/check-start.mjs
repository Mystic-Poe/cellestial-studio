// Phone-width walk through the client's page against the local dev server
// (workers/onboard/test/dev-server.mjs). Creates its own test client.
// Run: pnpm build && node workers/onboard/test/dev-server.mjs &
//      node tools/onboard/check-start.mjs [base] [out-dir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4410';
const out = process.argv[3] ?? '/tmp/onboard-shots';
mkdirSync(out, { recursive: true });
const ok = (name) => console.log('  ok  -', name);

const api = async (path, method = 'GET', body) => {
	const r = await fetch(`${base}/api/onboard/admin${path}`, {
		method,
		headers: { 'content-type': 'application/json', origin: base },
		body: body ? JSON.stringify(body) : undefined,
	});
	return r.json();
};
const mails = async () => (await (await fetch(`${base}/__mails`)).json()).map((m) => m.subject);

const c = await api('/clients', 'POST', { name: 'Test Bakery', email: 'owner@example.com', mode: 'test' });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/40[049]|409/.test(m.text()) && errors.push(m.text()));

// A real 4000×3000 photo, made by the browser, so resizing is tested for real.
const photo = Buffer.from(
	await page.evaluate(() => {
		const cv = document.createElement('canvas');
		cv.width = 4000;
		cv.height = 3000;
		const x = cv.getContext('2d');
		for (let i = 0; i < 400; i++) {
			x.fillStyle = `hsl(${i * 7} 60% ${30 + (i % 40)}%)`;
			x.fillRect((i * 97) % 4000, (i * 53) % 3000, 300, 200);
		}
		return cv.toDataURL('image/jpeg', 0.95).split(',')[1];
	}),
	'base64',
);

const heading = () => page.locator('[data-flow] h1').innerText();
const startUrl = (code) => `${base}/start/#${code}`;

await page.goto(startUrl(c.code));
await page.waitForSelector('[data-flow] form');
assert.match(await heading(), /Hi Test Bakery, let’s get your site started/);
ok('first visit: greeting and the intake form');

await page.fill('[name=area]', 'Springfield');
await page.waitForSelector('text=Saved.');
await page.reload();
await page.waitForSelector('[name=area]');
assert.equal(await page.inputValue('[name=area]'), 'Springfield');
ok('answers save as they type and survive a reload');

await page.click('text=Send it to Gabriel →');
await page.waitForSelector('[data-field=about][data-invalid]');
assert.match(await page.locator('[data-field=about] .ob-field-error').innerText(), /business/i);
assert.deepEqual(await mails(), []);
ok('sending without “what you do” points at that field; nothing sent');

await page.fill('[name=about]', 'Sourdough bakery and café.');
await page.check('[name=pages][value=Services]');
await page.check('[name=pages][value=Gallery]');
await page.fill('[name=likes] >> nth=0', 'javascript:alert(1)');
await page.waitForSelector('[data-field=likes][data-invalid]');
ok('a bad web address is marked on its field');
await page.fill('[name=likes] >> nth=0', 'example.com');
await page.check('[name=has_domain][value=yes]');
assert.equal(await page.isVisible('[name=domain]'), true);
await page.fill('[name=domain]', 'www.Bakery-Example.com');
await page.check('[name=has_domain][value=no]');
assert.equal(await page.isVisible('[name=domain]'), false);
ok('the address box only shows when they have one');

await page.setInputFiles('#ob-add-photos', { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: photo });
await page.waitForSelector('.ob-photo img');
const stored = (await api(`/clients/${c.id}`)).photos;
assert.equal(stored.length, 1);
assert.equal(stored[0].source, 'client');
assert.equal(stored[0].has_thumb, true);
assert.ok(stored[0].size < photo.length, 'shrunk before upload');
const dims = await page.evaluate(async (url) => {
	const b = await createImageBitmap(await (await fetch(url)).blob());
	return [b.width, b.height];
}, `/api/onboard/admin/clients/${c.id}/photos/${stored[0].id}?size=full`);
assert.deepEqual(dims, [2560, 1920]);
ok('photo shrunk on the phone to 2560 px, with a thumbnail, and shown');
await page.screenshot({ path: `${out}/start-intake.png`, fullPage: true });

await page.click('text=Send it to Gabriel →');
await page.waitForSelector('.ob-steps');
assert.equal(await heading(), 'Intake');
assert.equal(await page.locator('.ob-stage[aria-current=step]').innerText(), 'Intake');
assert.deepEqual(await mails(), ['[TEST] Onboarding: Test Bakery sent their answers']);
ok('send: the status page, and one email to Gabriel');

await page.click('text=Change my answers or add photos');
await page.waitForSelector('[name=about]');
assert.equal(await page.inputValue('[name=about]'), 'Sourdough bakery and café.');
assert.equal(await page.isChecked('[name=pages][value=Gallery]'), true);
await page.setInputFiles('#ob-add-photos', { name: 'logo.jpg', mimeType: 'image/jpeg', buffer: photo });
await page.waitForFunction(() => document.querySelectorAll('.ob-photo img').length === 2);
await page.click('text=Save changes');
await page.waitForSelector('.ob-steps');
assert.deepEqual((await mails()).slice(1), ['[TEST] Onboarding: Test Bakery added photos']);
ok('change answers and add a photo after sending; Gabriel told once');

await fetch(`${base}/__fill-storage?client=${c.id}`, { method: 'POST' });
await page.click('text=Change my answers or add photos');
await page.setInputFiles('#ob-add-photos', { name: 'more.jpg', mimeType: 'image/jpeg', buffer: photo });
await page.waitForSelector('text=Photo storage is full right now. Gabriel’s been told.');
assert.equal((await mails()).at(-1), 'Onboarding: photo storage is full');
await page.screenshot({ path: `${out}/start-storage-full.png`, fullPage: true });
await page.click('text=Save changes');
await page.waitForSelector('.ob-steps');
ok('a full store says so on the photo, and Gabriel gets one email');

await api(`/clients/${c.id}`, 'PATCH', { stage: 'design' });
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'Design', null, { timeout: 15000 });
ok('the page follows the stage Gabriel sets');

await api(`/clients/${c.id}`, 'PATCH', { stage: 'building' });
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'Building', null, { timeout: 15000 });
assert.equal(await page.locator('text=Change my answers').count(), 0);
ok('once building starts, answers can’t change here');

await api(`/clients/${c.id}`, 'PATCH', { stage: 'review', preview_url: 'https://preview.example.com/' });
await page.waitForSelector('text=See your site', { timeout: 15000 });
assert.equal(await page.getAttribute('text=See your site', 'href'), 'https://preview.example.com/');
await page.click('text=Request changes');
await page.click('text=Send my changes');
await page.waitForSelector('text=Tell Gabriel what to change first.');
await page.fill('[name=changes]', 'Bigger logo, please.');
await page.click('text=Send my changes');
await page.waitForSelector('text=Thanks — Gabriel has it.');
assert.equal((await mails()).at(-1), '[TEST] Onboarding: Test Bakery asked for changes');
await page.screenshot({ path: `${out}/start-review.png`, fullPage: true });
ok('review: see the site, ask for changes, Gabriel emailed');

await api(`/clients/${c.id}`, 'PATCH', { stage: 'building' });
await api(`/clients/${c.id}`, 'PATCH', { stage: 'review' });
await page.reload();
await page.waitForSelector('text=Looks good');
await page.click('text=Looks good');
await page.waitForSelector('text=He’ll put your site live');
ok('a second review round asks again; Looks good');

await api(`/clients/${c.id}`, 'PATCH', { stage: 'live', live_url: 'https://bakery.example.com' });
await page.waitForSelector('text=bakery.example.com', { timeout: 15000 });
assert.equal(await heading(), 'Your site is live');
await page.screenshot({ path: `${out}/start-live.png`, fullPage: true });
ok('live: their address');

await api(`/clients/${c.id}/rotate`, 'POST');
await page.reload();
await page.waitForSelector('text=This link isn’t active');
await page.goto(startUrl('garbage'));
await page.reload();
await page.waitForSelector('text=This link isn’t active');
ok('old and garbage links say the link isn’t active');

const wide = page.locator('body');
assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'no sideways scroll');
assert.ok(wide);
assert.deepEqual(errors, []);
ok('no page errors, no sideways scroll');
await browser.close();
