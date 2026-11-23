#!/usr/bin/env node
// The fifth look's own: the phone's taps that my-labels.mjs wrote down as "none": what is on the page after each.
//   node probe2.mjs      (R3_BASE for the build as it stood)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, PROD, ROOT, launch, open, sleep } from './lib.mjs';
const taps = JSON.parse(readFileSync(join(ROOT, 'refs/verification/fifth-look/labels/phone.json'))).filter((t) => t.what === 'none');
const browser = await launch({ gpu: true });
const tally = {};
for (const k of [...new Set(taps.map((t) => t.k))]) {
	const o = await open(browser, 'phone', { reducedMotion: true, init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(600);
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
	await sleep(900);
	for (const t of taps.filter((x) => x.k === k)) {
		await o.pressAt(...t.pt);
		await sleep(400);
		const r = await o.page.evaluate(([x, y]) => {
			const w = document.querySelector('[data-claim-words]');
			const panel = [...document.querySelectorAll('[data-sky-panel]')].find((p) => !p.hidden);
			const hooks = window.__cellestial.sky.hooks;
			let near = null;
			for (const b of document.querySelectorAll('#sky-ui button[data-slot], #sky-ui [data-slot]')) { const c = hooks.starCircle(b.dataset.slot); if (c && Number.isFinite(c.x)) { const d = Math.hypot(c.x - x, c.y - y) - c.r; if (!near || d < near.d) near = { slot: b.dataset.slot, d: Math.round(d) }; } }
			return { words: w && !w.hidden && getComputedStyle(w).visibility !== 'hidden' ? w.dataset.slot : null, panel: panel ? `${panel.dataset.skyPanel} ${panel.dataset.slot ?? panel.querySelector('[data-slot]')?.dataset.slot ?? ''}` : null, near };
		}, t.pt);
		const what = r.panel ? 'a panel' : r.words ? 'words' : 'nothing';
		tally[what] = (tally[what] ?? 0) + 1;
		console.log(`${t.fig} ${t.pt.map(Math.round)}: ${what}${r.panel ? ` (${r.panel})` : ''}${r.words ? ` (${r.words})` : ''}; nearest star's disc ${r.near ? `${r.near.slot} ${r.near.d} px from the touch` : '?'}`);
		await o.page.keyboard.press('Escape');
		await sleep(200);
	}
	await o.context.close();
}
console.log(JSON.stringify(tally));
await browser.close();
