#!/usr/bin/env node
// Round 3, piece 1: the knots and Cellestial's star on a phone on its side, at device pixels. Taurus
// and Sagittarius at their stations, the clock held, the sky empty: the figure whole, and each pair the
// knots' rule draws smaller, enlarged four times. Virgo: Cellestial's star and the star nearest its
// rings. Prints each pair's distance, radii and overlap as the page has them.
//   node side-knots.mjs [--size side] [--tag after]
//   R3_BASE=http://localhost:4616 node side-knots.mjs --tag before     (the build as it stood)
// Writes fifth-look/side/knots-<size>-<tag>.jpg and .txt.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'side' }, tag: { type: 'string', default: 'after' } } });
const size = values.size;
const { width: W, height: H } = SIZES[size].viewport;
const dpr = SIZES[size].deviceScaleFactor;
const dir = outDir('side');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
await o.page.evaluate(() => window.__cellestial.sky.ready);
await o.page.evaluate(() => window.__cellestial.sky.debug.setLevel(0));
await sleep(3000);
say(`THE KNOTS AND CELLESTIAL'S STAR at ${W}x${H} (${size}), ${values.tag}: ${PROD}`);
const cells = [];
const PAIRS = { 8: [['slot-77', 'slot-64'], ['slot-1', 'slot-54']], 3: [['slot-80', 'slot-33']], 2: [['slot-41', 'slot-18']] };
for (const k of [8, 3, 2, 0]) {
	const c = CONSTELLATIONS[k];
	await o.page.evaluate((i) => new Promise((done) => { const { debug } = window.__cellestial.sky; debug.setCoord(i); debug.setClock(2); requestAnimationFrame(() => requestAnimationFrame(done)); }), k);
	await sleep(400);
	const png = await o.page.screenshot({ type: 'png' });
	const cs = Object.fromEntries((await o.page.evaluate((slots) => slots.map((s) => [s, s ? window.__cellestial.sky.hooks.starCircle(s) : null]), c.stars.map((s) => s.slot))).filter(([s]) => s));
	const crop = async (x, y, half, label) => {
		const left = Math.max(0, Math.round((x - half) * dpr)), top = Math.max(0, Math.round((y - half) * dpr));
		const side = Math.min(half * 2 * dpr, W * dpr - left, H * dpr - top);
		cells.push({ img: await sharp(png).extract({ left, top, width: side, height: side }).resize({ width: 480, kernel: 'nearest' }).png().toBuffer(), label });
	};
	if (k === 0) {
		const core = await o.page.evaluate(() => window.__cellestial.sky.coreCircle());
		const rings = await o.page.evaluate(() => window.__cellestial.sky.introRings());
		const reach = Math.max(...rings.map((g) => Math.max(g.a, g.b)));
		const near = Object.entries(cs).map(([slot, q]) => ({ slot, d: Math.hypot(q.x - core.x, q.y - core.y), r: q.r })).sort((a, b) => a.d - a.r - (b.d - b.r))[0];
		say(`Virgo: Cellestial's star at ${core.x.toFixed(0)},${core.y.toFixed(0)}, the middle of its outer band ${reach.toFixed(1)} px out; the nearest star ${near.slot}: centre ${near.d.toFixed(1)} px away, radius ${near.r.toFixed(1)} px`);
		await crop(core.x, core.y, 70, `Cellestial's star and ${near.slot} (r ${near.r.toFixed(1)}), 140 px, device pixels`);
		continue;
	}
	cells.push({ img: await sharp(png).resize({ width: 960 }).png().toBuffer(), label: `${c.name} at ${W}x${H}, ${values.tag}` });
	for (const [a, b] of PAIRS[k]) {
		const p = cs[a], q = cs[b];
		const d = Math.hypot(p.x - q.x, p.y - q.y);
		const over = (p.r + q.r - d) / (2 * Math.min(p.r, q.r));
		say(`${c.name} ${a}/${b}: ${d.toFixed(1)} px apart, radii ${p.r.toFixed(1)} and ${q.r.toFixed(1)} px, ${(100 * over).toFixed(0)}% into each other`);
		await crop((p.x + q.x) / 2, (p.y + q.y) / 2, 30, `${a}/${b}: ${d.toFixed(1)} px apart, r ${p.r.toFixed(1)}, ${q.r.toFixed(1)}: ${(100 * over).toFixed(0)}% (60 px, x8)`);
	}
}
await sheet(join(dir, `knots-${size}-${values.tag}.jpg`), cells, { cols: 4, cellW: 390, cellH: 390 });
writeFileSync(join(dir, `knots-${size}-${values.tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
