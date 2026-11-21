#!/usr/bin/env node
// Comparison sheets for the loading scene: the reference video on one side,
// the build frozen at the same second on the other.
//
//   node tools/loader/compare.mjs [--url http://localhost:4500] [--only desk,phone,a5]
//                                 [--frames <dir>] [--times 3.0,3.33]
//
// Needs the dev server running (see PROGRESS.md). Opens "/?scene=loading&t=0&debug"
// once per screen size and moves the frozen loader with loader.seek(t), so
// every frame comes from the same page. Writes into refs/loading/compare/:
//
//   desk-1.jpg, desk-2.jpg     1440x900: reference left, build right, 7 pairs a sheet
//   phone-1.jpg, phone-2.jpg   390x844 (scale 2, mobile, touch): reference above, build below
//   a5-desk.jpg, a5-phone.jpg  the hand-off at every tenth of its length, 0 to 1
//   short.jpg                  (--only short) the short version of a same-session return,
//                              both sizes, at 0.05, 0.35, 0.6, 0.9, 1.2, 1.5, 1.9 s
//
// --frames keeps every captured frame as a PNG in that folder too.
// --big --times 3.0,3.33,4.25 [--out <dir>] is for looking closely: the
//   reference pulled from the video itself at full size (ffmpeg), three pairs
//   to a sheet, 790 px a frame, written as big-N.jpg.
// --times replaces the list of seconds (the sheets are then named *-custom).
// Exits non-zero if the page logged an error.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
let OUT = join(ROOT, 'refs/loading/compare');
const VIDEO = join(ROOT, 'cellestial-assets/images/a-loading/A2-A3_power-up-and-lightning-writing.mp4');
const REF = join(ROOT, 'refs/loading-video/f12');

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'desk,phone,a5' },
		frames: { type: 'string' },
		times: { type: 'string' },
		big: { type: 'boolean', default: false },
		out: { type: 'string' },
	},
});
if (values.out) OUT = values.out;
const only = new Set(values.big ? [] : values.only.split(','));
const custom = values.times?.split(',').map(Number);
const TIMES = custom ?? [0, 0.67, 1.33, 1.58, 2.75, 3.0, 3.33, 3.67, 3.83, 4.25, 4.75, 5.25, 5.75, 6.2];
const END = 6.2;
const HANDOFF = 1.5;
const A5 = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

const SIZES = {
	desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
	},
};

mkdirSync(OUT, { recursive: true });
if (values.frames) mkdirSync(values.frames, { recursive: true });

let errors = 0;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });

async function capture(size, times, short = false) {
	const context = await browser.newContext(SIZES[size]);
	const page = await context.newPage();
	// A return visit in the same session plays the short version.
	if (short) await page.addInitScript(() => sessionStorage.setItem('cellestial:loader', '1'));
	page.on('console', (m) => {
		if (m.type() === 'error') {
			errors++;
			console.error(`[${size}] console: ${m.text()}`);
		}
	});
	page.on('pageerror', (e) => {
		errors++;
		console.error(`[${size}] page error: ${e.message}`);
	});
	await page.goto(`${values.url}/?scene=loading&t=0&debug`, { waitUntil: 'networkidle' });
	await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
	await page.waitForFunction(
		() => window.__cellestial?.loader && document.querySelector('#loader.is-drawn'),
	);
	await page.waitForFunction(() => window.__cellestial?.sky);
	const shots = [];
	for (const t of times) {
		await page.evaluate(
			(at) =>
				new Promise((done) => {
					window.__cellestial.loader.seek(at);
					requestAnimationFrame(() => requestAnimationFrame(done));
				}),
			t,
		);
		const png = await page.screenshot({ type: 'png' });
		if (values.frames) writeFileSync(join(values.frames, `${size}-${t.toFixed(3)}.png`), png);
		shots.push(png);
	}
	await context.close();
	return shots;
}

const label = (text, w) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20"><rect width="100%" height="100%" fill="#181818"/><text x="6" y="15" font-family="monospace" font-size="13" fill="#e8e8e8">${text}</text></svg>`,
	);

const refFrame = (t) => join(REF, `f_${String(Math.round(t * 12) + 1).padStart(3, '0')}.jpg`);

async function sheet(name, w, h, parts) {
	await sharp({ create: { width: w, height: h, channels: 3, background: '#303030' } })
		.composite(parts)
		.jpeg({ quality: 86 })
		.toFile(join(OUT, name));
	console.log(`wrote ${join(OUT, name)}`);
}

const chunks = (list, n) => {
	const out = [];
	for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
	return out;
};

