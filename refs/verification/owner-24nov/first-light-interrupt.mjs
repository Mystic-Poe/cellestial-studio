import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
await page.goto('http://localhost:4500/?scene=sky&debug', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cellestial?.sky?.answer, null, { timeout: 20000 });
await page.waitForTimeout(2500);
// 1. a tap during the first light
console.log('started:', await page.evaluate(() => window.__cellestial.sky.answer.firstLight()));
await page.waitForTimeout(1300);
await page.touchscreen.tap(320, 700);
await page.waitForTimeout(100);
console.log('after a tap at 1.3 s: playing', await page.evaluate(() => window.__cellestial.sky.answer.firstLightOn()));
await page.waitForTimeout(1500);
console.log('the words with their star:', await page.evaluate(() => { const w = document.querySelector('[data-claim-words]'); return w.hidden ? 'hidden' : w.dataset.slot; }), '| pulsing', await page.evaluate(() => window.__cellestial.sky.answer.pulsing()));
// 2. frame times during the first light, unslowed and CPU x4
const cdp = await ctx.newCDPSession(page);
for (const rate of [1, 4]) {
	await page.evaluate(() => window.__cellestial.sky.answer.clear());
	await page.waitForTimeout(3000);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate });
	const ms = await page.evaluate(() => new Promise((done) => {
		window.__cellestial.sky.answer.firstLight();
		const times = []; let last = performance.now(); const end = last + 4500;
		const step = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else done(times); };
		requestAnimationFrame(step);
	}));
	ms.sort((a, b) => a - b);
	const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
	console.log(`CPU x${rate}: ${ms.length} frames, average ${avg.toFixed(1)} ms, 95th ${ms[Math.floor(ms.length * 0.95)].toFixed(1)} ms, worst ${ms[ms.length - 1].toFixed(1)} ms`);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
	// the same window with no first light, for comparison
	await page.waitForTimeout(6000);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate });
	const base = await page.evaluate(() => new Promise((done) => {
		const times = []; let last = performance.now(); const end = last + 4500;
		const step = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else done(times); };
		requestAnimationFrame(step);
	}));
	base.sort((a, b) => a - b);
	console.log(`   without it: average ${(base.reduce((a, b) => a + b, 0) / base.length).toFixed(1)} ms, 95th ${base[Math.floor(base.length * 0.95)].toFixed(1)} ms`);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
console.log('page errors', errors.length, errors.join(' | '));
await browser.close();
