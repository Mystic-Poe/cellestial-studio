// Walks the dashboard against the local dev server
// (workers/onboard/test/dev-server.mjs), at phone and desktop width.
// Run: node tools/onboard/check-dashboard.mjs [base] [out-dir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4410';
const out = process.argv[3] ?? '/tmp/onboard-shots';
mkdirSync(out, { recursive: true });
const ok = (name) => console.log('  ok  -', name);
const get = async (id) => (await fetch(`${base}/api/onboard/admin/clients/${id}`)).json();

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('status of 400') && errors.push(m.text())); // the bad email is on purpose

await page.goto(`${base}/dashboard/`);
await page.waitForSelector('.ob-tabs');
ok('list loads');

// New client, with one bad field first.
await page.click('[data-new-link]');
await page.fill('input[name=name]', 'Dash Test Florist');
await page.fill('input[name=email]', 'bad-email');
await page.fill('input[name=domain]', 'https://www.florist-example.com/');
await page.check('input[name=tier][value="2"]');
await page.check('input[name=mode][value="test"]');
await page.click('button[type=submit]');
await page.waitForSelector('[data-field=email][data-invalid]');
ok('bad email is marked on its field');
await page.fill('input[name=email]', 'owner@florist-example.com');
await page.click('button[type=submit]');
await page.waitForFunction(() => location.hash.startsWith('#c/'));
await page.waitForSelector('.ob-qr svg');
const id = decodeURIComponent((await page.evaluate(() => location.hash)).slice(3));
ok('created; detail shows link and QR');
await page.screenshot({ path: `${out}/dash-detail.png`, fullPage: true });

let c = await get(id);
assert.equal(c.domain, 'florist-example.com');

// Copy link.
await page.click('button:text("Copy link")');
assert.equal(await page.evaluate(() => navigator.clipboard.readText()), c.link);
ok('copy link puts the link on the clipboard');

// Tick step 1, put the client on step 3.
await page.locator('.ob-steplist li').nth(0).locator('input[type=checkbox]').check();
await page.waitForFunction(() => document.querySelector('.ob-steplist li input')?.checked);
await page.locator('.ob-steplist li').nth(2).locator('button').click();
await page.waitForSelector('.ob-steplist li:nth-child(3)[data-current]');
c = await get(id);
assert.equal(c.step, 2);
assert.deepEqual(c.done, ['gh-signup']);
ok('tick a step and move the client');

// Checklist + notes autosave.
await page.locator('label:has-text("Accept both invites") input').check();
await page.fill('textarea[name=notes]', 'Meets Thursday');
await page.waitForSelector('text=Saved.');
c = await get(id);
assert.equal(c.checklist.invites, true);
assert.equal(c.notes, 'Meets Thursday');
ok('checklist and notes save themselves');

// Edit details: tier 1 drops GitHub steps.
await page.fill('section:has(h2:text("Details")) input[name=name]', 'Dash Test Florist & Co');
await page.check('section:has(h2:text("Details")) input[name=tier][value="1"]');
await page.click('section:has(h2:text("Details")) button[type=submit]');
await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Dash Test Florist & Co');
c = await get(id);
assert.equal(c.tier, 1);
assert.equal(c.steps.length, 2);
assert.equal(await page.locator('.ob-steplist li').count(), 2);
ok('edit details; a tier change redraws the steps');

// Reset needs two taps.
await page.locator('.ob-steplist li').nth(0).locator('input[type=checkbox]').check();
await page.locator('.ob-steplist li').nth(1).locator('button').click();
await page.waitForSelector('.ob-steplist li:nth-child(2)[data-current]');
await page.click('button:text("Reset to step 1")');
c = await get(id);
assert.equal(c.step, 1, 'one tap does nothing');
await page.click('button:text("Clears every tick. Tap again")');
await page.waitForSelector('.ob-steplist li:nth-child(1)[data-current]');
assert.equal((await get(id)).step, 0);
ok('reset asks twice, then resets');

// New link.
const oldLink = c.link;
await page.click('button:text("New link")');
await page.click('button:text("The old link stops working. Tap again")');
await page.waitForSelector('text=New link made.');
assert.notEqual((await get(id)).link, oldLink);
ok('new link replaces the old one');

// Archive → appears under Archived.
await page.click('button:text("Archive")');
await page.waitForSelector('.ob-chip[data-status=archived]');
await page.click('text=← All clients');
await page.waitForSelector('.ob-tabs');
assert.equal(await page.locator(`[data-client="${id}"]`).count(), 0);
await page.click('.ob-tab:text("Archived")');
await page.waitForSelector(`[data-client="${id}"]`);
await page.screenshot({ path: `${out}/dash-archived.png`, fullPage: true });
ok('archived client moves to the Archived tab');

// Delete.
await page.click(`[data-client="${id}"]`);
await page.waitForSelector('button:text("Delete")');
await page.click('button:text("Delete")');
await page.click('button:has-text("for good? Tap again")');
await page.waitForFunction(() => location.hash === '#' || location.hash === '');
assert.equal((await fetch(`${base}/api/onboard/admin/clients/${id}`)).status, 404);
ok('delete asks twice, then removes');

// Desktop list shot with a couple of clients.
for (const name of ['Sample Garage', 'Sample Dental']) {
	await fetch(`${base}/api/onboard/admin/clients`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: base },
		body: JSON.stringify({ name, email: 'a@example.com', domain: 'example.com', lane: 'g', tier: 2, mode: 'person' }),
	});
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.click('.ob-tab:text("Active")');
await page.waitForSelector('.ob-row');
await page.screenshot({ path: `${out}/dash-list-desktop.png`, fullPage: true });

assert.deepEqual(errors, []);
ok('no page errors');
await browser.close();
