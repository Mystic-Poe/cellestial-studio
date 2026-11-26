// Walks the Admin link, the two studio tabs and the Billing template against
// the local dev server (workers/onboard/test/dev-server.mjs), at phone width.
// Run: node tools/onboard/check-billing.mjs [base] [out-dir]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4410';
const out = process.argv[3] ?? '/tmp/onboard-shots';
mkdirSync(out, { recursive: true });
const ok = (name) => console.log('  ok  -', name);

const newClient = async (name) =>
	(
		await fetch(`${base}/api/onboard/admin/clients`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: base },
			body: JSON.stringify({ name, email: 'owner@example.com', mode: 'test' }),
		})
	).json();
const made = await newClient('Billing Test Bakery');
const other = await newClient('Quoted Test Florist');

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// The menu on the main site.
await page.goto(`${base}/`);
const admin = page.locator('#chrome-menu a:has-text("Admin")');
assert.equal(await admin.count(), 1);
assert.equal(await admin.getAttribute('href'), '/dashboard/');
assert.equal(await admin.getAttribute('data-dest'), null, 'a plain link, not a sky flight');
ok('the main menu has an Admin link to /dashboard/');

await page.goto(`${base}/dashboard/`);
await page.waitForSelector('.ob-pagetabs');
assert.equal(await page.locator('.ob-pagetabs [aria-current=page]').innerText(), 'Onboarding');
await page.click('.ob-pagetabs a:has-text("Billing")');
await page.waitForURL(`${base}/dashboard/billing/`);
await page.waitForSelector('[data-offer=cohort]');
assert.equal(await page.locator('.ob-pagetabs [aria-current=page]').innerText(), 'Billing');
ok('two tabs, Onboarding and Billing, each its own address');

const cohort = await page.locator('[data-offer=cohort]').innerText();
assert.match(cohort, /Founding cohort/);
assert.match(cohort, /\$990\s*Free/);
assert.match(cohort, /\$69\/mo\s*\$39\/mo/);
assert.match(cohort, /locked for life/);
ok('the founding cohort card: build free, care $39/mo locked');

await page.click('[data-offer=cohort] button');
await page.waitForFunction(
	(name) =>
		[...document.querySelectorAll('select[name=client] option')].some((o) => o.textContent === name),
	made.name,
);
assert.match(await page.locator('.ob-plan').innerText(), /Pick a client first/);
await page.selectOption('select[name=client]', made.id);
assert.equal(
	await page.locator('.ob-plan').innerText(),
	'Billing Test Bakery · Founding cohort · Build: free · Care: $39/mo, locked for life, starting when their site goes live',
);
assert.match(await page.locator('.ob-sample').innerText(), /sandbox: test cards only/);
ok('pick a real client: one-line summary; the page says it is the sandbox');

await page.click('button:has-text("Confirm and make card link")');
await page.waitForSelector('text=Billing Test Bakery is set up. Send them this card link:');
assert.match(await page.locator('.ob-linkbox a').innerText(), /^https:\/\/checkout\.stripe\.com\//);
const plan = page.locator(`[data-plan="${made.id}"]`);
await plan.waitFor();
assert.match(await plan.innerText(), /Waiting for card/i);
assert.equal(
	await page.locator(`select[name=client] option[value="${made.id}"]`).count(),
	0,
	'not offered twice',
);
ok('confirm: a card link to send, and the plan waits for their card');
await page.screenshot({ path: `${out}/billing-card-link.png`, fullPage: true });

await fetch(`${base}/__save-card?client=${made.id}`, { method: 'POST' });
await page.reload();
await plan.waitFor();
assert.match(await plan.innerText(), /Card saved · starts at Live/i);
await fetch(`${base}/api/onboard/admin/clients/${made.id}`, {
	method: 'PATCH',
	headers: { 'content-type': 'application/json', origin: base },
	body: JSON.stringify({ stage: 'live' }),
});
await page.reload();
await plan.waitFor();
assert.match(await plan.innerText(), /Active/i);
assert.match(await plan.innerText(), /next charge/);
assert.match(await page.locator('.ob-figures').innerText(), /\$39\s*Coming in each month/);
assert.match(await page.locator('section:has(h2:text("Recent invoices"))').innerText(), /Billing Test Bakery\s*\$39/);
ok('card saved, then Live: care is active, $39 a month, first invoice paid');
await page.screenshot({ path: `${out}/billing-active.png`, fullPage: true });

await page.click('[data-offer=quoted] button');
await page.waitForSelector('input[name=build]', { state: 'visible' });
await page.selectOption('select[name=client]', other.id);
await page.fill('input[name=build]', '2,500');
await page.fill('input[name=care]', '89');
assert.match(
	await page.locator('.ob-plan').innerText(),
	/Quoted build · Build: \$2,500, invoiced now · Care: \$89\/mo/,
);
assert.equal(await page.isDisabled('button:has-text("Confirm and make card link")'), true);
assert.match(await page.locator('.ob-hint').first().innerText(), /Quoted builds are next/);
ok('a quoted build sums up its prices; starting one comes next');

assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'no sideways scroll');
assert.deepEqual(errors, []);
ok('no page errors, no sideways scroll');

for (const c of [made, other])
	await fetch(`${base}/api/onboard/admin/clients/${c.id}`, { method: 'DELETE', headers: { origin: base } });
await browser.close();
