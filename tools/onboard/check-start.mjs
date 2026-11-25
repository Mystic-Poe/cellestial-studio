// Phone-width walk through /start against the local dev server
// (workers/onboard/test/dev-server.mjs). Creates its own test client.
// Run: node tools/onboard/check-start.mjs [base] [out-dir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4410';
const out = process.argv[3] ?? '/tmp/onboard-shots';
mkdirSync(out, { recursive: true });

const api = async (path, method = 'GET', body) => {
	const r = await fetch(`${base}/api/onboard/admin${path}`, {
		method,
		headers: { 'content-type': 'application/json', origin: base },
		body: body ? JSON.stringify(body) : undefined,
	});
	return r.json();
};

const c = await api('/clients', 'POST', { name: 'Test Bakery', email: 'owner@example.com', domain: 'example.com', lane: 'ms', tier: 2, mode: 'test' });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('503') && !m.text().includes('404') && errors.push(m.text()));

const heading = () => page.locator('[data-flow] h1').innerText();
const ok = (name) => console.log('  ok  -', name);

await page.goto(c.link.replace('https://cellestialstudio.com', base));
await page.waitForSelector('[data-flow] .panel');
assert.equal(await heading(), 'Create your GitHub account');
await page.screenshot({ path: `${out}/start-1.png`, fullPage: true });
ok('loads step 1 with the test banner');
assert.ok(await page.locator('.ob-test').isVisible());

await page.click('[data-next]');
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent?.startsWith('Create your organization'));
await page.click('[data-next]');
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'Create your Cloudflare account');
ok('done twice reaches step 3');
await page.screenshot({ path: `${out}/start-3.png`, fullPage: true });

await page.click('[data-back]');
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent?.startsWith('Create your organization'));
assert.ok(await page.locator('[data-redo]').isVisible());
ok('back shows step 2 as done, with Redo');
await page.screenshot({ path: `${out}/start-back.png`, fullPage: true });

await page.locator('.ob-steps button').first().click();
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'Create your GitHub account');
await page.click('[data-redo]');
await page.waitForSelector('[data-next]:text("Done → Next step")');
ok('step bar jumps to step 1; redo clears its tick');

// The server agrees.
await page.waitForTimeout(600);
let s = await api(`/clients/${c.id}`);
assert.equal(s.step, 0);
assert.deepEqual(s.done, ['gh-org']);
ok('server saved step 0 with only gh-org ticked');

// Reload keeps the place.
await page.reload();
await page.waitForSelector('[data-flow] .panel');
assert.equal(await heading(), 'Create your GitHub account');
ok('reload lands on the same step');

// Gabriel moves them from the dashboard; the page follows.
await api(`/clients/${c.id}`, 'PATCH', { step: 2, done: ['gh-signup', 'gh-org'] });
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'Create your Cloudflare account', null, { timeout: 12000 });
ok('a step set from the dashboard reaches the open page');

await page.click('[data-next]');
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'Invite Gabriel to Cloudflare');
await page.click('[data-next]');
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'All done');
await page.screenshot({ path: `${out}/start-done.png`, fullPage: true });
s = await api(`/clients/${c.id}`);
assert.equal(s.status, 'done');
ok('finishing marks the client done');

const mails = await (await fetch(`${base}/__mails`)).json();
assert.ok(mails.some((m) => m.subject.startsWith('[TEST] Onboarding: Test Bakery')));
ok(`emails sent: ${mails.length}`);

// A rotated link dies.
await api(`/clients/${c.id}/rotate`, 'POST', {});
await page.reload();
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'This link isn’t active');
ok('old link after rotate shows "not active"');
await page.goto(`${base}/start/#nonsense`);
await page.waitForFunction(() => document.querySelector('[data-flow] h1')?.textContent === 'This link isn’t active');
ok('garbage link shows "not active"');

assert.deepEqual(errors, []);
ok('no page errors');
await browser.close();
