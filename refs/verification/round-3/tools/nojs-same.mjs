#!/usr/bin/env node
// Round 3, piece 3: THE PAGE WITHOUT SCRIPT, and the page whose script never arrives, must be what they
// were. Two builds side by side (R3_BASE: the build as it stood, default http://localhost:4616, see
// static.mjs; the new one on 4615), both sizes, three cases, a full-page PNG of each, pixels compared:
//   scripts off          JavaScript disabled in the browser
//   script fails         JavaScript on, the page's own script answers 404 (the watchdog in the head)
//   script fails, +13 s  the same, 13 s on (the stylesheet retires the cover at 12 s where it still stands)
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
for (const size of ['desk', 'phone']) for (const [name, js, wait] of [['scripts-off', false, 1000], ['script-fails', true, 1000], ['script-fails-13s', true, 13000]]) {
	const shots = {};
	const notes = {};
	for (const [build, base] of [['before', OLD], ['after', NEW]]) {
		const context = await browser.newContext({ ...SIZES[size], javaScriptEnabled: js });
		const page = await context.newPage();
		const asked = [];
		page.on('request', (r) => { if (/loader\/(c-lit|wordmark|wordmark-matte)\.webp/.test(r.url())) asked.push(r.url().split('/').pop()); });
		if (js) await page.route(/index\.astro[^/]*\.js$/, (route) => route.fulfill({ status: 404, body: '' }));
		await page.goto(`${base}/`, { waitUntil: 'load' });
		await sleep(wait);
		const file = join(dir, `${name}-${size}-${build}.png`);
		await page.screenshot({ path: file, fullPage: true });
		shots[build] = file;
		notes[build] = js ? await page.evaluate(() => `scene ${document.documentElement.dataset.scene ?? '(none)'}, the cover's display ${getComputedStyle(document.getElementById('loader')).display}`) : 'scripts off';
		notes[build] += `, the loader's other three pictures asked for: ${asked.length ? [...new Set(asked)].join(', ') : 'none'}`;
		await context.close();
	}
	const a = await sharp(shots.before).raw().toBuffer({ resolveWithObject: true });
	const b = await sharp(shots.after).raw().toBuffer({ resolveWithObject: true });
	let n = 0;
	if (a.info.width !== b.info.width || a.info.height !== b.info.height) n = -1;
	else for (let i = 0; i < a.data.length; i += a.info.channels) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++;
	if (n !== 0) differ++;
	say(`${size}, ${name}: the whole page ${a.info.width}x${a.info.height} px; PIXELS THAT DIFFER between the build as it stood and this one: ${n === -1 ? 'the pages are not the same size' : n}\n      before: ${notes.before}\n      after:  ${notes.after}`);
}
say(`CASES IN WHICH THE TWO BUILDS DIFFER: ${differ} of 6`);
writeFileSync(join(dir, 'nojs-same.txt'), `${log.join('\n')}\n`);
await browser.close();
