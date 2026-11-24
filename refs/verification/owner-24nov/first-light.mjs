// A first visit through the loader: the first light, frame by frame; then a reload in the same
// session (the short loader: no first light); then reduced motion (none).
import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';
const [, , base = 'http://localhost:4500', out] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
for (const [name, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
	const ctx = await browser.newContext(opts);
	const page = await ctx.newPage();
	const errors = [];
	page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
	page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
	await page.goto(`${base}/?debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 20000 });
	const t0 = Date.now();
	const log = [];
	let shot = 0;
	while (Date.now() - t0 < 9000) {
		const s = await page.evaluate(() => {
			const a = window.__cellestial.sky.answer;
			return { on: a.firstLightOn(), runs: a.beads.runs().length, beads: a.beads.screenAll().length };
		});
		log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s on=${s.on} runs=${s.runs}`);
		const ms = Date.now() - t0;
		if ([700, 900, 1300, 2000, 2300, 3300, 3700, 5000, 8000].some((m) => ms >= m && ms < m + 160) && shot < 9) {
			await page.screenshot({ path: `${out}/${name}-${String(shot++).padStart(2, '0')}-${(ms / 1000).toFixed(1)}s.jpg`, type: 'jpeg', quality: 80 });
		}
		await page.waitForTimeout(90);
	}
	const maxRuns = Math.max(...log.map((l) => Number(/runs=(\d+)/.exec(l)[1])));
	console.log(name, 'first visit: playing at', log.find((l) => l.includes('on=true'))?.split(' ')[0], '| most runs of beads at once', maxRuns, '| over by', log.find((l, i) => i > 3 && l.includes('on=false'))?.split(' ')[0]);
	// a reload in the same session: the short loader, and no first light
	await page.reload({ waitUntil: 'load' });
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 20000 });
	let again = false;
	for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!(window.__cellestial.sky?.answer && (window.__cellestial.sky.answer.firstLightOn() || window.__cellestial.sky.answer.beads.runs().length > 0)))) again = true; await page.waitForTimeout(100); }
	console.log(name, 'reload in the same session: first light', again ? 'PLAYED (wrong)' : 'not played');
	console.log(name, 'console errors', errors.length, errors.slice(0, 3).join(' | '));
	await ctx.close();
	// reduced motion
	const rm = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
	const p2 = await rm.newPage();
	await p2.goto(`${base}/?debug`, { waitUntil: 'load' });
	await p2.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 20000 });
	let rmOn = false;
	for (let i = 0; i < 25; i++) { if (await p2.evaluate(() => !!(window.__cellestial.sky?.answer && (window.__cellestial.sky.answer.firstLightOn() || window.__cellestial.sky.answer.beads.runs().length > 0)))) rmOn = true; await p2.waitForTimeout(100); }
	console.log(name, 'reduced motion: first light', rmOn ? 'PLAYED (wrong)' : 'not played');
	await rm.close();
}
await browser.close();
