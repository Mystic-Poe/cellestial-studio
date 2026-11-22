#!/usr/bin/env node
// Round 2, piece 2c: why does the time the unlit C stood before the script arrived buy nothing? At the
// moment the loader goes live (.is-live on #loader: its mount), what does the page know of its own first
// paint, when are the loader's pictures in, and what else is on the line? Phone profile, production build, a fast line and slow 4G, three first visits each.
//   node clock-credit.mjs [--tag before]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir } from './lib.mjs';
const { values } = parseArgs({ options: { tag: { type: 'string', default: '' } } });
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const [name, throttle, net] of [['unslowed', 1, false], ['slow 4G', 1, true], ['CPU 4x and slow 4G', 4, true]]) {
	for (let run = 0; run < 3; run++) {
		const o = await open(browser, 'phone', { throttle, init: { fn: () => {
			window.__t = { paints: [] };
			try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__t.paints.push({ name: e.name, start: Math.round(e.startTime), seenAt: Math.round(performance.now()) }); }).observe({ type: 'paint', buffered: true }); } catch {}
			new MutationObserver(() => {
				const l = document.getElementById('loader');
				if (l?.classList.contains('is-live') && !window.__t.live) {
					window.__t.live = Math.round(performance.now());
					window.__t.byName = performance.getEntriesByName('first-contentful-paint').length;
					window.__t.byType = performance.getEntriesByType('paint').map((p) => `${p.name} ${Math.round(p.startTime)}`);
					window.__t.poster = (() => { const i = l.querySelector('img'); return i ? { complete: i.complete, natural: i.naturalWidth, shown: getComputedStyle(i).display } : null; })();
					window.__t.mode = l.dataset.mode;
				}
				if (l?.classList.contains('is-drawn') && !window.__t.drawn) window.__t.drawn = Math.round(performance.now());
				if (document.documentElement.dataset.scene === 'sky' && !window.__t.sky) window.__t.sky = Math.round(performance.now());
			}).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scene', 'class'] });
		} } });
		if (net) { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); }
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 90000 });
		const t = await o.page.evaluate(() => ({ ...window.__t, res: performance.getEntriesByType('resource').map((r) => ({ name: r.name.split('/').pop().slice(0, 40), start: Math.round(r.startTime), end: Math.round(r.responseEnd), kb: Math.round(r.transferSize / 1024), type: r.initiatorType })) }));
		say(`phone, ${name}, visit ${run + 1}: the loader went live at ${t.live} ms (mode ${t.mode}); at that moment getEntriesByName('first-contentful-paint') gave ${t.byName} entr${t.byName === 1 ? 'y' : 'ies'}, the paint entries were [${t.byType.join('; ')}], the poster ${JSON.stringify(t.poster)}; paints as they were reported: ${t.paints.map((p) => `${p.name} at ${p.start} ms (reported at ${p.seenAt})`).join('; ')}; the canvas first drew (the pictures were in, the script began) at ${t.drawn} ms; the sky at ${t.sky} ms`);
		if (run === 0) for (const r of t.res.sort((a, b) => a.end - b.end)) say(`      ${String(r.start).padStart(5)} to ${String(r.end).padStart(5)} ms  ${String(r.kb).padStart(5)} KB  ${r.type.padEnd(8)} ${r.name}`);
		await o.context.close();
	}
}
writeFileSync(join(dir, `clock-credit${values.tag ? `-${values.tag}` : ''}.txt`), `${log.join('\n')}\n`);
await browser.close();
