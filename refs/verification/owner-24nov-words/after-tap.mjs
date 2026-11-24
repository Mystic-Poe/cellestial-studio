import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto('http://localhost:4500/?scene=sky&debug', { waitUntil: 'load' });
await page.waitForFunction(() => window.__cellestial?.sky?.answer, null, { timeout: 20000 });
await page.waitForTimeout(2500);
for (let k = 0; k < 3; k++) {
	await page.evaluate(() => window.__cellestial.sky.answer.clear());
	await page.waitForTimeout(1200);
	await page.evaluate(() => window.__cellestial.sky.answer.firstLight());
	await page.waitForFunction(() => document.querySelector('#sky-ui .sky-claim--flash'), null, { timeout: 6000 });
	await page.waitForTimeout(150 + k * 400);
	const runs = await page.evaluate(() => window.__cellestial.sky.answer.beads.runs().length);
	await page.touchscreen.tap(330, 760);
	const log = [];
	for (let i = 0; i < 12; i++) {
		log.push(await page.evaluate(() => [...document.querySelectorAll('#sky-ui .sky-claim--flash')].map((e) => (e.dataset.out === undefined ? 'new' : 'out')).join(',') || '-'));
		await page.waitForTimeout(100);
	}
	console.log(`tap ${k}: bead runs in flight at the tap ${runs}; words every 0.1 s after: ${log.join(' ')}`);
}
await browser.close();
