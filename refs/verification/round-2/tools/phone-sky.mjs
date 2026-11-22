#!/usr/bin/env node
// Finding 5: the phone's sky. Every one of the twelve stations with the sky as it starts (empty),
// production build, real GPU: the size of each figure and its stars, which stars overlap, whether
// any is off the screen or under the chrome; Cellestial's star and how far its rings end from
// Virgo's stars, at two moments of the rings' turn; then a real touch on EVERY star of EVERY figure.
//
// Round 2, piece 3 extended it (it was 390x844 only, taps on three figures, no verdicts):
//   node phone-sky.mjs [--size phone|small] [--only stations,taps]
// "phone" is 390x844 and writes round-2/phone-sky/; "small" is 360x740 and writes
// round-2/phone-sky/360/. Each requirement of the piece is printed as PASS or FAIL.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { ASSETS } from '../../../../src/experience/assets.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { size: { type: 'string', default: 'phone' }, only: { type: 'string', default: 'stations,taps' } } });
const size = values.size;
const only = new Set(values.only.split(','));
const { width: W, height: H } = SIZES[size].viewport;
const dir = outDir(size === 'phone' ? 'phone-sky' : `phone-sky/${W}`);
const WIDE = new Set(['Virgo', 'Capricornus', 'Aquarius', 'Pisces', 'Aries', 'Leo']);
const log = [];
const say = (s) => { console.log(s); log.push(s); };
let fails = 0;
const verdict = (ok, what) => { if (!ok) fails++; say(`${ok ? 'PASS' : 'FAIL'}  ${what}`); };

const browser = await launch({ gpu: true });
const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
await o.page.evaluate(() => window.__cellestial.sky.ready);
await sleep(1500);
await o.page.evaluate(() => { window.__picked = []; window.__cellestial.sky.hooks.on('star-pick', (e) => window.__picked.push(e.slot)); });
say(`THE PHONE'S SKY at ${W}x${H} (device pixels x${SIZES[size].deviceScaleFactor}), production build, the sky empty`);
const turned = await o.page.evaluate(() => window.__cellestial.sky.debug.stats().stations.filter((s) => s.turned).map((s) => s.figure));
say(`turned a quarter: ${turned.join(', ') || 'none'}`);

const chromeRects = () => o.page.evaluate(() => {
	const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return q.width ? { x: q.x, y: q.y, w: q.width, h: q.height } : null; };
	return { 'the exit button': rect('[data-descend]'), 'the logo': rect('.chrome-logo'), 'the menu button': rect('#chrome button[popovertarget]') };
});
const gapToRect = (c, r) => Math.hypot(Math.max(r.x - c.x, 0, c.x - (r.x + r.w)), Math.max(r.y - c.y, 0, c.y - (r.y + r.h))) - c.r;
const circlesOf = async (c) => (await o.page.evaluate((slots) => slots.map((s) => (s ? window.__cellestial.sky.hooks.starCircle(s) : null)), c.stars.map((s) => s.slot))).map((q, i) => (q ? { ...q, i, slot: c.stars[i].slot } : null)).filter(Boolean);

// The outer edge of each of Cellestial's rings as the sky draws it now: the page gives the middle
// of each band (introRings); the picture's own numbers give the outer edge from that.
const RING = ASSETS.sky.b3Ring;
const OUT = { long: RING.outer.rx / ((RING.outer.rx + RING.inner.rx) / 2), short: RING.outer.ry / ((RING.outer.ry + RING.inner.ry) / 2) };
const ringGaps = async (cs) => {
	const rings = await o.page.evaluate(() => window.__cellestial.sky.introRings());
	let least = Infinity, reach = 0;
	for (const g of rings) {
		const A = g.a * OUT.long, B = g.b * OUT.short;
		reach = Math.max(reach, A, B);
		for (let n = 0; n < 1440; n++) {
			const t = (n / 1440) * 2 * Math.PI;
			const ex = A * Math.cos(t), ey = B * Math.sin(t);
			const x = g.x + ex * Math.cos(g.turn) - ey * Math.sin(g.turn), y = g.y + ex * Math.sin(g.turn) + ey * Math.cos(g.turn);
			for (const s of cs) least = Math.min(least, Math.hypot(s.x - x, s.y - y) - s.r);
		}
	}
	return { least, reach, x: rings[0].x, y: rings[0].y };
};

