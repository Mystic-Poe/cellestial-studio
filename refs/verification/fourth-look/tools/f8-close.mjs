#!/usr/bin/env node
// The third look's own: the two taps of f8.mjs that put "claim yours" over the meaning's box on the
// desktop (Aries and Taurus complete, the third tap), cut out at the screen's own pixels and enlarged.
// NOTE: run only when nothing timing-sensitive is running.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('b7');
const log = [];
const browser = await launch({ gpu: true });
const cells = [];
for (const [k, pt] of [[7, [808, 533]], [8, [741, 530]]]) {
	const c = CONSTELLATIONS[k];
	const list = c.stars.map((s) => s.slot).filter(Boolean).map((slot) => ({ slot, ask: 'A site' }));
	const o = await open(browser, 'desk', { init: { fn: (l) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(l)); }, arg: list } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1200);
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
	await sleep(4500);
	await o.pressAt(...pt);
	await sleep(2300);
	const r = await o.page.evaluate((name) => {
		const w = document.querySelector('[data-claim-words]'), e = document.querySelector(`.sky-meaning[data-meaning="${name}"]`);
		const q = w.getBoundingClientRect(), m = e.getBoundingClientRect();
		const range = document.createRange(); range.selectNodeContents(w); const t = range.getBoundingClientRect();
		const lines = [...e.querySelectorAll('.sky-meaning__line')].map((l) => { const rg = document.createRange(); rg.selectNodeContents(l); const b = rg.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
		return { hidden: w.hidden, label: { x: q.x, y: q.y, w: q.width, h: q.height }, text: { x: t.x, y: t.y, w: t.width, h: t.height }, meaning: { x: m.x, y: m.y, w: m.width, h: m.height }, lines };
	}, c.name);
	const png = await o.page.screenshot({ type: 'png' });
	const box = { left: Math.round(r.label.x - 260), top: Math.round(r.label.y - 60), width: 460, height: 150 };
	cells.push({ img: await sharp(png).extract(box).resize({ width: 1380, kernel: 'nearest' }).png().toBuffer(), label: `${c.name} complete, a tap at ${pt}: "claim yours" (its box ${Math.round(r.label.x)},${Math.round(r.label.y)} ${Math.round(r.label.w)}x${Math.round(r.label.h)}; its letters ${Math.round(r.text.x)},${Math.round(r.text.y)} ${Math.round(r.text.w)}x${Math.round(r.text.h)}) beside the meaning (box ${Math.round(r.meaning.x)},${Math.round(r.meaning.y)} ${Math.round(r.meaning.w)}x${Math.round(r.meaning.h)}), x3`, enlarge: true });
	const L = r.lines[0] ?? r.meaning;
	const gapX = r.text.x - (L.x + L.w), gapY = Math.max(L.y - (r.text.y + r.text.h), r.text.y - (L.y + L.h));
	log.push(`${c.name}: "claim yours" letters at x ${r.text.x.toFixed(0)}..${(r.text.x + r.text.w).toFixed(0)}, y ${r.text.y.toFixed(0)}..${(r.text.y + r.text.h).toFixed(0)}; the meaning's letters at x ${L.x.toFixed(0)}..${(L.x + L.w).toFixed(0)}, y ${L.y.toFixed(0)}..${(L.y + L.h).toFixed(0)}; the letters ${gapX >= 0 || gapY >= 0 ? `do not overlap (${gapX.toFixed(0)} px apart sideways)` : 'OVERLAP'}`);
	await o.context.close();
}
await sheet(join(dir, 'claim-yours-close-desk.jpg'), cells, { cols: 1, cellW: 1380, cellH: 450 });
for (const l of log) console.log(l);
writeFileSync(join(dir, 'f8-close.txt'), `${log.join('\n')}\n`);
await browser.close();
