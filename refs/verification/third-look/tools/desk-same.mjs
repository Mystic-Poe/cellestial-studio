#!/usr/bin/env node
// Round 2, piece 3: the desktop must not change at all. Production build, 1440x900, real GPU, the
// sky's clock held still (debug.setClock, as tools/sky/compare.mjs holds it): three stations, the
// empty sky and a seeded one, as PNG.
//   node desk-same.mjs before     writes third-look/phone-sky/desk-before/
//   node desk-same.mjs after      writes third-look/phone-sky/desk-after/ and counts the pixels that
//                                 differ from desk-before/ (any channel, any amount)
// Run "before" twice (the second time as "again") to see that the capture itself repeats exactly.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sharp, sleep } from './lib.mjs';

const mode = process.argv[2] ?? 'after';
const dir = outDir(`phone-sky/desk-${mode === 'again' ? 'again' : mode}`);
const ref = outDir('phone-sky/desk-before');
const STATIONS = [0, 5, 8, 11];
const LIT = ['slot-1', 'slot-2', 'slot-3', 'slot-60', 'slot-61', 'slot-90', 'slot-91', 'slot-120'];
const browser = await launch({ gpu: true });
const log = [];
const say = (s) => { console.log(s); log.push(s); };
let total = 0;
for (const [name, lit] of [['empty', []], ['lit', LIT]]) {
	const o = await open(browser, 'desk', {
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
	// Every effect on, whatever this machine's frame times were while the page came up: the governor
	// is told its level, so that two runs cannot differ by it. And the seeded claims are given the
	// time they wait (2.5 s) to light, so that they are lit in every capture.
	await o.page.evaluate(() => window.__cellestial.sky.debug.setLevel(0));
	await sleep(4000);
	for (const k of STATIONS) {
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
		const q = await o.page.evaluate(() => window.__cellestial.sky.hooks.quality());
		say(`   quality level ${q.level} of ${q.levels}, dpr ${q.dpr}, last frame ${q.frameMs.toFixed(1)} ms`);
		const png = await o.page.screenshot({ type: 'png' });
		const file = `${name}-station-${k + 1}.png`;
		writeFileSync(join(dir, file), png);
		if (mode !== 'before' && existsSync(join(ref, file))) {
			const a = await sharp(readFileSync(join(ref, file))).raw().toBuffer();
			const b = await sharp(png).raw().toBuffer();
			let n = 0;
			for (let i = 0; i < a.length; i += 3) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
			total += n;
			say(`${file}: ${n} pixels differ from desk-before (of ${a.length / 3})`);
		} else say(`${file}: written`);
	}
	say(`${name}: console errors ${o.errors.length ? o.errors.join(' | ').slice(0, 300) : 'none'}`);
	await o.context.close();
}
if (mode !== 'before') say(`TOTAL: ${total} pixels differ`);
writeFileSync(join(dir, 'desk-same.txt'), `${log.join('\n')}\n`);
await browser.close();
