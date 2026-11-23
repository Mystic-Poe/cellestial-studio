#!/usr/bin/env node
// Finding 3: the teleport flash on the real page, production build, real GPU, in real time: all four
// menu destinations from the sky and from the Roots at both sizes. Every recorded frame of each flash
// is measured (how much of it is lit, the lit pixels' mean colour, how much is near-white and how far
// from the middle the white reaches, the ground between the lines), strips are cut, and the brightest
// frame is set beside the lit circuits of A1_c-emblem_lit.jpg.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, ROOT, frameTimes, hex, launch, open, outDir, pnow, recorder, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('flash');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const DEST = [['build', 'What we build'], ['claim', 'Claim your star'], ['contact', 'Contact me'], ['sky', 'The Sky']];
async function measure(img) {
	const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
	const n = info.width * info.height;
	let lit = 0, r = 0, g = 0, b = 0, white = 0, whiteFar = 0, dark = 0, sum = 0, black = 0;
	const cx = info.width / 2, cy = info.height / 2, half = Math.hypot(cx, cy);
	const lum = new Float32Array(n);
	for (let y = 0, i = 0, p = 0; y < info.height; y++) for (let x = 0; x < info.width; x++, i += info.channels, p++) {
		const R = data[i], G = data[i + 1], B = data[i + 2];
		const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
		lum[p] = L; sum += L;
		if (L > 110) { lit++; r += R; g += G; b += B; }
		if (L < 12) black++;
		if (Math.min(R, G, B) > 215) { white++; const d = Math.hypot(x - cx, y - cy) / half; if (d > whiteFar) whiteFar = d; }
	}
	// widths of lit runs on eight rows
	const runs = [];
	for (const fy of [0.1, 0.2, 0.3, 0.42, 0.58, 0.7, 0.8, 0.9]) {
		const y = Math.round(info.height * fy);
		let run = 0;
		for (let x = 0; x < info.width; x++) { if (lum[y * info.width + x] > 110) run++; else { if (run > 0 && run < 60) runs.push(run); run = 0; } }
	}
	runs.sort((a, c) => a - c);
	const sorted = Float32Array.from(lum).sort();
	return { L: sum / n, lit: (100 * lit) / n, mean: lit ? hex(r / lit, g / lit, b / lit) : 'none', white: (100 * white) / n, whiteFar, black: (100 * black) / n, median: sorted[Math.floor(n / 2)], runMedian: runs.length ? runs[Math.floor(runs.length / 2)] : 0, runs: runs.length, scale: info.width };
}
const peaks = [];
for (const size of ['desk', 'phone']) for (const from of ['sky', 'roots']) {
	const cells = [];
	for (const [dest, label] of DEST) {
		const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
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
		const fr = rec.frames.filter((f) => f.ts >= t0 - 20 && f.ts <= t0 + 800);
		const rows = [];
		for (const f of fr) rows.push({ t: Math.round(f.ts - t0), ...(await measure(f.img)), img: f.img });
		const flash = rows.filter((x) => x.lit > 0.4 && x.t > 30);
		const peak = rows.reduce((a, c) => (c.t > 30 && c.lit > a.lit ? c : a), rows[0]);
		const tag = `${size} ${from} -> "${label}"`;
		say(`${tag}: lands scene ${end.scene}, scrollY ${end.y}, dialog ${end.dialog}; frames ${ft.text}`);
		say(`   brightest frame at +${peak.t} ms: ${peak.lit.toFixed(1)}% of the frame lit (L>110), their mean ${peak.mean}; near-white ${peak.white.toFixed(2)}%, reaching ${(100 * peak.whiteFar).toFixed(0)}% of the way from the middle to the corner; median pixel light ${peak.median.toFixed(0)} (the ground between the lines), ${peak.black.toFixed(0)}% of the frame darker than 12; lit runs crossed: ${peak.runs}, median width ${(peak.runMedian * (o.W / peak.scale)).toFixed(1)} css px`);
		say(`   frame by frame (ms : mean light : % lit : % near-white : median light): ${rows.map((x) => `${x.t}:${x.L.toFixed(0)}:${x.lit.toFixed(1)}:${x.white.toFixed(2)}:${x.median.toFixed(0)}`).join('  ')}`);
		// strip: every recorded frame from 60 ms before the first lit frame to 60 after the last (at most 14)
		const a = flash.length ? flash[0].t - 70 : 0, z = flash.length ? flash[flash.length - 1].t + 90 : 600;
		const span = rows.filter((x) => x.t >= a && x.t <= z);
		const step = Math.max(1, Math.ceil(span.length / (size === 'desk' ? 12 : 12)));
		for (let i = 0; i < span.length; i += step) cells.push({ img: span[i].img, label: `${label} +${span[i].t}` });
		while (cells.length % 12) cells.push({ img: await sharp({ create: { width: 8, height: 8, channels: 3, background: '#2a2a2a' } }).png().toBuffer(), label: '' });
		if (dest === 'build' || (dest === 'sky' && from === 'roots')) peaks.push({ img: peak.img, label: `${tag}: brightest frame, +${peak.t} ms` });
		await o.context.close();
	}
	await sheet(join(dir, `${size}-from-${from}.jpg`), cells, size === 'desk' ? { cols: 6, cellW: 258, cellH: 161 } : { cols: 12, cellW: 125, cellH: 270 });
}
// The brightest frames whole, beside A1 lit seen close
const a1 = join(ROOT, 'cellestial-assets/images/a-loading/A1_c-emblem_lit.jpg');
const ref = [
	{ img: await sharp(a1).resize({ width: 760 }).png().toBuffer(), label: 'the pack: A1_c-emblem_lit.jpg, whole' },
	{ img: await sharp(a1).extract({ left: 500, top: 350, width: 760, height: 475 }).png().toBuffer(), label: 'A1 lit, a part at full size ("seen very close up")' },
];
await sheet(join(dir, 'peak-desk.jpg'), [...peaks.filter((p) => p.label.startsWith('desk')), ...ref], { cols: 2, cellW: 760, cellH: 475 });
await sheet(join(dir, 'peak-phone.jpg'), [...peaks.filter((p) => p.label.startsWith('phone')), ...ref], { cols: 5, cellW: 300, cellH: 650 });
writeFileSync(join(dir, 'flash.txt'), `${log.join('\n')}\n`);
await browser.close();
