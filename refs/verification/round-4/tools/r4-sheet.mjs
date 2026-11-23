#!/usr/bin/env node
// Round 4's own: EVERY star a touch can offer, its label BEFORE and AFTER, measured and as a picture.
// Two pages side by side, the build as it stood (R4_BEFORE, default http://localhost:4616) and this one
// (R3_BASE, default http://localhost:4615), the same station, reduced motion. For every star that
// sky.answer.plan() offers anywhere on a grid of points 10 px apart, the sky is touched at a point that
// offers it (sky.answer.touch(x, y): what a tap on empty sky calls; the real touches are label-near.mjs
// and r4-taps.mjs) on both pages, and for each label: its place, its box, its letters (a Range over the
// text), and what the box touches of everything drawn (answer.ts's drawn(), repeated through the debug
// hooks): discs of its own figure, discs of the figures behind, Cellestial's star to the reach of its
// rings, the logo, the menu, the exit button, the screen's sides, the meanings.
// THE SHEETS show every label that is not simply under its star on this build, or that touched anything
// on either build: the old place on the left, the new on the right, cut out of the screen at its own
// pixels (the phone's two to one).  --complete: the station's own figure complete (f8-all.mjs's case),
// the new place only, smaller cells.
//   node r4-sheet.mjs [--sizes desk,phone] [--complete]     writes labels/<size>[-complete].txt and -N.jpg
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'desk,phone' }, complete: { type: 'boolean', default: false } } });
const BEFORE = process.env.R4_BEFORE ?? 'http://localhost:4616';
const dir = outDir('labels');
const browser = await launch({ gpu: true });

const READ = () => {
	const sky = window.__cellestial.sky, hooks = sky.hooks, layout = hooks.layout();
	const w = document.querySelector('[data-claim-words]');
	if (!w || w.hidden || getComputedStyle(w).visibility === 'hidden') return null;
	const b = w.getBoundingClientRect();
	const box = { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom };
	const range = document.createRange();
	range.selectNodeContents(w);
	const t = range.getBoundingClientRect();
	const FIG = 12, SP = 6, RING = 0.215;
	const front = hooks.lattice.layer();
	const own = hooks.starCircle(w.dataset.slot);
	const gap = (s) => Math.hypot(Math.max(box.x0 - s.x, 0, s.x - box.x1), Math.max(box.y0 - s.y, 0, s.y - box.y1)) - s.r;
	const cover = (s) => { const dx = Math.max(box.x0 - s.x, 0, s.x - box.x1), dy = Math.max(box.y0 - s.y, 0, s.y - box.y1); const d = dx > 0 || dy > 0 ? Math.hypot(dx, dy) : -Math.min(s.x - box.x0, box.x1 - s.x, s.y - box.y0, box.y1 - s.y); return d >= s.r ? 0 : d <= -s.r ? Math.PI * s.r * s.r : s.r * s.r * Math.acos(d / s.r) - d * Math.sqrt(s.r * s.r - d * d); };
	let ownOff = -1;
	const discs = [];
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
			if (x < -r || x > layout.w + r || y < -r || y > layout.h + r) return;
			discs.push({ x, y, r, off: layer - front, rings });
		});
	}
	const near = discs.filter((s) => !s.rings && s.off === ownOff), far = discs.filter((s) => !s.rings && s.off !== ownOff), rings = discs.filter((s) => s.rings);
	const deepest = (l) => l.length ? Math.max(...l.map((s) => -gap(s))) : -Infinity;
	const rect = (e) => { if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return q.width ? { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom } : null; };
	const bgap = (a, q) => Math.hypot(Math.max(a.x0 - q.x1, 0, q.x0 - a.x1), Math.max(a.y0 - q.y1, 0, q.y0 - a.y1));
	const chrome = [['the logo', rect(document.querySelector('.chrome-logo'))], ['the menu', rect(document.querySelector('#chrome button[popovertarget]'))], ['the exit button', rect(document.querySelector('[data-descend]'))]].filter(([, q]) => q && bgap(box, q) === 0).map(([n]) => n);
	const meanings = [...document.querySelectorAll('.sky-meaning:not([hidden])')].map(rect).filter(Boolean);
	return {
		slot: w.dataset.slot, side: w.dataset.side ?? 'under', slide: Number(w.dataset.slide ?? 0), box, own, ownOff,
		letters: { x0: t.left, x1: t.right },
		nearOn: near.filter((s) => gap(s) < 0).length, nearDeep: deepest(near), nearAir: near.length ? Math.min(...near.map(gap)) : Infinity,
		farOn: far.filter((s) => gap(s) < 0).length, farCover: far.reduce((a, s) => a + cover(s), 0), nearCover: near.reduce((a, s) => a + cover(s), 0),
		rings: rings.length ? Math.min(...rings.map(gap)) : Infinity,
		chrome, toMeaning: meanings.length ? Math.min(...meanings.map((q) => bgap(box, q))) : Infinity,
		inside: box.x0 >= 0 && box.y0 >= 0 && box.x1 <= innerWidth && box.y1 <= innerHeight,
		edge: Math.min(t.left, innerWidth - t.right),
	};
};
const where = (r) => (r ? `${r.side}${r.slide ? (r.slide > 0 ? '+' : '') + r.slide : ''}` : 'no label');
const faults = (r) => {
	if (!r) return ['no label'];
	const f = [];
	if (r.nearOn) f.push(`on ${r.nearOn} star(s) of its own figure (${r.nearDeep.toFixed(1)} px in, ${r.nearCover.toFixed(0)} px2)`);
	if (r.farOn) f.push(`on ${r.farOn} point(s) of the figures behind (${r.farCover.toFixed(0)} px2)`);
	if (r.rings < 0) f.push(`${(-r.rings).toFixed(1)} px inside the reach of Cellestial's rings`);
	if (r.chrome.length) f.push(`on ${r.chrome.join(', ')}`);
	if (!r.inside) f.push('outside the screen');
	if (r.edge < 16) f.push(`letters ${r.edge.toFixed(1)} px from the side`);
	if (r.toMeaning < 40) f.push(`${r.toMeaning.toFixed(0)} px from a meaning`);
	return f;
};

