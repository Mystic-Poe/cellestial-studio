#!/usr/bin/env node
// Finding 1 (and 13): the fall, in real time, production build, real GPU, both sizes,
// from Virgo, Aries (4 stars) and Sagittarius (many). Every fx.impact call is logged.
//   node fall.mjs [--only desk,phone] [--figs 0,7,3] [--throttle 1,4]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { GRID, PROD, frameTimes, launch, open, outDir, pnow, recorder, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { only: { type: 'string', default: 'desk,phone' }, figs: { type: 'string', default: '0,7,3' }, throttle: { type: 'string', default: '1,4' }, url: { type: 'string', default: PROD } } });
const NAMES = ['Virgo', 'Libra', 'Scorpius', 'Sagittarius', 'Capricornus', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo'];
const dir = outDir('fall');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of values.only.split(',')) {
	for (const fig of values.figs.split(',').map(Number)) {
		for (const throttle of values.throttle.split(',').map(Number)) {
			const o = await open(browser, size, { throttle, init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
			await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
			await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
			await o.page.evaluate(() => window.__cellestial.sky.ready);
			await sleep(1200);
			await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
			await sleep(2500);
			const stars = await o.page.evaluate(([w, h]) => [...document.querySelectorAll('button.sky-star:not([hidden])')].filter((b) => { const r = b.getBoundingClientRect(); return r.right > 0 && r.left < w && r.bottom > 0 && r.top < h; }).length, [o.W, o.H]);
			await o.page.evaluate(() => {
				const fx = window.__cellestial.fx;
				window.__impacts = [];
				const orig = fx.impact.bind(fx);
				try { fx.impact = (x, y, s) => { window.__impacts.push({ t: performance.now(), x: Math.round(x), y: Math.round(y), s }); return orig(x, y, s); }; } catch (e) { window.__impacts.push({ error: String(e) }); }
				const roots = window.__cellestial.roots;
				window.__grow = [];
				if (roots?.growFrom) { const g = roots.growFrom.bind(roots); try { roots.growFrom = (x) => { window.__grow.push({ t: performance.now(), x: Math.round(x) }); return g(x); }; } catch {} }
			});
			const rec = await recorder(o);
			await sleep(300);
			const p0 = await pnow(o.page);
			const t0 = Date.now();
			await o.press('[data-descend]');
			await sleep(throttle > 1 ? 5200 : 3600);
			const p1 = await pnow(o.page);
			const ft = await frameTimes(o.page, p0, Math.min(p1, p0 + 3000));
			const imp = await o.page.evaluate(() => ({ impacts: window.__impacts, grow: window.__grow, scene: document.documentElement.dataset.scene, scrollY: Math.round(scrollY) }));
			const ts = imp.impacts.filter((i) => i.t).map((i) => Math.round(i.t - p0));
			const tag = `${size}-${NAMES[fig].toLowerCase()}${throttle > 1 ? `-cpu${throttle}x` : ''}`;
			say(`${tag}: ${stars} star buttons on screen; fx.impact called ${imp.impacts.length} times at +ms [${ts.join(',')}] x [${imp.impacts.map((i) => i.x).join(',')}] size [${imp.impacts.map((i) => (i.s ?? 1).toFixed?.(2) ?? i.s).join(',')}]; growFrom ${imp.grow.length} at +${imp.grow.map((g) => Math.round(g.t - p0)).join(',')} x ${imp.grow.map((g) => g.x).join(',')}; frames in the first 3 s: ${ft.text}; ends scene ${imp.scene} scrollY ${imp.scrollY}; console errors ${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'}`);
			if (throttle === 1 || size === 'phone') {
				// the whole event every 100 ms, then the crash itself frame by frame
				await sheet(join(dir, `${tag}-whole.jpg`), rec.cut('', t0, t0 + 3000, 100), GRID[size]);
				if (throttle === 1) await sheet(join(dir, `${tag}-dense.jpg`), rec.cut('', t0 + 150, t0 + 1650, size === 'phone' ? 32 : 42), GRID[size]);
			}
			await rec.stop();
			await o.context.close();
		}
	}
}
writeFileSync(join(dir, 'fall.txt'), `${log.join('\n')}\n`);
await browser.close();
