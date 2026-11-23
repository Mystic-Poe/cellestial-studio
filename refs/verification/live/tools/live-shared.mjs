import { chromium } from '/home/poe/cellestial-studio-work/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
await page.goto('https://cellestialstudio.com/?debug', { waitUntil: 'load' });
await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 20000 });
await page.waitForTimeout(2500);
console.log('live page, lit stars:', await page.evaluate(() => [...window.__cellestial.claims.all()].map(([s, c]) => `${s} ask="${c.ask}"`)));
// three quick taps: the beads
const tap = (x, y) => page.touchscreen.tap(x, y);
await tap(60, 700); await page.waitForTimeout(130); await tap(330, 250); await page.waitForTimeout(130); await tap(200, 760); await page.waitForTimeout(140);
console.log('three quick taps, runs of beads at once:', await page.evaluate(() => window.__cellestial.sky.answer.beads.runs().length));
await page.screenshot({ path: process.argv[2], type: 'jpeg', quality: 85 });
console.log('console errors:', errors.length, errors.slice(0, 2).join(' | '));
await browser.close();
