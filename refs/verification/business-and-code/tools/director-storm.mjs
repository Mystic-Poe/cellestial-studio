// After a storm of overlapping requests, how long until the director answers again?
// A: menu, B11, E6 only (what a visitor can really press). B: the same plus showStar (which only a
// sent request calls). Production build, real GPU.
import { BASE, check, DESK, launch, note, openPage, sleep, tally } from './lib.mjs';
const browser = await launch();
for (const [label, withStar] of [['A: go / descend / ascend', false], ['B: the same, plus showStar("slot-3") seven times', true]]) {
	const { context, page, errors } = await openPage(browser, DESK);
	await page.goto(`${BASE}/?scene=sky&debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.fx, null, { timeout: 20000 });
	await page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1500);
	await page.evaluate(async (star) => {
		const d = window.__cellestial.director;
		const calls = [() => d.go('build'), () => d.go('sky'), () => d.descend(), () => d.ascend(), () => d.go('claim'), () => d.go('contact')];
		if (star) calls.push(() => d.showStar('slot-3'));
		for (let i = 0; i < 20; i++) {
			calls[i % calls.length]();
			calls[(i * 3 + 1) % calls.length]();
			await new Promise((r) => setTimeout(r, 90 + (i % 5) * 130));
		}
	}, withStar);
	const t0 = Date.now();
	let answered = -1;
	const trail = [];
	for (let i = 0; i < 30; i++) {
		await sleep(2000);
		for (const id of await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((d) => d.id))) await page.evaluate((x) => document.getElementById(x).close(), id);
		const scene = await page.evaluate(() => document.documentElement.dataset.scene);
		trail.push(scene);
		if (scene === 'roots') { answered = Date.now() - t0; break; }
		await page.evaluate(() => window.__cellestial.director.go('build'));
	}
	note(`${label}: scenes seen every 2 s after the storm: ${trail.join(' ')}`);
	check(answered >= 0, `${label}: the director answers "What we build" again`, answered >= 0 ? `${(answered / 1000).toFixed(0)} s after the storm ended` : 'NEVER within 60 s');
	check(errors.length === 0, `${label}: no console errors`, errors.join(' | '));
	await context.close();
}
await browser.close();
process.exit(tally() ? 1 : 0);
