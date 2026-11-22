#!/usr/bin/env node
// The hand-off's last instant, many times over: is there a frame in which Cellestial's star is missing?
// For each run the mean light of every recorded frame from 400 ms before the scene becomes "sky" to
// 600 ms after; a frame whose light is under 70% of both its neighbours' is a blink. The worst is kept.
//   node a5-repeat.mjs [--runs 10] [--throttle 1]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { runs: { type: 'string', default: '10' }, throttle: { type: 'string', default: '1' }, only: { type: 'string', default: 'desk,phone' } } });
const throttle = Number(values.throttle);
const dir = outDir('a5');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of values.only.split(',')) {
	let blinks = 0;
	const keep = [];
	for (let run = 1; run <= Number(values.runs); run++) {
		const o = await open(browser, size, { throttle });
		const rec = await recorder(o, { quality: 80 });
		const t0 = Date.now();
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 60000 });
		const tSky = Date.now();
		await sleep(900);
		await rec.stop();
		const fr = rec.frames.filter((f) => f.ts >= tSky - 400 && f.ts <= tSky + 600);
		const L = [];
		for (const f of fr) {
			const { channels } = await sharp(f.img).stats();
			L.push(0.2126 * channels[0].mean + 0.7152 * channels[1].mean + 0.0722 * channels[2].mean);
		}
		const bad = [];
		for (let i = 1; i < L.length - 1; i++) if (L[i] < 0.7 * L[i - 1] && L[i] < 0.7 * L[i + 1]) bad.push(i);
		if (bad.length) {
			blinks++;
			const i = bad[0];
			if (keep.length < 2) for (const k of [i - 1, i, i + 1]) keep.push({ img: fr[k].img, label: `run ${run}: ${Math.round(fr[k].ts - tSky)} ms, light ${L[k].toFixed(1)}` });
		}
		say(`${size} cpu x${throttle} run ${run}: sky at ${tSky - t0} ms; ${fr.length} frames round the change; ${bad.length ? `BLINK at ${bad.map((i) => `${Math.round(fr[i].ts - tSky)} ms (${L[i - 1].toFixed(1)} -> ${L[i].toFixed(1)} -> ${L[i + 1].toFixed(1)})`).join(', ')}` : 'no blink'}; errors ${o.errors.length}`);
		await o.context.close();
	}
	say(`${size} cpu x${throttle}: a frame without the star in ${blinks} of ${values.runs} runs`);
	if (keep.length) await sheet(join(dir, `${size}${throttle > 1 ? `-cpu${throttle}x` : ''}-blink.jpg`), keep, size === 'phone' ? { cols: 6, cellW: 258, cellH: 558 } : { cols: 3, cellW: 520, cellH: 325 });
}
writeFileSync(join(dir, `blink${throttle > 1 ? `-cpu${throttle}x` : ''}.txt`), `${log.join('\n')}\n`);
await browser.close();
