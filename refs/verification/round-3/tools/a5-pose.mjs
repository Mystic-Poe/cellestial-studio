#!/usr/bin/env node
// Round 2, piece 2a: WHY the sky's middle goes dark for one frame at the end of the hand-off. The same
// in-page probe as a5-probe.mjs (the sky canvas's middle read back in the frame it was drawn, nothing
// recording), and beside it, in the same frame, the pose the sky says its star has: sky.coreCircle() off
// the debug hook (?debug). A dark frame whose pose is not a number is the arithmetic; a dark frame whose
// pose is whole is something else.
//   node refs/verification/round-3/tools/a5-pose.mjs [--runs 6] [--out pose.txt]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const arg = (name, d) => {
	const i = process.argv.indexOf(`--${name}`);
	return i < 0 ? d : process.argv[i + 1];
};
const RUNS = Number(arg('runs', 6));
const dir = outDir('a5');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
let dark = 0, darkNaN = 0, total = 0;
for (const size of ['desk', 'phone']) for (let run = 1; run <= RUNS; run++) {
	const o = await open(browser, size, { init: { fn: () => {
		window.__probe = [];
		const pad = document.createElement('canvas');
		pad.width = pad.height = 96;
		const g = pad.getContext('2d', { willReadFrequently: true });
		const tick = (t) => {
			const cv = document.getElementById('sky-canvas');
			const row = { t, scene: document.documentElement.dataset.scene, L: -1, pose: null };
			if (cv) {
				const r = cv.getBoundingClientRect();
				try {
					g.clearRect(0, 0, 96, 96);
					const sx = cv.width / (r.width || 1), sy = cv.height / (r.height || 1);
					const cx = (innerWidth / 2 - r.left) * sx, cy = (innerHeight / 2 - r.top) * sy;
					g.drawImage(cv, cx - 48 * sx, cy - 48 * sy, 96 * sx, 96 * sy, 0, 0, 96, 96);
					const d = g.getImageData(0, 0, 96, 96).data;
					let s = 0;
					for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * (d[i + 3] / 255);
					row.L = Math.round((s / (96 * 96)) * 10) / 10;
				} catch { row.L = -2; }
			}
			try {
				const c = window.__cellestial?.sky?.coreCircle?.();
				if (c) row.pose = [String(c.x), String(c.y), String(c.r)];
			} catch (e) { row.pose = [`threw ${e}`]; }
			window.__probe.push(row);
			setTimeout(() => requestAnimationFrame(tick), 0);
		};
		addEventListener('DOMContentLoaded', () => requestAnimationFrame(tick));
	} } });
	await o.page.goto(`${PROD}/?debug`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 60000 });
	await sleep(700);
	const rows = await o.page.evaluate(() => window.__probe);
	const k = rows.findIndex((r) => r.scene === 'sky');
	const usual = rows[k + 6].L;
	total++;
	const near = rows.slice(Math.max(0, k - 5), k + 3);
	const dips = rows.slice(Math.max(0, k - 12), k + 12).filter((r) => r.L >= 0 && r.L < usual * 0.5);
	const nan = dips.filter((r) => r.pose?.some((v) => v === 'NaN'));
	if (dips.length) dark++;
	if (nan.length) darkNaN++;
	say(`${size} run ${run}: ${dips.length ? `DARK FRAME at ${dips.map((r) => Math.round(r.t - rows[k].t)).join(', ')} ms; its pose ${dips.map((r) => `(${r.pose?.join(', ')})`).join(' ')}` : 'no dark frame'}`);
	for (const r of near) say(`   ${String(Math.round(r.t - rows[k].t)).padStart(5)} ${r.scene.padEnd(8)} middle ${String(r.L).padStart(6)}   star x ${r.pose?.[0]}  y ${r.pose?.[1]}  r ${r.pose?.[2]}`);
	await o.context.close();
}
say(`\n${dark} of ${total} runs drew a dark frame; in ${darkNaN} of those ${dark} the star's place in that frame was not a number.`);
writeFileSync(join(dir, arg('out', 'pose.txt')), `${log.join('\n')}\n`);
await browser.close();
