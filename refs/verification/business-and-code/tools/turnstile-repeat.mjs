// Does the real Turnstile widget render in the build-request dialog every time? Ten openings
// on the phone profile, five on the desktop, each in a fresh context, nothing stubbed.
import { BASE, check, DESK, launch, note, openPage, PHONE, sleep, tally } from './lib.mjs';
const browser = await launch();
for (const [name, size, n] of [['phone', PHONE, 10], ['desk', DESK, 5]]) {
	const times = [];
	for (let i = 0; i < n; i++) {
		const { context, page, errors } = await openPage(browser, size);
		const net = [];
		page.on('requestfailed', (r) => net.push(`FAILED ${r.url().slice(0, 80)} ${r.failure()?.errorText}`));
		page.on('response', (r) => { if (/cloudflare/.test(r.url()) && r.status() >= 400) net.push(`${r.status()} ${r.url().slice(0, 80)}`); });
		await page.goto(`${BASE}/?scene=roots&debug`, { waitUntil: 'load' });
		await page.waitForFunction(() => window.__cellestial?.claimFlow && window.__cellestial?.roots, null, { timeout: 15000 });
		const t0 = Date.now();
		await page.click('#roots [data-open-claim]');
		const ok = await page.waitForFunction(() => document.querySelector('#claim-form [name="cf-turnstile-response"]')?.value, null, { timeout: 25000 }).then(() => true, () => false);
		const state = await page.evaluate(() => ({ api: typeof window.turnstile, script: document.querySelectorAll('script[data-turnstile-api]').length, kids: document.querySelector('#claim-form [data-turnstile-slot]').children.length }));
		times.push(ok ? Date.now() - t0 : -1);
		if (!ok) note(`${name} #${i + 1}: NO WIDGET after 25 s — ${JSON.stringify(state)}; network: ${net.join(' | ') || 'nothing failed'}; console: ${errors.join(' | ').slice(0, 300) || 'none'}`);
		await context.close();
	}
	check(times.every((t) => t >= 0), `${name}: the widget rendered and issued a token in ${times.filter((t) => t >= 0).length} of ${n} openings`, `ms to token: ${times.join(', ')}`);
}
await browser.close();
process.exit(tally() ? 1 : 0);
