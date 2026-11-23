#!/usr/bin/env node
// The third look's own probe of the warp's cover, independent of the builders' check and of warp-cover.mjs.
// In the page, with nothing recording: a callback that runs LAST in every animation frame (it is registered
// after the page's own, as a5-probe.mjs does it) copies the effects canvas, reduced to 240 px wide, and
// stores the lowest and the mean alpha of that copy with the scene's name. So for every frame the page
// draws we have what the effects canvas held when that frame was handed to the screen, in that frame.
// THE QUESTION: in the first frame whose scene is "sky" (the page under the cover is now the sky), and in
// the frame before it (the Roots still under it), is the cover whole (alpha 255 everywhere)?
// Production build, real GPU and in software, both sizes, unslowed and CPU 4x, from the top of the Roots
// (E6 pressed) and from 1800 px down (E6 clicked from script, as the builders' check does).
//   node warp-probe.mjs [--runs 6] [--gpu 1,0]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { runs: { type: 'string', default: '6' }, gpu: { type: 'string', default: '1,0' }, sizes: { type: 'string', default: 'desk,phone' } } });
const dir = outDir('warp');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const probe = () => {
	sessionStorage.setItem('cellestial:round', '1');
	window.__p = [];
	const pad = document.createElement('canvas');
	const g = pad.getContext('2d', { willReadFrequently: true });
	const tick = (t) => {
		const scene = document.documentElement.dataset.scene;
		if (scene === 'warp' || (window.__p.length && window.__p.length < 400 && window.__p.some((r) => r.scene === 'warp'))) {
			const c = document.getElementById('fx-canvas');
			let min = -1, mean = -1, shown = false;
			if (c && c.width && getComputedStyle(c).display !== 'none') {
				shown = true;
				const w = 240, h = Math.max(1, Math.round((240 * c.height) / c.width));
				if (pad.width !== w || pad.height !== h) { pad.width = w; pad.height = h; }
				g.clearRect(0, 0, w, h);
				g.imageSmoothingEnabled = false; // nearest: a sample of real pixels, not an average
				g.drawImage(c, 0, 0, w, h);
				const d = g.getImageData(0, 0, w, h).data;
				min = 255; let s = 0;
				for (let i = 3; i < d.length; i += 4) { if (d[i] < min) min = d[i]; s += d[i]; }
				mean = s / (d.length / 4);
			}
			window.__p.push({ t, scene, min, mean: Math.round(mean * 10) / 10, shown, y: Math.round(scrollY) });
		}
		setTimeout(() => requestAnimationFrame(tick), 0);
	};
	addEventListener('DOMContentLoaded', () => requestAnimationFrame(tick));
};
let bad = 0, total = 0;
for (const gpu of values.gpu.split(',').map((x) => x === '1')) {
	const browser = await launch({ gpu });
	for (const size of values.sizes.split(',')) for (const throttle of [1, 4]) for (const from of ['top', 'far']) {
		const res = [];
		for (let run = 0; run < Number(values.runs); run++) {
			const o = await open(browser, size, { throttle, init: { fn: probe } });
			await o.page.goto(`${PROD}/?scene=roots&debug`, { waitUntil: 'load' });
			await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.roots && window.__cellestial?.fx);
			await o.page.evaluate(async () => { await window.__cellestial.sky.ready; await document.fonts.ready; });
			await sleep(gpu ? 1200 : 2000);
			if (from === 'far') { await o.page.evaluate(() => scrollTo(0, 1800)); await sleep(500); await o.page.evaluate(() => document.querySelector('[data-ascend]').click()); }
			else await o.press('[data-ascend]');
			await o.page.waitForFunction(() => window.__p.some((r) => r.scene === 'sky'), null, { timeout: 30000 });
			await sleep(600);
			const rows = await o.page.evaluate(() => window.__p);
			const k = rows.findIndex((r) => r.scene === 'sky');
			const at = rows[k], before = rows[k - 1], after = rows[k + 1];
			// how long the cover stays whole from the change, and the first frame before it that was whole
			let wholeFrom = k; while (wholeFrom > 0 && rows[wholeFrom - 1].min === 255) wholeFrom--;
			let wholeTo = k; while (wholeTo < rows.length - 1 && rows[wholeTo + 1].min === 255) wholeTo++;
			total++;
			const ok = at.min === 255;
			if (!ok) bad++;
			res.push(`${ok ? 'whole' : `NOT WHOLE (lowest alpha ${at.min})`}; the frame before (Roots under it) lowest alpha ${before?.min}; whole from ${Math.round(rows[wholeFrom].t - at.t)} ms to +${Math.round(rows[wholeTo].t - at.t)} ms round the change; the frame of the change ${Math.round(at.t - (before?.t ?? at.t))} ms long; scrollY at the change ${at.y}`);
			await o.context.close();
		}
		say(`${gpu ? 'real GPU' : 'software'}, ${size}, CPU x${throttle}, from ${from === 'top' ? 'the top of the Roots (E6 pressed)' : '1800 px down (E6 clicked from script)'}:`);
		for (const [i, r] of res.entries()) say(`   run ${i + 1}: in the frame the page becomes the sky the cover is ${r}`);
	}
	await browser.close();
}
say(`${total} warps probed: the cover was not whole in the frame of the change in ${bad}.`);
writeFileSync(join(dir, 'warp-probe.txt'), `${log.join('\n')}\n`);
