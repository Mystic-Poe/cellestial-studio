#!/usr/bin/env node
// The fifth look's own: EVERY TAP OF THE GRID, WRITTEN DOWN. The same grid as label-near.mjs (so the
// same taps on any build), reduced motion, the empty sky (or, with --complete, the station's own
// figure complete). For every tap: which star was offered, where the words stand (side, slide, box,
// the letters' own extent), the star's disc, and every other disc that is drawn (every slot of every
// figure that hooks.starCircle() gives), Cellestial's core and the reach of its rings, the chrome.
// A crop of every distinct label (slot + side + slide) is kept for the sheets (my-sheets.mjs).
//   node my-labels.mjs --size desk|phone|... [--complete] [--crops <dir>]
//   writes <OUT>/labels/<size>[-complete].json   (R3_OUT / R3_BASE as in lib.mjs)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, complete: { type: 'boolean', default: false }, crops: { type: 'string' }, only: { type: 'string' } } });
const size = values.size;
const dir = outDir('labels');
const { width: W, height: H } = SIZES[size].viewport;
const ALL = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean));
const browser = await launch({ gpu: true });
const taps = [];
const only = values.only ? values.only.split(',').map(Number) : null;
for (let k = 0; k < 12; k++) {
	if (only && !only.includes(k)) continue;
	const c = CONSTELLATIONS[k];
	const own = c.stars.map((s) => s.slot).filter(Boolean);
	// A fresh context per station when a figure is complete (the claims live in localStorage).
	const o = await open(browser, size, {
		reducedMotion: true,
		init: {
			fn: ([slots, complete]) => {
				sessionStorage.setItem('cellestial:round', '1');
				if (complete) localStorage.setItem('cellestial:claims', JSON.stringify(slots.map((slot) => ({ slot, ask: 'A site' }))));
			},
			arg: [own, values.complete],
		},
	});
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(600);
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
	await sleep(900);
	const cols = W > 700 ? 11 : 6, rows = 9;
	const top0 = SIZES[size].hasTouch ? 130 : 100;
	const seen = new Set();
	for (let n = 0; n < cols * rows; n++) {
		const pt = [30 + ((W - 60) * (n % cols)) / (cols - 1), top0 + ((H - top0 - 100) * Math.floor(n / cols)) / (rows - 1)];
		const hit = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('button, a, .sky-claim') ? 'a control' : 'sky') : 'nothing'; }, pt);
		const rec = { k, fig: c.name, n, pt };
		if (hit !== 'sky') { rec.what = hit; taps.push(rec); continue; }
		// The second run: were the words still on the page from the tap before (Escape does not always take them off)?
		rec.wordsBefore = await o.page.evaluate(() => { const e = document.querySelector('[data-claim-words]'); return e && !e.hidden && getComputedStyle(e).visibility !== 'hidden' ? { slot: e.dataset.slot, box: (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(e.getBoundingClientRect()) } : null; });
		await o.pressAt(...pt);
		await sleep(180);
		// The second run of this look: on the phone a touch's answer is sometimes not yet on the page 180 ms
		// after it (the count of "none" was the script's, not the page's): wait for the words or a panel, up to 900 ms more.
		for (let w = 0; w < 18; w++) {
			const there = await o.page.evaluate(() => { const e = document.querySelector('[data-claim-words]'); return !!document.querySelector('dialog[open], [data-panel]:not([hidden]), [data-sky-panel]:not([hidden])') || (!!e && !e.hidden && getComputedStyle(e).visibility !== 'hidden'); }).catch(() => false);
			if (there) { rec.waited = 180 + w * 50; break; }
			await sleep(50);
		}
		if (await o.page.evaluate(() => !!document.querySelector('dialog[open], [data-panel]:not([hidden]), [data-sky-panel]:not([hidden])')).catch(() => false)) {
			rec.what = 'panel';
			rec.panelSlot = await o.page.evaluate(() => document.querySelector('[data-claim-words]')?.dataset.slot ?? null);
			taps.push(rec);
			await o.page.keyboard.press('Escape'); await sleep(250);
			// The second run: a panel takes the first Escape; the words, if any still stand, the next.
			await o.page.keyboard.press('Escape'); await sleep(100); continue;
		}
		const r = await o.page.evaluate(([all]) => {
			const w = document.querySelector('[data-claim-words]');
			if (!w || w.hidden || getComputedStyle(w).visibility === 'hidden') return null;
			const b = w.getBoundingClientRect();
			const range = document.createRange();
			range.selectNodeContents(w);
			const t = range.getBoundingClientRect();
			const hooks = window.__cellestial.sky.hooks;
			const sky = window.__cellestial.sky;
			const star = hooks.starCircle(w.dataset.slot);
			const others = [];
			for (const s of all) {
				if (s === w.dataset.slot) continue;
				const d = hooks.starCircle(s);
				if (d && Number.isFinite(d.x)) others.push({ slot: s, x: d.x, y: d.y, r: d.r, lit: hooks.isLit?.(s) ?? false });
			}
			const core = sky.coreCircle?.() ?? null;
			const rings = sky.introRings?.() ?? null;
			const rect = (e) => { if (!e) return null; const g = e.getBoundingClientRect(); return g.width ? { x: g.x, y: g.y, w: g.width, h: g.height } : null; };
			const meanings = [...document.querySelectorAll('.sky-meaning:not([hidden])')].map((m) => { const g = m.getBoundingClientRect(); return g.width ? { x: g.x, y: g.y, w: g.width, h: g.height } : null; }).filter(Boolean);
			return {
				slot: w.dataset.slot, side: w.dataset.side ?? 'under', slide: Number(w.dataset.slide ?? 0),
				box: { x: b.x, y: b.y, w: b.width, h: b.height }, text: { x: t.x, y: t.y, w: t.width, h: t.height },
				star, others, core, reach: rings ? Math.max(...rings.map((g) => Math.max(g.a, g.b))) : null,
				chrome: { logo: rect(document.querySelector('.chrome-logo')), menu: rect(document.querySelector('#chrome button[popovertarget]')), exit: rect(document.querySelector('[data-descend]')) },
				meanings,
			};
		}, [ALL]);
		if (!r) { rec.what = 'none'; taps.push(rec); await o.page.keyboard.press('Escape'); await sleep(80); continue; }
		Object.assign(rec, { what: 'label' }, r);
		const key = `${r.slot}|${r.side}|${r.slide}`;
		rec.first = !seen.has(key);
		if (rec.first && values.crops) {
			seen.add(key);
			mkdirSync(values.crops, { recursive: true });
			const bw = 260, bh = 190;
			const mx = (r.box.x + r.box.w / 2 + (r.star?.x ?? r.box.x)) / 2, my = (r.box.y + r.box.h / 2 + (r.star?.y ?? r.box.y)) / 2;
			const left = Math.max(0, Math.min(W - bw, Math.round(mx - bw / 2))), top = Math.max(0, Math.min(H - bh, Math.round(my - bh / 2)));
			rec.crop = `${size}-${String(k + 1).padStart(2, '0')}-${r.slot}-${r.side}-${r.slide}.png`;
			rec.cropAt = [left, top, bw, bh];
			await o.page.screenshot({ type: 'png', path: join(values.crops, rec.crop), clip: { x: left, y: top, width: bw, height: bh } });
		} else seen.add(key);
		taps.push(rec);
		await o.page.keyboard.press('Escape');
		await sleep(80);
	}
	const errs = o.errors.filter((e) => !/about:blank/.test(e));
	console.log(`${size} ${k + 1} ${c.name}: ${taps.filter((t) => t.k === k && t.what === 'label').length} labels, ${taps.filter((t) => t.k === k && t.what === 'none').length} none, ${taps.filter((t) => t.k === k && t.what === 'panel').length} panels, console errors ${errs.length}${errs.length ? `: ${errs[0]}` : ''}`);
	await o.context.close();
}
writeFileSync(join(dir, `${size}${values.complete ? '-complete' : ''}.json`), JSON.stringify(taps));
await browser.close();
