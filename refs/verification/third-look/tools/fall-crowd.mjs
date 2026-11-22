#!/usr/bin/env node
// The third look's own: the crash at the ground, ENLARGED. The fall is recorded in real time on the
// production build (real GPU) and every recorded frame between --from and --to ms after the press is
// cut to a box round the ground (CSS px, as recorded) and laid out at the recording's own pixels, so
// that a row of separate strikes can be told from one flat band of white.
//   node fall-crowd.mjs [--size desk] [--fig 3] [--from 560] [--to 1160] [--step 50] [--box 380,540,700,320] [--tag crowd]
// For each cut frame also: the share of the box that is solid near-white (every channel 235 or more)
// and the longest horizontal run of such pixels on any one row (px of the recording).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';

const NAMES = ['virgo', 'libra', 'scorpius', 'sagittarius', 'capricornus', 'aquarius', 'pisces', 'aries', 'taurus', 'gemini', 'cancer', 'leo'];
const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, fig: { type: 'string', default: '3' }, from: { type: 'string', default: '560' }, to: { type: 'string', default: '1160' }, step: { type: 'string', default: '50' }, box: { type: 'string', default: '380,540,700,320' }, tag: { type: 'string', default: 'crowd' }, cols: { type: 'string', default: '2' } } });
const dir = outDir('fall');
const fig = Number(values.fig);
const [bx, by, bw, bh] = values.box.split(',').map(Number);
const browser = await launch({ gpu: true });
const o = await open(browser, values.size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
await o.page.evaluate(() => window.__cellestial.sky.ready);
await sleep(1200);
await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
await sleep(2500);
const rec = await recorder(o, { quality: 92 });
await sleep(300);
const t0 = Date.now();
await o.press('[data-descend]');
await sleep(2800);
await rec.stop();
const log = [];
const cells = [];
const meta = await sharp(rec.frames[0].img).metadata();
const s = meta.width / o.W;
const crop = { left: Math.round(bx * s), top: Math.round(by * s), width: Math.round(bw * s), height: Math.round(bh * s) };
let last = -1e9;
for (const f of rec.frames) {
	const t = f.ts - t0;
	if (t < Number(values.from) || t > Number(values.to) || t - last < Number(values.step) - 8) continue;
	last = t;
	const img = await sharp(f.img).extract(crop).png().toBuffer();
	const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
	let white = 0, best = 0;
	for (let y = 0; y < info.height; y++) {
		let run = 0;
		for (let x = 0; x < info.width; x++) {
			const p = (y * info.width + x) * info.channels;
			if (data[p] >= 235 && data[p + 1] >= 235 && data[p + 2] >= 235) { white++; run++; if (run > best) best = run; } else run = 0;
		}
	}
	log.push(`${values.size} ${NAMES[fig]} +${Math.round(t)} ms: solid near-white ${(100 * white / (info.width * info.height)).toFixed(1)}% of the box; longest white run on one row ${Math.round(best / s)} css px`);
	cells.push({ img, label: `${NAMES[fig]} +${Math.round(t)} ms   white ${(100 * white / (info.width * info.height)).toFixed(1)}%  longest row run ${Math.round(best / s)} px`, enlarge: true });
}
const cols = Number(values.cols);
const cellW = Math.floor((1600 - (cols + 1) * 8) / cols);
const cellH = Math.round((cellW * bh) / bw);
const per = cols * Math.max(1, Math.floor(1560 / (cellH + 34)));
for (let i = 0, n = 1; i < cells.length; i += per, n++) await sheet(join(dir, `${values.size}-${NAMES[fig]}-${values.tag}-${n}.jpg`), cells.slice(i, i + per), { cols, cellW, cellH });
for (const l of log) console.log(l);
writeFileSync(join(dir, `${values.size}-${NAMES[fig]}-${values.tag}.txt`), `${log.join('\n')}\nconsole errors: ${o.errors.join(' | ') || 'none'}\n`);
await browser.close();
