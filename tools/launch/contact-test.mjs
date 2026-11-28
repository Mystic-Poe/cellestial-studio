// One clearly-marked TEST enquiry through the live /contact form. Sends a real email.
// Run: node tools/launch/contact-test.mjs
import { chromium } from 'playwright-core';
import { CHROMIUM } from '../roots/lib.mjs';
const launch = () => chromium.launch({ executablePath: CHROMIUM, headless: false });
const b = await launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('https://cellestialstudio.com/contact', { waitUntil: 'load' });
await p.fill('#contact-form-name', 'TEST — launch check (Claude)');
await p.fill('#contact-form-email', 'cellestial.studio@gmail.com');
await p.fill('#contact-form-message', 'TEST enquiry from the Nov 27 launch build sheet, Job 3 step 1. Please ignore; Gro verifies it arrived.');
const ok = await p.waitForFunction(() => document.querySelector('[name="cf-turnstile-response"]')?.value, null, { timeout: 45000 }).then(() => true, () => false);
console.log('turnstile token:', ok);
if (ok) {
	const resp = p.waitForResponse((r) => r.url().includes('/api/contact'));
	await p.click('#contact-form button[type=submit]');
	const r = await resp;
	await p.waitForTimeout(800);
	console.log('status', r.status(), await r.text(), '| page says:', await p.textContent('#contact-form [data-status]'), '| at', new Date().toString());
}
await p.screenshot({ path: 'refs/verification/launch-contact.png' });
await b.close();
