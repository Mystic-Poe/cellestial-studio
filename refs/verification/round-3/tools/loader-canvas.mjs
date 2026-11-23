#!/usr/bin/env node
// Round 3, piece 3: the sky's script is now asked for when the loader has its pictures, a tenth of a
// second later than before on a fast line. Does that move anything the loader decides in its first
// second (how coarse its canvas is: it gets coarser if the first second's frames average over 22 ms)
// or its frames? Two builds side by side (R3_BASE the build as it stood, default :4616; the new one on
// :4615), a fast line, the phone and the desktop, unslowed and with the CPU slowed 4x, N first visits
// each: the canvas's width in device pixels 2.5 s after the mount, and the frames between the mount
// and then (average, 95th percentile, how many over 34 ms, the longest).
//   node loader-canvas.mjs [--runs 5]     writes loader/canvas.txt
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { frameTimes, launch, open, outDir, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { runs: { type: 'string', default: '5' } } });
const NEW = 'http://localhost:4615';
const OLD = process.env.R3_BASE ?? 'http://localhost:4616';
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const init = { fn: () => {
	window.__t = {};
	new MutationObserver(() => {
		const l = document.getElementById('loader');
		if (l?.classList.contains('is-live') && !window.__t.live) window.__t.live = performance.now();
		if (l?.classList.contains('is-drawn') && !window.__t.drawn) window.__t.drawn = performance.now();
	}).observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
	new PerformanceObserver((list) => { for (const e of list.getEntries()) if (/sky\.[^/]*\.js$/.test(e.name)) window.__t.skyScript = [e.startTime, e.responseEnd]; }).observe({ type: 'resource', buffered: true });
} };
for (const size of ['phone', 'desk']) for (const throttle of [1, 4]) for (const [build, base] of [['before', OLD], ['after', NEW]]) {
	const widths = [], avg = [], p95 = [], over = [], worst = [], asked = [];
	for (let run = 0; run < Number(values.runs); run++) {
		const o = await open(browser, size, { throttle, init });
		await o.page.goto(`${base}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => window.__t?.drawn, null, { timeout: 60000 });
		await sleep(2500);
		const t = await o.page.evaluate(() => ({ ...window.__t, w: document.querySelector('#loader canvas').width }));
		const f = await frameTimes(o.page, t.drawn, t.drawn + 2400);
		widths.push(t.w); avg.push(f.avg.toFixed(1)); p95.push(f.p95.toFixed(1)); over.push(f.over34); worst.push(Math.round(f.worst)); asked.push(t.skyScript ? `${Math.round(t.skyScript[0] - t.live)}` : '?');
		await o.context.close();
	}
	say(`${size}, CPU ${throttle}x, ${build.padEnd(6)}: the canvas's width ${widths.join(', ')} px; frames in its first 2.4 s: average ${avg.join(', ')} ms; 95th percentile ${p95.join(', ')}; over 34 ms ${over.join(', ')}; the longest ${worst.join(', ')} ms; the sky's script asked for ${asked.join(', ')} ms after the mount`);
}
writeFileSync(join(dir, 'canvas.txt'), `${log.join('\n')}\n`);
await browser.close();
