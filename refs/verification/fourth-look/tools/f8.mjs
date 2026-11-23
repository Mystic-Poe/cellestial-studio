#!/usr/bin/env node
// Finding 8: a complete figure, then a tap: is "claim yours" (for a star of the next figure) drawn over
// the meaning's words? One figure at a time is seeded complete; three taps each, both sizes.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, launch, open, outDir, sheet, sleep } from './lib.mjs';
const dir = outDir('b7');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of ['desk', 'phone']) {
	const cells = [];
	for (const k of [7, 0, 8, 4, 10]) {
		const c = CONSTELLATIONS[k];
		const list = c.stars.map((s) => s.slot).filter(Boolean).map((slot) => ({ slot, ask: 'A site' }));
		const o = await open(browser, size, { init: { fn: (l) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(l)); }, arg: list } });
		await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
		await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning);
		await o.page.evaluate(() => window.__cellestial.sky.ready);
		await sleep(1200);
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(4500);
		const m = await o.page.evaluate((name) => { const e = document.querySelector(`.sky-meaning[data-meaning="${name}"]`); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, c.name);
		if (!m) { say(`${size} ${c.name}: no meaning shown`); await o.context.close(); continue; }
		const taps = [[m.x + m.w / 2, m.y + m.h + 40], [m.x - 30, m.y + m.h / 2], [m.x + m.w + 30, m.y - 30]].map(([x, y]) => [Math.min(o.W - 30, Math.max(30, x)), Math.min(o.H - 150, Math.max(120, y))]);
		for (const [i, pt] of taps.entries()) {
			const hit = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('button, a') ? 'a control' : 'sky') : 'nothing'; }, pt);
			if (hit !== 'sky') { say(`${size} ${c.name} tap ${i + 1} at ${pt.map(Math.round)}: lands on ${hit}, skipped`); continue; }
			await o.pressAt(...pt);
			await sleep(2300);
			const r = await o.page.evaluate((mm) => {
				const w = document.querySelector('[data-claim-words]');
				if (!w || w.hidden) return { shown: false };
				const q = w.getBoundingClientRect();
				const over = q.x < mm.x + mm.w && mm.x < q.x + q.width && q.y < mm.y + mm.h && mm.y < q.y + q.height;
				return { shown: true, x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height), over, gap: Math.round(Math.hypot(Math.max(mm.x - (q.x + q.width), 0, q.x - (mm.x + mm.w)), Math.max(mm.y - (q.y + q.height), 0, q.y - (mm.y + mm.h)))) };
			}, m);
			say(`${size} ${c.name} complete, tap ${i + 1} at ${pt.map(Math.round)}: ${r.shown ? `"claim yours" at ${r.x},${r.y} (${r.w}x${r.h}); meaning at ${Math.round(m.x)},${Math.round(m.y)} ${Math.round(m.w)}x${Math.round(m.h)}; ${r.over ? 'OVER THE MEANING' : `clear of it by ${r.gap} px`}` : 'no "claim yours" shown (no empty star answered)'}`);
			cells.push({ img: await o.page.screenshot({ type: 'jpeg', quality: 88 }), label: `${c.name} tap ${i + 1}${r.shown ? (r.over ? ' OVER' : ` clear ${r.gap}px`) : ' none'}` });
			await o.page.keyboard.press('Escape');
			await sleep(500);
		}
		await o.context.close();
	}
	await sheet(join(dir, `claim-yours-${size}.jpg`), cells, size === 'desk' ? { cols: 5, cellW: 312, cellH: 195 } : { cols: 8, cellW: 190, cellH: 412 });
}
writeFileSync(join(dir, 'f8.txt'), `${log.join('\n')}\n`);
await browser.close();
