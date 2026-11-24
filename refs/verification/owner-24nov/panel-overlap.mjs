// Every empty star at every station: open its panel (as a tap on it does) and measure the panel
// against the exit button ("See what holds up the sky"), shown as it is after one full round.
//   node overlap.mjs <base> <out dir> [shots]
import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';
const [, , base = 'http://localhost:4500', out, shots = ''] = process.argv;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'] });
const sizes = { desk: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, short: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
let total = 0;
for (const [name, opts] of Object.entries(sizes)) {
	const ctx = await browser.newContext(opts);
	await ctx.addInitScript(() => { try { sessionStorage.setItem('cellestial:round', '1'); } catch {} });
	const page = await ctx.newPage();
	await page.goto(`${base}/?scene=sky&debug&rm=1`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.sky?.debug, null, { timeout: 20000 });
	await page.waitForTimeout(2000);
	const bad = [];
	let n = 0;
	for (let k = 0; k < 12; k++) {
		await page.evaluate((k) => { const d = window.__cellestial.sky.debug; d.setCoord(k); d.drawNow?.(); }, k);
		await page.waitForTimeout(250);
		const slots = await page.evaluate(() => [...document.querySelectorAll('button.sky-star:not([hidden])')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 4 && r.x > 0 && r.y > 0 && r.right < innerWidth && r.bottom < innerHeight; }).map((b) => b.dataset.slot));
		for (const slot of slots) {
			const r = await page.evaluate((slot) => {
				const sky = window.__cellestial.sky;
				if (window.__cellestial.claims.isLit(slot)) return null;
				sky.hooks.pick(slot);
				const p = document.querySelector('[data-sky-panel="empty"]');
				if (!p || p.hidden) return { none: true };
				const pr = p.getBoundingClientRect();
				const ex = document.querySelector('[data-descend]');
				const er = ex && !ex.hidden ? ex.getBoundingClientRect() : null;
				const btn = p.querySelector('.brass-btn').getBoundingClientRect();
				const ov = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
				const res = { panel: [pr.left, pr.top, pr.right, pr.bottom].map(Math.round), exitShown: !!er, over: er ? Math.round(ov(pr, er)) : 0, onButton: er ? Math.round(ov(btn, er)) : 0, gap: er ? Math.round(er.top - pr.bottom) : null };
				document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
				sky.hooks.pick && null;
				return res;
			}, slot);
			await page.keyboard.press('Escape');
			if (!r || r.none) continue;
			n++;
			if (r.over > 0) bad.push({ k, slot, ...r });
		}
	}
	total += bad.length;
	console.log(`${name}: ${n} panels opened, exit button shown: yes; panels the button covers: ${bad.length}; on the "Claim your star" button itself: ${bad.filter((b) => b.onButton > 0).length}`);
	for (const b of bad.slice(0, 6)) console.log(`   station ${b.k} ${b.slot}: panel ${b.panel}, ${b.over} px² under the button (${b.onButton} px² of "Claim your star"), gap ${b.gap}`);
	if (shots && bad.length) {
		const b = bad.find((x) => x.onButton > 0) ?? bad[0];
		await page.evaluate((k) => { const d = window.__cellestial.sky.debug; d.setCoord(k); d.drawNow?.(); }, b.k);
		await page.waitForTimeout(300);
		await page.evaluate((slot) => window.__cellestial.sky.hooks.pick(slot), b.slot);
		await page.waitForTimeout(400);
		await page.screenshot({ path: `${out}/${shots}-${name}.jpg`, type: 'jpeg', quality: 82 });
	}
	await ctx.close();
}
await browser.close();
console.log('TOTAL covered', total);
