#!/usr/bin/env node
// Round 4's own: EVERY TAP, one by one, so that two builds can be compared tap for tap. The empty sky (or,
// with --complete, the station's own figure complete, as f8-all.mjs seeds it), each station, the sky tapped
// with a real touch or click on label-near.mjs's own grid (11x9 on the desktop, 6x9 on the phone) and, with
// --fine, on one twice as fine. For every tap: what was under the finger; the star whose label shows (or
// none); the label's place (data-side, data-slide), its box, its letters' box (a Range over the text); the
// star's circle; and what the label's box touches of everything drawn (answer.ts's own measure, repeated
// through the debug hooks): the near figure's discs, the far figures', Cellestial's star to the reach of
// its rings; the logo, the menu, the exit button; the meanings. Reduced motion (a tap marks its star at once).
//   [R3_BASE=http://localhost:4616] node r4-taps.mjs --out <file.json> [--sizes desk,phone] [--complete] [--fine]
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone' }, out: { type: 'string' }, complete: { type: 'boolean', default: false }, fine: { type: 'boolean', default: false } } });
if (!values.out) throw new Error('--out <file.json>');
const browser = await launch({ gpu: true });
const all = {};
for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	all[size] = [];
	let o = null;
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		if (values.complete || !o) {
			if (o) await o.context.close();
			const list = values.complete ? c.stars.map((s) => s.slot).filter(Boolean).map((slot) => ({ slot, ask: 'A site' })) : [];
			o = await open(browser, size, { reducedMotion: true, init: { fn: (l) => { sessionStorage.setItem('cellestial:round', '1'); if (l.length) localStorage.setItem('cellestial:claims', JSON.stringify(l)); }, arg: list } });
			await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
			await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
			await o.page.evaluate(() => window.__cellestial.sky.ready);
			await o.page.evaluate(() => document.fonts.ready);
			await sleep(800);
		}
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(900);
		const m = values.fine ? 2 : 1;
		const cols = (W > 700 ? 11 : 6) * m - (m - 1), rows = 9 * m - (m - 1);
		const top0 = SIZES[size].hasTouch ? 130 : 100;
		const taps = [];
		for (let n = 0; n < cols * rows; n++) {
			const pt = [30 + ((W - 60) * (n % cols)) / (cols - 1), top0 + ((H - top0 - 100) * Math.floor(n / cols)) / (rows - 1)];
			const hit = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('button, a, .sky-claim') ? 'a control' : 'sky') : 'nothing'; }, pt);
			if (hit !== 'sky') { taps.push({ pt, hit }); continue; }
			await o.pressAt(...pt);
			await sleep(150);
			// A touch within a finger's reach of a star is the star's (the browser's own rule): its panel opens.
			const panel = await o.page.evaluate(() => { const q = document.querySelector('dialog[open], [data-panel]:not([hidden]), .sky-panel:not([hidden])'); return q ? { picked: window.__cellestial.claims?.picked?.() ?? null } : null; }).catch(() => null);
			if (panel) { taps.push({ pt, hit: 'a panel opened', picked: panel.picked }); await o.page.keyboard.press('Escape'); await o.page.evaluate(() => window.__cellestial.sky.answer.clear()); await sleep(150); continue; }
			const r = await o.page.evaluate(() => {
				const sky = window.__cellestial.sky, hooks = sky.hooks, layout = hooks.layout();
				const w = document.querySelector('[data-claim-words]');
				const pulsing = sky.answer.pulsing();
				if (!w || w.hidden || getComputedStyle(w).visibility === 'hidden') return { slot: null, pulsing, at: hooks.flight().coord };
				const b = w.getBoundingClientRect();
				const box = { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
				const range = document.createRange();
				range.selectNodeContents(w);
				const t = range.getBoundingClientRect();
				const FIG = 12, SP = 6, RING = 0.215;
				const front = hooks.lattice.layer();
				const own = hooks.starCircle(w.dataset.slot);
				const gap = (s) => Math.hypot(Math.max(box.x0 - s.x, 0, s.x - box.x1), Math.max(box.y0 - s.y, 0, s.y - box.y1)) - s.r;
				const on = [];
				let ownOff = null;
				for (let layer = front; layer <= front + 5; layer++) {
					const f = ((layer % FIG) + FIG) % FIG;
					const plan = layout.plans[f], fit = layout.fits[f];
					if (!plan || !fit) continue;
					plan.stars.forEach((star, i) => {
						const p = hooks.project(star.x, star.y, -layer * SP);
						const x = p.x, y = p.y, scale = p.scale;
						if (scale <= 0 || p.depth < 0.25) return;
						if (star.slot === w.dataset.slot) { ownOff = layer - front; return; }
						const rings = i === plan.epicentre;
						const r = rings ? RING * layout.b3 * scale : Math.max(fit.starR * layout.sizeOf(star) * scale, 1.25);
						const g = gap({ x, y, r });
						if (g < 4) on.push({ off: layer - front, r, gap: g, rings, slot: star.slot ?? null });
					});
				}
				const rect = (e) => { if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return q.width ? { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom } : null; };
				const bgap = (a, q) => Math.hypot(Math.max(a.x0 - q.x1, 0, q.x0 - a.x1), Math.max(a.y0 - q.y1, 0, q.y0 - a.y1));
				const chrome = [['the logo', rect(document.querySelector('.chrome-logo'))], ['the menu', rect(document.querySelector('#chrome button[popovertarget]'))], ['the exit button', rect(document.querySelector('[data-descend]'))]].filter(([, q]) => q && bgap(box, q) === 0).map(([n]) => n);
				const meanings = [...document.querySelectorAll('.sky-meaning:not([hidden])')].map(rect).filter(Boolean);
				return { slot: w.dataset.slot, pulsing, side: w.dataset.side ?? 'under', slide: Number(w.dataset.slide ?? 0), box, letters: { x0: t.left, x1: t.right, y0: t.top, y1: t.bottom }, own, ownOff, on, chrome, toMeaning: meanings.length ? Math.min(...meanings.map((q) => bgap(box, q))) : null, at: hooks.flight().coord, w: innerWidth, h: innerHeight };
			});
			taps.push({ pt, hit, ...r });
			// Escape closes a panel; it does not take the words away (they stay until the next touch), and words
			// left standing where the next point of the grid is would be taken for a control: they are put out.
			await o.page.keyboard.press('Escape');
			await o.page.evaluate(() => window.__cellestial.sky.answer.clear());
			await sleep(70);
		}
		all[size].push({ k, name: c.name, taps, errors: o.errors.filter((e) => !/about:blank/.test(e)) });
		console.log(`${size} ${k + 1} ${c.name}: ${taps.filter((t) => t.hit === 'sky').length} taps on the sky, a label for ${taps.filter((t) => t.slot).length}`);
	}
	if (o) await o.context.close();
}
writeFileSync(values.out, JSON.stringify(all));
await browser.close();
