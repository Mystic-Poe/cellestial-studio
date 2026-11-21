// Weight and first paint of the home page on the phone profile (390x844, scale 2, touch),
// CPU slowed 4x. Production build. For each request: bytes as the preview server sent them
// (it does not compress) and the same body gzipped (about what a CDN would transfer).
// Run: node refs/verification/business-and-code/tools/weight.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { BASE, HERE, launch, PHONE, sleep } from './lib.mjs';

const OBSERVE = `
	window.__perf = { lcp: [], long: [], marks: {} };
	new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp.push({ t: e.startTime, size: e.size, el: e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : '') + (e.element.id ? '#' + e.element.id : '') : null, url: e.url || null }); }).observe({ type: 'largest-contentful-paint', buffered: true });
	new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
	new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.marks[e.name] = e.startTime; }).observe({ type: 'paint', buffered: true });
	new MutationObserver(() => { const s = document.documentElement.dataset.scene; if (s && !window.__perf.marks['scene:' + s]) window.__perf.marks['scene:' + s] = performance.now(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scene'] });
`;
const out = [];
const say = (s = '') => { console.log(s); out.push(s); };
const browser = await launch();

async function run(label, { net, url = '/?debug' }) {
	const context = await browser.newContext(PHONE);
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send('Network.enable');
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: net.rtt, downloadThroughput: (net.down * 1024) / 8, uploadThroughput: (net.up * 1024) / 8 });
	await page.addInitScript(OBSERVE);
	const reqs = new Map();
	let t0 = null;
	cdp.on('Network.requestWillBeSent', (e) => { t0 ??= e.timestamp; reqs.set(e.requestId, { url: e.request.url, start: e.timestamp - t0 }); });
	cdp.on('Network.responseReceived', (e) => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.encoding = e.response.headers['content-encoding'] ?? e.response.headers['Content-Encoding'] ?? 'none'; r.type = e.type; } });
	cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.wire = e.encodedDataLength; r.end = e.timestamp - t0; } });
	const bodies = new Map();
	page.on('response', async (res) => { try { const b = await res.body(); bodies.set(res.url(), b); } catch {} });
	await page.goto(BASE + url, { waitUntil: 'load', timeout: 120000 });
	const marks = { load: await page.evaluate(() => performance.now()) };
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 120000 });
	await page.waitForFunction(() => window.__cellestial?.sky, null, { timeout: 120000 });
	await page.evaluate(() => window.__cellestial.sky.ready);
	marks.skyReadySeen = await page.evaluate(() => performance.now());
	await sleep(4000);
	const perf = await page.evaluate(() => ({ ...window.__perf, nav: performance.getEntriesByType('navigation')[0].toJSON(), res: performance.getEntriesByType('resource').map((r) => ({ name: r.name, start: r.startTime, end: r.responseEnd })) }));
	const list = [...reqs.values()].filter((r) => r.wire !== undefined).sort((a, b) => a.start - b.start);
	for (const r of list) {
		const b = bodies.get(r.url);
		r.raw = b ? b.length : 0;
		const compressible = /\.(js|css|html|svg|json|txt)$|\/$|\/\?/.test(new URL(r.url).pathname + new URL(r.url).search) || r.type === 'Document';
		r.gz = b ? (compressible ? gzipSync(b, { level: 9 }).length : b.length) : 0;
	}
	say(`\n## ${label}`);
	say('start s | end s | wire bytes | body | gzipped | encoding | url');
	for (const r of list) say(`${r.start.toFixed(2)} | ${r.end.toFixed(2)} | ${r.wire} | ${r.raw} | ${r.gz} | ${r.encoding} | ${r.url.replace(BASE, '')}`);
	const sum = (rs, k) => rs.reduce((a, r) => a + r[k], 0);
	const dcl = perf.nav.domContentLoadedEventEnd / 1000;
	const loadT = perf.nav.loadEventEnd / 1000;
	const skyAt = (perf.marks['scene:sky'] ?? 0) / 1000;
	const first = list.filter((r) => r.end <= loadT + 0.001);
	const isSky = (r) => /\/sky\.[^/]+\.js|cellestial\/sky\//.test(r.url);
	const beforeSky = list.filter((r) => !isSky(r));
	say(`requests: ${list.length}; third-party: ${list.filter((r) => !r.url.startsWith(BASE)).map((r) => r.url).join(', ') || 'none'}`);
	say(`up to the load event (${loadT.toFixed(2)} s): ${first.length} requests, ${sum(first, 'wire')} bytes on the wire, ${sum(first, 'gz')} gzipped`);
	say(`everything but the sky's own files (chunk + textures): ${beforeSky.length} requests, ${sum(beforeSky, 'raw')} bytes, ${sum(beforeSky, 'gz')} gzipped`);
	say(`the sky's own files: ${list.filter(isSky).map((r) => `${r.url.replace(BASE, '')} ${r.raw}/${r.gz}`).join('; ')} — arriving by ${Math.max(0, ...list.filter(isSky).map((r) => r.end)).toFixed(2)} s`);
	say(`all, once the sky has arrived: ${list.length} requests, ${sum(list, 'raw')} bytes, ${sum(list, 'gz')} gzipped`);
	const lcp = perf.lcp.at(-1);
	say(`first paint ${(perf.marks['first-paint'] / 1000).toFixed(2)} s; first contentful paint ${(perf.marks['first-contentful-paint'] / 1000).toFixed(2)} s; DOMContentLoaded ${dcl.toFixed(2)} s; load ${loadT.toFixed(2)} s; the sky on stage at ${skyAt.toFixed(2)} s`);
	say(`LCP candidates: ${perf.lcp.map((e) => `${(e.t / 1000).toFixed(2)} s ${e.el} ${e.size}px² ${e.url ? e.url.replace(BASE, '') : ''}`).join(' → ')}`);
	say(`Largest Contentful Paint: ${lcp ? (lcp.t / 1000).toFixed(2) : 'none'} s`);
	const long = perf.long;
	const tbt = long.reduce((a, e) => a + Math.max(0, e.d - 50), 0);
	say(`long tasks (> 50 ms): ${long.length}; total ${long.reduce((a, e) => a + e.d, 0)} ms; longest ${Math.max(0, ...long.map((e) => e.d))} ms; blocking time over 50 ms: ${tbt} ms`);
	say(`  each (start ms: length ms): ${long.map((e) => `${e.t}: ${e.d}`).join(', ')}`);
	const during = (a, b) => long.filter((e) => e.t >= a && e.t < b);
	say(`  during the loader (to ${Math.round(skyAt * 1000)} ms): ${during(0, skyAt * 1000).length} tasks, ${during(0, skyAt * 1000).reduce((a, e) => a + e.d, 0)} ms; in the 4 s after: ${during(skyAt * 1000, 1e9).length} tasks, ${during(skyAt * 1000, 1e9).reduce((a, e) => a + e.d, 0)} ms`);
	await context.close();
}

await run('first visit, CPU 4x slower, network as it comes (localhost)', {});
await run('first visit, CPU 4x slower, slow 4G (1.6 Mbit/s down, 750 kbit/s up, 150 ms)', { net: { down: 1600, up: 750, rtt: 150 } });
await run('reduced motion is not this; straight to the sky (?scene=sky), CPU 4x, localhost', { url: '/?scene=sky&debug' });
await browser.close();
writeFileSync(path.join(HERE, '..', 'weight.txt'), `${out.join('\n')}\n`);
