#!/usr/bin/env node
// Sheets for the Roots: the build on the real page, to be LOOKED AT, beside
// the pictures it must match where there is one.
//
//   node tools/roots/compare.mjs [--url http://localhost:4500] [--only tiles,descent,...] [--gpu]
//
// Needs the dev server running (see PROGRESS.md). Opens "/?scene=roots&debug"
// at 1440x900 and 390x844 (scale 2, mobile, touch) and drives the scene
// through window.__cellestial.roots.debug. Writes into refs/roots/compare/
// (JPEG, 1600 px at most):
//
//   tiles-desk.jpg, tiles-phone.jpg   every tile open, the whole screen
//   tile-close.jpg                    two tiles pixel for pixel (desktop, phone)
//   descent-desk-N.jpg, -phone-N.jpg  the whole descent, top to bottom, cut
//                                     into screen-sized pieces
//   node.jpg                          a node close up beside E4_node.jpg: idle
//                                     at four moments of its breathing, under
//                                     the pointer, read
//   pulse-desk.jpg, pulse-phone.jpg   the guided light frozen at five places on
//                                     its way: from the surface to node 1, from
//                                     node 1 to node 2 (tile 1 closed), from
//                                     node 5 to the Close (all read)
//   pulse-close.jpg                   one of those frames at full size
//   grow-desk.jpg, grow-phone.jpg     growFrom at three x, frozen at moments
//                                     from the impact on
//   grow-close.jpg                    the first 420 ms at full size
//   still.jpg                         reduced motion at both sizes (the top, a
//                                     tile open, the next node marked); and
//                                     320x568 with motion on
//   nojs-desk.jpg, nojs-phone.jpg     the page with script off, top to bottom,
//                                     in screen-sized pieces
//
// Exits non-zero if the page logged an error.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch, openPage, ROOT, rootsReady, sharp, sheet, shot } from './lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'tiles,descent,node,pulse,grow,still,nojs' },
		gpu: { type: 'boolean', default: false },
	},
});
const only = new Set(values.only.split(','));
const OUT = join(ROOT, 'refs/roots/compare');
mkdirSync(OUT, { recursive: true });
const URL = `${values.url}/?scene=roots&debug`;
const IDS = ['site', 'systems', 'app', 'addons', 'care'];
const NOISE = /sandboxed and the 'allow-scripts'|turnstile|challenges\.cloudflare|Failed to load resource/i;
const GRID = { desk: { cols: 2, cellW: 790, cellH: 494 }, phone: { cols: 5, cellW: 310, cellH: 671 } };

let bad = 0;
const browser = await launch({ gpu: values.gpu });
const done = async ({ context, errors }) => {
	bad += errors.filter((e) => !NOISE.test(e)).length;
	await context.close();
};
/** The whole page as screen-sized pieces. */
async function pieces(page, name) {
	const { h, vh } = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
	const cells = [];
	for (let y = 0; y < h; y += vh) {
		const top = Math.min(y, h - vh);
		await page.evaluate((t) => scrollTo(0, t), top);
		await page.waitForTimeout(250);
		cells.push({ img: await shot(page), label: `${name}  y ${top}..${top + vh} of ${h}` });
	}
	return cells;
}

if (only.has('tiles')) {
	const close = [];
	for (const size of ['desk', 'phone']) {
		const run = await openPage(browser, size, URL);
		const { page } = run;
		await rootsReady(page);
		const cells = [];
		for (const id of IDS) {
			const bulb = page.locator(`.roots-stop[data-offer="${id}"] .roots-node__bulb`);
			await bulb.scrollIntoViewIfNeeded();
			if (size === 'desk') await bulb.click();
			else await bulb.tap();
			await page.waitForTimeout(900);
			const box = await page.evaluate((i) => {
				const r = document.getElementById(`offer-${i}`).getBoundingClientRect();
				const cs = getComputedStyle(document.querySelector(`#offer-${i} p`));
				return { x: r.left, y: r.top, w: r.width, h: r.height, font: cs.fontSize, lh: cs.lineHeight };
			}, id);
			cells.push({ img: await shot(page), label: `${id}: tile ${Math.round(box.w)}x${Math.round(box.h)} at ${Math.round(box.x)},${Math.round(box.y)}; text ${box.font}/${box.lh}` });
			if (id === 'site' || id === 'care') {
				close.push({ img: await shot(page, { x: Math.max(0, box.x - 16), y: Math.max(0, box.y - 16), width: box.w + 32, height: box.h + 32 }), label: `${size} ${id}, pixel for pixel (${size === 'phone' ? '2 px per px' : '1:1'})` });
			}
		}
		await sheet(join(OUT, `tiles-${size}.jpg`), cells, GRID[size]);
		await done(run);
	}
	await sheet(join(OUT, 'tile-close.jpg'), close, { cols: 4, cellW: 392, cellH: 560, enlarge: false });
}