const cells = [];
const closeups = [];
const dense = [];
const stations = [];
if (only.has('stations')) {
	let offScreen = 0, nearSide = 0, underChrome = 0, deepest = 0, lowWide = 0;
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(2600);
		const png = await o.page.screenshot({ type: 'png' });
		const cs = await circlesOf(c);
		const rects = await chromeRects();
		const want = c.stars.filter((s) => s.slot).length;
		const top = Math.min(...cs.map((q) => q.y - q.r)), bottom = Math.max(...cs.map((q) => q.y + q.r)), left = Math.min(...cs.map((q) => q.x - q.r)), right = Math.max(...cs.map((q) => q.x + q.r));
		const cTop = Math.min(...cs.map((q) => q.y)), cBottom = Math.max(...cs.map((q) => q.y));
		let pairs = 0, worst = 0;
		for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
			const d = Math.hypot(cs[a].x - cs[b].x, cs[a].y - cs[b].y);
			if (d < cs[a].r + cs[b].r) { pairs++; worst = Math.max(worst, (cs[a].r + cs[b].r - d) / (2 * Math.min(cs[a].r, cs[b].r))); }
		}
		const side = Math.min(left, W - right);
		const chrome = [];
		for (const [name, r] of Object.entries(rects)) if (r) { const g = Math.min(...cs.map((q) => gapToRect(q, r))); chrome.push(`${name} ${Math.round(g)} px`); if (g <= 0) underChrome++; }
		if (cs.length < want) offScreen += want - cs.length;
		if (side < 20 - 0.05 || top < 0 || bottom > H) nearSide++;
		deepest = Math.max(deepest, worst);
		const share = (bottom - top) / H;
		if (WIDE.has(c.name) && share < 0.5) lowWide++;
		say(`${String(k + 1).padStart(2)} ${c.name.padEnd(12)}${turned.includes(c.name) ? 'TURNED ' : 'upright'} ${cs.length} claimable stars on screen of ${want}; figure ${Math.round(right - left)}x${Math.round(bottom - top)} px (y ${Math.round(top)}..${Math.round(bottom)}: ${(100 * share).toFixed(0)}% of the height; centre to centre ${(100 * (cBottom - cTop) / H).toFixed(0)}%); nearest side ${side.toFixed(1)} px; star radius ${Math.min(...cs.map((q) => q.r)).toFixed(1)}..${Math.max(...cs.map((q) => q.r)).toFixed(1)} px; overlapping pairs ${pairs}, deepest ${(100 * worst).toFixed(0)}% of the smaller star's width; clear of ${chrome.join(', ')}`);
		cells.push({ img: png, label: `${k + 1} ${c.name}${turned.includes(c.name) ? ' (turned)' : ''}: ${(100 * share).toFixed(0)}% high` });
		dense.push({ k, pairs, worst, cs });
		stations.push({ k, cs });
		if (k === 0) {
			const dpr = SIZES[size].deviceScaleFactor;
			const moments = [];
			for (const wait of [0, 2400]) {
				await sleep(wait);
				const shot = wait ? await o.page.screenshot({ type: 'png' }) : png;
				const g = await ringGaps(cs);
				moments.push(g);
				const R = 110;
				closeups.push({ img: await sharp(shot).extract({ left: Math.round((g.x - R) * dpr), top: Math.round((g.y - R) * dpr), width: R * 2 * dpr, height: R * 2 * dpr }).png().toBuffer(), label: `Cellestial's star, device pixels (${R * 2} css px across)${wait ? `, ${wait / 1000} s later` : ''}` });
				if (wait) closeups.push({ img: await sharp(shot).extract({ left: 0, top: Math.round(Math.max(0, top - 30) * dpr), width: W * dpr, height: Math.round((Math.min(H, bottom + 30) - Math.max(0, top - 30)) * dpr) }).png().toBuffer(), label: 'Virgo and the star, the whole figure' });
			}
			const core = await o.page.evaluate(() => window.__cellestial.sky.coreCircle());
			const full = moments[0].reach;
			const near = cs.map((s) => ({ d: Math.hypot(s.x - core.x, s.y - core.y), r: s.r })).sort((a, b) => a.d - b.d).slice(0, 4);
			say(`   Cellestial's star: ${(2 * full).toFixed(1)} px across (the full reach of its rings, ${full.toFixed(1)} px from its centre at ${Math.round(core.x)},${Math.round(core.y)}); core r ${core.r.toFixed(1)} px. Virgo's four nearest stars: ${near.map((q) => `centre ${q.d.toFixed(1)} px away, radius ${q.r.toFixed(1)}, its disc ${(q.d - q.r - full).toFixed(1)} px beyond the rings' full reach`).join('; ')}`);
			say(`   the rings as drawn, nearest approach of any ring's outer edge to any star's disc: ${moments.map((g, i) => `${g.least.toFixed(1)} px (${i ? '2.4 s later' : 'first moment'})`).join(', ')}`);
			verdict(near.every((q) => q.d - q.r - full >= 2 - 0.05), `Cellestial's rings end at least 2 px short of every star of Virgo, at their full reach (least ${Math.min(...near.map((q) => q.d - q.r - full)).toFixed(1)} px) and as drawn at two moments (${moments.map((g) => g.least.toFixed(1)).join(' and ')} px)`);
			verdict(2 * full >= 84, `Cellestial's star is at least 84 px across (${(2 * full).toFixed(1)})`);
		}
	}
	verdict(offScreen === 0, `every claimable star is on screen at every station (${offScreen} missing)`);
	verdict(nearSide === 0, `every star is at least 20 px clear of the sides at every station (${nearSide} stations fail)`);
	verdict(underChrome === 0, `every star is clear of the logo, the menu button and the exit button (${underChrome} touches)`);
	verdict(lowWide === 0, `the six wide figures are at least 50% of the screen's height (${lowWide} are not)`);
	verdict(deepest <= 1 / 3 + 0.002, `no two stars overlap by more than a third (deepest ${(100 * deepest).toFixed(1)}%)`);
	await sheet(join(dir, 'stations-empty.jpg'), cells, { cols: 6, cellW: 258, cellH: Math.round((258 * H) / W) });
	await sheet(join(dir, 'cellestial-star.jpg'), closeups, { cols: 3, cellW: 500, cellH: 500 });
	// The figures with a knot, at device pixels.
	const knots = [];
	for (const d of dense.filter((q) => q.pairs > 0).sort((a, b) => b.worst - a.worst).slice(0, 3)) {
		const c = CONSTELLATIONS[d.k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), d.k);
		await sleep(2600);
		const crop = await o.page.screenshot({ type: 'png' });
		const dpr = SIZES[size].deviceScaleFactor;
		const top = Math.max(0, Math.min(...d.cs.map((q) => q.y - q.r)) - 30), bottom = Math.min(H, Math.max(...d.cs.map((q) => q.y + q.r)) + 30);
		knots.push({ img: await sharp(crop).extract({ left: 0, top: Math.round(top * dpr), width: W * dpr, height: Math.round((bottom - top) * dpr) }).png().toBuffer(), label: `${c.name}, empty: ${d.pairs} overlapping pairs, deepest ${(100 * d.worst).toFixed(0)}%` });
	}
	if (knots.length) await sheet(join(dir, 'dense-figures.jpg'), knots, { cols: 3, cellW: 520, cellH: 900 });
}

