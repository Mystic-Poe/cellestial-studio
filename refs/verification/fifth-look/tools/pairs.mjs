#!/usr/bin/env node
// The fourth look's own: THE KNOTS, every pair of stars, at any list of sizes. The sky empty, the round
// done, the clock held; at every station every pair of stars whose discs meet: how far each is into the
// other as a share of the SMALLER star's width ((r1 + r2 - d) / (2 * min r)). Every pair over a third is
// named. For Taurus (and any figure with a pair over a third) the figure whole and the knot enlarged
// (device pixels, x4, hard pixels). Then a real touch at the centre of each star of each named pair.
//   node pairs.mjs --sizes side,side667,side740,side932,desk,phone
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'side,side667,side740,side932' }, tag: { type: 'string', default: 'pairs' } } });
const dir = outDir('knots');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const cells = [];
for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	const dpr = SIZES[size].deviceScaleFactor;
	const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => { window.__picked = []; window.__cellestial.sky.hooks.on('star-pick', (e) => window.__picked.push(e.slot)); });
	await sleep(1500);
	say(`THE KNOTS at ${W}x${H} (${size}): ${PROD}`);
	let deepest = 0, smallest = 1e9;
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(2400);
		const cs = (await o.page.evaluate((slots) => slots.map((s) => (s ? { slot: s, ...window.__cellestial.sky.hooks.starCircle(s) } : null)), c.stars.map((s) => s.slot))).filter(Boolean);
		smallest = Math.min(smallest, ...cs.map((q) => q.r));
		const bad = [];
		let n = 0, worst = 0;
		for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
			const d = Math.hypot(cs[a].x - cs[b].x, cs[a].y - cs[b].y);
			if (d >= cs[a].r + cs[b].r) continue;
			n++;
			const over = (cs[a].r + cs[b].r - d) / (2 * Math.min(cs[a].r, cs[b].r));
			worst = Math.max(worst, over);
			if (over > 1 / 3 + 0.002) bad.push({ a: cs[a], b: cs[b], d, over });
		}
		deepest = Math.max(deepest, worst);
		say(`${String(k + 1).padStart(2)} ${c.name.padEnd(12)} radius ${Math.min(...cs.map((q) => q.r)).toFixed(1)}..${Math.max(...cs.map((q) => q.r)).toFixed(1)} px; pairs that meet ${n}, deepest ${(100 * worst).toFixed(0)}%${bad.map((p) => `\n      OVER A THIRD: ${p.a.slot} (r ${p.a.r.toFixed(1)}) and ${p.b.slot} (r ${p.b.r.toFixed(1)}), centres ${p.d.toFixed(1)} px apart: ${(100 * p.over).toFixed(0)}% of the smaller star's width`).join('')}`);
		if (bad.length || c.name === 'Taurus') {
			const png = await o.page.screenshot({ type: 'png' });
			cells.push({ img: await sharp(png).resize({ width: 780 }).png().toBuffer(), label: `${c.name} at ${W}x${H}: deepest ${(100 * worst).toFixed(0)}%` });
			const p = bad.sort((x, y) => y.over - x.over)[0] ?? null;
			const mid = p ? [(p.a.x + p.b.x) / 2, (p.a.y + p.b.y) / 2] : (() => { const s = cs.reduce((m, q) => (q.r < m.r ? q : m)); return [s.x, s.y]; })();
			const half = size === 'desk' ? 80 : 40;
			const left = Math.max(0, Math.round((mid[0] - half) * dpr)), top = Math.max(0, Math.round((mid[1] - half) * dpr));
			const sidePx = Math.min(half * 2 * dpr, W * dpr - left, H * dpr - top);
			cells.push({ img: await sharp(png).extract({ left, top, width: sidePx, height: sidePx }).resize({ width: 640, kernel: 'nearest' }).png().toBuffer(), label: `${c.name} ${W}x${H}: ${half * 2} css px round ${p ? `${p.a.slot}/${p.b.slot}, ${(100 * p.over).toFixed(0)}%` : 'its smallest star'}` });
			// a real touch at the centre of each star of each pair over a third
			for (const q of [...new Map(bad.flatMap((p) => [p.a, p.b]).map((q) => [q.slot, q])).values()]) {
				await o.page.evaluate(() => { window.__picked.length = 0; });
				await o.pressAt(q.x, q.y);
				await sleep(450);
				const got = await o.page.evaluate(() => [...window.__picked]);
				say(`      a ${o.phone ? 'touch' : 'click'} at the centre of ${q.slot}: took ${got.join(', ') || 'nothing'}`);
				await o.page.keyboard.press('Escape');
				await sleep(250);
			}
		}
	}
	say(`${size}: the deepest any two stars stand into each other ${(100 * deepest).toFixed(0)}%; the smallest star's radius ${smallest.toFixed(1)} px (${(2 * smallest).toFixed(0)} px across)`);
	await o.context.close();
}
await sheet(join(dir, `${values.tag}.jpg`), cells, { cols: 2, cellW: 780, cellH: 640 });
writeFileSync(join(dir, `${values.tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
