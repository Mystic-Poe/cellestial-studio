// The director under rough handling, on the production build with the real GPU: things the
// builders' transition checks do not do. Run: node refs/verification/business-and-code/tools/director-probes.mjs
import path from 'node:path';
import sharp from 'sharp';
import { BASE, check, DESK, launch, note, openPage, PHONE, SHOTS, sleep, tally } from './lib.mjs';

const browser = await launch();
const st = (page) => page.evaluate(() => ({
	scene: document.documentElement.dataset.scene,
	y: Math.round(scrollY),
	spacer: document.getElementById('sky-window').offsetHeight,
	focus: document.activeElement?.id || document.activeElement?.tagName,
	rootsTop: Math.round(document.getElementById('roots').getBoundingClientRect().top),
	veil: [...document.body.children].filter((e) => e.getAttribute('aria-hidden') === 'true' && e.style.position === 'fixed').map((e) => `${e.style.opacity}/${e.style.pointerEvents}`).join(','),
}));
const mean = async (buf) => {
	const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	let s = 0;
	for (let i = 0; i < data.length; i += 3) s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
	return s / (data.length / 3);
};
async function sky(page, extra = '') {
	await page.goto(`${BASE}/?scene=sky&debug${extra}`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.fx, null, { timeout: 20000 });
	await page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1500);
}
const settle = async (page, ms = 4000) => { await sleep(ms); return st(page); };

