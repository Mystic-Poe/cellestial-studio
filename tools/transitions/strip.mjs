#!/usr/bin/env node
// The transitions between scenes as strips of frames, to be LOOKED AT: the
// fall and the crash (D1, D2), the warp back (G2) and the menu teleports (C4),
// on the real page, in real time.
//
//   node tools/transitions/strip.mjs [--url http://localhost:4500] [--only fall,warp,teleport] [--no-gpu]
//
// Needs the dev server running (see PROGRESS.md). Each transition is started
// with a real click and photographed as fast as the browser gives pictures;
// sixteen of them, the ones nearest the moments asked for, make a strip (the
// moments are closer together where more happens). The time printed on a frame is
// milliseconds after the click (the picture was asked for then; it shows the
// page a few tens of milliseconds later). Writes into refs/transitions/compare/
// (JPEG, 1600 px at most):
//
//   fall-desk.jpg, fall-phone.jpg     B11 pressed in the sky, to the Roots
//   warp-desk.jpg, warp-phone.jpg     E6 pressed at the top of the ground
//   warp-deep-desk.jpg, -phone.jpg    E6's launch from far down the ground
//                                     (the return after a claim sent from there)
//   teleport-desk.jpg, -phone.jpg     every menu destination from the sky and
//                                     from the Roots: the peak of the flash and
//                                     the landing
//
// The sky is drawn on the real GPU unless --no-gpu.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch, openPage, ROOT, sheet } from '../roots/lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'fall,warp,teleport' },
		'no-gpu': { type: 'boolean', default: false },
	},
});
const only = new Set(values.only.split(','));
const OUT = join(ROOT, 'refs/transitions/compare');
mkdirSync(OUT, { recursive: true });
const NOISE = /sandboxed and the 'allow-scripts'|turnstile|challenges\.cloudflare|Failed to load resource/i;
const SIZES = ['desk', 'phone'];
const STRIP = {
	desk: { cols: 4, cellW: 390, cellH: 244 },
	phone: { cols: 8, cellW: 192, cellH: 416 },
};
const FALL_AT = [40, 250, 400, 500, 600, 700, 800, 900, 1050, 1250, 1500, 1800, 2100, 2400, 2800, 3250];
const WARP_AT = [40, 200, 400, 550, 700, 800, 900, 1000, 1050, 1100, 1200, 1300, 1400, 1500, 1700, 2050];
export const MENU = { sky: 'The Sky', build: 'What we build', claim: 'Claim your star', contact: 'Contact me' };

const browser = await launch({ gpu: !values['no-gpu'] });
let bad = 0;