if (only.has('descent')) {
	for (const size of ['desk', 'phone']) {
		const run = await openPage(browser, size, URL);
		const { page } = run;
		await rootsReady(page);
		await page.addStyleTag({ content: '.roots-node__glow,.roots-node::before{animation:none!important}' });
		await page.waitForTimeout(1200); // every band drawn
		console.log(`  ${size}: ${JSON.stringify(await page.evaluate(() => window.__cellestial.roots.debug.net.debug.stats()))}`);
		const cells = await pieces(page, size);
		if (size === 'desk') {
			for (let i = 0; i < cells.length; i += 2) await sheet(join(OUT, `descent-desk-${i / 2 + 1}.jpg`), cells.slice(i, i + 2), { cols: 1, cellW: 1440, cellH: 900, max: 1600 });
		} else await sheet(join(OUT, 'descent-phone.jpg'), cells, { cols: 5, cellW: 312, cellH: 675 });
		await done(run);
	}
}

const FREEZE = '.roots-node__glow,.roots-node::before{animation-play-state:paused!important}';

if (only.has('node')) {
	const ref = await sharp(join(ROOT, 'cellestial-assets/images/e-roots/E4_node.jpg')).extract({ left: 264, top: 150, width: 452, height: 760 }).png().toBuffer();
	const cells = [{ img: ref, label: 'E4_node.jpg (the pack picture)' }];
	for (const size of ['desk', 'phone']) {
		const run = await openPage(browser, size, URL);
		const { page } = run;
		await rootsReady(page);
		await page.waitForTimeout(600);
		const box = await page.evaluate(() => {
			const r = document.querySelectorAll('.roots-node')[1].getBoundingClientRect();
			scrollBy(0, r.top - 120);
			const q = document.querySelectorAll('.roots-node')[1].getBoundingClientRect();
			return { x: Math.max(0, q.left - 70), y: q.top - 20, width: q.width + 140, height: q.height * 0.9 + 40 };
		});
		const phase = async (at) => {
			await page.evaluate((ms) => {
				for (const a of document.getAnimations()) {
					a.pause();
					a.currentTime = ms;
				}
			}, at * 1000);
			await page.waitForTimeout(150);
		};
		for (const at of [0, 0.9, 1.7, 2.6]) {
			await phase(at);
			cells.push({ img: await shot(page, box), label: `${size}: idle, ${at} s into its 2.6 s breath` });
		}
		await page.evaluate(() => {
			for (const a of document.getAnimations()) a.play();
		});
		if (size === 'desk') {
			await page.locator('.roots-node__bulb').nth(1).hover();
			await page.waitForTimeout(500);
			cells.push({ img: await shot(page, box), label: 'desk: under the pointer' });
			await page.mouse.move(5, 5);
		}
		await page.evaluate(() => {
			window.__cellestial.roots.debug.open('systems');
			window.__cellestial.roots.debug.close();
			document.activeElement.blur();
		});
		await page.waitForTimeout(600);
		const y2 = await page.evaluate(() => document.querySelectorAll('.roots-node')[1].getBoundingClientRect().top - 20);
		cells.push({ img: await shot(page, { ...box, y: y2 }), label: `${size}: read (steadily lit)` });
		await done(run);
	}
	await sheet(join(OUT, 'node.jpg'), cells, { cols: 6, cellW: 258, cellH: 380 });
}

if (only.has('pulse')) {
	for (const size of ['desk', 'phone']) {
		const run = await openPage(browser, size, URL);
		const { page } = run;
		await rootsReady(page);
		await page.addStyleTag({ content: `${FREEZE}` });
		const cells = [];
		const legs = [
			[-1, 0, 'from the surface to node 1 (nothing read yet)'],
			[0, 1, 'tile 1 closed: from node 1 to node 2'],
			[4, 5, 'all five read: from node 5 to "Claim your star"'],
		];
		for (const [from, to, what] of legs) {
			// Stand so the whole stretch is on screen (or its lower part, when it is taller than the screen).
			await page.evaluate(([f, t]) => {
				const d = window.__cellestial.roots.debug;
				for (const id of ['site', 'systems', 'app', 'addons', 'care'].slice(0, f + 1)) d.open(id);
				d.close();
				document.activeElement.blur();
				const lay = d.layout();
				const a = f < 0 ? 0 : lay.nodes[f].bulb.y;
				const b = t > 4 ? lay.close.y : lay.nodes[t].bulb.y;
				scrollTo(0, Math.max(0, (a + b) / 2 - innerHeight / 2));
			}, [from, to]);
			await page.waitForTimeout(500);
			for (const k of [0.08, 0.3, 0.55, 0.8, 0.97]) {
				await page.evaluate(([f, t, kk]) => window.__cellestial.roots.debug.net.debug.pulseAt(f, t, kk), [from, to, k]);
				await page.waitForTimeout(120);
				cells.push({ img: await shot(page), label: `${what}: ${Math.round(k * 100)}% of the way` });
			}
		}
		await sheet(join(OUT, `pulse-${size}.jpg`), cells, size === 'desk' ? { cols: 5, cellW: 312, cellH: 195 } : { cols: 5, cellW: 312, cellH: 675 });
		if (size === 'desk') {
			// One frame at full size: the light itself.
			await page.evaluate(() => window.__cellestial.roots.debug.net.debug.pulseAt(4, 5, 0.55));
			await page.waitForTimeout(120);
			const at = await page.evaluate(() => {
				const r = document.querySelector('.roots-net canvas[data-role="pulse"]').getBoundingClientRect();
				return { x: r.left - 120, y: Math.max(0, r.top - 60), width: 600, height: 480 };
			});
			await sheet(join(OUT, 'pulse-close.jpg'), [{ img: await shot(page, at), label: 'the guided light at full size (1440x900, node 5 to the Close, 55%)' }], { cols: 1, cellW: 600, cellH: 480 });
		}
		await done(run);
	}
}

