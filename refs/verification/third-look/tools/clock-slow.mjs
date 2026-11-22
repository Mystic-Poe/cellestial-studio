#!/usr/bin/env node
// On a slow line, how long is the loader's picture on screen? Phone profile, production build, slow 4G
// (and with the CPU slowed 4x), five first visits each. Times are the page's own (performance.now()):
// first contentful paint (the server's unlit C), the moment the loader goes live (.is-live on #loader),
// and the moment the scene becomes "sky" (a MutationObserver on <html data-scene>).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir } from './lib.mjs';
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const [name, throttle, net] of [['unslowed', 1, false], ['slow 4G', 1, true], ['CPU 4x and slow 4G', 4, true]]) {
	const rows = [];
	for (let run = 0; run < 5; run++) {
		const o = await open(browser, 'phone', { throttle, init: { fn: () => {
			window.__t = {};
			new MutationObserver(() => {
				if (document.documentElement.dataset.scene === 'sky' && !window.__t.sky) window.__t.sky = performance.now();
				const l = document.getElementById('loader');
				if (l?.classList.contains('is-live') && !window.__t.live) window.__t.live = performance.now();
			}).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scene', 'class'] });
		} } });
		if (net) { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); }
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		const t = await o.page.evaluate(() => ({ ...window.__t, fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null }));
		rows.push(t);
		await o.context.close();
	}
	say(`phone, ${name}: first paint ${rows.map((r) => Math.round(r.fcp)).join(', ')} ms; loader live ${rows.map((r) => Math.round(r.live ?? -1)).join(', ')} ms; sky ${rows.map((r) => Math.round(r.sky)).join(', ')} ms`);
	say(`   the loader's picture on screen (first paint to the sky): ${rows.map((r) => ((r.sky - r.fcp) / 1000).toFixed(2)).join(', ')} s; from the loader going live: ${rows.map((r) => (r.live ? ((r.sky - r.live) / 1000).toFixed(2) : '?')).join(', ')} s`);
}
writeFileSync(join(dir, 'clock-slow-line.txt'), `${log.join('\n')}\n`);
await browser.close();
