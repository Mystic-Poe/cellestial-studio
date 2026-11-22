#!/usr/bin/env node
// Round 2, piece 2b: does the teleport flash dip at its peak? The second look's flash.mjs, narrowed to
// that question and run several times over: the real page, production build, real GPU, the real menu,
// recorded in real time; in every recorded frame the share of the screen that is lit (brighter than
// L 110, flash.mjs's own measure). Between the first and the last frame at 90% of the peak (the level
// stretch: the peak to the start of the fade) the lowest frame is found. UNDER 80% OF THE PEAK IS A DIP. So is a second rise: a frame under 80% of the peak
// followed by one a quarter of the peak brighter and at least half the peak.
// Also, from the page's own frame times, the longest frame of the flash (the swap).
//   node flash-dip.mjs [--runs 3] [--sizes desk] [--from sky] [--dest build,claim,contact] [--tag before] [--throttle 4]
// --throttle slows the CPU (the swap then blocks for longer: on the build of the second look it blocked 100 to
// 117 ms unslowed; since round 2's piece 1 made the Roots' first frames cheaper it blocks 33 to 50 ms).
// Writes flash/flash-dip[-tag].txt and, for the first run of each teleport, a strip of every recorded
// frame of the flash: flash/dip-<size>-from-<from>[-tag].jpg.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, frameTimes, launch, open, outDir, pnow, recorder, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { runs: { type: 'string', default: '3' }, sizes: { type: 'string', default: 'desk' }, from: { type: 'string', default: 'sky' }, dest: { type: 'string', default: 'build,claim,contact' }, tag: { type: 'string', default: '' }, throttle: { type: 'string', default: '1' } } });
const throttle = Number(values.throttle);
const RUNS = Number(values.runs);
const tag = values.tag ? `-${values.tag}` : '';
const LABEL = { build: 'What we build', claim: 'Claim your star', contact: 'Contact me', sky: 'The Sky' };
const dir = outDir('flash');
const log = [`The flash's light through its peak (the share of the frame brighter than L 110, per recorded frame; ${RUNS} runs of each teleport${throttle > 1 ? `; CPU slowed ${throttle}x` : ''}). Between the first and last frames at 90% of the peak, the lowest frame; under 80% of the peak is a DIP, and so is a fall under 80% followed by a rise of a quarter of the peak to at least half of it.`];
const say = (s) => { console.log(s); log.push(s); };
async function lit(img) {
	const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
	let n = 0;
	for (let i = 0; i < data.length; i += info.channels) if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > 110) n++;
	return (100 * n) / (info.width * info.height);
}
const browser = await launch({ gpu: true });
let dips = 0, total = 0;
for (const size of values.sizes.split(',')) for (const from of values.from.split(',')) {
	const cells = [];
	for (const dest of values.dest.split(',')) for (let run = 1; run <= RUNS; run++) {
		const o = await open(browser, size, { throttle, init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
		await o.page.goto(`${PROD}/?scene=${from}&debug`, { waitUntil: 'load' });
		await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
		await o.page.evaluate(() => window.__cellestial.sky.ready);
		await sleep(2500);
		const rec = await recorder(o, { quality: 90 });
		await o.press('#chrome button[popovertarget]');
		await sleep(500);
		const p0 = await pnow(o.page);
		const t0 = Date.now();
		await o.press(`#chrome-menu [data-dest="${dest}"]`);
		await sleep(1500);
		await rec.stop();
		const ft = await frameTimes(o.page, p0, p0 + 900);
		const end = await o.page.evaluate(() => ({ scene: document.documentElement.dataset.scene, y: Math.round(scrollY), dialog: !!document.querySelector('dialog[open]') }));
		const rows = [];
		for (const f of rec.frames.filter((x) => x.ts >= t0 - 20 && x.ts <= t0 + 900)) rows.push({ t: Math.round(f.ts - t0), lit: await lit(f.img), img: f.img });
		const peak = rows.reduce((a, c) => (c.t > 30 && c.lit > a.lit ? c : a), rows[0]);
		const high = rows.filter((x) => x.t > 30 && x.lit >= 0.9 * peak.lit);
		const a = high[0].t, z = high[high.length - 1].t;
		const level = rows.filter((x) => x.t >= a && x.t <= z);
		const low = level.reduce((m, c) => (c.lit < m.lit ? c : m), level[0]);
		const share = low.lit / peak.lit;
		// A second rise: after the peak is first reached, a frame under 80% of it and, later, a frame a quarter of
		// the peak brighter than that one and at least half the peak (a flash that dips and comes back, even if not
		// all the way: the level stretch above would stop short of such a dip).
		let again = null;
		for (let i = rows.indexOf(high[0]); i < rows.length && !again; i++) {
			if (rows[i].lit >= 0.8 * peak.lit) continue;
			const back = rows.slice(i + 1).find((x) => x.lit >= rows[i].lit + 0.25 * peak.lit && x.lit >= 0.5 * peak.lit);
			if (back) again = { from: rows[i], to: back };
		}
		const dip = share < 0.8 || !!again;
		total++;
		if (dip) dips++;
		say(`${size}${throttle > 1 ? ` cpu x${throttle}` : ''} ${from} -> "${LABEL[dest]}" run ${run}: lands scene ${end.scene}, scrollY ${end.y}, dialog ${end.dialog}; peak ${peak.lit.toFixed(1)}% lit at +${peak.t} ms; level stretch +${a}..+${z} ms (${level.length} frames), its lowest frame ${low.lit.toFixed(1)}% at +${low.t} ms: ${(100 * share).toFixed(0)}% of the peak; ${again ? `falls to ${again.from.lit.toFixed(1)}% at +${again.from.t} ms and RISES AGAIN to ${again.to.lit.toFixed(1)}% at +${again.to.t} ms` : 'no second rise'}${dip ? '  <-- DIP' : ''}; the page's frames: ${ft.text}`);
		say(`   lit, frame by frame (ms:%): ${rows.filter((x) => x.lit > 0.2).map((x) => `${x.t}:${x.lit.toFixed(1)}`).join(' ')}`);
		if (run === 1) {
			const span = rows.filter((x) => x.lit > 0.4 && x.t > 30);
			const picks = span.slice(0, 24);
			for (const x of picks) cells.push({ img: x.img, label: `${LABEL[dest]} +${x.t}: ${x.lit.toFixed(1)}%` });
			while (cells.length % 12) cells.push({ img: await sharp({ create: { width: 8, height: 8, channels: 3, background: '#2a2a2a' } }).png().toBuffer(), label: '' });
		}
		await o.context.close();
	}
	await sheet(join(dir, `dip-${size}-from-${from}${tag}.jpg`), cells, size === 'desk' ? { cols: 12, cellW: 132, cellH: 83 } : { cols: 12, cellW: 125, cellH: 270 });
}
say(`A dip in ${dips} of ${total} flashes.`);
writeFileSync(join(dir, `flash-dip${tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
