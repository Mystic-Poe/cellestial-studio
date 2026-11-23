#!/usr/bin/env node
// The fifth look's own: every grid tap that gave a label on the build as it stood and none in my grid run of the
// new build (a panel, or a point not tapped because the words of the tap before stood there): each made ALONE
// on a fresh page of the new build. Does it offer the star it offered before?
//   node probe3.mjs --size phone|desk
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, ROOT, launch, open, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'phone' } } });
const base = join(ROOT, 'refs/verification/fifth-look');
const neu = JSON.parse(readFileSync(join(base, 'labels', `${values.size}.json`)));
const old = JSON.parse(readFileSync(join(base, 'old/labels', `${values.size}.json`)));
const list = old.map((t, i) => ({ o: t, n: neu[i] })).filter(({ o, n }) => o.what === 'label' && n.what !== 'label');
const browser = await launch({ gpu: true });
let same = 0;
for (const { o: t, n } of list) {
	const o = await open(browser, values.size, { reducedMotion: true, init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(500);
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), t.k);
	await sleep(900);
	await o.pressAt(...t.pt);
	await sleep(400);
	const r = await o.page.evaluate(() => {
		const w = document.querySelector('[data-claim-words]');
		const panel = [...document.querySelectorAll('[data-sky-panel]')].find((p) => !p.hidden);
		return { words: w && !w.hidden && getComputedStyle(w).visibility !== 'hidden' ? `${w.dataset.slot} ${w.dataset.side}` : null, panel: !!panel };
	});
	const ok = !r.panel && r.words?.startsWith(`${t.slot} `);
	if (ok) same++;
	console.log(`${t.fig} ${t.pt.map(Math.round)}: before ${t.slot}; in the grid run ${n.what}; alone on the new build: ${r.panel ? 'A PANEL' : r.words ?? 'NOTHING'}${ok ? '' : '   <<< NOT THE SAME'}`);
	await o.context.close();
}
console.log(`${values.size}: ${list.length} taps gave a label before and none in the grid run; made alone, ${same} offer the same star as before`);
await browser.close();
