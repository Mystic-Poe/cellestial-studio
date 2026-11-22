#!/usr/bin/env node
// The fall again: (A) frame times with nothing recording, unslowed and CPU 4x; (B) the light on the
// screen frame by frame (mean luminance of every recorded frame), and the frames either side of the
// steepest drop, enlarged. Production build, real GPU.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, frameTimes, launch, open, outDir, pnow, recorder, sharp, sheet, sleep } from './lib.mjs';

const NAMES = { 0: 'virgo', 7: 'aries', 3: 'sagittarius' };
const dir = outDir('fall');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const stand = async (o, fig) => {
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1200);
	await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
	await sleep(2500);
};
say('A. Frame times of the fall with nothing recording (first 2.6 s after the press)');
for (const size of ['desk', 'phone']) for (const fig of [0, 7, 3]) for (const throttle of [1, 4]) {
	const o = await open(browser, size, { throttle, init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await stand(o, fig);
	const p0 = await pnow(o.page);
	await o.press('[data-descend]');
	await sleep(throttle > 1 ? 4500 : 3400);
	const ft = await frameTimes(o.page, p0, p0 + 2600);
	const q = await o.page.evaluate(() => window.__cellestial.sky.debug.stats().quality.level).catch(() => '?');
	say(`${size} ${NAMES[fig]} cpu x${throttle}: ${ft.text}; governor level after ${q}`);
	await o.context.close();
}
say('');
say('B. The light on the screen, frame by frame (mean luminance 0..255 of each recorded frame, ms after the press)');
for (const size of ['desk', 'phone']) for (const fig of [0, 3]) {
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
	say(`${size} ${NAMES[fig]}: peak ${peak.L.toFixed(1)} at +${peak.t}; steepest drop between two consecutive frames ${lum[worst - 1].L.toFixed(1)} -> ${lum[worst].L.toFixed(1)} (+${lum[worst - 1].t} -> +${lum[worst].t} ms)`);
	const cells = lum.slice(Math.max(0, worst - 3), worst + 3).map((l) => ({ img: l.img, label: `+${l.t} ms  mean light ${l.L.toFixed(1)}` }));
	await sheet(join(dir, `${size}-${NAMES[fig]}-cut.jpg`), cells, size === 'desk' ? { cols: 3, cellW: 520, cellH: 325 } : { cols: 6, cellW: 258, cellH: 558 });
	await o.context.close();
}
writeFileSync(join(dir, 'fall-cut.txt'), `${log.join('\n')}\n`);
await browser.close();
