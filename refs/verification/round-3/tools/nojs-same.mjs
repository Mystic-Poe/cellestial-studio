#!/usr/bin/env node
// Round 3, piece 3: THE PAGE WITHOUT SCRIPT, and the page whose script never arrives, must be what they
// were. Two builds side by side (R3_BASE: the build as it stood, default http://localhost:4616, see
// static.mjs; the new one on 4615), both sizes, three cases, a full-page PNG of each, pixels compared:
//   scripts off          JavaScript disabled in the browser
//   script fails         JavaScript on, the page's own script answers 404 (the watchdog in the head)
//   script fails, +13 s  the same, 13 s on (the stylesheet retires the cover at 12 s where it still stands)
// Each case is captured in rounds (3; the 13 s case twice): the build as it stood, this build, and the
// build as it stood again, the control. CSS animations are held at their first frame for the capture.
// Also read from the page: the scene, the cover's display, whether anything asked for the loader's
// other three pictures. Writes nojs/<case>-<size>-<build>.png and nojs/nojs-same.txt.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIZES, launch, outDir, sharp, sleep } from './lib.mjs';
const NEW = 'http://localhost:4615';
const OLD = process.env.R3_BASE ?? 'http://localhost:4616';
const dir = outDir('nojs');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
let differ = 0;
const ROUNDS = 3;
/** One full-page capture. CSS animations are held at their first frame (the logo's light is one, and it runs on the page's clock). */
async function shot(base, size, js, wait, file) {
	const context = await browser.newContext({ ...SIZES[size], javaScriptEnabled: js });
	const page = await context.newPage();
	const asked = [];
	page.on('request', (r) => { if (/loader\/(c-lit|wordmark|wordmark-matte)\.webp/.test(r.url())) asked.push(r.url().split('/').pop()); });
	if (js) await page.route(/index\.astro[^/]*\.js$/, (route) => route.fulfill({ status: 404, body: '' }));
	await page.goto(`${base}/`, { waitUntil: 'load' });
	await sleep(wait);
	await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
	let note = js ? await page.evaluate(() => `scene ${document.documentElement.dataset.scene ?? '(none)'}, the cover's display ${getComputedStyle(document.getElementById('loader')).display}`) : 'scripts off';
	note += `, the loader's other three pictures asked for: ${asked.length ? [...new Set(asked)].join(', ') : 'none'}`;
	await context.close();
	return note;
}
/** The pixels that differ between two captures, and the box they lie in. */
async function compare(fa, fb, dpr) {
	const a = await sharp(fa).raw().toBuffer({ resolveWithObject: true });
	const b = await sharp(fb).raw().toBuffer({ resolveWithObject: true });
	if (a.info.width !== b.info.width || a.info.height !== b.info.height) return { n: -1, text: 'the pages are not the same size' };
	let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, most = 0;
	for (let i = 0; i < a.data.length; i += a.info.channels) {
		const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
		if (!d) continue;
		n++;
		most = Math.max(most, d);
		const px = i / a.info.channels, x = px % a.info.width, y = Math.floor(px / a.info.width);
		x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
	}
	return { n, size: `${a.info.width}x${a.info.height}`, text: n ? `${n} (at most ${most} of 255; inside x ${Math.floor(x0 / dpr)} to ${Math.ceil(x1 / dpr)}, y ${Math.floor(y0 / dpr)} to ${Math.ceil(y1 / dpr)} CSS px)` : '0' };
}
for (const size of ['desk', 'phone']) for (const [name, js, wait] of [['scripts-off', false, 1500], ['script-fails', true, 1500], ['script-fails-13s', true, 13000]]) {
	const dpr = SIZES[size].deviceScaleFactor ?? 1;
	const f = (build) => join(dir, `${name}-${size}-${build}.png`);
	const rounds = [];
	let notes = {};
	let page = '';
	// Each round: the build as it stood, this build, and the build as it stood AGAIN (the control: what two
	// captures of one build differ by).
	for (let round = 0; round < (name === 'script-fails-13s' ? 2 : ROUNDS); round++) {
		notes = { before: await shot(OLD, size, js, wait, f('before')), after: await shot(NEW, size, js, wait, f('after')) };
		await shot(OLD, size, js, wait, f('again'));
		const d = await compare(f('before'), f('after'), dpr);
		const c = await compare(f('before'), f('again'), dpr);
		page = d.size;
		rounds.push({ d, c });
	}
	const clean = rounds.filter((r) => r.d.n === 0).length;
	if (!clean) differ++;
	if (name === 'scripts-off') await sharp(f('after')).resize({ height: 1600 }).jpeg({ quality: 82 }).toFile(join(dir, `${name}-${size}-after.jpg`));
	say(`${size}, ${name}: the whole page ${page} px; PIXELS THAT DIFFER between the build as it stood and this one, ${rounds.length} round${rounds.length > 1 ? 's' : ''}: ${rounds.map((r) => r.d.text).join(' | ')}\n      the control, the build as it stood captured twice: ${rounds.map((r) => r.c.text).join(' | ')}\n      before: ${notes.before}\n      after:  ${notes.after}`);
}
say(`CASES IN WHICH NO ROUND CAME OUT WITH 0 PIXELS DIFFERING: ${differ} of 6`);
writeFileSync(join(dir, 'nojs-same.txt'), `${log.join('\n')}\n`);
await browser.close();
