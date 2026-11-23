// After publishing: one visitor's pass over the LIVE site at the owner's two sizes. Nothing is sent.
// node live-browse.mjs <out dir>
import { chromium } from '/home/poe/cellestial-studio/node_modules/playwright-core/index.mjs';

const out = process.argv[2];
const base = 'https://cellestialstudio.com';
const browser = await chromium.launch({
	executablePath: '/usr/bin/chromium',
	args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'],
});
const sizes = [
	['desk', { width: 1440, height: 900 }, false],
	['phone', { width: 390, height: 844 }, true],
];
const lines = [];
const say = (s) => {
	lines.push(s);
	console.log(s);
};
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 80 });
const scene = (page) => page.evaluate(() => document.documentElement.dataset.scene ?? '(none)');

for (const [name, viewport, mobile] of sizes) {
	const ctx = await browser.newContext({
		viewport,
		deviceScaleFactor: mobile ? 2 : 1,
		isMobile: mobile,
		hasTouch: mobile,
		userAgent: mobile
			? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
			: undefined,
	});
	const page = await ctx.newPage();
	const errors = [];
	const posts = [];
	page.on('console', (m) => {
		if (m.type() === 'error') errors.push(m.text().slice(0, 160));
	});
	page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 160)}`));
	page.on('request', (r) => {
		if (r.method() === 'POST' && r.url().includes('/api/')) posts.push(r.url());
	});
	const tap = (x, y) => (mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
	try {
		// 1. first visit: the loader, then the sky
		const t0 = Date.now();
		await page.goto(`${base}/`, { waitUntil: 'commit' });
		await page.waitForTimeout(3000);
		await shot(page, `${name}-1-loader`);
		say(`${name}: scene at 3 s: ${await scene(page)}`);
		await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 15000 });
		say(`${name}: the sky ${((Date.now() - t0) / 1000).toFixed(1)} s after navigation`);
		await page.waitForTimeout(2500);
		await shot(page, `${name}-2-sky`);
		const stars = await page.locator('button.sky-star').count();
		say(`${name}: star buttons in the page: ${stars}; logo ${await page.locator('.chrome-logo').isVisible()}, menu button ${await page.locator('.chrome-bars').isVisible()}`);

		// 2. a tap beside an empty star: the beads, "claim yours", then its panel and the request form
		const boxes = await page.evaluate(() =>
			[...document.querySelectorAll('button.sky-star')]
				.map((b) => {
					const r = b.getBoundingClientRect();
					return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, id: b.dataset.slot ?? b.id ?? '' };
				})
				.filter((b) => b.w > 8 && b.x > 60 && b.x < innerWidth - 60 && b.y > 140 && b.y < innerHeight - 160),
		);
		const star = boxes[Math.floor(boxes.length / 2)];
		say(`${name}: stars on screen ${boxes.length}; touching the sky beside one at ${Math.round(star.x)},${Math.round(star.y)}`);
		await tap(star.x + 26, star.y + 30);
		await page.waitForFunction(() => {
			const w = document.querySelector('[data-claim-words]');
			return w && !w.hidden;
		}, null, { timeout: 6000 });
		await page.waitForTimeout(700);
		await shot(page, `${name}-3-claim-yours`);
		const words = await page.locator('[data-claim-words]').boundingBox();
		say(`${name}: "claim yours" written at ${Math.round(words.x)},${Math.round(words.y)}`);
		await tap(words.x + words.width / 2, words.y + words.height / 2);
		await page.locator('#sky-claim-star').waitFor({ state: 'visible', timeout: 5000 });
		await page.waitForTimeout(500);
		await shot(page, `${name}-4-star-panel`);
		await page.locator('#sky-claim-star').click();
		await page.locator('#claim-dialog[open]').waitFor({ state: 'visible', timeout: 5000 });
		await page.waitForTimeout(3500);
		await shot(page, `${name}-5-claim-form`);
		const form = await page.evaluate(() => {
			const f = document.querySelector('#claim-form');
			const names = [...f.elements].map((e) => e.name).filter(Boolean);
			const frame = f.querySelector('iframe');
			return {
				action: f.getAttribute('action'),
				method: f.method,
				names: [...new Set(names)],
				star: f.elements.star?.value ?? null,
				turnstile: frame ? new URL(frame.src).host : document.querySelector('.cf-turnstile, [data-sitekey]') ? 'widget holder present' : 'none',
			};
		});
		say(`${name}: the request form: ${JSON.stringify(form)}`);
		await page.locator('[data-claim-close]').click();
		await page.waitForTimeout(600);

		// 3. the menu teleports to the roots
		await page.locator('.chrome-bars').click();
		await page.waitForTimeout(500);
		await shot(page, `${name}-6-menu`);
		const items = await page.locator('#chrome-menu a').allInnerTexts();
		say(`${name}: the menu: ${items.map((s) => s.trim()).join(' | ')}`);
		await page.locator('#chrome-menu a[data-dest="build"]').click();
		await page.waitForFunction(() => document.documentElement.dataset.scene === 'roots', null, { timeout: 8000 });
		await page.waitForTimeout(2500);
		await shot(page, `${name}-7-roots`);
		say(`${name}: after the menu's second item the scene is ${await scene(page)}`);

		// 4. the contact page with the real spam check
		await page.goto(`${base}/contact/`, { waitUntil: 'load' });
		await page.waitForTimeout(4000);
		await shot(page, `${name}-8-contact`);
		say(`${name}: /contact/: spam-check frame from ${await page.evaluate(() => {
			const f = document.querySelector('iframe');
			return f ? new URL(f.src).host : 'no frame';
		})}`);

		// 5. /start: the builder makes a link, and the link resolves (in person: no emails)
		await page.goto(`${base}/start/new/`, { waitUntil: 'load' });
		await page.fill('input[name="name"]', 'Example Bakery');
		await page.fill('input[name="email"]', 'owner@example.com');
		await page.fill('input[name="domain"]', 'example.com');
		await page.waitForTimeout(600);
		const href = await page.evaluate(() => document.querySelector('[data-link]')?.href ?? '');
		say(`${name}: /start/new/ made a link: ${href.replace(/#.*/, '#…')} (${href.split('#')[1]?.length ?? 0} characters after the #)`);
		await shot(page, `${name}-9-start-new`);
		await page.goto(href, { waitUntil: 'load' });
		await page.waitForTimeout(1200);
		const text = await page.evaluate(() => document.body.innerText);
		say(`${name}: the link opens: names the business ${text.includes('Example Bakery')}, names the domain ${text.includes('example.com')}, "incomplete" ${/incomplete/i.test(text)}`);
		await shot(page, `${name}-10-start-link`);
	} catch (e) {
		say(`${name}: STOPPED: ${String(e).slice(0, 300)}`);
		await shot(page, `${name}-stopped`).catch(() => {});
	}
	say(`${name}: POSTs made to /api/: ${posts.length}; console errors: ${errors.length}${errors.length ? `: ${errors.slice(0, 4).join(' || ')}` : ''}`);
	await ctx.close();
}
await browser.close();
