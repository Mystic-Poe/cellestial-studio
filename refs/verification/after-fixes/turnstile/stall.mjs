// 1. Which protocol does Chromium use for Cloudflare's Turnstile requests?
// 2. What does the site show when Turnstile's script never answers (a stalled request)?
import { chromium } from 'playwright-core';
const BASE = process.env.BASE ?? 'http://localhost:4621';
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'] });
const state = (page, sel) => page.evaluate((s) => {
	const form = document.querySelector(s);
	const slot = form.querySelector('[data-turnstile-slot]');
	const r = slot.getBoundingClientRect();
	const input = form.querySelector('[name="cf-turnstile-response"]');
	return { slot: { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }, widgets: slot.children.length, inputs: form.querySelectorAll('[name="cf-turnstile-response"]').length, token: input ? input.value.slice(0, 24) : null, api: typeof window.turnstile, scripts: document.querySelectorAll('script[data-turnstile-api]').length, send: form.querySelector('button[type="submit"]').disabled ? 'disabled' : 'enabled' };
}, sel);

// ── 1. protocols ──
{
	const context = await browser.newContext(PHONE);
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send('Network.enable');
	const seen = [];
	cdp.on('Network.responseReceived', (e) => /challenges\.cloudflare\.com/.test(e.response.url) && seen.push(`${e.response.protocol} ${e.response.status} ${e.response.url.replace(/^https:\/\/challenges\.cloudflare\.com/, '').slice(0, 44)} (${e.response.remoteIPAddress})`));
	await page.goto(`${BASE}/?scene=roots&debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.claimFlow && window.__cellestial?.roots);
	await page.click('#roots [data-open-contact]');
	await page.waitForFunction(() => document.querySelector('#contact-box-form [name="cf-turnstile-response"]')?.value, null, { timeout: 20000 }).catch(() => {});
	await sleep(500);
	console.log('PROTOCOLS (top-level requests seen by the page target):\n  ' + seen.join('\n  '));
	await context.close();
}

// ── 2. a stalled script ──
for (const f of [{ label: 'message box', form: '#contact-box-form', open: '#roots [data-open-contact]', dialog: '#contact-dialog' }]) {
	const context = await browser.newContext(PHONE);
	const page = await context.newPage();
	const errors = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 120)}`));
	let held = 0;
	await context.route('**/turnstile/v0/api.js*', () => { held++; /* never answered: a stalled request */ });
	await page.goto(`${BASE}/?scene=roots&debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.claimFlow && window.__cellestial?.roots);
	await page.click(f.open);
	await page.waitForSelector(`${f.dialog}[open]`);
	await sleep(6000);
	console.log(`\nSTALLED api.js, ${f.label}, 6 s after opening:\n  ${JSON.stringify(await state(page, f.form))}  requests held: ${held}`);
	await page.keyboard.press('Escape');
	await sleep(300);
	await page.click(f.open);
	await sleep(2500);
	console.log(`  reopened, 2.5 s later:\n  ${JSON.stringify(await state(page, f.form))}  requests held: ${held}`);
	await page.fill(`${f.form} [name="name"]`, 'Test Visitor');
	await page.fill(`${f.form} [name="email"]`, 'visitor@example.com');
	await page.fill(`${f.form} [name="message"]`, 'hello');
	await page.click(`${f.form} button[type="submit"]`);
	await page.waitForFunction((sel) => /Sent|did not/.test(document.querySelector(`${sel} [data-status]`).textContent), f.form, { timeout: 8000 }).catch(() => {});
	console.log(`  after Send: "${await page.evaluate((sel) => document.querySelector(`${sel} [data-status]`).textContent, f.form)}"; console: ${errors.join(' | ') || 'none'}`);
	await page.screenshot({ path: new URL('./stalled.png', import.meta.url).pathname });
	await context.close();
}
await browser.close();
