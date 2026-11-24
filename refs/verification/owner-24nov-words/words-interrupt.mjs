// The first light's words when the visitor acts first: a tap on the sky, a tap on the words,
// leaving the sky; and frame times with the words, unslowed and CPU x4.
import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';
const [, , base = 'http://localhost:4500'] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
await page.goto(`${base}/?scene=sky&debug`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__cellestial?.sky?.answer, null, { timeout: 20000 });
await page.waitForTimeout(2500);
const flashes = () => page.evaluate(() => [...document.querySelectorAll('#sky-ui .sky-claim--flash')].map((e) => ({ out: e.dataset.out !== undefined, aria: e.getAttribute('aria-hidden') })));
const waitWords = () => page.waitForFunction(() => [...document.querySelectorAll('#sky-ui .sky-claim--flash')].some((e) => e.dataset.out === undefined && Number(getComputedStyle(e).opacity) > 0.8), null, { timeout: 6000 });

// 1. a tap on the sky while words show
await page.evaluate(() => window.__cellestial.sky.answer.firstLight());
await waitWords();
console.log('1. words showing before the tap:', (await flashes()).length, '| aria-hidden', (await flashes())[0]?.aria);
await page.touchscreen.tap(330, 760);
await page.waitForTimeout(60);
console.log('   just after a tap on the sky: going', (await flashes()).filter((f) => f.out).length, 'of', (await flashes()).length);
await page.waitForTimeout(400);
console.log('   0.46 s after: first-light words left', (await flashes()).length, '| first light playing', await page.evaluate(() => window.__cellestial.sky.answer.firstLightOn()));
await page.waitForTimeout(2500);
console.log('   the visitor\'s own words:', await page.evaluate(() => { const w = document.querySelector('[data-claim-words]'); return w.hidden ? 'hidden' : `by ${w.dataset.slot}`; }), '| first-light words now', (await flashes()).length);

// 2. a tap on the words: that star's panel
await page.evaluate(() => window.__cellestial.sky.answer.clear());
await page.waitForTimeout(1500);
await page.evaluate(() => window.__cellestial.sky.answer.firstLight());
await waitWords();
const target = await page.evaluate(() => {
	const e = [...document.querySelectorAll('#sky-ui .sky-claim--flash')].find((el) => el.dataset.out === undefined && Number(getComputedStyle(el).opacity) > 0.8);
	const r = e.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2, slot: e.dataset.slot };
});
await page.evaluate(() => window.__cellestial.sky.hooks.on('open-empty', ({ slot }) => { window.__opened = slot; }));
await page.touchscreen.tap(target.x, target.y);
await page.waitForTimeout(700);
const panel = await page.evaluate(() => {
	const p = document.querySelector('[data-sky-panel="empty"]');
	return p && !p.hidden ? `open for ${window.__opened}` : 'closed';
});
console.log(`   the words tapped were ${target.slot}'s`);
console.log('2. a tap on "claim yours": the empty star\'s panel', panel, '| claim button visible', await page.locator('#sky-claim-star').isVisible(), '| words left', (await flashes()).length);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// 3. leaving the sky mid-sequence (the menu to the roots)
await page.evaluate(() => window.__cellestial.sky.answer.clear());
await page.waitForTimeout(1500);
await page.evaluate(() => window.__cellestial.sky.answer.firstLight());
await waitWords();
await page.locator('.chrome-bars').click();
await page.waitForTimeout(300);
await page.locator('#chrome-menu a[data-dest="build"]').click();
await page.waitForFunction(() => document.documentElement.dataset.scene === 'roots', null, { timeout: 8000 });
await page.waitForTimeout(500);
console.log('3. after the menu took the visitor to the roots: first-light words left', (await flashes()).length);
console.log('page errors', errors.length, errors.join(' | '));
await ctx.close();

// 4. frame times, desk and phone, CPU x1 and x4, with the first light (and its words) and without
for (const [name, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
	const c = await browser.newContext(opts);
	const p = await c.newPage();
	await p.goto(`${base}/?scene=sky&debug`, { waitUntil: 'load' });
	await p.waitForFunction(() => window.__cellestial?.sky?.answer, null, { timeout: 20000 });
	await p.waitForTimeout(2500);
	const cdp = await c.newCDPSession(p);
	const frames = (play) => p.evaluate((play) => new Promise((done) => {
		if (play) window.__cellestial.sky.answer.firstLight();
		const times = []; let last = performance.now(); const end = last + 6000;
		const step = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else done(times); };
		requestAnimationFrame(step);
	}), play);
	const sum = (ms) => { ms.sort((a, b) => a - b); return `average ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)} ms, 95th ${ms[Math.floor(ms.length * 0.95)].toFixed(1)}, worst ${ms.at(-1).toFixed(1)}`; };
	for (const rate of [1, 4]) {
		await cdp.send('Emulation.setCPUThrottlingRate', { rate });
		const on = await frames(true);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
		await p.waitForTimeout(3000);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate });
		const off = await frames(false);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
		console.log(`4. ${name} CPU x${rate}: with it ${sum(on)} | without ${sum(off)}`);
		await p.waitForTimeout(1500);
	}
	await c.close();
}
await browser.close();
