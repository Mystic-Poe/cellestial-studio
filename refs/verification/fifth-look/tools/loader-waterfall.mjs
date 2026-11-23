#!/usr/bin/env node
// Round 3, piece 3: THE WATERFALL of a first visit's first seconds on slow 4G (1.6 Mbit/s down, 750 kbit/s
// up, 150 ms), production build: for the page, its stylesheets, its font, its first script, the sky's
// script and the loader's four pictures, when each was asked for, at what priority, and when its last
// byte arrived (DevTools' own network events; ms after the navigation's request). With them the page's
// own times: the browser's first-contentful-paint, the moment the page showed the unlit C (the inline
// script's mark, if the build has one), the loader live, the sky.
//   node loader-waterfall.mjs [--runs 2] [--sizes desk,phone] [--line slow4g|1mbit|fast] [--all: every request]
// Writes loader/waterfall.txt (R3_OUT moves it, as for every script here).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { runs: { type: 'string', default: '2' }, sizes: { type: 'string', default: 'desk,phone' }, line: { type: 'string', default: 'slow4g' }, all: { type: 'boolean', default: false } } });
const seenScript = new Set();
const LINES = { slow4g: ['slow 4G', 150, 1.6], '1mbit': ['1 Mbit/s, 200 ms', 200, 1.0], fast: ['a fast line', 0, 0] };
const [lineName, latency, mbit] = LINES[values.line];
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
		if (l?.classList.contains('is-drawn') && !window.__t.drawn) window.__t.drawn = performance.now();
	}).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scene', 'class'] });
} };
const name = (url) => {
	const p = new URL(url).pathname;
	if (p === '/') return 'the page';
	if (/loader\//.test(p)) return p.split('/').pop();
	if (/fonts\//.test(p)) return 'the font';
	if (/\.css$/.test(p)) return `css ${p.split('/').pop().split('.')[0]}`;
	if (/sky\.[^/]*\.js$/.test(p)) return 'the sky script';
	if (/index\.astro[^/]*DLSk[^/]*\.js$|index\.astro[^/]*\.js$/.test(p) && !seenScript.has(p)) { seenScript.add(p); return seenScript.size === 1 ? 'the page script' : `the page script's import ${p.split('.').slice(-2, -1)}`; }
	return values.all ? p.replace('/_astro/', '').replace('/cellestial/', '') : null;
};
for (const size of values.sizes.split(',')) for (let run = 1; run <= Number(values.runs); run++) {
	const o = await open(browser, size, { init });
	await o.cdp.send('Network.enable');
	if (mbit) await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: (mbit * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
	const reqs = new Map();
	seenScript.clear();
	let zero = null;
	o.cdp.on('Network.requestWillBeSent', (e) => { if (zero === null) zero = e.timestamp; const n = name(e.request.url); if (n && !reqs.has(e.requestId)) reqs.set(e.requestId, { n, asked: e.timestamp, pr: e.request.initialPriority, kb: 0 }); });
	o.cdp.on('Network.resourceChangedPriority', (e) => { const r = reqs.get(e.requestId); if (r) r.pr += `>${e.newPriority}`; });
	o.cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) r.first = e.timestamp; });
	o.cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.done = e.timestamp; r.kb = e.encodedDataLength / 1024; } });
	await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
	await sleep(300);
	const t = await o.page.evaluate(() => ({ ...window.__t, fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null, shown: window.__loaderEarly?.seenAt ?? null }));
	const ms = (x) => (x === undefined ? '   ?' : String(Math.round((x - zero) * 1000)).padStart(5));
	say(`${size}, ${lineName}, run ${run}: first contentful paint ${Math.round(t.fcp)} ms; the page showed the unlit C at ${t.shown === null ? '(no mark in this build)' : `${Math.round(t.shown)} ms`}; the loader live at ${Math.round(t.live)}; its canvas first drawn at ${Math.round(t.drawn ?? -1)}; the sky at ${Math.round(t.sky)} ms`);
	say('      asked  first byte  last byte   KB   priority   what');
	const rows = [...reqs.values()].sort((a, b) => a.asked - b.asked);
	for (const r of rows) say(`      ${ms(r.asked)}  ${ms(r.first)}      ${ms(r.done)}   ${r.kb.toFixed(0).padStart(4)}  ${r.pr.padEnd(10)} ${r.n}`);
	const c = rows.find((r) => r.n === 'c-unlit.webp');
	const three = rows.filter((r) => /^(c-lit|wordmark|wordmark-matte)\.webp$/.test(r.n));
	const before = three.filter((r) => r.done < c?.done).map((r) => r.n);
	say(`      THE UNLIT C's file is complete at ${ms(c?.done).trim()} ms; of the other three, complete BEFORE it: ${before.length ? before.join(', ') : 'none'}`);
	await o.context.close();
}
writeFileSync(join(dir, `waterfall${values.line === 'slow4g' ? '' : `-${values.line}`}.txt`), `${log.join('\n')}\n`);
await browser.close();
