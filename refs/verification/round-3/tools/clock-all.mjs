#!/usr/bin/env node
// The third look's own clock: how long is the loader's picture on screen? The page's own times
// (performance.now()): the browser's first-contentful-paint (the server's unlit C), the moment the loader
// goes live (.is-live on #loader), the moment the scene becomes "sky" (a MutationObserver, as
// clock-slow.mjs has it). Production build, real GPU, both sizes, four conditions: a fast line, the CPU
// slowed 4x, slow 4G (1.6 Mbit/s down, 750 kbit/s up, 150 ms), and both. Five FIRST visits each (a fresh
// context, nothing cached), then in a sixth context a first visit, a same-session reload (the short
// version) and, in a seventh, a skip (a tap or a key one second after the first paint).
//   node clock-all.mjs [--sizes phone,desk] [--runs 5]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'phone,desk' }, runs: { type: 'string', default: '5' } } });
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const init = { fn: () => {
	window.__t = {};
	new MutationObserver(() => {
		if (document.documentElement.dataset.scene === 'sky' && !window.__t.sky) window.__t.sky = performance.now();
		const l = document.getElementById('loader');
		if (l?.classList.contains('is-live') && !window.__t.live) window.__t.live = performance.now();
	}).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scene', 'class'] });
} };
const read = (o) => o.page.evaluate(() => ({ ...window.__t, fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null }));
const slow = async (o) => { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); };
const s2 = (ms) => (ms / 1000).toFixed(2);
let under = 0, over = 0, all = 0;
for (const size of values.sizes.split(',')) for (const [name, throttle, net] of [['a fast line', 1, false], ['CPU 4x', 4, false], ['slow 4G', 1, true], ['CPU 4x and slow 4G', 4, true]]) {
	const rows = [];
	for (let run = 0; run < Number(values.runs); run++) {
		const o = await open(browser, size, { throttle, init });
		if (net) await slow(o);
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		rows.push(await read(o));
		await o.context.close();
	}
	const onScreen = rows.map((r) => r.sky - r.fcp);
	all += onScreen.length; under += onScreen.filter((x) => x < 6000).length; over += onScreen.filter((x) => x > 8000).length;
	say(`${size}, ${name}: FIRST VISITS: first paint at ${rows.map((r) => Math.round(r.fcp)).join(', ')} ms; loader live at ${rows.map((r) => Math.round(r.live ?? -1)).join(', ')} ms; the sky at ${rows.map((r) => Math.round(r.sky)).join(', ')} ms after navigation`);
	say(`   FIRST PAINT TO THE SKY: ${onScreen.map(s2).join(', ')} s   (from the loader going live: ${rows.map((r) => (r.live ? s2(r.sky - r.live) : '?')).join(', ')} s; from navigation: ${rows.map((r) => s2(r.sky)).join(', ')} s)${onScreen.some((x) => x < 6000) ? '   <-- UNDER 6' : ''}${onScreen.some((x) => x > 8000) ? '   <-- OVER 8' : ''}`);
	// the short version
	{
		const o = await open(browser, size, { throttle, init });
		if (net) await slow(o);
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		await sleep(1500);
		await o.page.reload({ waitUntil: 'commit' });
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		const r = await read(o);
		say(`   same-session reload (the short version): first paint at ${Math.round(r.fcp)} ms, the sky at ${Math.round(r.sky)} ms: ${s2(r.sky - r.fcp)} s on screen`);
		await o.context.close();
	}
	// a skip
	{
		const o = await open(browser, size, { throttle, init });
		if (net) await slow(o);
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => performance.getEntriesByType('paint').some((p) => p.name === 'first-contentful-paint'), null, { timeout: 60000 });
		await sleep(1000);
		const at = await o.page.evaluate(() => performance.now());
		if (o.phone) await o.page.touchscreen.tap(200, 400); else await o.page.keyboard.press('a');
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		const r = await read(o);
		say(`   a skip (${o.phone ? 'tap' : 'key'}) at ${Math.round(at)} ms (first paint ${Math.round(r.fcp)}, loader live ${Math.round(r.live ?? -1)}): the sky at ${Math.round(r.sky)} ms, ${s2(r.sky - at)} s after the ${o.phone ? 'tap' : 'key'}`);
		await o.context.close();
	}
}
say(`ALL FIRST VISITS: ${all}; first paint to the sky under 6 s in ${under}, over 8 s in ${over}.`);
writeFileSync(join(dir, 'clock-all.txt'), `${log.join('\n')}\n`);
await browser.close();