if (only.has('grow')) {
	for (const size of ['desk', 'phone']) {
		const run = await openPage(browser, size, URL);
		const { page } = run;
		await rootsReady(page);
		await page.addStyleTag({ content: `${FREEZE}#roots .roots-node{transition:none!important}` });
		await page.evaluate(() => window.__cellestial.roots.debug.net.stopGuide());
		const cells = [];
		const times = size === 'desk' ? [40, 160, 380, 900] : [40, 140, 300, 560, 1100];
		const frame = async (share, ms) => {
			const lit = await page.evaluate(([sh, t]) => {
				const n = window.__cellestial.roots.debug.net.debug.growAt(innerWidth * sh, t);
				document.querySelectorAll('.roots-node').forEach((el, i) => el.toggleAttribute('data-lit', i < n));
				return n;
			}, [share, ms]);
			await page.waitForTimeout(150);
			return lit;
		};
		for (const share of [0.15, 0.5, 0.85]) {
			for (const ms of times) {
				const lit = await frame(share, ms);
				cells.push({ img: await shot(page), label: `impact at ${Math.round(share * 100)}% of the width, +${ms} ms (${lit} node${lit === 1 ? '' : 's'} lit)` });
			}
		}
		await sheet(join(OUT, `grow-${size}.jpg`), cells, size === 'desk' ? { cols: 4, cellW: 392, cellH: 245 } : { cols: 5, cellW: 312, cellH: 675 });
		if (size === 'desk') {
			const close = [];
			for (const ms of [30, 110, 240, 420]) {
				await frame(0.5, ms);
				close.push({ img: await shot(page, { x: 320, y: 0, width: 780, height: 520 }), label: `impact at 50%, +${ms} ms, full size` });
			}
			await sheet(join(OUT, 'grow-close.jpg'), close, { cols: 2, cellW: 780, cellH: 520 });
		}
		await done(run);
	}
}

if (only.has('still')) {
	const cells = [];
	for (const size of ['desk', 'phone', 'narrow']) {
		const still = size !== 'narrow';
		const run = await openPage(browser, size, `${URL}${still ? '&rm=1' : ''}`, still ? { reducedMotion: 'reduce' } : {});
		const { page } = run;
		await rootsReady(page);
		await page.waitForTimeout(900);
		const what = still ? `reduced motion, ${size}` : '320x568';
		cells.push({ img: await shot(page), label: `${what}: the top${still ? ' (node 1 is marked: a steady, stronger glow)' : ''}` });
		await page.evaluate(() => window.__cellestial.roots.debug.open('site'));
		await page.waitForTimeout(still ? 150 : 800);
		cells.push({ img: await shot(page), label: `${what}: tile 1 open` });
		await page.evaluate(() => {
			window.__cellestial.roots.debug.close();
			document.activeElement.blur();
			document.querySelectorAll('.roots-node__bulb')[1].scrollIntoView({ block: 'center' });
		});
		await page.waitForTimeout(500);
		cells.push({ img: await shot(page), label: `${what}: node 1 read, node 2 ${still ? 'marked' : 'next'}` });
		if (!still) {
			await page.evaluate(() => {
				window.__cellestial.roots.debug.open('care');
			});
			await page.waitForTimeout(900);
			cells.push({ img: await shot(page), label: `${what}: the longest tile, scrolling inside itself` });
			await page.evaluate(() => {
				window.__cellestial.roots.debug.close();
				scrollTo(0, window.__cellestial.roots.anchorY('close'));
			});
			await page.waitForTimeout(500);
			cells.push({ img: await shot(page), label: `${what}: the Close` });
		}
		await done(run);
	}
	await sheet(join(OUT, 'still.jpg'), cells, { cols: 4, cellW: 392, cellH: 520 });
}

if (only.has('nojs')) {
	for (const size of ['desk', 'phone']) {
		const run = await openPage(browser, size, `${values.url}/`, { javaScriptEnabled: false });
		const cells = await pieces(run.page, `${size}, script off`);
		await sheet(join(OUT, `nojs-${size}.jpg`), cells, size === 'desk' ? { cols: 2, cellW: 790, cellH: 494 } : { cols: 6, cellW: 258, cellH: 560 });
		await done(run);
	}
}

await browser.close();
if (bad) console.error(`${bad} page error(s)`);
process.exit(bad ? 1 : 0);
