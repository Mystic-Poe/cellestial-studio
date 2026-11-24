// When the first light's beads reach each star: slot, wave send time, arrival.
import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';
const [, , base = 'http://localhost:4500'] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
for (const [name, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
	const ctx = await browser.newContext(opts);
	const page = await ctx.newPage();
	await page.goto(`${base}/?debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
	const seen = new Map();
	let tStart = null;
	const t0 = Date.now();
	while (Date.now() - t0 < 8000) {
		const s = await page.evaluate(() => {
			const a = window.__cellestial.sky.answer;
			const now = window.__cellestial.sky.hooks?.time?.() ?? performance.now() / 1000;
			return { now, on: a.firstLightOn(), runs: a.beads.runs().map((r) => ({ slot: r.route.slot, t0: r.t0, arr: r.arriveAfter })) };
		});
		for (const r of s.runs) if (!seen.has(r.slot)) seen.set(r.slot, r);
		await page.waitForTimeout(40);
	}
	const list = [...seen.values()].sort((a, b) => a.t0 + a.arr - (b.t0 + b.arr));
	const base0 = Math.min(...list.map((r) => r.t0));
	console.log(name, 'stars reached', list.length);
	console.log(list.map((r) => `${r.slot}: sent ${(r.t0 - base0).toFixed(2)} lands ${(r.t0 + r.arr - base0).toFixed(2)}`).join('\n'));
	await ctx.close();
}
await browser.close();
