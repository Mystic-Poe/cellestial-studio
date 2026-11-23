#!/usr/bin/env node
// Finding 7: the guided light in real time. Production build, real GPU. Tile 1 is opened and closed, so the
// light leads from node 1 to node 2; nine seconds are recorded and the head (a near-white blob on the trunk)
// is found in every frame: how long it travels, how long it rests, what share of the time it is on screen.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('roots');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of ['desk', 'phone']) {
	const o = await open(browser, size);
	await o.page.goto(`${PROD}/?scene=roots&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.roots?.debug?.state().grown === true, null, { timeout: 20000 });
	await sleep(800);
	const n1 = o.page.locator('.roots-stop').nth(0).locator('button').first();
	await n1.evaluate((el, h) => scrollTo({ top: scrollY + el.getBoundingClientRect().top - h * 0.12 }), o.H);
	await sleep(500);
	const b = await n1.boundingBox();
	await o.pressAt(b.x + b.width / 2, b.y + b.height / 2);
	await sleep(900);
	await o.page.keyboard.press('Escape');
	await sleep(600);
	const rec = await recorder(o, { quality: 90 });
	const t0 = Date.now();
	await sleep(9000);
	await rec.stop();
	const fr = rec.frames.filter((f) => f.ts >= t0);
	const series = [];
	for (const f of fr) {
		const { data, info } = await sharp(f.img).raw().toBuffer({ resolveWithObject: true });
		let n = 0, sy = 0;
		for (let y = 0, i = 0; y < info.height; y++) for (let x = 0; x < info.width; x++, i += info.channels) if (Math.min(data[i], data[i + 1], data[i + 2]) > 242) { n++; sy += y; }
		series.push({ t: Math.round(f.ts - t0), n, y: n ? Math.round((sy / n) * (o.H / info.height)) : -1, img: f.img });
	}
	const base = [...series].map((s) => s.n).sort((a, c) => a - c)[Math.floor(series.length * 0.2)];
	const on = series.map((s) => s.n > base + 25);
	let runs = [], cur = null;
	for (let i = 0; i < series.length; i++) {
		if (on[i] && !cur) cur = { a: series[i].t, y0: series[i].y };
		if (!on[i] && cur) { cur.b = series[i].t; cur.y1 = series[i - 1].y; runs.push(cur); cur = null; }
	}
	runs = runs.filter((r) => r.b - r.a > 120);
	const shown = series.filter((_, i) => on[i]).length / series.length;
	say(`${size}: node 1 -> node 2, 9 s recorded (${series.length} frames); near-white pixels at rest ${base}; the head is on screen in ${(100 * shown).toFixed(0)}% of the frames; journeys: ${runs.map((r) => `+${r.a}..+${r.b} ms (${r.b - r.a} ms, y ${r.y0} -> ${r.y1})`).join('; ')}; rests between them: ${runs.slice(1).map((r, i) => `${r.a - runs[i].b} ms`).join(', ')}`);
	const cells = [];
	for (let t = 0; t <= 4400; t += 200) { const f = rec.at(t0 + t); if (f) cells.push({ img: f.img, label: `+${t} ms` }); }
	await sheet(join(dir, `light-${size}.jpg`), cells, size === 'desk' ? { cols: 6, cellW: 258, cellH: 161 } : { cols: 12, cellW: 125, cellH: 270 });
	await o.context.close();
}
writeFileSync(join(dir, 'light.txt'), `${log.join('\n')}\n`);
await browser.close();
