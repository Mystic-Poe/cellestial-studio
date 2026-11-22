#!/usr/bin/env node
// The third look's own (second run): the sky's governor on a REAL visit ("/", the loader skipped by a tap
// or a key one second in), before the fall, after it, and back in the sky after the warp: does the fall
// leave the sky scaled down, and if it does, does it come back? Production build, real GPU, both sizes.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const dir = outDir('walk');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const level = (o) => o.page.evaluate(() => { const q = window.__cellestial.sky.debug.stats().quality; return `${q.level} (pixel ratio ${q.dpr})`; }).catch(() => '?');
for (const size of ['phone', 'desk']) for (const throttle of [1, 4]) for (let run = 1; run <= (throttle === 1 ? 4 : 2); run++) {
	const o = await open(browser, size, { throttle, init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await o.page.goto(`${PROD}/?debug`, { waitUntil: 'load' });
	await sleep(1000);
	if (o.phone) await o.pressAt(o.W / 2, o.H / 2); else await o.page.keyboard.press('a');
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
	await sleep(2500);
	const before = await level(o);
	await o.press('[data-descend]');
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'roots', null, { timeout: 30000 });
	await sleep(2500);
	const after = await level(o);
	await o.press('[data-ascend]');
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
	await sleep(2000);
	const back2 = await level(o);
	await sleep(8000);
	const back10 = await level(o);
	await sleep(15000);
	const back25 = await level(o);
	say(`${size}, CPU x${throttle}, run ${run}: the governor's level in the sky before the fall ${before}; in the Roots after it ${after}; back in the sky after the warp: at 2 s ${back2}, at 10 s ${back10}, at 25 s ${back25}; console errors ${o.errors.filter((e) => !/about:blank/.test(e)).length}`);
	await o.context.close();
}
writeFileSync(join(dir, 'governor-visit.txt'), `${log.join('\n')}\n`);
await browser.close();
