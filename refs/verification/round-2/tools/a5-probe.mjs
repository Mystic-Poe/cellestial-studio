#!/usr/bin/env node
// Is the blink at the scene change really drawn, or an artefact of the recording? An in-page probe, no
// recording: after the page's own animation-frame callbacks have run, each canvas's middle 96x96 px is
// copied (drawImage, same frame, before the buffer is presented) and its mean light stored with the
// scene's name. Looks for a frame where the sky's canvas has lost its centre.
//   node a5-probe.mjs [--runs 6] [--throttle 1]
// Round 2 (piece 2a) added the two options and the count at the end: a DIP is a frame, within 12 frames
// of the scene change, in which the middle of the sky's canvas has under half the light it has six frames
// after the change. The probe itself is the second look's, unchanged.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { runs: { type: 'string', default: '6' }, throttle: { type: 'string', default: '1' }, only: { type: 'string', default: 'desk,phone' } } });
const RUNS = Number(values.runs);
const throttle = Number(values.throttle);
const tag = throttle > 1 ? `-cpu${throttle}x` : '';
const summary = [];
const dir = outDir('a5');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const size of values.only.split(',')) { let dipped = 0; for (let run = 1; run <= RUNS; run++) {
	const o = await open(browser, size, { throttle, init: { fn: () => {
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
	const light = (r) => r.c.find((c) => c.id === 'sky-canvas')?.L ?? -1;
	const usual = light(rows[Math.min(rows.length - 1, k + 6)]);
	const dips = rows.slice(Math.max(0, k - 12), k + 12).filter((r) => light(r) >= 0 && light(r) < usual * 0.5);
	if (dips.length) dipped++;
	summary.push(`${size} cpu x${throttle} run ${run}: ${dips.length ? `DIP ${dips.map((r) => `(${Math.round(r.t - rows[k].t)} ms, ${r.scene}, ${light(r)})`).join(' ')}` : 'no dip'} (centre light otherwise ${usual})`);
	await o.context.close();
} summary.push(`${size} cpu x${throttle}: a dip in ${dipped} of ${RUNS} first visits`); }
for (const s of summary) console.log(s);
writeFileSync(join(dir, `blink-probe${tag}.txt`), `${log.join('\n')}\n`);
writeFileSync(join(dir, `blink-probe${tag}-summary.txt`), `In-page probe (no recording): light of the sky canvas's middle 96 px, frame by frame, round the scene change. A DIP is a frame drawn without Cellestial's star (ms from the frame the scene became 'sky', scene, light).\n${summary.join('\n')}\n`);
await browser.close();
