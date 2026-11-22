#!/usr/bin/env node
// Finding 15, and what the rescaled timeline may have broken: long frames while the loader plays (the sky is
// now mounted at the loader's still moment, about 1.9 s of its script). A first visit to "/" on the
// production build, real GPU, both sizes, unslowed and CPU 4x. Every animation frame's time and every long
// task is logged in the page; the screen is recorded. For each frame gap over 50 ms: when it was, how long,
// and whether anything on screen was moving round it (the mean difference between the recorded frames
// 150 ms before it, just before it, just after it and 150 ms after it).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const diff = async (a, b) => {
	if (!a || !b) return -1;
	const [x, y] = await Promise.all([a, b].map((f) => sharp(f.img).resize({ width: 360 }).greyscale().raw().toBuffer()));
	let s = 0;
	const n = Math.min(x.length, y.length);
	for (let i = 0; i < n; i++) s += Math.abs(x[i] - y[i]);
	return s / n;
};
for (const size of ['desk', 'phone']) for (const throttle of [1, 4]) {
	const o = await open(browser, size, { throttle, init: { fn: () => {
		window.__long = [];
		try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ s: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); } catch {}
	} } });
	const rec = await recorder(o, { quality: 80 });
	const t0 = Date.now();
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 60000 });
	const tSky = Date.now();
	await sleep(600);
	await rec.stop();
	const d = await o.page.evaluate(() => ({ origin: performance.timeOrigin, raf: window.__raf, long: window.__long }));
	const tag = `${size} cpu x${throttle}`;
	const gaps = [];
	for (let i = 1; i < d.raf.length; i++) if (d.raf[i] - d.raf[i - 1] > 50) gaps.push({ a: d.raf[i - 1], b: d.raf[i] });
	const inLoader = gaps.filter((g) => d.origin + g.b < tSky);
	const all = d.raf.filter((t) => d.origin + t < tSky);
	const dts = all.slice(1).map((t, i) => t - all[i]);
	say(`${tag}: the sky ${tSky - t0} ms after navigation (${Math.round(tSky - d.origin)} ms after the page's time origin). ${dts.length} frames while the loader played: average ${(dts.reduce((a, b) => a + b, 0) / dts.length).toFixed(1)} ms, over 34 ms ${dts.filter((x) => x > 34).length}, over 50 ms ${dts.filter((x) => x > 50).length}, over 100 ms ${dts.filter((x) => x > 100).length}. Long tasks: ${d.long.map((l) => `${Math.round(l.d)} ms at ${Math.round(l.s)}`).join(', ') || 'none'}`);
	const cells = [];
	for (const g of inLoader) {
		const A = d.origin + g.a, B = d.origin + g.b;
		const before = rec.at(A - 5), prev = rec.at(A - 150), after = rec.frames.find((f) => f.ts >= B + 12) ?? null, after2 = rec.frames.find((f) => f.ts >= B + 160) ?? null;
		const m1 = await diff(prev, before), m2 = await diff(before, after), m3 = await diff(after, after2);
		say(`   a frame of ${Math.round(g.b - g.a)} ms from ${Math.round(g.a)} ms: the picture changed by ${m1.toFixed(2)} over the 150 ms before it, ${m2.toFixed(2)} across it, ${m3.toFixed(2)} over the 150 ms after (mean grey levels of 255; under 0.3 is a still picture)`);
		if (g.b - g.a > 90 && before && after) cells.push({ img: prev?.img ?? before.img, label: `${tag}: 150 ms before the ${Math.round(g.b - g.a)} ms frame at ${Math.round(g.a)}` }, { img: before.img, label: 'just before' }, { img: after.img, label: 'just after' }, { img: (after2 ?? after).img, label: '150 ms after' });
	}
	if (cells.length) await sheet(join(dir, `stall-${size}${throttle > 1 ? `-cpu${throttle}x` : ''}.jpg`), cells.slice(0, 16), size === 'desk' ? { cols: 4, cellW: 390, cellH: 244 } : { cols: 8, cellW: 190, cellH: 412 });
	say(`   console errors: ${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'}`);
	await o.context.close();
}
writeFileSync(join(dir, 'stall.txt'), `${log.join('\n')}\n`);
await browser.close();
