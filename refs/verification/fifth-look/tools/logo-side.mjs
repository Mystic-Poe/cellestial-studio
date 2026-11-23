#!/usr/bin/env node
// Round 2, piece 4d: the logo's emblem, BEFORE and AFTER in one run of one build. The page is opened
// twice at each size: once as built, once with the logo's picture (/cellestial/chrome/c-logo.webp)
// answered from an earlier commit. The emblem is cut from the screenshot pixel for pixel (no JPEG, no
// resampling) and shown as drawn and enlarged with hard pixels, between the pack's A1 unlit and A1 lit
// brought to the same height. The node's breathing glow is frozen at its middle, as
// tools/chrome/compare.mjs does. Production build. Writes logo/side-by-side-<size>.png and .txt.
//   node logo-side.mjs [--rev c0cacf3]      the commit the "before" picture is taken from
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, ROOT, SIZES, hex, launch, open, outDir, sharp, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { rev: { type: 'string', default: 'c0cacf3' } } });
const dir = outDir('logo');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const old = execFileSync('git', ['show', `${values.rev}:public/cellestial/chrome/c-logo.webp`], { cwd: ROOT, maxBuffer: 1 << 24 });
const browser = await launch({ gpu: true });
/** The pack's emblem cut to its brass, at a height. */
const a1 = async (name, height) => {
	const file = join(ROOT, `cellestial-assets/images/a-loading/${name}`);
	const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
	let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
	for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (data[y * info.width + x] < 40) continue; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
	return sharp(file).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).resize({ height, kernel: 'lanczos3' }).png().toBuffer();
};
/** The emblem's struts: every pixel that is not dark, left of the main node (whose light is blue in every picture). */
const measure = async (png) => {
	const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
	let r = 0, g = 0, b = 0, n = 0, warm = 0, cool = 0;
	for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
		if (x > 0.68 * info.width && y > 0.62 * info.height) continue;
		const i = (y * info.width + x) * info.channels;
		const [R, G, B] = [data[i], data[i + 1], data[i + 2]];
		if (Math.max(R, G, B) <= 60) continue;
		r += R; g += G; b += B; n++;
		if (R > B + 12) warm++;
		if (B > R + 5) cool++;
	}
	return `struts' mean ${hex(r / n, g / n, b / n)} (red over blue by ${((r - b) / n).toFixed(1)}); ${(100 * warm / n).toFixed(0)}% of their pixels warm (R > B + 12), ${(100 * cool / n).toFixed(0)}% bluish (B > R + 5)`;
};
for (const size of ['desk', 'phone']) {
	const dpr = SIZES[size].deviceScaleFactor;
	const Z = size === 'desk' ? 5 : 3;
	const cells = [];
	for (const which of ['before', 'after']) {
		const o = await open(browser, size, { init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
		if (which === 'before') await o.page.route('**/cellestial/chrome/c-logo.webp', (r) => r.fulfill({ body: old, contentType: 'image/webp' }));
		await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
		await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
		await o.page.evaluate(() => window.__cellestial.sky.ready);
		await o.page.addStyleTag({ content: '.chrome-emblem::after{animation:none!important;opacity:.4!important}' });
		// The sky is hidden for the shot: the lattice's lines pass behind the logo and are not the logo.
		await o.page.addStyleTag({ content: '#sky canvas,[data-scene-root="sky"] canvas{visibility:hidden!important}' });
		await sleep(1200);
		const b = await o.page.evaluate(() => { const r = document.querySelector('#chrome .chrome-emblem').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
		const png = await o.page.screenshot({ type: 'png' });
		const crop = await sharp(png).extract({ left: Math.round(b.x * dpr), top: Math.round(b.y * dpr), width: Math.round(b.w * dpr), height: Math.round(b.h * dpr) }).png().toBuffer();
		say(`${size} ${which}: the emblem ${Math.round(b.w)}x${Math.round(b.h)} CSS px (${Math.round(b.w * dpr)}x${Math.round(b.h * dpr)} device px): ${await measure(crop)}`);
		cells.push({ img: crop, label: `${which}` });
		if (which === 'after') cells.height = Math.round(b.h * dpr);
		await o.context.close();
	}
	const unlit = await a1('A1_c-emblem_unlit.jpg', cells.height), lit = await a1('A1_c-emblem_lit.jpg', cells.height);
	say(`${size} A1 unlit at that height: ${await measure(unlit)}`);
	say(`${size} A1 lit at that height: ${await measure(lit)}`);
	const all = [{ img: unlit, label: 'A1 unlit (the pack)' }, ...cells, { img: lit, label: 'A1 lit (the pack)' }];
	const h = cells.height, w = Math.round((h * 167) / 192) + 8, lh = 24, gap = 12;
	const cellW = w * (Z + 1) + 2 * gap;
	const parts = [];
	for (const [i, c] of all.entries()) {
		const left = i * cellW + gap;
		parts.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cellW - gap}" height="${lh}"><text x="0" y="16" font-family="sans-serif" font-size="13" fill="#ddd">${size}: ${c.label} (as drawn, and x${Z})</text></svg>`), left, top: 4 });
		parts.push({ input: c.img, left, top: lh + 8 });
		const m = await sharp(c.img).metadata();
		parts.push({ input: await sharp(c.img).resize({ width: m.width * Z, kernel: 'nearest' }).png().toBuffer(), left: left + w + gap, top: lh + 8 });
	}
	const file = `side-by-side-${size}.png`;
	await sharp({ create: { width: all.length * cellW, height: h * Z + lh + 20, channels: 3, background: '#000' } }).composite(parts).png().toFile(join(dir, file));
	say(`wrote logo/${file} (${all.length * cellW}x${h * Z + lh + 20}); "before" is the logo's picture of ${values.rev}`);
}
await browser.close();
writeFileSync(join(dir, 'side-by-side.txt'), `${log.join('\n')}\n`);
