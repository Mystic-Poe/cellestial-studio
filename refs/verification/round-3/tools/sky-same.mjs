#!/usr/bin/env node
// Round 3, piece 1: a size must come out of the piece as it went in. desk-same.mjs made general:
// production build, real GPU, the sky's clock held still, ALL TWELVE stations, the empty sky and a
// seeded one, as PNG, at any size lib.mjs knows (or WxH, with "t" after it for a touch screen at x2).
//   node sky-same.mjs before --size phone    writes round-3/same/<size>-before/
//   node sky-same.mjs after  --size phone    writes round-3/same/<size>-after/ and counts the pixels
//                                            that differ from <size>-before/ (any channel, any amount)
//   node sky-same.mjs again  --size phone    the same build once more: shows the capture repeats
// Where a capture differs, the box the differing pixels lie in is printed (CSS px), so that every
// difference can be named.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, SIZES, launch, open, outDir, sharp, sleep } from './lib.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { size: { type: 'string', default: 'phone' } } });
const mode = positionals[0] ?? 'after';
let size = values.size;
const m = /^(\d+)x(\d+)(t?)$/.exec(size);
if (m) {
	SIZES[size] = { viewport: { width: Number(m[1]), height: Number(m[2]) }, deviceScaleFactor: m[3] ? 2 : 1, isMobile: !!m[3], hasTouch: !!m[3] };
}
const dpr = SIZES[size].deviceScaleFactor ?? 1;
const dir = outDir(`same/${size}-${mode}`);
const ref = outDir(`same/${size}-before`);
const LIT = ['slot-1', 'slot-2', 'slot-3', 'slot-60', 'slot-61', 'slot-90', 'slot-91', 'slot-120'];
const browser = await launch({ gpu: true });
const log = [];
const say = (s) => { console.log(s); log.push(s); };
let total = 0;
const differing = [];
say(`THE SKY AT ${SIZES[size].viewport.width}x${SIZES[size].viewport.height} (${size}), ${mode}: twelve stations, the clock held, empty and seeded`);
for (const [name, lit] of [['empty', []], ['lit', LIT]]) {
	const o = await open(browser, size, {
		init: {
			fn: (slots) => {
				sessionStorage.setItem('cellestial:round', '1');
				if (slots.length) localStorage.setItem('cellestial:claims', JSON.stringify(slots.map((s) => ({ slot: s, ask: 'A site for my bakery.' }))));
			},
			arg: lit,
		},
	});
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'networkidle' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	// The logo's own light (a CSS animation on the page's clock) is not the sky: it is hidden, both times.
	await o.page.addStyleTag({ content: '.chrome-logo { visibility: hidden !important; }' });
	await o.page.evaluate(() => window.__cellestial.sky.debug.setLevel(0));
	await sleep(4000);
	for (let k = 0; k < 12; k++) {
		await o.page.evaluate(
			(c) =>
				new Promise((done) => {
					const { debug } = window.__cellestial.sky;
					debug.setCoord(c);
					debug.setClock(2);
					requestAnimationFrame(() => requestAnimationFrame(done));
				}),
			k,
		);
		await sleep(300);
		const png = await o.page.screenshot({ type: 'png' });
		const file = `${name}-station-${k + 1}.png`;
		writeFileSync(join(dir, file), png);
		if (mode !== 'before' && existsSync(join(ref, file))) {
			const A = await sharp(readFileSync(join(ref, file))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
			const b = await sharp(png).removeAlpha().raw().toBuffer();
			const a = A.data;
			const w = A.info.width;
			let n = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
			for (let i = 0; i < a.length; i += 3) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
				n++;
				const p = i / 3, x = p % w, y = (p - x) / w;
				x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
			}
			total += n;
			if (n) differing.push(file);
			say(`${file}: ${n} pixels differ from ${size}-before (of ${a.length / 3})${n ? `, all inside x ${(x0 / dpr).toFixed(0)}..${(x1 / dpr).toFixed(0)}, y ${(y0 / dpr).toFixed(0)}..${(y1 / dpr).toFixed(0)} css px` : ''}`);
		} else say(`${file}: written`);
	}
	say(`${name}: console errors ${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'}`);
	await o.context.close();
}
if (mode !== 'before') say(`TOTAL: ${total} pixels differ; captures that differ: ${differing.join(', ') || 'none'}`);
writeFileSync(join(dir, 'sky-same.txt'), `${log.join('\n')}\n`);
await browser.close();
