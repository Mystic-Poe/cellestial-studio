#!/usr/bin/env node
// The third look's own (second run): a real touch (or click) at the centre of EVERY star of EVERY figure
// at a size, with the round done so that the exit button is there, the sky empty. For each star: did the
// sky pick THAT star? If not: what element is under the finger. And where each star stands against the
// exit button, the logo and the menu. Production build, real GPU.
//   node all-taps.mjs --size side|desk|phone|short [--shots 1,2,3,10]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, launch, open, outDir, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'side' }, shots: { type: 'string', default: '' } } });
const size = values.size;
const dir = outDir(size === 'desk' ? 'desk-sky' : 'phone-sky');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const o = await open(browser, size, { init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
await o.page.evaluate(() => window.__cellestial.sky.ready);
await o.page.evaluate(() => { window.__picked = []; window.__cellestial.sky.hooks.on('star-pick', (e) => window.__picked.push(e.slot)); });
await sleep(1500);
say(`EVERY STAR TAPPED at ${o.W}x${o.H} (${size}), the sky empty, the exit button shown`);
const shots = new Set(values.shots.split(',').filter(Boolean).map(Number));
const cells = [];
let total = 0, taken = 0;
const extra = [];
let edgeLeast = 1e9;
for (let k = 0; k < 12; k++) {
	const c = CONSTELLATIONS[k];
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
	await sleep(2600);
	const m = await o.page.evaluate((slots) => {
		const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return q.width && cs.visibility !== 'hidden' && !e.hidden ? { x: q.x, y: q.y, w: q.width, h: q.height } : null; };
		const sky = window.__cellestial.sky;
		return { b11: rect('[data-descend]'), logo: rect('.chrome-logo'), menu: rect('#chrome button[popovertarget]'), circles: slots.map((s) => (s ? { slot: s, ...sky.hooks.starCircle(s) } : null)) };
	}, c.stars.map((s) => s.slot));
	if (shots.has(k + 1)) cells.push({ img: await o.page.screenshot({ type: 'png' }), label: `${k + 1} ${c.name} ${o.W}x${o.H}` });
	const gap = (q, r) => Math.hypot(Math.max(r.x - q.x, 0, q.x - (r.x + r.w)), Math.max(r.y - q.y, 0, q.y - (r.y + r.h))) - q.r;
	const cs = m.circles.filter((q) => q && Number.isFinite(q.x));
	const res = [];
	for (const q of cs) {
		total++;
		const under = await o.page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : ''}${e.hasAttribute('data-descend') || e.closest('[data-descend]') ? '[the exit button]' : ''}` : 'nothing'; }, [q.x, q.y]);
		await o.page.evaluate(() => { window.__picked.length = 0; });
		await o.pressAt(q.x, q.y);
		await sleep(450);
		const got = await o.page.evaluate(() => window.__picked[0] ?? null);
		const nPicked = await o.page.evaluate(() => window.__picked.length);
		if (nPicked > 1) extra.push(`${q.slot}: ${nPicked} picks`);
		const scene = await o.page.evaluate(() => document.documentElement.dataset.scene);
		if (got === q.slot) taken++;
		else res.push(`${q.slot} at ${Math.round(q.x)},${Math.round(q.y)} r ${q.r.toFixed(1)}: ${got ? `took ${got}` : 'took nothing'}; under the finger: ${under}; its disc ${m.b11 ? Math.round(gap(q, m.b11)) : '-'} px from the exit button; scene now ${scene}`);
		if (scene !== 'sky') {
			// the tap went to the exit button: the fall has begun. Come back.
			await sleep(4500);
			await o.page.evaluate(() => window.__cellestial.director.go('sky'));
			await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 15000 }).catch(() => {});
			await sleep(2500);
			await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
			await sleep(2600);
		} else {
			await o.page.keyboard.press('Escape');
			await sleep(250);
		}
	}
	const edge = cs.length ? Math.min(...cs.map((q) => Math.min(q.x - q.r, o.W - q.x - q.r, q.y - q.r, o.H - q.y - q.r))) : 0;
	edgeLeast = Math.min(edgeLeast, edge);
	const least = (r) => (r && cs.length ? Math.round(Math.min(...cs.map((q) => gap(q, r)))) : null);
	say(`${String(k + 1).padStart(2)} ${c.name.padEnd(11)} ${cs.length} stars, ${cs.length - res.length} took the star under the finger; nearest disc to the exit button ${least(m.b11)} px, to the logo ${least(m.logo)} px, to the menu ${least(m.menu)} px; nearest disc to a side of the screen ${edge.toFixed(1)} px; stars whose disc reaches the exit button: ${m.b11 ? cs.filter((q) => gap(q, m.b11) < 0).length : 0}${res.length ? `\n      NOT TAKEN: ${res.join('\n      NOT TAKEN: ')}` : ''}`);
}
say(`fourth look: taps that picked more than one star: ${extra.join(', ') || 'none'}; nearest any disc comes to a side of the screen: ${edgeLeast.toFixed(1)} px`);
say(`${taken} of ${total} taps took the star under the finger; console errors: ${o.errors.filter((e) => !/about:blank/.test(e)).join(' | ').slice(0, 300) || 'none'}`);
if (cells.length) await sheet(join(dir, `taps-${size}.jpg`), cells, { cols: 2, cellW: 788, cellH: 500 });
writeFileSync(join(dir, `all-taps-${size}.txt`), `${log.join('\n')}\n`);
await browser.close();