for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	const log = [];
	const say = (s) => { console.log(s); log.push(s); };
	const cells = [];
	const left = [];
	const tally = { before: {}, after: {} };
	const count = { stars: 0, moved: 0, sameStar: 0 };
	const sum = { before: { near: 0, far: 0, rings: 0, chrome: 0, outside: 0, edge: 0, meaning: 0, none: 0, deepest: 0 }, after: { near: 0, far: 0, rings: 0, chrome: 0, outside: 0, edge: 0, meaning: 0, none: 0, deepest: 0 } };
	let pages = null;
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		if (values.complete || !pages) {
			if (pages) for (const o of pages) await o.context.close();
			pages = [];
			const list = values.complete ? c.stars.map((s) => s.slot).filter(Boolean).map((slot) => ({ slot, ask: 'A site' })) : [];
			for (const base of [BEFORE, PROD]) {
				const o = await open(browser, size, { reducedMotion: true, init: { fn: (l) => { sessionStorage.setItem('cellestial:round', '1'); if (l.length) localStorage.setItem('cellestial:claims', JSON.stringify(l)); }, arg: list } });
				await o.page.goto(`${base}/?scene=sky&debug`, { waitUntil: 'load' });
				await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
				await o.page.evaluate(() => window.__cellestial.sky.ready);
				await o.page.evaluate(() => document.fonts.ready);
				await sleep(800);
				pages.push(o);
			}
		}
		for (const o of pages) await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(900);
		// Which star each point offers, on each build.
		const maps = [];
		for (const o of pages) maps.push(await o.page.evaluate(() => { const sky = window.__cellestial.sky, out = []; for (let y = 5; y < innerHeight; y += 10) for (let x = 5; x < innerWidth; x += 10) out.push([x, y, sky.answer.plan(x, y)?.slot ?? null]); return out; }));
		let differ = 0, lost = 0;
		const notOffered = new Set(maps[0].map((q) => q[2]).filter(Boolean));
		for (let i = 0; i < maps[0].length; i++) { if (maps[0][i][2] !== maps[1][i][2]) differ++; if (maps[0][i][2] && !maps[1][i][2]) lost++; notOffered.delete(maps[1][i][2]); }
		say(`${size} ${k + 1} ${c.name}${values.complete ? ' complete' : ''}: of ${maps[0].length} points 10 px apart, the star offered differs at ${differ}; a star before and none now at ${lost}; stars offered before ${new Set(maps[0].map((q) => q[2]).filter(Boolean)).size}, now ${new Set(maps[1].map((q) => q[2]).filter(Boolean)).size}${notOffered.size ? `; no longer offered: ${[...notOffered].join(', ')}` : ''}`);
		const points = new Map();
		for (const [x, y, slot] of maps[1]) if (slot && !points.has(slot)) points.set(slot, [x, y]);
		// The stars the old build offered and this one does not are shown too, where the old one had them.
		for (const [x, y, slot] of maps[0]) if (slot && notOffered.has(slot) && !points.has(`was ${slot}`)) points.set(`was ${slot}`, [x, y]);
		for (const [key, pt] of points) {
			const res = [];
			for (const o of pages) { await o.page.evaluate(([x, y]) => window.__cellestial.sky.answer.touch(x, y), pt); }
			await sleep(120);
			for (const o of pages) res.push(await o.page.evaluate(READ));
			const [b, a] = res;
			count.stars++;
			if (b && a && b.slot === a.slot) count.sameStar++;
			for (const [name, r] of [['before', b], ['after', a]]) {
				tally[name][where(r)] = (tally[name][where(r)] ?? 0) + 1;
				const s = sum[name];
				if (!r) { s.none++; continue; }
				if (r.nearOn) { s.near++; s.deepest = Math.max(s.deepest, r.nearDeep); }
				if (r.farOn) s.far++;
				if (r.rings < 0) s.rings++;
				if (r.chrome.length) s.chrome++;
				if (!r.inside) s.outside++;
				if (r.edge < 16) s.edge++;
				if (r.toMeaning < 40) s.meaning++;
			}
			const fb = faults(b), fa = faults(a);
			const moved = !a || !b || a.slot !== b.slot || a.side !== 'under' || a.slide !== 0;
			if (moved) count.moved++;
			if (moved || fb.length || fa.length) {
				say(`  ${c.name} ${key}${a && b && a.slot !== b.slot ? ` (before ${b.slot}, now ${a.slot})` : ''} (layer +${(a ?? b)?.ownOff}, r ${(a ?? b)?.own?.r.toFixed(1)}): ${where(b)} -> ${where(a)}${a ? `, box ${Math.round(a.box.x0)},${Math.round(a.box.y0)}` : ''}; before: ${fb.join('; ') || 'touched nothing'}; now: ${fa.join('; ') || 'touches nothing'}`);
				// The picture: the star and both labels in view.
				const boxes = [b, a].filter(Boolean).flatMap((r) => [r.box, { x0: r.own.x - r.own.r, x1: r.own.x + r.own.r, y0: r.own.y - r.own.r, y1: r.own.y + r.own.r }]);
				const cw = values.complete ? 190 : 250, ch = values.complete ? 126 : 166;
				const cx = (Math.min(...boxes.map((q) => q.x0)) + Math.max(...boxes.map((q) => q.x1))) / 2, cy = (Math.min(...boxes.map((q) => q.y0)) + Math.max(...boxes.map((q) => q.y1))) / 2;
				const clip = { x: Math.round(Math.max(0, Math.min(W - cw, cx - cw / 2))), y: Math.round(Math.max(0, Math.min(H - ch, cy - ch / 2))), width: cw, height: ch };
				const shots = [];
				for (const o of values.complete ? [pages[1]] : pages) shots.push(await sharp(await o.page.screenshot({ type: 'png', clip })).resize(cw, ch).png().toBuffer());
				const img = shots.length === 1 ? shots[0] : await sharp({ create: { width: cw * 2 + 4, height: ch, channels: 3, background: '#666' } }).composite([{ input: shots[0], left: 0, top: 0 }, { input: shots[1], left: cw + 4, top: 0 }]).png().toBuffer();
				const cell = { img, label: `${c.name} ${key.replace('slot-', '')}: ${values.complete ? '' : `${where(b)} > `}${where(a)}${fa.length ? ' !' : ''}` };
				cells.push(cell);
				// Still on a star of its own figure, or on anything it must never be on: on a sheet of their own.
				if (a && (a.nearOn || a.rings < 0 || a.chrome.length || !a.inside || a.edge < 16 || a.toMeaning < 40)) left.push({ ...cell, label: `${c.name} ${key.replace('slot-', '')}: ${where(a)}, ${a.nearOn ? `${a.nearDeep.toFixed(1)} px into a star` : fa[0]}` });
			}
			for (const o of pages) await o.page.evaluate(() => window.__cellestial.sky.answer.clear());
		}
	}
	for (const o of pages) { const e = o.errors.filter((x) => !/about:blank/.test(x)); if (e.length) say(`console errors: ${e.join(' | ').slice(0, 300)}`); await o.context.close(); }
	const line = (n) => `${JSON.stringify(tally[n])}; on a star of its own figure ${sum[n].near} (deepest ${sum[n].deepest.toFixed(1)} px); on points of the figures behind ${sum[n].far}; inside the reach of Cellestial's rings ${sum[n].rings}; on the logo, the menu or the exit button ${sum[n].chrome}; outside the screen ${sum[n].outside}; letters nearer a side than 16 px ${sum[n].edge}; within 40 px of a meaning ${sum[n].meaning}; no label ${sum[n].none}`;
	say(`${size} (${W}x${H})${values.complete ? ', the figure of each station complete' : ', the empty sky'}: ${count.stars} stars offered at the twelve stations; the same star's label on both builds ${count.sameStar}; not simply under its star now ${count.moved}`);
	say(`  BEFORE: ${line('before')}`);
	say(`  AFTER:  ${line('after')}`);
	const name = `${size}${values.complete ? '-complete' : ''}`;
	writeFileSync(join(dir, `${name}.txt`), `${log.join('\n')}\n`);
	const per = values.complete ? 80 : 21;
	if (left.length) await sheet(join(dir, `${name}-on-stars.jpg`), left, values.complete ? { cols: 8, cellW: 190, cellH: 126, gap: 6 } : { cols: 3, cellW: 504, cellH: 166 });
	for (let n = 0; n * per < cells.length; n++) await sheet(join(dir, `${name}-${n + 1}.jpg`), cells.slice(n * per, n * per + per), values.complete ? { cols: 8, cellW: 190, cellH: 126, gap: 6 } : { cols: 3, cellW: 504, cellH: 166 });
}
await browser.close();