for (const [name, size] of [['desk', DESK], ['phone', PHONE]]) {
	console.log(`\n# ${name}`);
	// 1. The window changes size twice during the fall.
	{
		const { context, page, errors } = await openPage(browser, size);
		await sky(page);
		page.evaluate(() => window.__cellestial.director.descend());
		await sleep(500);
		await page.setViewportSize({ width: size.viewport.height, height: size.viewport.width });
		await sleep(700);
		await page.setViewportSize(size.viewport);
		const s = await settle(page);
		check(s.scene === 'roots' && s.y === 0 && s.spacer === 0 && s.rootsTop === 0, 'resized (rotated) twice during the fall: ends on the Roots, at the top', JSON.stringify(s));
		check(errors.length === 0, 'no console errors', errors.join(' | '));
		await context.close();
	}
	// 2. Reduced motion is switched on in the middle of the fall, and in the middle of the warp.
	{
		const { context, page, errors } = await openPage(browser, size);
		await sky(page);
		page.evaluate(() => window.__cellestial.director.descend());
		await sleep(600);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		let s = await settle(page);
		check(s.scene === 'roots' && s.y === 0 && s.spacer === 0, 'reduced motion switched on mid-fall: ends on the Roots, at the top', JSON.stringify(s));
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await sleep(300);
		await page.evaluate(() => window.scrollTo(0, 900));
		page.evaluate(() => window.__cellestial.director.ascend());
		await sleep(500);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		s = await settle(page);
		check(s.scene === 'sky' && s.y === 0, 'reduced motion switched on mid-warp: ends on the sky', JSON.stringify(s));
		const m = await mean(await page.screenshot());
		check(m > 0.3, 'and the sky is drawn', `mean luminance ${m.toFixed(2)}`);
		check(errors.length === 0, 'no console errors', errors.join(' | '));
		await context.close();
	}
	// 3. Every way of going somewhere, asked for at once, twenty times over.
	{
		const { context, page, errors } = await openPage(browser, size);
		await sky(page);
		await page.evaluate(async () => {
			const d = window.__cellestial.director;
			const calls = [() => d.go('build'), () => d.go('sky'), () => d.descend(), () => d.ascend(), () => d.go('claim'), () => d.go('contact')]; // showStar queues by design: see director-storm.mjs
			for (let i = 0; i < 20; i++) {
				calls[i % calls.length]();
				calls[(i * 3 + 1) % calls.length]();
				await new Promise((r) => setTimeout(r, 90 + (i % 5) * 130));
			}
		});
		const s = await settle(page, 7000);
		const dialogs = await page.evaluate(() => [...document.querySelectorAll('dialog[open]')].map((d) => d.id));
		note(`after the storm: ${JSON.stringify(s)}; dialogs open: ${dialogs.join(',') || 'none'}`);
		check(['sky', 'roots'].includes(s.scene), 'twenty overlapping requests: the page ends in one resting scene', s.scene);
		check(s.scene === 'sky' ? s.y === 0 && s.spacer > 0 : s.spacer === 0, 'and its scroll model is whole', JSON.stringify(s));
		check(!/1\/auto/.test(s.veil), 'no black veil is left over the page', s.veil);
		// And it still answers.
		for (const d of dialogs) await page.evaluate((id) => document.getElementById(id).close(), d);
		await page.evaluate(() => window.__cellestial.director.go('build'));
		const after = await settle(page, 2500);
		check(after.scene === 'roots', 'and the menu still works afterwards', JSON.stringify(after));
		const m = await mean(await page.screenshot({ path: path.join(SHOTS, `probe-${name}-after-storm.png`) }));
		check(m > 4, 'and the page is not black', `mean ${m.toFixed(1)}`);
		check(errors.length === 0, 'no console errors', errors.join(' | '));
		await context.close();
	}
	// 4. The GPU takes the context away in flight, and gives it back.
	{
		const { context, page, errors } = await openPage(browser, size);
		await sky(page);
		const before = await mean(await page.screenshot());
		const lost = await page.evaluate(() => {
			const c = document.getElementById('sky-canvas');
			const gl = c.getContext('webgl2') || c.getContext('webgl');
			const ext = gl?.getExtension('WEBGL_lose_context');
			if (!ext) return false;
			window.__lose = ext;
			ext.loseContext();
			return true;
		});
		await sleep(800);
		const during = await mean(await page.screenshot());
		const menuWorks = await page.evaluate(() => { document.querySelector('.chrome-bars').click(); const open = document.querySelector('#chrome-menu').matches(':popover-open'); document.querySelector('#chrome-menu').hidePopover(); return open; });
		await page.evaluate(() => window.__lose?.restoreContext());
		await sleep(1500);
		await page.keyboard.press('PageDown');
		await sleep(3500);
		const after = await mean(await page.screenshot({ path: path.join(SHOTS, `probe-${name}-context-restored.png`) }));
		note(`context lost by script: ${lost}; mean luminance before ${before.toFixed(2)}, while lost ${during.toFixed(2)}, after it came back and a flight to the next figure ${after.toFixed(2)}`);
		check(lost && menuWorks, 'with the context lost the menu still opens');
		check(after > before * 0.4, 'the context restored: the sky is drawn again', `${after.toFixed(2)} vs ${before.toFixed(2)}`);
		// The way down still works after a loss.
		await page.evaluate(() => window.__cellestial.director.go('build'));
		const s = await settle(page, 2500);
		check(s.scene === 'roots', 'and the Roots are still reachable', JSON.stringify(s));
		note(`console: ${errors.map((e) => e.slice(0, 120)).join(' | ') || 'none'}`);
		await context.close();
	}
	// 5. Back and forward from the Roots, and from an open dialog.
	{
		const { context, page, errors } = await openPage(browser, size);
		await sky(page);
		await page.evaluate(() => window.__cellestial.director.go('build'));
		await settle(page, 2000);
		await page.evaluate(() => window.scrollTo(0, 1200));
		await page.goto(`${BASE}/contact/`, { waitUntil: 'load' });
		await page.goBack({ waitUntil: 'load' });
		await sleep(5000);
		const s = await st(page);
		const m = await mean(await page.screenshot());
		note(`back from /contact to the home page: ${JSON.stringify(s)}, mean luminance ${m.toFixed(1)}`);
		check(['sky', 'roots', 'loading'].includes(s.scene) && (s.scene !== 'sky' || s.y === 0), 'back from /contact: the page is in one scene with its scroll model whole', JSON.stringify(s));
		const real = errors.filter((e) => !/Blocked script execution/.test(e));
		check(real.length === 0, 'no console errors', real.join(' | '));
		await context.close();
	}
}
await browser.close();
process.exit(tally() ? 1 : 0);
