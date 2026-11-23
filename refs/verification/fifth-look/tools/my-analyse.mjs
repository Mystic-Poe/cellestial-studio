#!/usr/bin/env node
// The fifth look's own: what my-labels.mjs wrote down, read. For a size (and --complete), the new build's
// taps and, beside them, the old build's (labels/ and old/labels/):
//   - the same tap, the same star? every tap that differs; every star offered before and not now;
//   - every distinct label of the new build measured by MY geometry, not the page's rule: its box
//     against every other disc drawn (on it; nearer than 4 px), Cellestial's core and the reach of its
//     rings, the letters' distance from the screen's sides, the chrome, the screen; how far the box
//     stands from its own star;
//   - for every label that left the place under its star: was that place really taken (what by), and
//     which of right, left, above and the corners were free by my measure;
//   - for the labels under their star: are they centred on it.
//   node my-analyse.mjs --size desk [--complete]      writes labels/<size>[-complete]-analysis.txt
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, SIZES } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, complete: { type: 'boolean', default: false } } });
const size = values.size;
const name = `${size}${values.complete ? '-complete' : ''}`;
const base = join(ROOT, 'refs/verification/fifth-look');
const neu = JSON.parse(readFileSync(join(base, 'labels', `${name}.json`)));
const oldFile = join(base, 'old/labels', `${name}.json`);
const old = existsSync(oldFile) ? JSON.parse(readFileSync(oldFile)) : null;
const { width: W, height: H } = SIZES[size].viewport;
const out = [];
const say = (s) => { console.log(s); out.push(s); };
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : String(v));
const discGap = (b, s) => Math.hypot(Math.max(b.x - s.x, 0, s.x - (b.x + b.w)), Math.max(b.y - s.y, 0, s.y - (b.y + b.h))) - s.r;
const rectGap = (a, c) => Math.hypot(Math.max(c.x - (a.x + a.w), 0, a.x - (c.x + c.w)), Math.max(c.y - (a.y + a.h), 0, a.y - (c.y + c.h)));
const POINT = 3; // a disc of this radius or less is a far figure's point

/** One build's distinct labels, measured. */
function measure(taps) {
	const seen = new Map();
	for (const t of taps) {
		if (t.what !== 'label') continue;
		const key = `${t.k}|${t.slot}|${t.side}|${t.slide}`;
		if (seen.has(key)) { seen.get(key).taps++; continue; }
		const b = t.box;
		const gaps = t.others.map((s) => ({ s, g: discGap(b, s) }));
		const stars = gaps.filter((x) => x.s.r > POINT);
		const points = gaps.filter((x) => x.s.r <= POINT);
		const m = {
			t, taps: 1,
			onStars: stars.filter((x) => x.g < 0), nearStars: stars.filter((x) => x.g >= 0 && x.g < 4),
			onPoints: points.filter((x) => x.g < 0),
			least: gaps.length ? Math.min(...gaps.map((x) => x.g)) : Infinity,
			core: t.core ? discGap(b, t.core) : Infinity,
			rings: t.core?.r ? discGap(b, { x: t.core.x, y: t.core.y, r: t.core.r / 0.27 }) : Infinity,
			coreR: t.core?.r ?? 0, reach: t.core?.r ? t.core.r / 0.27 : 0,
			letL: t.text.x, letR: W - (t.text.x + t.text.w),
			inside: b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H,
			chrome: Object.entries(t.chrome).filter(([, g]) => g && rectGap(b, g) === 0).map(([n]) => n),
			own: t.star ? discGap(b, t.star) : NaN,
			dx: t.star ? b.x + b.w / 2 - t.star.x : NaN,
			meaning: t.meanings?.length ? Math.min(...t.meanings.map((g) => rectGap(b, g))) : Infinity,
		};
		seen.set(key, m);
	}
	return [...seen.values()];
}

function summary(title, ms) {
	const sides = {};
	for (const m of ms) { const s = m.t.slide ? `${m.t.side} slid ${m.t.slide}` : m.t.side; sides[s] = (sides[s] ?? 0) + 1; }
	say(`${title}: ${ms.length} distinct labels (station, star, place); by place ${JSON.stringify(sides)}`);
	say(`  across another STAR's disc (r > ${POINT} px): ${ms.filter((m) => m.onStars.length).length}; within 4 px of one, not on it: ${ms.filter((m) => !m.onStars.length && m.nearStars.length).length}; over far POINTS (r <= ${POINT} px): ${ms.filter((m) => m.onPoints.length).length} (most on one label: ${Math.max(0, ...ms.map((m) => m.onPoints.length))})`);
	say(`  on Cellestial's core: ${ms.filter((m) => m.core < 0).length}; inside the reach of its rings: ${ms.filter((m) => m.rings < 0).length}; the nearest to the rings' reach ${f1(Math.min(...ms.map((m) => m.rings)))} px`);
	say(`  letters nearer a side than 16 px: ${ms.filter((m) => m.letL < 15.95 || m.letR < 15.95).length} (the least ${f1(Math.min(...ms.map((m) => Math.min(m.letL, m.letR))))} px); outside the screen ${ms.filter((m) => !m.inside).length}; on the logo, the menu or the exit button ${ms.filter((m) => m.chrome.length).length}`);
	say(`  the box from its own star's disc: ${f1(Math.min(...ms.map((m) => m.own)))} to ${f1(Math.max(...ms.map((m) => m.own)))} px; the nearest to a meaning ${f1(Math.min(...ms.map((m) => m.meaning)))} px`);
}

