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
//   pulse.jpg                         the guided light: a burst of frames after
//                                     tile 1 is closed, and after all five
//   grow-desk.jpg, grow-phone.jpg     growFrom at three x: frames from the
//                                     impact to the settled network
//   still.jpg                         reduced motion; and 320 px wide
//   nojs-desk.jpg, nojs-phone.jpg     the page with script off, in pieces
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

await browser.close();
if (bad) console.error(`${bad} page error(s)`);
process.exit(bad ? 1 : 0);
