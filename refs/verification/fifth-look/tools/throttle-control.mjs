// The fifth look's own control: does lib.mjs's CPU throttle take effect? The same busy loop timed unslowed and slowed 4x.
import { PROD, launch, open } from './lib.mjs';
const browser = await launch({ gpu: true });
for (const throttle of [1, 4]) {
	const o = await open(browser, 'desk', { throttle, reducedMotion: true });
	await o.page.goto(`${PROD}/contact`, { waitUntil: 'load' });
	const ms = await o.page.evaluate(() => { const t = performance.now(); let x = 0; for (let i = 0; i < 3e7; i++) x += Math.sqrt(i); return performance.now() - t; });
	console.log(`throttle ${throttle}: the loop took ${ms.toFixed(0)} ms`);
	await o.context.close();
}
await browser.close();