if (only.has('taps')) {
	say('');
	say('TAPS: a real touch on every star of every figure. At its centre, and on its free side (0.55 of its radius out, away from its nearest neighbour).');
	let all = 0, good = 0;
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(2600);
		const cs = await circlesOf(c);
		let ok = 0, wrong = 0, none = 0;
		const misses = [];
		const tapAt = async (x, y, want, kind) => {
			await o.page.evaluate(() => { window.__picked.length = 0; });
			await o.page.touchscreen.tap(x, y);
			await sleep(450);
			const got = await o.page.evaluate(() => window.__picked[0] ?? null);
			await o.page.keyboard.press('Escape');
			await sleep(250);
			await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
			await sleep(250);
			if (got === want) ok++;
			else if (got === null) { none++; misses.push(`${kind} of ${want} at ${Math.round(x)},${Math.round(y)}: nothing picked`); }
			else { wrong++; misses.push(`${kind} of ${want} at ${Math.round(x)},${Math.round(y)}: took ${got}`); }
		};
		for (const s of cs) {
			await tapAt(s.x, s.y, s.slot, 'centre');
			const others = cs.filter((t) => t !== s);
			const near = others.reduce((a, b) => (Math.hypot(b.x - s.x, b.y - s.y) < Math.hypot(a.x - s.x, a.y - s.y) ? b : a));
			const dx = s.x - near.x, dy = s.y - near.y, L = Math.hypot(dx, dy) || 1;
			await tapAt(s.x + (dx / L) * s.r * 0.55, s.y + (dy / L) * s.r * 0.55, s.slot, 'free side');
		}
		all += ok + wrong + none;
		good += ok;
		say(`${c.name.padEnd(12)} ${cs.length} stars, ${ok + wrong + none} taps: the star under the finger ${ok}, ANOTHER STAR ${wrong}, nothing ${none}${misses.length ? `\n      ${misses.join('\n      ')}` : ''}`);
	}
	verdict(good === all && all === 2 * 146, `a touch at the centre and one on the free side of every star of every figure takes that star (${good} of ${all}; 146 stars)`);
}
verdict(o.errors.length === 0, `no console error (${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'})`);
say(fails ? `${fails} FAILED` : 'ALL PASS');
writeFileSync(join(dir, `phone-sky${only.size === 2 ? '' : `-${[...only].join('-')}`}.txt`), `${log.join('\n')}\n`);
await browser.close();
process.exit(fails ? 1 : 0);
