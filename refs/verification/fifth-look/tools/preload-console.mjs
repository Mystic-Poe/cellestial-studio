#!/usr/bin/env node
// The third look's own: does the browser's console raise anything about the three pictures the page now
// asks for from its markup (link rel=preload)? Every console message of ANY kind (the console API and the
// browser's own log: Log.entryAdded) is kept, for: a first visit played through, a same-session return
// (the short loader), a skipped loader, ?scene=sky, ?scene=roots, reduced motion (the device's own
// setting, and ?rm=1). Each page is left open 7 s after it has settled (Chromium's "preloaded but not
// used" warning comes about 3 s after the load event). Production build, both sizes.
// Round 3, piece 3: one more visitor's path, AN EARLY SKIP (slow 4G, a key or a tap 1.0 s after
// navigation, before the loader's script is live).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, SIZES, launch, outDir, sleep } from './lib.mjs';
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
let total = 0;
for (const size of ['desk', 'phone']) {
	const cases = [
		{ name: 'first visit, played through', url: '/', sky: true },
		{ name: 'same-session return (short loader)', url: '/', sky: true, reload: true },
		{ name: 'skipped loader (a key or a tap 1 s in)', url: '/', sky: true, skip: true },
		{ name: 'early skip (slow 4G, a key or a tap 1.0 s after navigation, before the loader is live)', url: '/', sky: true, early: true },
		{ name: '?scene=sky', url: '/?scene=sky' },
		{ name: '?scene=roots', url: '/?scene=roots' },
		{ name: 'reduced motion (the device setting)', url: '/', rm: true },
		{ name: '?rm=1', url: '/?rm=1' },
		{ name: '/contact', url: '/contact' },
	];
	for (const c of cases) {
		const context = await browser.newContext({ ...SIZES[size], reducedMotion: c.rm ? 'reduce' : 'no-preference' });
		const page = await context.newPage();
		const msgs = [];
		page.on('console', (m) => msgs.push(`console.${m.type()}: ${m.text()}`));
		page.on('pageerror', (e) => msgs.push(`PAGEERROR ${e}`));
		const cdp = await context.newCDPSession(page);
		await cdp.send('Log.enable');
		cdp.on('Log.entryAdded', (e) => msgs.push(`log.${e.entry.level} [${e.entry.source}]: ${e.entry.text}${e.entry.url ? ` (${e.entry.url})` : ''}`));
		const failed = [];
		page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
		const preloaded = [];
		page.on('request', (r) => { if (/loader\/(c-lit|wordmark|wordmark-matte)\.webp/.test(r.url())) preloaded.push(r.url().split('/').pop()); });
		if (c.early) {
			await cdp.send('Network.enable');
			await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
			await page.goto(`${PROD}${c.url}`, { waitUntil: 'commit' });
			await page.waitForFunction(() => performance.now() >= 1000, null, { polling: 'raf' });
			const live = await page.evaluate(() => document.getElementById('loader')?.classList.contains('is-live'));
			if (live) msgs.push('THE SCRIPT (not the page): the loader was already live at the press; this was not an early skip');
			if (SIZES[size].hasTouch) await page.touchscreen.tap(200, 400); else await page.keyboard.press('a');
			await page.waitForLoadState('load');
		} else
		await page.goto(`${PROD}${c.url}`, { waitUntil: 'load' });
		if (c.skip) { await sleep(1000); if (SIZES[size].hasTouch) await page.touchscreen.tap(200, 400); else await page.keyboard.press('a'); }
		if (c.sky) await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 60000 });
		if (c.reload) { msgs.push('--- reload ---'); await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 }); }
		await sleep(7000);
		const scene = await page.evaluate(() => document.documentElement.dataset.scene ?? '(none)');
		const uniq = [...new Set(msgs)].filter((m) => m !== '--- reload ---' || msgs.length > 1);
		const real = uniq.filter((m) => m !== '--- reload ---' && !/challenges\.cloudflare\.com|turnstile/i.test(m));
		total += real.length;
		say(`${size} | ${c.name} | ends in scene ${scene} | the three pictures asked for: ${[...new Set(preloaded)].join(', ') || 'none'} | console messages of any kind: ${real.length}${real.length ? `\n      ${real.join('\n      ')}` : ''}${uniq.length !== real.length + (uniq.includes('--- reload ---') ? 1 : 0) ? `\n      (Turnstile's own, not counted: ${uniq.filter((m) => /challenges\.cloudflare\.com|turnstile/i.test(m)).length})` : ''}${failed.length ? `\n      requests failed: ${failed.join('; ')}` : ''}`);
		await context.close();
	}
}
say(`TOTAL console messages (warnings, errors, anything), Turnstile's own aside: ${total}`);
writeFileSync(join(dir, 'preload-console.txt'), `${log.join('\n')}\n`);
await browser.close();
