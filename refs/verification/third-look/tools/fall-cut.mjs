#!/usr/bin/env node
// The fall again: (A) frame times with nothing recording, unslowed and CPU 4x; (B) the light on the
// screen frame by frame (mean luminance of every recorded frame), and the frames either side of the
// steepest drop, enlarged. Production build, real GPU.
//
// Round 2 added (piece 1): part B also from Aries; for each run the steepest drop as a share of that
// run's peak, and the widest SOLID near-white area in any recorded frame (every channel 225 or more;
// measured twice: at least 40 px tall, which is a mass, and at least 12 px tall, which also counts a
// thick lit band along the ground), with how long it stayed wider than 120 px;
// and the options
//   node fall-cut.mjs [--url http://localhost:4615] [--part A,B] [--figs 0,7,3] [--sub fall] [--only desk,phone] [--fresh]
// (--fresh: part A opens a new browser for every run, so each fall is the first that browser's
// graphics process has drawn, as it is for a visitor; without it only the very first run is.)
// (--sub names the folder under refs/verification/third-look/ the output goes to).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, frameTimes, launch, open, outDir, pnow, recorder, sharp, sheet, sleep } from './lib.mjs';

const NAMES = { 0: 'virgo', 7: 'aries', 3: 'sagittarius' };
const { values } = parseArgs({ options: { url: { type: 'string', default: PROD }, part: { type: 'string', default: 'A,B' }, figs: { type: 'string', default: '0,7,3' }, sub: { type: 'string', default: 'fall' }, only: { type: 'string', default: 'desk,phone' }, fresh: { type: 'boolean', default: false } } });
const FIGS = values.figs.split(',').map(Number);
const ONLY = values.only.split(',');
const dir = outDir(values.sub);
const log = [];
const say = (s) => { console.log(s); log.push(s); };
let browser = await launch({ gpu: true });
const stand = async (o, fig) => {
	await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1200);
	await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
	await sleep(2500);
};
if (values.part.includes('A')) say('A. Frame times of the fall with nothing recording (first 2.6 s after the press)');
if (values.part.includes('A')) for (const size of ONLY) for (const fig of FIGS) for (const throttle of [1, 4]) {
	if (values.fresh) {
		await browser.close();
		browser = await launch({ gpu: true });
	}
	const o = await open(browser, size, { throttle, init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await stand(o, fig);
	const p0 = await pnow(o.page);
	await o.press('[data-descend]');
	await sleep(throttle > 1 ? 4500 : 3400);
	const ft = await frameTimes(o.page, p0, p0 + 2600);
	const q = await o.page.evaluate(() => window.__cellestial.sky.debug.stats().quality.level).catch(() => '?');
	say(`${size} ${NAMES[fig]} cpu x${throttle}${values.fresh ? ' (fresh browser)' : ''}: ${ft.text}; governor level after ${q}`);
	await o.context.close();
}
/** The widest solid near-white run in a frame, px of the frame as recorded (CSS px at both sizes: the screencast is at most 1440 wide). */
const whiteRun = async (img, minTall) => {
	const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
	const { width: w, height: h, channels: c } = info;
	const tall = new Uint16Array(w * h); // how many near-white pixels in a column end at this one
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const p = (y * w + x) * c;
		if (data[p] >= 225 && data[p + 1] >= 225 && data[p + 2] >= 225) tall[y * w + x] = (y ? tall[(y - 1) * w + x] : 0) + 1;
	}
	let best = 0;
	for (let y = 0; y < h; y++) {
		let run = 0;
		for (let x = 0; x < w; x++) {
			run = tall[y * w + x] >= minTall ? run + 1 : 0;
			if (run > best) best = run;
		}
	}
	return { px: best, scale: w };
};
if (values.part.includes('B')) say('');
if (values.part.includes('B')) say('B. The light on the screen, frame by frame (mean luminance 0..255 of each recorded frame, ms after the press)');
if (values.part.includes('B')) for (const size of ONLY) for (const fig of FIGS) {
	const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await stand(o, fig);
	const rec = await recorder(o, { quality: 85 });
	await sleep(300);
	const t0 = Date.now();
	await o.press('[data-descend]');
	await sleep(2600);
	await rec.stop();
	const fr = rec.frames.filter((f) => f.ts >= t0 + 300 && f.ts <= t0 + 2200);
	const lum = [];
	for (const f of fr) {
		const { channels } = await sharp(f.img).stats();
		lum.push({ t: Math.round(f.ts - t0), L: 0.2126 * channels[0].mean + 0.7152 * channels[1].mean + 0.0722 * channels[2].mean, img: f.img });
	}
	let worst = 1;
	for (let i = 1; i < lum.length; i++) if (lum[i - 1].L - lum[i].L > lum[worst - 1].L - lum[worst].L) worst = i;
	const peak = lum.reduce((a, b) => (b.L > a.L ? b : a));
	say(`${size} ${NAMES[fig]}: ${lum.map((l) => `${l.t}:${l.L.toFixed(1)}`).join(' ')}`);
	say(`${size} ${NAMES[fig]}: peak ${peak.L.toFixed(1)} at +${peak.t}; steepest drop between two consecutive frames ${lum[worst - 1].L.toFixed(1)} -> ${lum[worst].L.toFixed(1)} (+${lum[worst - 1].t} -> +${lum[worst].t} ms), ${(((lum[worst - 1].L - lum[worst].L) / peak.L) * 100).toFixed(1)}% of the peak`);
	const cssW = size === 'desk' ? 1440 : 390;
	for (const minTall of [40, 12]) {
		const white = [];
		for (const l of lum) {
			const r = await whiteRun(l.img, Math.round((minTall * (await sharp(l.img).metadata()).width) / cssW));
			white.push({ t: l.t, px: Math.round((r.px * cssW) / r.scale) });
		}
		const widest = white.reduce((a, b) => (b.px > a.px ? b : a));
		const wide = white.filter((x) => x.px > 120);
		say(`${size} ${NAMES[fig]}: widest solid near-white area at least ${minTall} px tall: ${widest.px} px (CSS) at +${widest.t}; wider than 120 px in ${wide.length} frames${wide.length ? ` (+${wide[0].t} to +${wide[wide.length - 1].t} ms)` : ''}${minTall === 40 ? `; by frame over 60 px: ${white.filter((x) => x.px > 60).map((x) => `${x.t}:${x.px}`).join(' ') || 'none'}` : ''}`);
	}
	const cells = lum.slice(Math.max(0, worst - 3), worst + 3).map((l) => ({ img: l.img, label: `+${l.t} ms  mean light ${l.L.toFixed(1)}` }));
	await sheet(join(dir, `${size}-${NAMES[fig]}-cut.jpg`), cells, size === 'desk' ? { cols: 3, cellW: 520, cellH: 325 } : { cols: 6, cellW: 258, cellH: 558 });
	await o.context.close();
}
writeFileSync(join(dir, `fall-cut${values.part === 'A,B' ? '' : `-${values.part}`}${values.fresh ? '-fresh' : ''}.txt`), `${log.join('\n')}\n`);
await browser.close();
