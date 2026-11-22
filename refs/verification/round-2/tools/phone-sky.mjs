#!/usr/bin/env node
// Finding 5: the phone's sky. Every one of the twelve stations at 390x844 with the sky as it starts
// (empty), production build, real GPU: the size of each figure and its stars, which stars overlap,
// whether any is hidden; then a real tap on every star of the densest figures: does the tap take
// the star the finger is on? And Cellestial's star with Virgo's nearest stars over its rings, close up.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('phone-sky');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const o = await open(browser, 'phone', { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
await o.page.evaluate(() => window.__cellestial.sky.ready);
await sleep(1500);
await o.page.evaluate(() => { window.__picked = []; window.__cellestial.sky.hooks.on('star-pick', (e) => window.__picked.push(e.slot)); });
const cells = [];
const dense = [];
const closeups = [];
for (let k = 0; k < 12; k++) {
	const c = CONSTELLATIONS[k];
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
	await sleep(2600);
	const png = await o.page.screenshot({ type: 'png' });
	const info = await o.page.evaluate((slots) => {
		const hooks = window.__cellestial.sky.hooks;
		const core = window.__cellestial.sky.coreCircle?.();
		return { circles: slots.map((s) => (s ? hooks.starCircle(s) : null)), core };
	}, c.stars.map((s) => s.slot));
	const cs = info.circles.map((q, i) => (q ? { ...q, i, slot: c.stars[i].slot } : null)).filter(Boolean);
	const top = Math.min(...cs.map((q) => q.y - q.r)), bottom = Math.max(...cs.map((q) => q.y + q.r)), left = Math.min(...cs.map((q) => q.x - q.r)), right = Math.max(...cs.map((q) => q.x + q.r));
	let pairs = 0, worst = 0, hidden = 0;
	const overlapped = new Set();
	for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
		const d = Math.hypot(cs[a].x - cs[b].x, cs[a].y - cs[b].y);
		if (d < cs[a].r + cs[b].r) {
			pairs++;
			overlapped.add(a); overlapped.add(b);
			const share = (cs[a].r + cs[b].r - d) / (2 * Math.min(cs[a].r, cs[b].r));
			if (share > worst) worst = share;
			if (d < Math.max(cs[a].r, cs[b].r) * 0.6) hidden++;
		}
	}
	say(`${String(k + 1).padStart(2)} ${c.name.padEnd(12)} ${cs.length} claimable stars on screen of ${c.stars.filter((s) => s.slot).length}; figure ${Math.round(right - left)}x${Math.round(bottom - top)} px (y ${Math.round(top)}..${Math.round(bottom)}, ${(100 * (bottom - top) / 844).toFixed(0)}% of the height); star radius ${Math.min(...cs.map((q) => q.r)).toFixed(1)}..${Math.max(...cs.map((q) => q.r)).toFixed(1)} px; overlapping pairs ${pairs} (${overlapped.size} stars in an overlap), deepest overlap ${(100 * worst).toFixed(0)}% of the smaller star's width; pairs where one centre is inside the other's inner 60%: ${hidden}`);
	cells.push({ img: png, label: `${k + 1} ${c.name}: ${pairs} overlapping pairs` });
	dense.push({ k, pairs, cs });
	if (k === 0) {
		const q = info.core;
		say(`   Cellestial's star: core circle r ${q.r.toFixed(1)} px at ${Math.round(q.x)},${Math.round(q.y)}; Virgo's stars whose centre is within 70 px of it: ${cs.filter((s) => Math.hypot(s.x - q.x, s.y - q.y) < 70).map((s) => `${Math.round(Math.hypot(s.x - q.x, s.y - q.y))} px`).join(', ')}`);
		const R = 110;
		closeups.push({ img: await sharp(png).extract({ left: Math.round((q.x - R) * 2), top: Math.round((q.y - R) * 2), width: R * 4, height: R * 4 }).png().toBuffer(), label: `Cellestial's star on the phone, device pixels (${R * 2} css px across)` });
		await sleep(2400);
		const png2 = await o.page.screenshot({ type: 'png' });
		closeups.push({ img: await sharp(png2).extract({ left: Math.round((q.x - R) * 2), top: Math.round((q.y - R) * 2), width: R * 4, height: R * 4 }).png().toBuffer(), label: 'the same 2.4 s later' });
		closeups.push({ img: await sharp(png).extract({ left: 0, top: Math.round((q.y - 190) * 2), width: 780, height: 760 }).png().toBuffer(), label: 'Virgo and the star, the screen\'s width' });
	}
}
await sheet(join(dir, 'stations-empty.jpg'), cells, { cols: 6, cellW: 258, cellH: 558 });
await sheet(join(dir, 'cellestial-star.jpg'), closeups, { cols: 3, cellW: 500, cellH: 500 });

// Taps on the three densest figures
dense.sort((a, b) => b.pairs - a.pairs);
say('');
say('TAPS: a real touch on every star of the three figures with most overlaps. At the centre, and at the point of the star farthest from its nearest neighbour (0.55 of its radius out).');
for (const d of dense.slice(0, 3)) {
	const c = CONSTELLATIONS[d.k];
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), d.k);
	await sleep(2600);
	const crop = await o.page.screenshot({ type: 'png' });
	const cs = (await o.page.evaluate((slots) => slots.map((s) => (s ? window.__cellestial.sky.hooks.starCircle(s) : null)), c.stars.map((s) => s.slot))).map((q, i) => (q ? { ...q, slot: c.stars[i].slot } : null)).filter(Boolean);
	let ok = 0, wrong = 0, none = 0;
	const misses = [];
	const tapAt = async (x, y, want, kind) => {
		await o.page.evaluate(() => { window.__picked.length = 0; });
		await o.page.touchscreen.tap(x, y);
		await sleep(450);
		const got = await o.page.evaluate(() => window.__picked[0] ?? null);
		await o.page.keyboard.press('Escape');
		await sleep(250);
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), d.k);
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
		// and the side that faces the neighbour, where the two overlap
		if (L < s.r + near.r) await tapAt(s.x - (dx / L) * s.r * 0.55, s.y - (dy / L) * s.r * 0.55, s.slot, 'crowded side');
	}
	say(`${c.name} (${cs.length} stars, ${d.pairs} overlapping pairs): ${ok + wrong + none} taps: the star under the finger ${ok}, ANOTHER STAR ${wrong}, nothing ${none}${misses.length ? `\n      ${misses.join('\n      ')}` : ''}`);
	const top = Math.max(0, Math.min(...cs.map((q) => q.y - q.r)) - 30), bottom = Math.min(844, Math.max(...cs.map((q) => q.y + q.r)) + 30);
	closeups.push({ img: await sharp(crop).extract({ left: 0, top: Math.round(top * 2), width: 780, height: Math.round((bottom - top) * 2) }).png().toBuffer(), label: `${c.name}, empty, the screen's width at device pixels` });
}
await sheet(join(dir, 'dense-figures.jpg'), closeups.slice(3), { cols: 3, cellW: 520, cellH: 620 });
say(`console errors: ${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'}`);
writeFileSync(join(dir, 'phone-sky.txt'), `${log.join('\n')}\n`);
await browser.close();