if (only.has('desk')) {
	const shots = await capture('desk', TIMES);
	const RW = 416;
	const RH = 234;
	const BW = 374;
	const pairW = RW + BW + 4;
	const rowH = RH + 20 + 6;
	const pairs = TIMES.map((t, i) => ({ t, png: shots[i] }));
	for (const [n, group] of chunks(pairs, 7).entries()) {
		const parts = [];
		for (const [i, { t, png }] of group.entries()) {
			const x = (i % 2) * (pairW + 8);
			const y = Math.floor(i / 2) * rowH;
			parts.push({ input: label(`${t.toFixed(2)} s   reference | build 1440x900`, pairW), left: x, top: y });
			parts.push({ input: await sharp(refFrame(t)).resize(RW, RH).toBuffer(), left: x, top: y + 20 });
			parts.push({ input: await sharp(png).resize(BW, RH).toBuffer(), left: x + RW + 4, top: y + 20 });
		}
		await sheet(custom ? `desk-custom-${n + 1}.jpg` : `desk-${n + 1}.jpg`, pairW * 2 + 8, rowH * 4, parts);
	}
}

if (only.has('phone')) {
	const shots = await capture('phone', TIMES);
	const CW = 224;
	const RH = 126;
	const PH = Math.round((CW * 844) / 390);
	const pairs = TIMES.map((t, i) => ({ t, png: shots[i] }));
	for (const [n, group] of chunks(pairs, 7).entries()) {
		const parts = [];
		for (const [i, { t, png }] of group.entries()) {
			const x = i * (CW + 4);
			parts.push({ input: label(`${t.toFixed(2)} s`, CW), left: x, top: 0 });
			parts.push({ input: await sharp(refFrame(t)).resize(CW, RH).toBuffer(), left: x, top: 20 });
			parts.push({ input: await sharp(png).resize(CW, PH).toBuffer(), left: x, top: 20 + RH + 4 });
		}
		await sheet(
			custom ? `phone-custom-${n + 1}.jpg` : `phone-${n + 1}.jpg`,
			7 * (CW + 4) - 4,
			20 + RH + 4 + PH,
			parts,
		);
	}
}

if (only.has('a5')) {
	const times = A5.map((f) => END + f * HANDOFF + (f === 0 ? 1e-4 : 0));
	{
		const shots = await capture('desk', times);
		const W = 398;
		const H = Math.round((W * 900) / 1440);
		const parts = [];
		for (const [i, png] of shots.entries()) {
			const x = (i % 4) * (W + 4);
			const y = Math.floor(i / 4) * (H + 24);
			parts.push({ input: label(`A5 at ${A5[i]} (1440x900)`, W), left: x, top: y });
			parts.push({ input: await sharp(png).resize(W, H).toBuffer(), left: x, top: y + 20 });
		}
		await sheet('a5-desk.jpg', 4 * (W + 4) - 4, 3 * (H + 24), parts);
	}
	{
		const shots = await capture('phone', times);
		const W = 224;
		const H = Math.round((W * 844) / 390);
		const parts = [];
		for (const [i, png] of shots.entries()) {
			const x = (i % 6) * (W + 4);
			const y = Math.floor(i / 6) * (H + 24);
			parts.push({ input: label(`A5 at ${A5[i]}`, W), left: x, top: y });
			parts.push({ input: await sharp(png).resize(W, H).toBuffer(), left: x, top: y + 20 });
		}
		await sheet('a5-phone.jpg', 6 * (W + 4) - 4, 2 * (H + 24), parts);
	}
}

if (values.big) {
	const { execFileSync } = await import('node:child_process');
	const shots = await capture('desk', TIMES);
	const W = 790;
	const pairs = TIMES.map((t, i) => ({ t, png: shots[i] }));
	for (const [n, group] of chunks(pairs, 3).entries()) {
		const parts = [];
		for (const [i, { t, png }] of group.entries()) {
			const y = i * 520;
			const ref = execFileSync(
				'ffmpeg',
				['-v', 'error', '-ss', String(t), '-i', VIDEO, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'],
				{ maxBuffer: 1 << 28 },
			);
			parts.push({ input: label(`${t.toFixed(2)} s   reference | build 1440x900`, W * 2 + 4), left: 0, top: y });
			parts.push({ input: await sharp(ref).resize(W, 444).toBuffer(), left: 0, top: y + 20 });
			parts.push({ input: await sharp(png).resize(W, 494).toBuffer(), left: W + 4, top: y + 20 });
		}
		await sheet(`big-${n + 1}.jpg`, W * 2 + 4, 520 * group.length, parts);
	}
}

if (only.has('short')) {
	const times = [0.05, 0.35, 0.6, 0.9, 1.2, 1.5, 1.9];
	const desk = await capture('desk', times, true);
	const phone = await capture('phone', times, true);
	const W = 224;
	const DH = Math.round((W * 900) / 1440);
	const PH = Math.round((W * 844) / 390);
	const parts = [];
	for (const [i, t] of times.entries()) {
		const x = i * (W + 4);
		parts.push({ input: label(`short ${t.toFixed(2)} s`, W), left: x, top: 0 });
		parts.push({ input: await sharp(desk[i]).resize(W, DH).toBuffer(), left: x, top: 20 });
		parts.push({ input: await sharp(phone[i]).resize(W, PH).toBuffer(), left: x, top: 24 + DH });
	}
	await sheet('short.jpg', 7 * (W + 4) - 4, 24 + DH + PH, parts);
}

await browser.close();
if (errors) {
	console.error(`${errors} error(s) on the page`);
	process.exit(1);
}