/** The real page on the sky (the round already flown, so B11 is there) or on the Roots. */
export async function open(browser, size, scene, { init } = {}) {
	const o = await openPage(browser, size, null);
	await o.page.addInitScript(() => sessionStorage.setItem('cellestial:round', '1'));
	if (init) await o.page.addInitScript(init);
	await o.page.goto(`${values.url}/?scene=${scene}&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(
		() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.fx,
	);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await o.page.waitForTimeout(1200);
	return o;
}

/**
 * Start something, then photograph for `ms`. Returns [{ at, img }].
 *
 * The pictures are asked of the browser directly, with no clip: what is on the
 * screen, whole. (page.screenshot() first asks where the page is scrolled to
 * and then cuts that rectangle out of the document, so while a script is
 * scrolling fast it photographs a rectangle the screen has already left:
 * fixed things appear shifted and a black band shows at one edge.)
 */
async function film(page, start, ms) {
	const cdp = await page.context().newCDPSession(page);
	const frames = [];
	const t0 = Date.now();
	await start();
	for (;;) {
		const at = Date.now() - t0;
		if (at > ms) break;
		const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
		frames.push({ at, img: Buffer.from(data, 'base64') });
	}
	await cdp.detach();
	return frames;
}

/** The picture nearest each moment asked for. */
function pick(frames, times) {
	return times.map((t) => frames.reduce((a, b) => (Math.abs(b.at - t) < Math.abs(a.at - t) ? b : a)));
}

async function strip(name, size, scene, prepare, start, times) {
	const ms = times.at(-1) + 50;
	const o = await open(browser, size, scene);
	if (prepare) await prepare(o.page);
	const frames = await film(o.page, () => start(o.page), ms);
	console.log(`  ${name}-${size}: ${frames.length} pictures in ${ms} ms`);
	await sheet(
		join(OUT, `${name}-${size}.jpg`),
		pick(frames, times).map((f) => ({ img: f.img, label: `${f.at} ms` })),
		STRIP[size],
	);
	bad += o.errors.filter((e) => !NOISE.test(e)).length;
	await o.context.close();
}

/** A click that does not wait for anything: the filming starts at once. */
const press = (page, selector) =>
	page.evaluate((s) => {
		const el = document.querySelector(s);
		if (!el) throw new Error(`nothing matches ${s}`);
		el.click();
	}, selector);

if (only.has('fall')) {
	for (const size of SIZES) {
		await strip('fall', size, 'sky', null, (page) => press(page, '[data-descend]'), FALL_AT);
	}
}

if (only.has('warp')) {
	for (const size of SIZES) {
		await strip('warp', size, 'roots', null, (page) => press(page, '[data-ascend]'), WARP_AT);
		await strip(
			'warp-deep',
			size,
			'roots',
			(page) => page.evaluate(() => window.scrollTo(0, 1800)),
			(page) => page.evaluate(() => void window.__cellestial.director.ascend()),
			WARP_AT,
		);
	}
}

if (only.has('teleport')) {
	for (const size of SIZES) {
		const cells = [];
		for (const from of ['sky', 'roots']) {
			for (const [dest, words] of Object.entries(MENU)) {
				const o = await open(browser, size, from);
				// From the Roots, start in the middle of the ground: both ways are possible.
				if (from === 'roots') await o.page.evaluate(() => window.scrollTo(0, 1500));
				await o.page.click('#chrome button[popovertarget]');
				await o.page.waitForTimeout(350);
				const item = o.page.locator(`#chrome [data-dest="${dest}"]`);
				if ((await item.textContent()).trim() !== words) throw new Error(`the menu says "${await item.textContent()}", not "${words}"`);
				const frames = await film(o.page, () => item.click({ noWaitAfter: true }), 1500);
				// The peak: the picture nearest the middle of the flash.
				const peak = frames.reduce((a, b) => (Math.abs(b.at - 215) < Math.abs(a.at - 215) ? b : a));
				const before = frames.filter((f) => f.at < 215).at(-2) ?? frames[0];
				const after = frames.find((f) => f.at > 290) ?? frames.at(-1);
				await o.page.waitForTimeout(700);
				const state = await o.page.evaluate(() => ({
					scene: document.documentElement.dataset.scene,
					y: Math.round(window.scrollY),
					focus:
						document.activeElement?.textContent?.trim().slice(0, 24) ||
						document.activeElement?.id ||
						document.activeElement?.tagName,
					dialog: document.querySelector('dialog[open]')?.id ?? null,
				}));
				const landed = await o.page.screenshot({ type: 'jpeg', quality: 80 });
				const tag = `${from} → ${words}`;
				cells.push({ img: before.img, label: `${tag}: ${before.at} ms` });
				cells.push({ img: peak.img, label: `${tag}: ${peak.at} ms` });
				cells.push({ img: after.img, label: `${tag}: ${after.at} ms` });
				cells.push({
					img: landed,
					label: `landed: ${state.scene}, y ${state.y}, focus "${state.focus}"${state.dialog ? `, ${state.dialog} open` : ''}`,
				});
				console.log(`  ${size} ${tag}: ${JSON.stringify(state)}`);
				bad += o.errors.filter((e) => !NOISE.test(e)).length;
				await o.context.close();
			}
		}
		await sheet(
			join(OUT, `teleport-${size}.jpg`),
			cells,
			size === 'desk' ? { cols: 8, cellW: 192, cellH: 120 } : { cols: 8, cellW: 192, cellH: 416 },
		);
	}
}

await browser.close();
if (bad) {
	console.error(`${bad} page error(s)`);
	process.exit(1);
}
