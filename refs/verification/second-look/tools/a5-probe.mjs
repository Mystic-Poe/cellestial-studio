#!/usr/bin/env node
// Is the blink at the scene change really drawn, or an artefact of the recording? An in-page probe, no
// recording: after the page's own animation-frame callbacks have run, each canvas's middle 96x96 px is
// copied (drawImage, same frame, before the buffer is presented) and its mean light stored with the
// scene's name. Looks for a frame where the sky's canvas has lost its centre.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const dir = outDir('a5');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of ['desk', 'phone']) for (let run = 1; run <= 6; run++) {
	const o = await open(browser, size, { init: { fn: () => {
		window.__probe = [];
		const pad = document.createElement('canvas');
		pad.width = pad.height = 96;
		const g = pad.getContext('2d', { willReadFrequently: true });
		const tick = (t) => {
			const row = { t, scene: document.documentElement.dataset.scene, c: [] };
			for (const cv of document.querySelectorAll('canvas')) {
				const r = cv.getBoundingClientRect();
				const cs = getComputedStyle(cv);
				let L = -1;
				try {
					g.clearRect(0, 0, 96, 96);
					const sx = cv.width / (r.width || 1), sy = cv.height / (r.height || 1);
					// the middle of the SCREEN, in this canvas's own pixels
					const cx = (innerWidth / 2 - r.left) * sx, cy = (innerHeight / 2 - r.top) * sy;
					g.drawImage(cv, cx - 48 * sx, cy - 48 * sy, 96 * sx, 96 * sy, 0, 0, 96, 96);
					const d = g.getImageData(0, 0, 96, 96).data;
					let s = 0;
					for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * (d[i + 3] / 255);
					L = s / (96 * 96);
				} catch { L = -2; }
				row.c.push({ id: cv.id || cv.className || cv.parentElement?.id || '?', L: Math.round(L * 10) / 10, op: cs.opacity, vis: cs.visibility, disp: cs.display, ph: getComputedStyle(cv.parentElement).opacity });
			}
			window.__probe.push(row);
			setTimeout(() => requestAnimationFrame(tick), 0); // registered after the page's own: runs last next frame
		};
		addEventListener('DOMContentLoaded', () => requestAnimationFrame(tick));
	} } });
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 60000 });
	await sleep(700);
	const rows = await o.page.evaluate(() => window.__probe);
	const k = rows.findIndex((r) => r.scene === 'sky');
	const near = rows.slice(Math.max(0, k - 8), k + 8);
	say(`${size} run ${run}: ${rows.length} frames probed; the scene becomes "sky" at probe ${k}. Frames round it (ms from that frame | canvas: light of the screen's middle / opacity / parent's opacity):`);
	for (const r of near) say(`   ${String(Math.round(r.t - rows[k].t)).padStart(5)} ${r.scene.padEnd(8)} ${r.c.map((c) => `${c.id}: ${c.L} /${c.op}/${c.ph}${c.disp === 'none' ? ' display none' : ''}${c.vis === 'hidden' ? ' hidden' : ''}`).join(' | ')}`);
	await o.context.close();
}
writeFileSync(join(dir, 'blink-probe.txt'), `${log.join('\n')}\n`);
await browser.close();