const N = measure(neu);
summary(`NEW build, ${name} (${W}x${H})`, N);
const tapsN = neu.filter((t) => t.what === 'label').length;
say(`  taps: ${neu.length}; a label ${tapsN}; no label ${neu.filter((t) => t.what === 'none').length}; a panel opened ${neu.filter((t) => t.what === 'panel').length}; on a control ${neu.filter((t) => t.what === 'a control' || t.what === 'nothing').length}`);
let O = null;
if (old) {
	O = measure(old);
	summary(`OLD build, ${name}`, O);
	say(`  taps: ${old.length}; a label ${old.filter((t) => t.what === 'label').length}; no label ${old.filter((t) => t.what === 'none').length}; a panel opened ${old.filter((t) => t.what === 'panel').length}`);
}

// Every fault of the new build, named.
say('');
say('NEW build, every label that breaks a rule by my measure:');
let faults = 0;
for (const m of N) {
	const w = [];
	if (m.onStars.length) w.push(`across ${m.onStars.map((x) => `${x.s.slot} (r ${f1(x.s.r)}, ${f1(-x.g)} px in)`).join(', ')}`);
	if (m.core < 0) w.push(`on Cellestial's core (${f1(-m.core)} px in, core r ${f1(m.coreR)})`);
	else if (m.rings < 0) w.push(`inside the rings' reach (${f1(-m.rings)} px in; reach ${f1(m.reach)} px)`);
	if (m.letL < 15.95 || m.letR < 15.95) w.push(`letters ${f1(Math.min(m.letL, m.letR))} px from the side`);
	if (!m.inside) w.push('outside the screen');
	if (m.chrome.length) w.push(`on ${m.chrome.join(', ')}`);
	if (m.meaning < 40) w.push(`${f1(m.meaning)} px from a meaning`);
	if (w.length) { faults++; say(`  ${m.t.fig} ${m.t.slot} ${m.t.side}${m.t.slide ? ` slid ${m.t.slide}` : ''} (star ${Math.round(m.t.star.x)},${Math.round(m.t.star.y)} r ${f1(m.t.star.r)}; box ${Math.round(m.t.box.x)},${Math.round(m.t.box.y)}): ${w.join('; ')}`); }
}
if (!faults) say('  none');

// The labels that left the place under their star: was it taken, and what else was free?
const boxAt = (star, side, slide = 0) => {
	const reach = star.r * 1.1 + 7, hw = 48, h = 24;
	let x = star.x, y = star.y - h / 2;
	if (side === 'under' || side === 'above') { x = Math.min(Math.max(star.x + slide, 56), W - 56); y = side === 'under' ? star.y + reach : star.y - reach - h; }
	else if (side === 'right' || side === 'left') { x = side === 'right' ? star.x + reach + hw : star.x - reach - hw; y += slide; }
	else { const d = reach * Math.SQRT1_2; x = side.endsWith('right') ? star.x + d + hw : star.x - d - hw; y = side.startsWith('under') ? star.y + d : star.y - d - h; }
	return { x: x - hw, y, w: 96, h };
};
const blockers = (t, b) => {
	const w = [];
	for (const s of t.others) { const g = discGap(b, s); if (s.r > POINT && g < 4) w.push(`${s.slot} r ${f1(s.r)} (${g < 0 ? `${f1(-g)} px in` : `${f1(g)} px off`})`); }
	const pts = t.others.filter((s) => s.r <= POINT && discGap(b, s) < 0).length;
	if (pts > 1) w.push(`${pts} far points`);
	if (t.core?.r && discGap(b, { x: t.core.x, y: t.core.y, r: t.core.r / 0.27 }) < 0) w.push(`Cellestial's rings (${f1(-discGap(b, { x: t.core.x, y: t.core.y, r: t.core.r / 0.27 }))} px in)`);
	if (b.x < 8 || b.x + b.w > W - 8) w.push('the side of the screen');
	if (b.y < 4 || b.y + b.h > H - 4) w.push('the top or bottom');
	for (const [n, g] of Object.entries(t.chrome)) if (g && rectGap(b, g) < (n === 'exit' ? 4 : 0.01)) w.push(`the ${n}`);
	for (const g of t.meanings ?? []) if (rectGap(b, g) < 40) w.push('a meaning');
	return w;
};
const ORDER = ['under', 'right', 'left', 'above', 'under-right', 'under-left', 'above-right', 'above-left'];
say('');
say('NEW build, every label NOT under its star: what took the place under it, and what was free by my measure (in the order under, right, left, above, then the corners):');
let notTaken = 0, notFirst = 0, moved = 0;
for (const m of N) {
	const t = m.t;
	if (t.side === 'under' && !t.slide) continue;
	moved++;
	const under = blockers(t, boxAt(t.star, 'under'));
	const free = ORDER.filter((s) => blockers(t, boxAt(t.star, s)).length === 0);
	const mine = boxAt(t.star, t.side, t.slide);
	const off = Math.hypot(mine.x - t.box.x, mine.y - t.box.y);
	const first = free[0] ?? '(none free)';
	const flag = [];
	if (!under.length) { notTaken++; flag.push('UNDER WAS FREE'); }
	if (free.length && first !== t.side) { notFirst++; flag.push(`FIRST FREE IS ${first}`); }
	if (off > 1.5) flag.push(`box ${f1(off)} px from where my reckoning puts that place`);
	say(`  ${t.fig} ${t.slot} -> ${t.side}${t.slide ? ` slid ${t.slide}` : ''} (${m.taps} taps): under taken by ${under.join(', ') || 'NOTHING'}; free: ${free.join(', ') || 'none'}${flag.length ? `   <<< ${flag.join('; ')}` : ''}`);
}
say(`  ${moved} labels not under their star; the place under was free for ${notTaken}; a place earlier in the order was free for ${notFirst}`);

