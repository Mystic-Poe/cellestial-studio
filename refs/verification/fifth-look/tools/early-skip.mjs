#!/usr/bin/env node
// Round 3, piece 3a: A SKIP MADE BEFORE THE LOADER'S SCRIPT HAS ARRIVED. Slow 4G (1.6 Mbit/s down, 750
// kbit/s up, 150 ms), production build, real GPU, a tap on the phone and a key ("a") on the desktop.
// The page's own times, ms after navigation: the browser's first paint, the frame the page showed the
// unlit C in (window.__loaderEarly.seenAt), the loader live (.is-live), the press, the sky.
//   nothing        nothing pressed: the loader plays through
//   at-mount       the press the moment the loader is live: the reference, "a skip at the mount"
//   early          the press 1.0 s after navigation: the cover stands (black: the C's file is still on
//                  its way), the page's script has not arrived
//   seen           the press 0.3 s after the unlit C is first seen (the brief's own case; on this build
//                  and line the page's script is live by then)
//   seen-late      the same with the page's script held back a further 1.5 s (as on a line where the C
//                  outruns it): the press 0.3 s after the C is first seen, the script not yet there
//   quiet          Tab, Shift, Control, Alt, Meta at 1.0 s after navigation: not a skip
//   mount-late     the reference for seen-late: the script held back 1.5 s, the press the moment it is live
// Also, by DevTools' own list of the window's listeners (one more visit at each size, not timed): the
// window's keydown and pointerdown listeners, and which script each belongs to (the page's own markup
// or a file), before the loader is live, just after, and when the sky is on; and what is left on
// window.__loaderEarly for a second taker.
//   node early-skip.mjs [--runs 4] [--sizes phone,desk]     writes loader/early-skip.txt
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { runs: { type: 'string', default: '4' }, sizes: { type: 'string', default: 'phone,desk' } } });
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
const slow = async (o) => { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); };
const read = (o) => o.page.evaluate(() => ({ ...window.__t, now: performance.now(), fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null, seen: window.__loaderEarly?.seenAt ?? null, mode: document.getElementById('loader')?.dataset.mode }));
/** Call before navigation: DevTools then knows which script each listener was written in. */
const watchScripts = async (o) => {
	o.scripts = new Map();
	o.cdp.on('Debugger.scriptParsed', (e) => o.scripts.set(e.scriptId, e.url));
	await o.cdp.send('Debugger.enable');
};
const listeners = async (o) => {
	const { result } = await o.cdp.send('Runtime.evaluate', { expression: 'window' });
	const { listeners: ls } = await o.cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
	const whose = (l) => {
		const url = o.scripts?.get(l.scriptId);
		if (url === undefined) return 'not the page\'s (the test\'s own or the browser\'s)';
		const path = url ? new URL(url).pathname : '';
		return path === '/' ? "the markup's script" : path.split('/').pop().split('.')[0] || 'not the page\'s';
	};
	const of = (type) => ls.filter((l) => l.type === type).map(whose);
	const list = (a) => (a.length ? a.join(' + ') : 'none');
	return `keydown: ${list(of('keydown'))}; pointerdown: ${list(of('pointerdown'))}`;
};
const r0 = (x) => (x === null || x === undefined ? '?' : Math.round(x));
const CASES = ['nothing', 'at-mount', 'early', 'seen', 'seen-late', 'mount-late', 'quiet'];
for (const size of values.sizes.split(',')) {
	const sums = {};
	for (const kind of CASES) for (let run = 1; run <= Number(values.runs); run++) {
		if ((kind === 'nothing' || kind === 'quiet') && run > 2) continue;
		const o = await open(browser, size, { init });
		await slow(o);
		if (kind === 'seen-late' || kind === 'mount-late') await o.page.route(/index\.astro[^/]*\.js$/, async (route) => { await sleep(1500); await route.continue().catch(() => {}); });
		const press = () => (o.phone ? o.page.touchscreen.tap(200, 400) : o.page.keyboard.press('a'));
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		let at = null;
		if (kind === 'at-mount' || kind === 'mount-late') { await o.page.waitForFunction(() => window.__t?.live, null, { timeout: 60000, polling: 'raf' }); at = (await read(o)).now; await press(); }
		if (kind === 'early') { await o.page.waitForFunction(() => performance.now() >= 1000, null, { timeout: 60000, polling: 'raf' }); at = (await read(o)).now; await press(); }
		if (kind === 'seen' || kind === 'seen-late') { await o.page.waitForFunction(() => window.__loaderEarly?.seenAt, null, { timeout: 60000, polling: 'raf' }); await sleep(300); at = (await read(o)).now; await press(); }
		if (kind === 'quiet') { await o.page.waitForFunction(() => performance.now() >= 1000, null, { timeout: 60000, polling: 'raf' }); at = (await read(o)).now; for (const key of ['Tab', 'Shift', 'Control', 'Alt', 'Meta']) await o.page.keyboard.press(key); }
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		const t = await read(o);
		const what = at === null ? 'nothing pressed' : `the ${kind === 'quiet' ? 'quiet keys' : o.phone ? 'tap' : 'key'} at ${r0(at)} (${at < t.live ? `${r0(t.live - at)} ms BEFORE the loader is live` : `${r0(at - t.live)} ms after the loader is live`})`;
		say(`${size}, ${kind}, run ${run}: first paint ${r0(t.fcp)}, the C shown ${r0(t.seen)}, the loader live ${r0(t.live)}, ${what}; THE SKY AT ${r0(t.sky)} ms${at === null ? '' : `, ${((t.sky - at) / 1000).toFixed(2)} s after the press`}${o.errors.length ? `  ERRORS: ${o.errors.join(' | ')}` : ''}`);
		(sums[kind] ??= []).push(t.sky);
		await o.context.close();
	}
	const span = (k) => `${Math.min(...sums[k]).toFixed(0)} to ${Math.max(...sums[k]).toFixed(0)}`;
	// Whose the window's listeners are, at three moments of one early skip.
	{
		const o = await open(browser, size, { init });
		await slow(o);
		await watchScripts(o);
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => performance.now() >= 1000, null, { timeout: 60000, polling: 'raf' });
		const before = await listeners(o);
		if (o.phone) await o.page.touchscreen.tap(200, 400); else await o.page.keyboard.press('a');
		await o.page.waitForFunction(() => window.__t?.live, null, { timeout: 60000, polling: 'raf' });
		const after = await listeners(o);
		const left = await o.page.evaluate(() => JSON.stringify(window.__loaderEarly?.take()));
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		await sleep(300);
		const end = await listeners(o);
		say(`${size}, THE WINDOW'S LISTENERS in one early skip. Before the loader is live: ${before}. Just after it is live: ${after}. With the sky on: ${end}. Left on window.__loaderEarly for a second taker: ${left}`);
		await o.context.close();
	}
	say(`${size}: THE SKY, ms after navigation: nothing pressed ${span('nothing')}; a skip at the mount ${span('at-mount')}; A SKIP BEFORE THE SCRIPT (1.0 s) ${span('early')}; 0.3 s after the C is seen ${span('seen')}; the same with the script held back 1.5 s ${span('seen-late')} (a skip at THAT mount ${span('mount-late')}); Tab and modifiers before the script ${span('quiet')}`);
}
// Where no loader plays, nothing is listened for or kept.
for (const [name, url, rm] of [['reduced motion (the device setting)', '/', true], ['?scene=sky', '/?scene=sky', false]]) {
	const o = await open(browser, 'desk', { reducedMotion: rm });
	await slow(o);
	await watchScripts(o);
	await o.page.goto(`${PROD}${url}`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => document.getElementById('loader') && performance.now() >= 700, null, { timeout: 60000, polling: 'raf' });
	const early = await listeners(o);
	const has = await o.page.evaluate(() => typeof window.__loaderEarly);
	say(`${name}: 0.7 s after navigation (the page's script not yet there) the window's listeners: ${early}; window.__loaderEarly is ${has}`);
	await o.context.close();
}
// The page's script never arrives.
{
	const o = await open(browser, 'desk');
	await watchScripts(o);
	await o.page.route(/index\.astro[^/]*\.js$/, (route) => route.abort());
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => document.getElementById('loader'), null, { polling: 'raf' });
	await o.page.keyboard.press('a');
	await o.page.waitForLoadState('load');
	await sleep(500);
	const end = await listeners(o);
	const s = await o.page.evaluate(() => ({ scene: document.documentElement.dataset.scene ?? '(none: the page without script)', left: JSON.stringify(window.__loaderEarly?.take()), loader: getComputedStyle(document.getElementById('loader')).display }));
	say(`the page's script never arrives (its request fails), a key pressed while the cover stood: after the load event the window's listeners: ${end}; left to take: ${s.left}; the scene: ${s.scene}; the cover's display: ${s.loader}`);
	await o.context.close();
}
writeFileSync(join(dir, 'early-skip.txt'), `${log.join('\n')}\n`);
await browser.close();
