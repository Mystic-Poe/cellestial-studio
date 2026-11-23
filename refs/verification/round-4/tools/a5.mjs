#!/usr/bin/env node
// Finding 6: A5, the hand-off from the loader to the sky, in real time on the production build
// (a first visit to "/"), both sizes, every recorded frame measured (how much of it is near-white,
// its mean light) and a dense strip of the middle of the screen.
//   node a5.mjs [--throttle 1]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { out: { type: 'string', default: 'a5' }, throttle: { type: 'string', default: '1' }, only: { type: 'string', default: 'desk,phone' } } });
const throttle = Number(values.throttle);
const dir = outDir(values.out);
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of values.only.split(',')) {
	const o = await open(browser, size, { throttle });
	const rec = await recorder(o, { quality: 88 });
	const t0 = Date.now();
	await o.page.goto(`${PROD}/?debug`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 40000 });
	const tSky = Date.now();
	await sleep(1500);
	await rec.stop();
	const tag = `${size}${throttle > 1 ? `-cpu${throttle}x` : ''}`;
	say(`${tag}: scene "sky" ${tSky - t0} ms after navigation; console errors: ${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'}`);
	const fr = rec.frames.filter((f) => f.ts >= tSky - 1900 && f.ts <= tSky + 900);
	const rows = [];
	for (const f of fr) {
		const { data, info } = await sharp(f.img).raw().toBuffer({ resolveWithObject: true });
		let white = 0, bright = 0, sum = 0;
		const n = info.width * info.height;
		for (let i = 0; i < data.length; i += info.channels) {
			const r = data[i], g = data[i + 1], b = data[i + 2];
			const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			sum += L;
			if (Math.min(r, g, b) > 225) white++;
			if (L > 128) bright++;
		}
		rows.push({ t: Math.round(f.ts - tSky), L: sum / n, white: (100 * white) / n, bright: (100 * bright) / n, img: f.img, w: info.width, h: info.height });
	}
	say(`${tag}: ms relative to the scene change : mean light : % of the frame near-white (every channel over 225) : % brighter than mid-grey`);
	say(rows.map((r) => `${r.t}:${r.L.toFixed(1)}:${r.white.toFixed(2)}:${r.bright.toFixed(1)}`).join('  '));
	const peakW = rows.reduce((a, b) => (b.white > a.white ? b : a));
	let jump = 1;
	for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i].L - rows[i - 1].L) > Math.abs(rows[jump].L - rows[jump - 1].L)) jump = i;
	say(`${tag}: most near-white ${peakW.white.toFixed(2)}% of the frame at ${peakW.t} ms; largest change of mean light between two consecutive frames ${rows[jump - 1].L.toFixed(1)} -> ${rows[jump].L.toFixed(1)} at ${rows[jump - 1].t} -> ${rows[jump].t} ms`);
	// dense strip, the middle of the screen enlarged
	const phone = size === 'phone';
	const pick = [];
	for (let t = -1650; t <= 650; t += phone ? 50 : 66) {
		let best = null;
		for (const r of rows) if (r.t <= t + 10) best = r;
		if (best) pick.push({ t, r: best });
	}
	const cells = [];
	for (const { t, r } of pick) {
		const crop = phone
			? { left: 0, top: Math.round(r.h * 0.2), width: r.w, height: Math.round(r.h * 0.6) }
			: { left: Math.round(r.w * 0.19), top: Math.round(r.h * 0.12), width: Math.round(r.w * 0.62), height: Math.round(r.h * 0.76) };
		cells.push({ img: await sharp(r.img).extract(crop).toBuffer(), label: `${t} ms` });
	}
	const per = phone ? 24 : 20;
	for (let i = 0, k = 1; i < cells.length; i += per, k++) {
		await sheet(join(dir, `${tag}-handoff-${k}.jpg`), cells.slice(i, i + per), phone ? { cols: 12, cellW: 125, cellH: 165 } : { cols: 5, cellW: 310, cellH: 238 });
	}
	// the pieces close up: every other recorded frame from the break to the rings
	{
		const z = [];
		for (let t = -1380; t <= -610; t += 33) {
			let best = null;
			for (const r of rows) if (r.t <= t + 8) best = r;
			if (!best) continue;
			const crop = phone
				? { left: 0, top: Math.round(best.h * 0.3), width: best.w, height: Math.round(best.h * 0.4) }
				: { left: Math.round(best.w * 0.45), top: Math.round(best.h * 0.2), width: Math.round(best.w * 0.4), height: Math.round(best.h * 0.45) };
			z.push({ img: await sharp(best.img).extract(crop).toBuffer(), label: `${t} ms`, enlarge: true });
		}
		await sheet(join(dir, `${tag}-pieces.jpg`), z, phone ? { cols: 6, cellW: 258, cellH: 224 } : { cols: 4, cellW: 390, cellH: 275 });
	}
	// the three frames round the scene change, whole
	const near = rows.filter((r) => r.t >= -40 && r.t <= 120).slice(0, 6);
	await sheet(join(dir, `${tag}-swap.jpg`), near.map((r) => ({ img: r.img, label: `${r.t} ms, mean light ${r.L.toFixed(1)}` })), phone ? { cols: 6, cellW: 258, cellH: 558 } : { cols: 3, cellW: 520, cellH: 325 });
	await o.context.close();
}
writeFileSync(join(dir, `a5${throttle > 1 ? `-cpu${throttle}x` : ''}.txt`), `${log.join('\n')}\n`);
await browser.close();
