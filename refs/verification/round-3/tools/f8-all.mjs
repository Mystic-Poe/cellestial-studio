#!/usr/bin/env node
// Round 3, piece 2 (2c): "claim yours" and the meanings, everywhere. One figure at a time is seeded
// complete (or, with --pair, a figure and the next one), the visitor stands at its station, and the sky
// is tapped on a grid of points across the whole screen. For every label that appears: how far its box
// is from every meaning that is showing (40 px at least), which side of its star it stands on, whether
// it is inside the screen, off the logo, the menu and the exit button, and off every other star.
// Reduced motion, so that a tap marks its star at once (the placing is the same code either way; the
// two taps the third look found are run in real time by f8.mjs and f8-close.mjs). Production build.
//   node f8-all.mjs [--sizes desk,phone,small,short,side] [--pair]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone,small,short,side' }, pair: { type: 'boolean', default: false } } });
const dir = outDir('b7');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
let fails = 0;
for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	const cols = W > 700 ? 9 : 5, rows = H > 700 ? 8 : 5;
	const sides = { under: 0, above: 0, right: 0, left: 0 };
	let taps = 0, shown = 0, least = Infinity, leastAt = '', moved = 0, bad = 0;
	const cells = [];
	for (let k = 0; k < CONSTELLATIONS.length; k++) {
		const c = CONSTELLATIONS[k];
		const figures = values.pair ? [c, CONSTELLATIONS[(k + 1) % CONSTELLATIONS.length]] : [c];
		const list = figures.flatMap((f) => f.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({ slot, ask: 'A site' }));
		const o = await open(browser, size, { reducedMotion: true, init: { fn: (l) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(l)); }, arg: list } });
		await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
		await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning);
		await o.page.evaluate(() => window.__cellestial.sky.ready);
		await o.page.evaluate(() => document.fonts.ready);
		await sleep(800);
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(900);
		const slots = [0, 1, 2, 3, 4, 5].flatMap((n) => CONSTELLATIONS[(k + n) % CONSTELLATIONS.length].stars.map((s) => s.slot).filter(Boolean));
		const nMeanings = await o.page.evaluate(() => document.querySelectorAll('.sky-meaning:not([hidden])').length);
		if (nMeanings < 1) { say(`FAIL  ${size} ${c.name}: no meaning is showing`); fails++; }
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
			const pt = [30 + ((W - 60) * i) / (cols - 1), 100 + ((H - 100 - 100) * j) / (rows - 1)];
			const hit = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('button, a, .sky-claim') ? 'a control' : 'sky') : 'nothing'; }, pt);
			if (hit !== 'sky') continue;
			taps++;
			await o.pressAt(...pt);
			await sleep(140);
			const r = await o.page.evaluate((all) => {
				const w = document.querySelector('[data-claim-words]');
				if (!w || w.hidden || getComputedStyle(w).visibility === 'hidden') return null;
				const q = w.getBoundingClientRect();
				const box = { x: q.x, y: q.y, w: q.width, h: q.height };
				const gap = (a, b) => Math.hypot(Math.max(a.x - (b.x + b.w), 0, b.x - (a.x + a.w)), Math.max(a.y - (b.y + b.h), 0, b.y - (a.y + a.h)));
				const rect = (e) => { if (!e || e.hidden) return null; const t = e.getBoundingClientRect(); return { x: t.x, y: t.y, w: t.width, h: t.height }; };
				const meanings = [...document.querySelectorAll('.sky-meaning:not([hidden])')].map((e) => ({ name: e.dataset.meaning, ...rect(e) }));
				const hooks = window.__cellestial.sky.hooks;
				const own = hooks.starCircle(w.dataset.slot);
				const others = all.filter((s) => s !== w.dataset.slot).map((s) => hooks.starCircle(s)).filter(Boolean);
				const core = window.__cellestial.sky.coreCircle?.();
				if (core) others.push(core);
				const disc = (s) => Math.hypot(Math.max(box.x - s.x, 0, s.x - (box.x + box.w)), Math.max(box.y - s.y, 0, s.y - (box.y + box.h))) - s.r;
				const chrome = [['the logo', rect(document.querySelector('.chrome-logo'))], ['the menu', rect(document.querySelector('#chrome button[popovertarget]'))], ['the exit button', rect(document.querySelector('[data-descend]'))]].filter(([, b]) => b && gap(box, b) === 0).map(([n]) => n);
				return { slot: w.dataset.slot, side: w.dataset.side ?? 'under', box, own, toMeaning: meanings.length ? Math.min(...meanings.map((m) => gap(box, m))) : Infinity, nearestMeaning: meanings.sort((a, b) => gap(box, a) - gap(box, b))[0]?.name, onStars: others.filter((s) => disc(s) < 0).length, starGap: others.length ? Math.min(...others.map(disc)) : Infinity, chrome, inside: box.x >= 0 && box.y >= 0 && box.x + box.w <= innerWidth && box.y + box.h <= innerHeight };
			}, slots);
			if (r) {
				shown++;
				sides[r.side] = (sides[r.side] ?? 0) + 1;
				if (r.toMeaning < least) { least = r.toMeaning; leastAt = `${c.name}, tap at ${pt.map(Math.round)}, ${r.slot}, ${r.side}`; }
				const wrong = [];
				if (r.toMeaning < 40) wrong.push(`${r.toMeaning.toFixed(0)} px from the meaning (${r.nearestMeaning})`);
				// Off the screen, the chrome and the other stars: asked of the words that left their place under the star.
				if (r.side !== 'under') {
					moved++;
					if (!r.inside) wrong.push('outside the screen');
					if (r.chrome.length) wrong.push(`on ${r.chrome.join(', ')}`);
					if (r.onStars) wrong.push(`on ${r.onStars} other star(s)`);
					if (cells.length < 24) cells.push({ img: await o.page.screenshot({ type: 'jpeg', quality: 88 }), label: `${c.name} tap ${pt.map(Math.round)}: ${r.side}, ${Math.round(r.toMeaning)} px from the meaning` });
					say(`      ${size} ${c.name}${values.pair ? ' and the next' : ''} complete, tap at ${pt.map(Math.round)}: "claim yours" ${r.side.toUpperCase()} ${r.slot} (star at ${Math.round(r.own.x)},${Math.round(r.own.y)} r ${r.own.r.toFixed(1)}), box ${Math.round(r.box.x)},${Math.round(r.box.y)} ${Math.round(r.box.w)}x${Math.round(r.box.h)}; ${Math.round(r.toMeaning)} px from the meaning; ${Math.round(r.starGap)} px from the nearest other star`);
				}
				if (wrong.length) { bad++; fails++; say(`FAIL  ${size} ${c.name} complete, tap at ${pt.map(Math.round)}: "claim yours" ${r.side} ${r.slot} at ${Math.round(r.box.x)},${Math.round(r.box.y)}: ${wrong.join('; ')}`); }
			}
			await o.page.keyboard.press('Escape');
			await sleep(60);
		}
		if (o.errors.length) say(`      ${size} ${c.name}: console errors ${o.errors.join(' | ').slice(0, 200)}`);
		await o.context.close();
	}
	say(`${bad ? 'FAIL' : 'PASS'}  ${size} (${W}x${H})${values.pair ? ', two figures complete' : ''}: ${taps} taps on empty sky at twelve stations, "claim yours" shown ${shown} times: under its star ${sides.under}, above ${sides.above}, right ${sides.right}, left ${sides.left}; the nearest to a meaning ${Number.isFinite(least) ? `${least.toFixed(0)} px (${leastAt})` : 'none'}; within 40 px: ${bad}`);
	if (cells.length) await sheet(join(dir, `claim-yours-moved-${size}${values.pair ? '-pair' : ''}.jpg`), cells, W > H ? { cols: 4, cellW: 390, cellH: Math.round((390 * H) / W) } : { cols: 8, cellW: 190, cellH: Math.round((190 * H) / W) });
}
writeFileSync(join(dir, `f8-all${values.pair ? '-pair' : ''}${values.sizes === 'desk,phone,small,short,side' ? '' : `-${values.sizes.replaceAll(',', '-')}`}.txt`), `${log.join('\n')}\n`);
await browser.close();
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