// The labels under their star: centred?
const under = N.filter((m) => m.t.side === 'under' && !m.t.slide);
const offc = under.filter((m) => Math.abs(m.dx) > 0.6);
say('');
say(`NEW build, the ${under.length} labels under their star: centred on it (within 0.6 px) ${under.length - offc.length}; held in from a side of the screen ${offc.length}${offc.length ? `: ${offc.map((m) => `${m.t.fig} ${m.t.slot} (${f1(m.dx)} px, star at x ${Math.round(m.t.star.x)})`).join(', ')}` : ''}`);
const underBlocked = under.filter((m) => blockers(m.t, m.t.box).length);
say(`  of them, under although my measure finds something within the rule's reach there: ${underBlocked.length}${underBlocked.length ? `: ${underBlocked.map((m) => `${m.t.fig} ${m.t.slot}: ${blockers(m.t, m.t.box).join(', ')}`).join(' | ')}` : ''}`);

// The same tap on the two builds.
if (old) {
	say('');
	const byTap = new Map(old.map((t) => [`${t.k}|${t.n}`, t]));
	let same = 0, diff = 0, lost = 0, gained = 0;
	const lines = [];
	for (const t of neu) {
		const o = byTap.get(`${t.k}|${t.n}`);
		if (!o) continue;
		const a = o.what === 'label' ? o.slot : o.what, b = t.what === 'label' ? t.slot : t.what;
		if (a === b) { same++; continue; }
		diff++;
		if (o.what === 'label' && t.what !== 'label') lost++;
		if (o.what !== 'label' && t.what === 'label') gained++;
		lines.push(`  ${t.fig} tap ${t.n} at ${t.pt.map(Math.round)}: was ${a}, now ${b}`);
	}
	say(`THE SAME TAP ON THE TWO BUILDS (${name}): ${neu.length} taps; the same answer ${same}; different ${diff} (a label before and none now ${lost}; none before and a label now ${gained})`);
	for (const l of lines) say(l);
	const starsO = new Set(O.map((m) => `${m.t.fig} ${m.t.slot}`)), starsN = new Set(N.map((m) => `${m.t.fig} ${m.t.slot}`));
	say(`  stars offered: before ${starsO.size}, now ${starsN.size}; offered before and not now: ${[...starsO].filter((s) => !starsN.has(s)).join(', ') || 'none'}; offered now and not before: ${[...starsN].filter((s) => !starsO.has(s)).join(', ') || 'none'}`);
	// How far the labels that stayed under moved.
	const oldBy = new Map(O.map((m) => [`${m.t.k}|${m.t.slot}`, m]));
	let stayed = 0, shifted = [];
	for (const m of N) {
		if (m.t.side !== 'under' || m.t.slide) continue;
		const o = oldBy.get(`${m.t.k}|${m.t.slot}`);
		if (!o || o.t.side !== 'under') continue;
		const d = Math.hypot(m.t.box.x - o.t.box.x, m.t.box.y - o.t.box.y);
		if (d < 0.6) stayed++; else shifted.push(`${m.t.fig} ${m.t.slot} ${f1(m.t.box.x - o.t.box.x)},${f1(m.t.box.y - o.t.box.y)}`);
	}
	say(`  labels under their star on both builds: in the same place to 0.6 px ${stayed}; moved ${shifted.length}${shifted.length ? `: ${shifted.join(' | ')}` : ''}`);
}
writeFileSync(join(base, 'labels', `${name}-analysis.txt`), `${out.join('\n')}\n`);
