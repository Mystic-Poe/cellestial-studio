#!/usr/bin/env node
// The fourth look's own: THE EMPTY SKY, the common case. A visitor taps the sky and "claim yours" is written
// by the nearest empty star of the figure he stands at. At every station the sky tapped on a grid (a real
// touch or click); for each distinct label: the label's box against the discs of every OTHER star of the figure, against Cellestial's star
// (its core's disc, and at Virgo the full reach of its rings), the logo, the menu, the exit button and
// the screen's edge. Reduced motion (a tap marks its star at once; the placing is the same code).
//   node label-near.mjs [--sizes desk,phone]      writes b7/label-near.txt and b7/label-near-<size>.jpg
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone' } } });
const dir = outDir('b7');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	const dpr = SIZES[size].deviceScaleFactor ?? 1;
	const o = await open(browser, size, { reducedMotion: true, init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(800);
	const rings = await o.page.evaluate(() => window.__cellestial.sky.introRings?.() ?? null).catch(() => null);
	let distinct = 0, shown = 0, onStar = 0, onCore = 0, onChrome = 0, outside = 0, none = 0, least = Infinity, leastAt = '';
	const sides = {};
	const cells = [];
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(900);
		const slots = c.stars.map((s) => s.slot).filter(Boolean);
		const cols = W > 700 ? 11 : 6, rows = 9;
		const top0 = SIZES[size].hasTouch ? 130 : 100;
		const seen = new Set();
		for (let n = 0; n < cols * rows; n++) {
			const slot = 'sky';
			const pt = [30 + ((W - 60) * (n % cols)) / (cols - 1), top0 + ((H - top0 - 100) * Math.floor(n / cols)) / (rows - 1)];
			const hit = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('button, a, .sky-claim') ? 'a control' : 'sky') : 'nothing'; }, pt);
			if (hit !== 'sky') continue;
			await o.pressAt(...pt);
			await sleep(180);
			if (await o.page.evaluate(() => !!document.querySelector('dialog[open], [data-panel]:not([hidden])')).catch(() => false)) { await o.page.keyboard.press('Escape'); await sleep(150); continue; }
			const r = await o.page.evaluate(([own, all]) => {
				const w = document.querySelector('[data-claim-words]');
				if (!w || w.hidden || getComputedStyle(w).visibility === 'hidden') return null;
				const b = w.getBoundingClientRect();
				const box = { x: b.x, y: b.y, w: b.width, h: b.height };
				const hooks = window.__cellestial.sky.hooks;
				const disc = (s) => Math.hypot(Math.max(box.x - s.x, 0, s.x - (box.x + box.w)), Math.max(box.y - s.y, 0, s.y - (box.y + box.h))) - s.r;
				const others = all.filter((s) => s !== w.dataset.slot).map((s) => hooks.starCircle(s)).filter((s) => s && Number.isFinite(s.x));
				const core = window.__cellestial.sky.coreCircle?.() ?? null;
				const rect = (e) => { if (!e) return null; const g = e.getBoundingClientRect(); return g.width ? { x: g.x, y: g.y, w: g.width, h: g.height } : null; };
				const gap = (a, c) => Math.hypot(Math.max(c.x - (a.x + a.w), 0, a.x - (c.x + c.w)), Math.max(c.y - (a.y + a.h), 0, a.y - (c.y + c.h)));
				const chrome = [['the logo', rect(document.querySelector('.chrome-logo'))], ['the menu', rect(document.querySelector('#chrome button[popovertarget]'))], ['the exit button', rect(document.querySelector('[data-descend]'))]].filter(([, g]) => g && gap(box, g) === 0).map(([n]) => n);
				return { slot: w.dataset.slot, asked: own, side: w.dataset.side ?? 'under', box, starGap: others.length ? Math.min(...others.map(disc)) : Infinity, on: others.filter((s) => disc(s) < 0).length, core: core ? { gap: disc(core), x: core.x, y: core.y, r: core.r } : null, chrome, inside: box.x >= 0 && box.y >= 0 && box.x + box.w <= innerWidth && box.y + box.h <= innerHeight };
			}, [slot, slots]);
			if (!r) { none++; await o.page.keyboard.press('Escape'); await sleep(80); continue; }
			shown++;
			if (seen.has(r.slot + r.side)) { await o.page.keyboard.press('Escape'); await sleep(60); continue; }
			seen.add(r.slot + r.side);
			distinct++;
			sides[r.side] = (sides[r.side] ?? 0) + 1;
			const wrong = [];
			if (r.on) { onStar++; wrong.push(`on ${r.on} other star(s) of the figure (deepest ${(-r.starGap).toFixed(1)} px into a disc)`); }
			const ringReach = k === 0 && rings && r.core ? Math.hypot(Math.max(r.box.x - r.core.x, 0, r.core.x - (r.box.x + r.box.w)), Math.max(r.box.y - r.core.y, 0, r.core.y - (r.box.y + r.box.h))) : null;
			if (r.core && r.core.gap < 0) { onCore++; wrong.push(`on Cellestial's core (${(-r.core.gap).toFixed(1)} px in)`); }
			if (r.chrome.length) { onChrome++; wrong.push(`on ${r.chrome.join(', ')}`); }
			if (!r.inside) { outside++; wrong.push('outside the screen'); }
			if (r.starGap < least) { least = r.starGap; leastAt = `${c.name} ${r.slot}`; }
			if (wrong.length || (ringReach !== null && ringReach < 110 * (W / 1440 + 0.25))) {
				say(`  ${size} ${String(k + 1).padStart(2)} ${c.name} ${r.slot}: "claim yours" ${r.side}, box ${Math.round(r.box.x)},${Math.round(r.box.y)} ${Math.round(r.box.w)}x${Math.round(r.box.h)}: ${wrong.join('; ') || 'touches no disc'}${ringReach !== null ? `; ${ringReach.toFixed(0)} px from the centre of Cellestial's star` : ''}`);
				if (cells.length < 18) {
					const png = await o.page.screenshot({ type: 'png' });
					const bw = 240, bh = 160;
					const left = Math.max(0, Math.min(W - bw, Math.round(r.box.x + r.box.w / 2 - bw / 2))), top = Math.max(0, Math.min(H - bh, Math.round(r.box.y + r.box.h / 2 - 30 - bh / 2)));
					cells.push({ img: await sharp(png).extract({ left: left * dpr, top: top * dpr, width: bw * dpr, height: bh * dpr }).resize(510, 340, { kernel: 'nearest' }).jpeg({ quality: 92 }).toBuffer(), label: `${size} ${c.name} ${r.slot}: ${r.side}${wrong.length ? `; ${wrong[0].slice(0, 40)}` : ''}` });
				}
			}
			await o.page.keyboard.press('Escape');
			await sleep(80);
		}
	}
	say(`${size} (${W}x${H}), the empty sky, the sky tapped on a grid at every station: "claim yours" shown ${shown} times, for ${distinct} distinct stars and sides (a tap that gave no label ${none}); sides ${JSON.stringify(sides)}; on another star of the figure ${onStar}; on Cellestial's core ${onCore}; on the logo, the menu or the exit button ${onChrome}; outside the screen ${outside}; the nearest any label comes to another star's disc ${least.toFixed(1)} px (${leastAt}); console errors ${o.errors.filter((e) => !/about:blank/.test(e)).length}`);
	if (cells.length) await sheet(join(dir, `label-near-${size}.jpg`), cells, { cols: 3, cellW: 510, cellH: 340 });
	await o.context.close();
}
writeFileSync(join(dir, 'label-near.txt'), `${log.join('\n')}\n`);
await browser.close();
