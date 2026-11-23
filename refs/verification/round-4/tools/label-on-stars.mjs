#!/usr/bin/env node
// The fourth look's own: "claim yours" under a star of the NEXT figure (the station's own figure complete),
// where f8-all.mjs (my copy) found its box over other stars: the label as drawn, cut out at the screen's
// own pixels and enlarged, on this build and (R3_BASE) on the build as it stood (round 4: f7d5ea4, served on 4616).
//   node label-on-stars.mjs            writes b7/label-on-stars.jpg and .txt
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('b7');
const CASES = [['desk', 1, 'slot-27'], ['desk', 7, 'slot-60'], ['desk', 0, 'slot-25'], ['phone', 1, 'slot-27'], ['phone', 0, 'slot-88'], ['phone', 2, 'slot-13']];
const BUILDS = [['this build', 'http://localhost:4615'], ['the build as it stood (f7d5ea4)', 'http://localhost:4616']];
const browser = await launch({ gpu: true });
const cells = [];
const log = [];
for (const [size, k, want] of CASES) {
	for (const [name, base] of BUILDS) {
		const c = CONSTELLATIONS[k];
		const list = c.stars.map((s) => s.slot).filter(Boolean).map((slot) => ({ slot, ask: 'A site' }));
		const o = await open(browser, size, { reducedMotion: true, init: { fn: (l) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(l)); }, arg: list } });
		await o.page.goto(`${base}/?scene=sky&debug`, { waitUntil: 'load' });
		await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning);
		await o.page.evaluate(() => window.__cellestial.sky.ready);
		await o.page.evaluate(() => document.fonts.ready);
		await sleep(800);
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(900);
		const { width: W, height: H } = SIZES[size].viewport;
		let got = null;
		const top = SIZES[size].hasTouch ? 130 : 100;
		outer: for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
			const pt = [30 + ((W - 60) * i) / 11, top + ((H - top - 100) * j) / 11];
			const hit = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('button, a, .sky-claim') ? 'a control' : 'sky') : 'nothing'; }, pt);
			if (hit !== 'sky') continue;
			await o.pressAt(...pt);
			await sleep(160);
			const r = await o.page.evaluate(() => { const w = document.querySelector('[data-claim-words]'); if (!w || w.hidden) return null; const q = w.getBoundingClientRect(); return { slot: w.dataset.slot, side: w.dataset.side ?? 'under', x: q.x, y: q.y, w: q.width, h: q.height, size: getComputedStyle(w).fontSize }; });
			if (r && r.slot === want) { got = { ...r, pt }; break outer; }
			await o.page.keyboard.press('Escape');
			await sleep(60);
		}
		if (!got) { log.push(`${size} ${c.name} ${want} on ${name}: no tap of the grid gave that star`); await o.context.close(); continue; }
		await sleep(400);
		const dpr = SIZES[size].deviceScaleFactor ?? 1;
		const png = await o.page.screenshot({ type: 'png' });
		const bw = 260, bh = 170;
		const cx = got.x + got.w / 2, cy = got.y + got.h / 2 - 20;
		const left = Math.max(0, Math.min(W - bw, Math.round(cx - bw / 2))), tp = Math.max(0, Math.min(H - bh, Math.round(cy - bh / 2)));
		const img = await sharp(png).extract({ left: left * dpr, top: tp * dpr, width: bw * dpr, height: bh * dpr }).resize(520, 340, { kernel: 'nearest' }).jpeg({ quality: 92 }).toBuffer();
		cells.push({ img, label: `${size} ${c.name} complete, ${want}, ${name}: ${got.side}` });
		log.push(`${size} ${c.name} complete, tap at ${got.pt.map(Math.round)} on ${name}: "claim yours" ${got.side} ${got.slot}, box ${Math.round(got.x)},${Math.round(got.y)} ${Math.round(got.w)}x${Math.round(got.h)}, type ${got.size}`);
		await o.context.close();
	}
}
for (const l of log) console.log(l);
await sheet(join(dir, 'label-on-stars.jpg'), cells, { cols: 3, cellW: 520, cellH: 340 });
writeFileSync(join(dir, 'label-on-stars.txt'), `${log.join('\n')}\n`);
await browser.close();
