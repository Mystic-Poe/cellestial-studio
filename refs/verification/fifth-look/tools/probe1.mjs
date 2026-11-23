import { PROD, launch, open, sleep } from './lib.mjs';
const browser = await launch({ gpu: true });
const o = await open(browser, 'phone', { reducedMotion: true, init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
await o.page.evaluate(() => window.__cellestial.sky.ready);
await sleep(1200);
for (const pt of [[228, 284], [228, 591], [96, 667]]) {
	const before = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return `${el?.tagName}.${el?.className}`; }, pt);
	await o.pressAt(...pt);
	await sleep(250);
	const r = await o.page.evaluate(() => {
		const w = document.querySelector('[data-claim-words]');
		const vis = [...document.querySelectorAll('#sky-ui *')].filter((e) => !e.hidden && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden' && e.children.length === 0).map((e) => `${e.tagName}.${e.className}#${e.id}:${(e.textContent || '').slice(0, 30)}`);
		const stars = ['slot-53', 'slot-34', 'slot-3', 'slot-87', 'slot-102', 'slot-85', 'slot-110', 'slot-52', 'slot-28', 'slot-65', 'slot-98', 'slot-74'].map((s) => [s, window.__cellestial.sky.hooks.starCircle(s)]).filter(([, c]) => c).map(([s, c]) => `${s} ${c.x.toFixed(0)},${c.y.toFixed(0)} r${c.r.toFixed(0)}`);
		return { words: w ? { hidden: w.hidden, vis: getComputedStyle(w).visibility, slot: w.dataset.slot } : null, vis, stars };
	});
	console.log(pt, before, JSON.stringify(r));
	await o.page.keyboard.press('Escape');
	await sleep(200);
}
await browser.close();
