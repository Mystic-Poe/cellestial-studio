#!/usr/bin/env node
// Round 4's own: what "claim yours" is placed among, read from the page and written as JSON, so that the
// placing rule (src/experience/sky/claim-label.ts, pure geometry) can be run in node over every star a
// tap can offer, and WHICH STAR A TAP OFFERS can be compared between two builds point for point.
// At each station: the screen; every star drawn (the page's own measure: answer.ts, drawn(), repeated
// here through the debug hooks: the station's figure and the five behind it, Cellestial's star as the
// full reach of its rings); the meanings showing; the logo, the menu and the exit button; and, on a
// grid of points 20 px apart over the whole screen, the star sky.answer.plan(x, y) would offer (it
// changes nothing in the page). Reduced motion. --complete seeds the station's own figure complete (as
// f8-all.mjs does), one figure at a time.
//   R3_BASE=http://localhost:4616 node r4-dump.mjs --out <file.json> [--sizes desk,phone] [--complete]
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone' }, out: { type: 'string' }, complete: { type: 'boolean', default: false }, step: { type: 'string', default: '20' } } });
if (!values.out) throw new Error('--out <file.json>');
const browser = await launch({ gpu: true });
const all = {};
for (const size of values.sizes.split(',')) {
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
		const d = await o.page.evaluate((step) => {
			const sky = window.__cellestial.sky, hooks = sky.hooks, layout = hooks.layout();
			const FIG = 12, SP = 6, RING = 0.215;
			const front = hooks.lattice.layer();
			const discs = [];
			for (let layer = front; layer <= front + 5; layer++) {
				const f = ((layer % FIG) + FIG) % FIG;
				const plan = layout.plans[f], fit = layout.fits[f];
				if (!plan || !fit) continue;
				plan.stars.forEach((star, i) => {
					const p = hooks.project(star.x, star.y, -layer * SP);
					const x = p.x, y = p.y, scale = p.scale, depth = p.depth;
					if (scale <= 0 || depth < 0.25) return;
					const epi = i === plan.epicentre;
					const r = epi ? RING * layout.b3 * scale : Math.max(fit.starR * layout.sizeOf(star) * scale, 1.25);
					if (x < -r || x > layout.w + r || y < -r || y > layout.h + r) return;
					discs.push({ x, y, r, off: layer - front, f, slot: star.slot ?? null, epi, lit: star.slot ? hooks.isLit(star.slot) : false, depth });
				});
			}
			const rect = (e) => { if (!e || e.hidden) return null; const t = e.getBoundingClientRect(); return t.width ? { x0: t.left, y0: t.top, x1: t.right, y1: t.bottom } : null; };
			const meanings = [...document.querySelectorAll('.sky-meaning:not([hidden])')].map(rect).filter(Boolean);
			const offers = [];
			for (let y = step / 2; y < layout.h; y += step) for (let x = step / 2; x < layout.w; x += step) offers.push([x, y, sky.answer.plan(x, y)?.slot ?? null]);
			const core = sky.coreCircle();
			return { w: layout.w, h: layout.h, front, discs, meanings, logo: rect(document.querySelector('.chrome-logo')), menu: rect(document.querySelector('#chrome button[popovertarget]')), exit: rect(document.querySelector('[data-descend]')), core, offers };
		}, Number(values.step));
		all[size].push({ k, name: c.name, ...d });
		console.log(`${size} ${k + 1} ${c.name}: ${d.discs.length} discs drawn, ${d.meanings.length} meanings, ${new Set(d.offers.map((q) => q[2])).size} distinct offers on ${d.offers.length} points`);
	}
	if (o) await o.context.close();
}
writeFileSync(values.out, JSON.stringify(all));
await browser.close();
