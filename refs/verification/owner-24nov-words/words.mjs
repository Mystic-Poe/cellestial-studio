// The first light's words, in the page: when each is struck, how many show at once, whether
// any two overlap or come nearer than 8 px, and frame times while it plays. Screens to <out>.
import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';
const [, , base = 'http://localhost:4500', out = '.'] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
for (const [name, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
	const ctx = await browser.newContext(opts);
	const page = await ctx.newPage();
	const errors = [];
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
	page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
	await page.goto(`${base}/?debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
	// Frame times, from the page itself.
	await page.evaluate(() => {
		window.__ft = [];
		let last = performance.now();
		const tick = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length < 900) requestAnimationFrame(tick); };
		requestAnimationFrame(tick);
	});
	const t0 = Date.now();
	const struck = new Map();
	let most = 0, closest = Infinity, overlapped = 0, shots = 0;
	const at = [];
	while (Date.now() - t0 < 8000) {
		const s = await page.evaluate(() => [...document.querySelectorAll('#sky-ui .sky-claim--flash')].map((el) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			return { text: el.textContent, out: el.dataset.out !== undefined, vis: cs.visibility, op: Number(cs.opacity), x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, key: el.style.translate };
		}));
		const ms = Date.now() - t0;
		const shown = s.filter((e) => e.vis !== 'hidden' && e.op > 0.05);
		most = Math.max(most, shown.length);
		for (const e of s) if (!struck.has(e.key + e.text)) struck.set(e.key + e.text, ms);
		for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
			const a = shown[i], b = shown[j];
			const gap = Math.hypot(Math.max(a.x0 - b.x1, 0, b.x0 - a.x1), Math.max(a.y0 - b.y1, 0, b.y0 - a.y1));
			closest = Math.min(closest, gap);
			if (gap === 0) overlapped++;
		}
		at.push(`${(ms / 1000).toFixed(2)} ${shown.length}`);
		if (shown.length >= 2 && shots < 6 && (shots === 0 || ms - (at.lastShot ?? 0) > 650)) {
			at.lastShot = ms;
			await page.screenshot({ path: `${out}/${name}-${String(shots++).padStart(2, '0')}-${(ms / 1000).toFixed(1)}s.jpg`, type: 'jpeg', quality: 82 });
		}
		await page.waitForTimeout(30);
	}
	const ft = await page.evaluate(() => window.__ft.slice(5));
	ft.sort((a, b) => a - b);
	const times = [...struck.values()].sort((a, b) => a - b);
	console.log(`${name}: words struck ${times.length} (scaled box keys; the strike swell may double-count none: keys are the place)`);
	console.log(`${name}: struck at ms ${times.join(' ')}`);
	console.log(`${name}: most showing at once ${most}; closest two ${closest === Infinity ? '-' : closest.toFixed(1)} px; overlapping samples ${overlapped}`);
	console.log(`${name}: frames median ${ft[Math.floor(ft.length / 2)].toFixed(1)} ms, p95 ${ft[Math.floor(ft.length * 0.95)].toFixed(1)} ms, worst ${ft.at(-1).toFixed(1)} ms over ${ft.length}`);
	console.log(`${name}: left in the page after: ${await page.locator('#sky-ui .sky-claim--flash').count()}; console errors ${errors.length} ${errors.slice(0, 2).join(' | ')}`);
	await ctx.close();
}
await browser.close();
