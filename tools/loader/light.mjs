#!/usr/bin/env node
// How much light hangs in the air: the reference video against the build,
// as numbers. For the two soft fields a picture is a poor judge of:
//
//   the haze behind the letters while the word is written (4.25, 4.75, 5.25 s)
//   the blue wash of the overload (3.0, 3.33 s)
//
//   node tools/loader/light.mjs [--url http://localhost:4500] > refs/loading/compare/light.txt
//
// Needs the dev server running (see PROGRESS.md) and ffmpeg. For each time it
// takes the reference frame out of the video and the build frozen at the same
// second at 1440x900, and prints the average colour (r,g,b, 0 to 255) of a
// small box at the same fraction of each frame.
//
// Read it with this in mind: the reference is 16:9 and the build 16:10, so the
// same fraction of the frame is nearly, not exactly, the same place in the
// scene. A box that lands on the C, the bolt or a letter says nothing about
// the air (they are easy to spot: far brighter or brass-coloured).

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const VIDEO = join(
	ROOT,
	'cellestial-assets/images/a-loading/A2-A3_power-up-and-lightning-writing.mp4',
);
const { values } = parseArgs({
	options: { url: { type: 'string', default: 'http://localhost:4500' } },
});

const HAZE = {
	title: 'The haze behind the letters',
	times: [4.25, 4.75, 5.25],
	box: [0.03, 0.03],
	rows: [
		['top, centre', [[0.5, 0.12]]],
		['above and right of the word', [[0.75, 0.25]]],
		['right edge, mid-height', [[0.93, 0.5]]],
		['below the word', [[0.6, 0.72]]],
		['bottom, centre', [[0.5, 0.9]]],
		['top right corner', [[0.96, 0.05]]],
		['left edge, mid-height', [[0.06, 0.5]]],
		['bottom left corner', [[0.04, 0.95]]],
	],
};
const ACROSS = [0.35, 0.45, 0.55, 0.7, 0.8, 0.9, 0.97];
const WASH = {
	title: `The overload's wash, left to right at x = ${ACROSS.join(', ')} of the width`,
	times: [3.0, 3.33],
	box: [0.025, 0.04],
	rows: [
		['near the top (y 0.12)', ACROSS.map((x) => [x, 0.12])],
		['mid-height (y 0.45)', ACROSS.map((x) => [x, 0.45])],
		['near the bottom (y 0.9)', ACROSS.map((x) => [x, 0.9])],
	],
};

async function colour(png, [fx, fy], [bw, bh]) {
	const { width, height } = await sharp(png).metadata();
	const w = Math.round(width * bw);
	const h = Math.round(height * bh);
	const left = Math.min(width - w, Math.max(0, Math.round(fx * width - w / 2)));
	const top = Math.min(height - h, Math.max(0, Math.round(fy * height - h / 2)));
	const data = await sharp(png).extract({ left, top, width: w, height: h }).removeAlpha().raw().toBuffer();
	const sum = [0, 0, 0];
	for (let i = 0; i < data.length; i += 3) for (let k = 0; k < 3; k++) sum[k] += data[i + k];
	return sum.map((v) => Math.round(v / (data.length / 3))).join(',');
}

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${values.url}/?scene=loading&t=0&debug`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
await page.waitForFunction(
	() => window.__cellestial?.loader && document.querySelector('#loader.is-drawn'),
);

for (const set of [HAZE, WASH]) {
	console.log(`${set.title}\n`);
	for (const t of set.times) {
		const ref = execFileSync(
			'ffmpeg',
			['-v', 'error', '-ss', String(t), '-i', VIDEO, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'],
			{ maxBuffer: 1 << 28 },
		);
		await page.evaluate(
			(at) =>
				new Promise((done) => {
					window.__cellestial.loader.seek(at);
					requestAnimationFrame(() => requestAnimationFrame(done));
				}),
			t,
		);
		const build = await page.screenshot({ type: 'png' });
		console.log(`  ${t.toFixed(2)} s`);
		for (const [name, points] of set.rows) {
			const r = [];
			const b = [];
			for (const point of points) {
				r.push((await colour(ref, point, set.box)).padEnd(11));
				b.push((await colour(build, point, set.box)).padEnd(11));
			}
			console.log(`    ${name.padEnd(28)} reference ${r.join(' ')}`);
			console.log(`    ${''.padEnd(28)} build     ${b.join(' ')}`);
		}
		console.log('');
	}
}
await browser.close();
