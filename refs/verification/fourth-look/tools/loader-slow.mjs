#!/usr/bin/env node
// The third look's own, two questions about the loader on a slow line (slow 4G: 1.6 Mbit/s down,
// 750 kbit/s up, 150 ms), production build, real GPU:
// (1) WHAT DOES THE VISITOR SEE? A first visit recorded at both sizes on a fast line and on slow 4G, cut
//     every 300 ms from the first non-black recorded frame to the sky: loader/slow-<size>.jpg, fast-<size>.jpg.
// (2) IS A SKIP MADE BEFORE THE SCRIPT HAS ARRIVED REMEMBERED? On slow 4G the server's unlit C stands about
//     1.1 s before the loader's script goes live. A tap (phone) or a key (desktop) 300 ms after the first
//     paint (before the loader is live), and another run with it 300 ms after the loader goes live.
// NOTE: timing-sensitive; run with nothing else on the GPU.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, GRID, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const init = { fn: () => {
	window.__t = {};
	new MutationObserver(() => {
		if (document.documentElement.dataset.scene === 'sky' && !window.__t.sky) window.__t.sky = performance.now();
		const l = document.getElementById('loader');
		if (l?.classList.contains('is-live') && !window.__t.live) window.__t.live = performance.now();
	}).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scene', 'class'] });
} };
const slow = async (o) => { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); };
const read = (o) => o.page.evaluate(() => ({ ...window.__t, fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null }));
for (const size of ['desk', 'phone']) for (const line of ['fast', 'slow']) {
	const o = await open(browser, size, { init });
	if (line === 'slow') await slow(o);
	const rec = await recorder(o, { quality: 80 });
	const t0 = Date.now();
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
	const tSky = Date.now();
	await sleep(700);
	await rec.stop();
	const t = await read(o);
	let first = null;
	for (const f of rec.frames) { if (f.ts < t0) continue; const { channels } = await sharp(f.img).stats(); if (channels[0].mean + channels[1].mean + channels[2].mean > 1.2) { first = f.ts; break; } }
	say(`${size}, ${line} line: first paint ${Math.round(t.fcp)} ms, loader live ${Math.round(t.live)} ms, the sky ${Math.round(t.sky)} ms after navigation; in the recording the first frame that is not black comes ${Math.round(first - t0)} ms after navigation and the sky ${Math.round(tSky - first)} ms after that`);
	await sheet(join(dir, `${line}-${size}.jpg`), rec.cut(line, first, tSky + 300, 300), GRID[size]);
	await o.context.close();
}
for (const size of ['desk', 'phone']) for (const when of ['300 ms after the first paint (the script not yet there)', '300 ms after the loader goes live']) for (let run = 1; run <= 2; run++) {
	const o = await open(browser, size, { init });
	await slow(o);
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	if (when.startsWith('300 ms after the first')) await o.page.waitForFunction(() => performance.getEntriesByType('paint').some((p) => p.name === 'first-contentful-paint'), null, { timeout: 60000 });
	else await o.page.waitForFunction(() => window.__t?.live, null, { timeout: 60000 });
	await sleep(300);
	const at = await o.page.evaluate(() => performance.now());
	if (o.phone) await o.page.touchscreen.tap(200, 400); else await o.page.keyboard.press('a');
	await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
	const t = await read(o);
	say(`${size}, slow 4G, a ${o.phone ? 'tap' : 'key'} ${when}, run ${run}: first paint ${Math.round(t.fcp)}, loader live ${Math.round(t.live)}, the ${o.phone ? 'tap' : 'key'} at ${Math.round(at)}, the sky at ${Math.round(t.sky)} ms: ${((t.sky - at) / 1000).toFixed(2)} s after it (an unskipped visit reaches the sky at about 8300 ms)`);
	await o.context.close();
}
writeFileSync(join(dir, 'loader-slow.txt'), `${log.join('\n')}\n`);
await browser.close();
