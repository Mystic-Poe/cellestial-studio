#!/usr/bin/env node
// The third look's own: on slow 4G, WHEN IS THE LOADER'S PICTURE REALLY SEEN? The browser's first
// contentful paint comes when the first rows of the unlit C's file are painted, and those rows are black.
// A first visit is recorded (every frame) and each frame's mean light measured: the first frame in which
// anything of the C shows (mean light over 0.4 after the blank page has gone), the first in which the
// unlit C is whole (its light within 3% of where it settles before the script starts), and the sky.
// Three first visits at each size, slow 4G; one on a fast line for comparison. Production build.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, recorder, sharp, sleep } from './lib.mjs';
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const init = { fn: () => {
	window.__t = {};
	new MutationObserver(() => {
		if (document.documentElement.dataset.scene === 'sky' && !window.__t.sky) window.__t.sky = Date.now();
		const l = document.getElementById('loader');
		if (l?.classList.contains('is-live') && !window.__t.live) window.__t.live = Date.now();
	}).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scene', 'class'] });
} };
for (const size of ['desk', 'phone']) for (const [line, runs] of [['slow 4G', 3], ['a fast line', 1]]) for (let run = 1; run <= runs; run++) {
	const o = await open(browser, size, { init });
	if (line === 'slow 4G') { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); }
	const rec = await recorder(o, { quality: 80 });
	const t0 = Date.now();
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
	await sleep(300);
	await rec.stop();
	const t = await o.page.evaluate(() => ({ ...window.__t, origin: performance.timeOrigin, fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null }));
	const rows = [];
	for (const f of rec.frames.filter((x) => x.ts >= t0 && x.ts <= t.sky)) { const { channels } = await sharp(f.img).stats(); rows.push({ t: f.ts - t.origin, L: (channels[0].mean + channels[1].mean + channels[2].mean) / 3 }); }
	// the blank page before the site is white: start after the last frame brighter than 200
	let start = 0;
	rows.forEach((r, i) => { if (r.L > 200) start = i + 1; });
	const site = rows.slice(start);
	const seen = site.find((r) => r.L > 0.4);
	const live = t.live - t.origin;
	// the unlit C whole: the light of the last frame before the script's first drawing (taken as the frame at live + 150 ms or the last before it)
	const still = site.filter((r) => r.t <= Math.max(live + 150, (seen?.t ?? 0) + 900));
	const settle = still.length ? still[still.length - 1].L : 0;
	const whole = site.find((r) => r.L >= 0.97 * settle);
	const sky = t.sky - t.origin;
	say(`${size}, ${line}, run ${run}: first contentful paint ${Math.round(t.fcp)} ms; the first recorded frame of the site (black) at ${Math.round(site[0]?.t ?? -1)} ms; anything of the C first SEEN at ${seen ? Math.round(seen.t) : '?'} ms; the unlit C whole at ${whole ? Math.round(whole.t) : '?'} ms; the loader live at ${Math.round(live)} ms; the sky at ${Math.round(sky)} ms. First paint to the sky ${((sky - t.fcp) / 1000).toFixed(2)} s; FIRST SEEN to the sky ${seen ? ((sky - seen.t) / 1000).toFixed(2) : '?'} s; the C whole to the sky ${whole ? ((sky - whole.t) / 1000).toFixed(2) : '?'} s; the C seen half-drawn for ${seen && whole ? Math.round(whole.t - seen.t) : '?'} ms`);
	await o.context.close();
}
writeFileSync(join(dir, 'loader-seen.txt'), `${log.join('\n')}\n`);
await browser.close();
