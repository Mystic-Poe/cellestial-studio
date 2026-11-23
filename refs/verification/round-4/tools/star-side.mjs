#!/usr/bin/env node
// Round 2, piece 4c: the empty star at its station, BEFORE and AFTER in one run of one build. The page
// is opened twice at each size: once as built, once with the station picture
// (/cellestial/sky/b4-station.webp) answered from an earlier commit, so nothing else differs. Each
// star is cut from the screenshot pixel for pixel (no JPEG, no resampling), shown as it is and
// enlarged 6x with hard pixels. Production build, real GPU. Writes stars/side-by-side-<size>-<large|small>.png
// (the largest and the smallest star on screen at Aries and at Taurus) and side-by-side.txt.
//   node star-side.mjs [--rev c0cacf3]      the commit the "before" picture is taken from
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, ROOT, SIZES, hex, launch, open, outDir, sharp, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { rev: { type: 'string', default: 'c0cacf3' } } });
const dir = outDir('stars');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const old = execFileSync('git', ['show', `${values.rev}:public/cellestial/sky/b4-station.webp`], { cwd: ROOT, maxBuffer: 1 << 24 });
const browser = await launch({ gpu: true });
const Z = 6;
const rows = [];
for (const size of ['desk', 'phone']) {
	const dpr = SIZES[size].deviceScaleFactor;
	for (const fig of [7, 8]) {
		const c = CONSTELLATIONS[fig];
		const slots = c.stars.map((s) => s.slot).filter(Boolean);
		const row = { label: `${size} ${c.name}`, cells: [] };
		for (const which of ['before', 'after']) {
			const o = await open(browser, size, { init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
			if (which === 'before') await o.page.route('**/cellestial/sky/b4-station.webp', (r) => r.fulfill({ body: old, contentType: 'image/webp' }));
			await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
			await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
			await o.page.evaluate(() => window.__cellestial.sky.ready);
			await sleep(1000);
			await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
			await sleep(3000);
			// The stars turn very slowly: both shots are taken the same time after the same call.
			const png = await o.page.screenshot({ type: 'png' });
			const circles = (await o.page.evaluate((list) => list.map((s) => window.__cellestial.sky.hooks.starCircle(s)), slots)).filter(Boolean).filter((q) => q.x > 60 && q.y > 60 && q.x < o.W - 60 && q.y < o.H - 60);
			// the largest star on screen, and the smallest
			circles.sort((a, b) => b.r - a.r);
			for (const q of [circles[0], circles.at(-1)]) {
				const R = Math.ceil(q.r * 1.45 * dpr);
				const box = { left: Math.round(q.x * dpr) - R, top: Math.round(q.y * dpr) - R, width: 2 * R, height: 2 * R };
				const crop = await sharp(png).extract(box).png().toBuffer();
				const { data, info } = await sharp(crop).raw().toBuffer({ resolveWithObject: true });
				// How much of the disc is brass, and how the brass is broken up: along every row of the disc,
				// the runs of brass pixels (a line is a short run; a blotch is a long one).
				let inside = 0, warm = 0, runs = 0, runPx = 0, longRuns = 0, wr = 0, wg = 0, wb = 0;
				for (let y = 0; y < info.height; y++) {
					let run = 0;
					for (let x = 0; x <= info.width; x++) {
						const i = (y * info.width + x) * info.channels;
						const d = x < info.width ? Math.hypot(x + 0.5 - R, y + 0.5 - R) / (q.r * dpr) : 9;
						const on = d < 0.8 && data[i] > data[i + 2] + 18 && data[i] > 70;
						if (d < 0.8) inside++;
						if (on) { warm++; run++; wr += data[i]; wg += data[i + 1]; wb += data[i + 2]; }
						else if (run) { runs++; runPx += run; if (run >= 4) longRuns++; run = 0; }
					}
				}
				say(`${size} ${c.name} ${which}: a star ${(2 * q.r * dpr).toFixed(0)} device px across (${(2 * q.r).toFixed(0)} CSS px): brass ${(100 * warm / inside).toFixed(1)}% of the disc, mean ${warm ? hex(wr / warm, wg / warm, wb / warm) : 'none'}; across the rows ${runs} runs of brass, ${(runPx / Math.max(1, runs)).toFixed(2)} px long on average, ${longRuns} of them 4 px or longer`);
				row.cells.push({ crop, size: 2 * R, label: `${which}, ${(2 * q.r * dpr).toFixed(0)} px` });
			}
			await o.context.close();
		}
		// order: before large, after large, before small, after small
		row.cells = [row.cells[0], row.cells[2], row.cells[1], row.cells[3]];
		rows.push(row);
	}
}
await browser.close();
const lh = 24, gap = 10;
const cellW = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.size))) * (Z + 1) + 3 * gap;
const cellH = Math.max(...rows.flatMap((r) => r.cells.map((c) => c.size))) * Z + lh + 2 * gap;
// Four sheets, each under 1600 px: a size, and its largest or its smallest star; before on the left.
for (const size of ['desk', 'phone']) for (const [k, which] of ['large', 'small'].entries()) {
	const mine = rows.filter((r) => r.label.startsWith(size));
	const parts = [];
	for (const [j, row] of mine.entries()) for (const [i, cell] of row.cells.slice(2 * k, 2 * k + 2).entries()) {
		const left = i * cellW + gap, top = j * cellH + gap;
		parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW - gap}" height="${lh}"><text x="0" y="16" font-family="sans-serif" font-size="13" fill="#ddd">${row.label}: ${cell.label} (as drawn, and x${Z})</text></svg>`), left, top });
		parts.push({ input: cell.crop, left, top: top + lh });
		parts.push({ input: await sharp(cell.crop).resize({ width: cell.size * Z, kernel: 'nearest' }).png().toBuffer(), left: left + cell.size + gap, top: top + lh });
	}
	const file = `side-by-side-${size}-${which}.png`;
	await sharp({ create: { width: 2 * cellW, height: mine.length * cellH, channels: 3, background: '#000' } }).composite(parts).png().toFile(join(dir, file));
	say(`wrote stars/${file} (${2 * cellW}x${mine.length * cellH}); "before" is the station picture of ${values.rev}`);
}
writeFileSync(join(dir, 'side-by-side.txt'), `${log.join('\n')}\n`);
