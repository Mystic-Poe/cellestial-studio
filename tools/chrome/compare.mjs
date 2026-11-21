#!/usr/bin/env node
// The chrome (C1 to C3): sheets to be LOOKED AT, and its behaviour in checks.
//
//   node tools/chrome/compare.mjs [--url http://localhost:4500] [--only sheets,checks]
//
// Needs the dev server running (see PROGRESS.md). Runs on the real page at
// 1440x900 and 390x844 (scale 2, touch), and 320x568 for the open menu.
// Writes into refs/chrome/compare/ (JPEG, 1600 px at most):
//
//   closed.jpg   the top-left corner, closed, over the black sky and over soil
//   logo.jpg     the logo enlarged, between A1_c-emblem_unlit.jpg and
//                A1_c-emblem_lit.jpg: it must sit visibly between them
//   bars.jpg     the three bars enlarged: at rest, under the pointer, with
//                keyboard focus, pressed, and with the menu open
//   menu.jpg     the menu open, over the sky and over soil, three widths, and
//                on the page without script
//   measure.txt  the checks: "ok" or "FAIL", one line each
//
// Exits non-zero if a check failed or the page logged an error.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch, openPage, ROOT, sharp, sheet, shot } from '../roots/lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'sheets,checks' },
	},
});
const only = new Set(values.only.split(','));
const OUT = join(ROOT, 'refs/chrome/compare');
mkdirSync(OUT, { recursive: true });
const NOISE = /sandboxed and the 'allow-scripts'|turnstile|challenges\.cloudflare|Failed to load resource/i;
const WORDS = ['The Sky', 'What we build', 'Claim your star', 'Contact me'];
const BUTTON = '#chrome button[popovertarget]';

const lines = [];
let failed = 0;
let bad = 0;
const check = (ok, what) => {
	if (!ok) failed++;
	const line = `${ok ? 'ok  ' : 'FAIL'} ${what}`;
	console.log(line);
	lines.push(line);
};

const browser = await launch({ gpu: true });
async function open(size, scene, opts = {}) {
	const o = await openPage(browser, size, null, opts.context);
	await o.page.addInitScript(() => sessionStorage.setItem('cellestial:round', '1'));
	await o.page.goto(`${values.url}/?scene=${scene}${opts.query ?? '&debug'}`, { waitUntil: 'load' });
	if (!opts.raw) {
		await o.page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.fx);
		await o.page.evaluate(() => window.__cellestial.sky.ready);
	}
	await o.page.evaluate(() => document.fonts.ready);
	await o.page.waitForTimeout(1300);
	return o;
}
const close = async (o) => {
	bad += o.errors.filter((e) => !NOISE.test(e)).length;
	await o.context.close();
};
const enlarge = async (img, k) => {
	const meta = await sharp(img).metadata();
	return sharp(img).resize({ width: Math.round(meta.width * k), kernel: 'cubic' }).png().toBuffer();
};
const box = (page, selector) =>
	page.evaluate((s) => {
		const r = document.querySelector(s).getBoundingClientRect();
		return { x: r.x, y: r.y, width: r.width, height: r.height };
	}, selector);
const pad = (b, p) => ({ x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), width: b.width + 2 * p, height: b.height + 2 * p });

if (only.has('sheets')) {
	// closed.jpg
	{
		const cells = [];
		for (const size of ['desk', 'phone']) {
			for (const scene of ['sky', 'roots']) {
				const o = await open(size, scene);
				const clip = size === 'desk' ? { x: 0, y: 0, width: 480, height: 300 } : { x: 0, y: 0, width: 390, height: 244 };
				cells.push({
					img: await shot(o.page, clip),
					label: `${size}, over ${scene === 'sky' ? 'the sky' : 'soil'}: the top-left ${clip.width}x${clip.height} px`,
				});
				await close(o);
			}
		}
		await sheet(join(OUT, 'closed.jpg'), cells, { cols: 2, cellW: 780, cellH: 488 });
	}
	// logo.jpg
	{
		// The emblem alone, cut from the picture at the same framing as the logo.
		const a1 = async (name) => {
			const file = join(ROOT, `cellestial-assets/images/a-loading/${name}`);
			const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
			let [x0, y0, x1, y1] = [info.width, info.height, 0, 0];
			for (let y = 0; y < info.height; y++) {
				for (let x = 0; x < info.width; x++) {
					if (data[y * info.width + x] < 40) continue;
					if (x < x0) x0 = x;
					if (x > x1) x1 = x;
					if (y < y0) y0 = y;
					if (y > y1) y1 = y;
				}
			}
			const m = 30;
			return sharp(file)
				.extract({ left: Math.max(0, x0 - m), top: Math.max(0, y0 - m), width: Math.min(info.width, x1 + m) - Math.max(0, x0 - m), height: Math.min(info.height, y1 + m) - Math.max(0, y0 - m) })
				.resize({ height: 420 })
				.png()
				.toBuffer();
		};
		const cells = [{ img: await a1('A1_c-emblem_unlit.jpg'), label: 'A1_c-emblem_unlit.jpg' }];
		for (const size of ['phone', 'desk']) {
			const o = await open(size, 'sky');
			// Freeze the breathing at its middle, so the two sizes show the same moment.
			await o.page.addStyleTag({ content: '.chrome-emblem::after{animation:none!important;opacity:.4!important}' });
			const b = pad(await box(o.page, '#chrome .chrome-logo'), 6);
			cells.push({
				img: await enlarge(await shot(o.page, b), size === 'phone' ? 3.5 : 7),
				label: `the logo, ${size} (${Math.round(b.width - 12)}x${Math.round(b.height - 12)} px), enlarged`,
				enlarge: true,
			});
			await close(o);
		}
		cells.push({ img: await a1('A1_c-emblem_lit.jpg'), label: 'A1_c-emblem_lit.jpg' });
		await sheet(join(OUT, 'logo.jpg'), cells, { cols: 4, cellW: 390, cellH: 520 });
	}
	// bars.jpg
	{
		const cells = [];
		for (const size of ['phone', 'desk']) {
			const k = size === 'phone' ? 5 : 10;
			const o = await open(size, 'sky');
			const b = pad(await box(o.page, BUTTON), 4);
			const snap = async (label) => cells.push({ img: await enlarge(await shot(o.page, b), k), label: `${size}: ${label}`, enlarge: true });
			await snap('at rest');
			await o.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
			await o.page.waitForTimeout(250);
			await snap('under the pointer');
			await o.page.mouse.down();
			await o.page.waitForTimeout(250);
			await snap('pressed');
			await o.page.mouse.move(700, 600);
			await o.page.mouse.up();
			// Onto the button by keyboard: back one stop, forward one.
			await o.page.focus(BUTTON);
			await o.page.keyboard.press('Shift+Tab');
			await o.page.keyboard.press('Tab');
			if (!(await o.page.evaluate((s) => document.activeElement === document.querySelector(s) && document.activeElement.matches(':focus-visible'), BUTTON))) {
				throw new Error('the button did not take keyboard focus');
			}
			await o.page.waitForTimeout(250);
			await snap('keyboard focus');
			await o.page.keyboard.press('Enter');
			await o.page.waitForTimeout(400);
			await snap('menu open');
			await close(o);
		}
		await sheet(join(OUT, 'bars.jpg'), cells, { cols: 5, cellW: 300, cellH: 300 });
	}
	// menu.jpg
	{
		const cells = [];
		for (const [size, scene] of [['desk', 'sky'], ['desk', 'roots'], ['phone', 'sky'], ['phone', 'roots'], ['narrow', 'roots']]) {
			const o = await open(size, scene);
			await o.page.click(BUTTON);
			await o.page.waitForTimeout(450);
			const clip = size === 'desk' ? { x: 0, y: 0, width: 520, height: 400 } : size === 'phone' ? { x: 0, y: 0, width: 390, height: 300 } : { x: 0, y: 0, width: 320, height: 300 };
			cells.push({ img: await shot(o.page, clip), label: `${size}, over ${scene === 'sky' ? 'the sky' : 'soil'}: the top-left ${clip.width}x${clip.height} px` });
			await close(o);
		}
		const o = await openPage(browser, 'phone', null, { javaScriptEnabled: false });
		await o.page.goto(`${values.url}/`, { waitUntil: 'load' });
		await o.page.waitForTimeout(600);
		await o.page.click(BUTTON);
		await o.page.waitForTimeout(450);
		cells.push({ img: await shot(o.page, { x: 0, y: 0, width: 390, height: 300 }), label: 'phone, script off: the button still opens it' });
		await close(o);
		await sheet(join(OUT, 'menu.jpg'), cells, { cols: 3, cellW: 520, cellH: 400 });
	}
}

if (only.has('checks')) {
	for (const size of ['desk', 'phone']) {
		const tag = `${size}:`;
		// The markup and the sizes.
		let o = await open(size, 'sky');
		const m = await o.page.evaluate((BUTTON) => {
			const chrome = document.getElementById('chrome');
			const logo = chrome.querySelector('.chrome-logo');
			const button = document.querySelector(BUTTON);
			const r = (el) => el.getBoundingClientRect();
			const visible = [];
			const walk = document.createTreeWalker(chrome, NodeFilter.SHOW_TEXT);
			while (walk.nextNode()) {
				const t = walk.currentNode.textContent.trim();
				if (t) visible.push(t);
			}
			return {
				first: document.body.firstElementChild === chrome || document.body.querySelector(':scope > :not(a[href="#main"])') === chrome,
				words: visible,
				logoName: logo.getAttribute('aria-label'),
				logoHref: logo.getAttribute('href'),
				imgAlt: logo.querySelector('img').getAttribute('alt'),
				links: chrome.querySelectorAll('a').length,
				buttons: chrome.querySelectorAll('button').length,
				buttonName: button.getAttribute('aria-label'),
				expanded: button.getAttribute('aria-expanded'),
				button: { w: r(button).width, h: r(button).height },
				whole: { right: Math.max(r(logo).right, r(button).right), bottom: Math.max(r(logo).bottom, r(button).bottom) },
				studio: getComputedStyle(chrome.querySelector('.chrome-studio')).fontFamily.split(',')[0],
				studioPx: getComputedStyle(chrome.querySelector('.chrome-studio')).fontSize,
				items: [...chrome.querySelectorAll('#chrome-menu a')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), dest: a.dataset.dest })),
				z: getComputedStyle(chrome).zIndex,
				pe: getComputedStyle(chrome).pointerEvents,
				images: [...chrome.querySelectorAll('img')].map((i) => new URL(i.src).pathname),
			};
		}, BUTTON);
		check(JSON.stringify(m.words) === JSON.stringify(['studio', ...WORDS]), `${tag} the only words in the chrome are "studio" and the four items, in order (${m.words.join(' / ')})`);
		check(m.logoName === 'Cellestial studio' && m.logoHref === '/' && m.imgAlt === '' && m.links === 5, `${tag} the logo is one link named "${m.logoName}" to "${m.logoHref}"; five links in all`);
		check(m.buttons === 1 && m.buttonName === 'Menu' && m.expanded === 'false', `${tag} one button, named "${m.buttonName}", aria-expanded ${m.expanded}`);
		check(m.button.w >= 44 && m.button.h >= 44, `${tag} the button's hit area is ${m.button.w}x${m.button.h} px`);
		check(size === 'desk' || (m.whole.right <= 140 && m.whole.bottom <= 84), `${tag} the logo and the button end at ${Math.round(m.whole.right)}, ${Math.round(m.whole.bottom)} px from the corner`);
		check(/Quicksand/i.test(m.studio), `${tag} "studio" is set in ${m.studio}, ${m.studioPx}`);
		check(JSON.stringify(m.items.map((i) => i.href)) === JSON.stringify(['/', '#roots', '/contact', '/contact']), `${tag} the items are links to ${m.items.map((i) => i.href).join(', ')}`);
		check(m.z === '40' && m.pe === 'none', `${tag} the header is at z-index ${m.z} and takes no pointer events itself`);
		check(m.images.every((p) => p.startsWith('/cellestial/')), `${tag} its one picture is ${m.images.join(', ')}`);

		// What the menu asks of the director.
		await o.page.evaluate(() => {
			const d = window.__cellestial.director;
			window.__calls = [];
			d.go = (dest) => {
				window.__calls.push(dest);
				return Promise.resolve();
			};
		});
		for (const [i, dest] of ['sky', 'build', 'claim', 'contact'].entries()) {
			await o.page.click(BUTTON);
			await o.page.waitForTimeout(300);
			const state = await o.page.evaluate((BUTTON) => ({
				open: document.querySelector('#chrome-menu').matches(':popover-open'),
				expanded: document.querySelector(BUTTON).getAttribute('aria-expanded'),
				focus: document.activeElement?.textContent?.trim(),
			}), BUTTON);
			if (i === 0) check(state.open && state.expanded === 'true' && state.focus === WORDS[0], `${tag} a click opens the menu: aria-expanded ${state.expanded}, focus on "${state.focus}"`);
			if (i === 0) {
				const heights = await o.page.evaluate(() => [...document.querySelectorAll('#chrome-menu a')].map((a) => a.getBoundingClientRect().height));
				const fits = await o.page.evaluate(() => {
					const r = document.querySelector('#chrome-menu').getBoundingClientRect();
					return r.left >= 0 && r.right <= innerWidth && r.top >= 0;
				});
				check(heights.every((h) => h >= 44) && fits, `${tag} each item is ${heights.join(', ')} px tall and the panel is whole on screen`);
			}
			await o.page.click(`#chrome [data-dest="${dest}"]`);
			await o.page.waitForTimeout(250);
		}
		let after = await o.page.evaluate((BUTTON) => ({
			calls: window.__calls,
			open: document.querySelector('#chrome-menu').matches(':popover-open'),
			expanded: document.querySelector(BUTTON).getAttribute('aria-expanded'),
			focusOnButton: document.activeElement === document.querySelector(BUTTON),
		}), BUTTON);
		check(JSON.stringify(after.calls) === JSON.stringify(['sky', 'build', 'claim', 'contact']), `${tag} the four items asked the director for ${after.calls.join(', ')}: once each`);
		check(!after.open && after.expanded === 'false' && after.focusOnButton, `${tag} choosing an item closes the menu and returns focus to the button`);
		await o.page.click('#chrome .chrome-logo');
		await o.page.waitForTimeout(150);
		after = await o.page.evaluate(() => ({ calls: window.__calls, url: location.pathname + location.search }));
		check(after.calls.length === 5 && after.calls[4] === 'sky' && after.url.startsWith('/?scene=sky'), `${tag} the logo asks for the sky and does not navigate`);
		await close(o);

		// Keyboard, Escape, a click outside.
		o = await open(size, 'roots');
		const order = [];
		for (let i = 0; i < 4; i++) {
			await o.page.keyboard.press('Tab');
			order.push(await o.page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim().slice(0, 20)));
		}
		const iLogo = order.indexOf('Cellestial studio');
		check(iLogo >= 0 && iLogo <= 1 && order[iLogo + 1] === 'Menu', `${tag} Tab reaches ${order.slice(0, iLogo + 2).join(', then ')}`);
		// Focus is on something after the button now; go back to it.
		await o.page.focus(BUTTON);
		await o.page.keyboard.press('Enter');
		await o.page.waitForTimeout(300);
		let k = await o.page.evaluate(() => ({ open: document.querySelector('#chrome-menu').matches(':popover-open'), focus: document.activeElement?.textContent?.trim() }));
		check(k.open && k.focus === WORDS[0], `${tag} Enter on the button opens the menu and focus goes to "${k.focus}"`);
		const tabbed = [];
		for (let i = 0; i < 3; i++) {
			await o.page.keyboard.press('Tab');
			tabbed.push(await o.page.evaluate(() => document.activeElement?.textContent?.trim()));
		}
		check(JSON.stringify(tabbed) === JSON.stringify(WORDS.slice(1)), `${tag} Tab walks the items: ${tabbed.join(', ')}`);
		await o.page.keyboard.press('Escape');
		await o.page.waitForTimeout(300);
		k = await o.page.evaluate((BUTTON) => ({ open: document.querySelector('#chrome-menu').matches(':popover-open'), back: document.activeElement === document.querySelector(BUTTON), expanded: document.querySelector(BUTTON).getAttribute('aria-expanded') }), BUTTON);
		check(!k.open && k.back && k.expanded === 'false', `${tag} Escape closes it and focus is back on the button`);
		await o.page.click(BUTTON);
		await o.page.waitForTimeout(300);
		if (size === 'phone') await o.page.touchscreen.tap(300, 600);
		else await o.page.mouse.click(900, 600);
		await o.page.waitForTimeout(300);
		k = await o.page.evaluate((BUTTON) => ({ open: document.querySelector('#chrome-menu').matches(':popover-open'), expanded: document.querySelector(BUTTON).getAttribute('aria-expanded'), scene: document.documentElement.dataset.scene }), BUTTON);
		check(!k.open && k.expanded === 'false' && k.scene === 'roots', `${tag} a ${size === 'phone' ? 'tap' : 'click'} outside closes it`);
		await close(o);

		// Hidden while loading, there after.
		o = await open(size, 'loading', { query: '&t=3&debug', raw: true });
		const hidden = await o.page.evaluate(() => {
			const c = document.getElementById('chrome');
			const s = getComputedStyle(c);
			document.querySelector('#chrome .chrome-logo').focus();
			return { scene: document.documentElement.dataset.scene, visibility: s.visibility, opacity: s.opacity, focusable: document.activeElement !== document.body };
		});
		check(hidden.scene === 'loading' && hidden.visibility === 'hidden' && hidden.opacity === '0' && !hidden.focusable, `${tag} while the scene is "loading" the chrome is hidden and cannot take focus`);
		await close(o);
		o = await openPage(browser, size, null);
		await o.page.goto(`${values.url}/?debug`, { waitUntil: 'load' });
		await o.page.waitForFunction(() => window.__cellestial?.loader);
		const fade = await o.page.evaluate(async () => {
			const c = document.getElementById('chrome');
			const before = getComputedStyle(c).visibility;
			window.__cellestial.loader.skip();
			await new Promise((resolve) => document.addEventListener('cellestial:scene', resolve, { once: true }));
			const t0 = performance.now();
			const seen = [];
			while (performance.now() - t0 < 700) {
				seen.push([Math.round(performance.now() - t0), Number(getComputedStyle(c).opacity)]);
				await new Promise((r) => requestAnimationFrame(r));
			}
			const full = seen.find(([, v]) => v >= 0.999);
			const mid = seen.filter(([, v]) => v > 0.02 && v < 0.98).length;
			return { before, vis: getComputedStyle(c).visibility, fullAt: full?.[0], mid };
		});
		check(fade.before === 'hidden' && fade.vis === 'visible' && fade.mid > 5 && fade.fullAt >= 300 && fade.fullAt <= 520, `${tag} when the loader ends the chrome fades in: fully there ${fade.fullAt} ms after the scene changes (${fade.mid} frames in between)`);
		await close(o);

		// Reduced motion: nothing moves.
		o = await open(size, 'sky', { query: '&rm=1&debug' });
		const still = await o.page.evaluate(() => {
			const c = document.getElementById('chrome');
			return {
				breathe: getComputedStyle(c.querySelector('.chrome-emblem'), '::after').animationName,
				fade: getComputedStyle(c).transitionDuration,
				menu: getComputedStyle(c.querySelector('#chrome-menu')).transitionDuration,
			};
		});
		check(still.breathe === 'none' && still.fade === '0s' && /^0s/.test(still.menu), `${tag} reduced motion: no breathing (${still.breathe}), no fade (${still.fade}), no drop (${still.menu})`);
		await close(o);

		// The page without script.
		o = await openPage(browser, size, null, { javaScriptEnabled: false });
		await o.page.goto(`${values.url}/`, { waitUntil: 'load' });
		await o.page.waitForTimeout(500);
		await o.page.click(BUTTON);
		await o.page.waitForTimeout(400);
		const menuBox = await o.page.locator('#chrome-menu').boundingBox();
		const hrefs = await o.page.locator('#chrome-menu a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
		const texts = await o.page.locator('#chrome-menu a').allTextContents();
		const pos = await o.page.locator('#chrome').evaluate((c) => getComputedStyle(c).position);
		check(menuBox && menuBox.height > 150 && JSON.stringify(texts.map((t) => t.trim())) === JSON.stringify(WORDS) && JSON.stringify(hrefs) === JSON.stringify(['/', '#roots', '/contact', '/contact']), `${tag} with script off the button opens the menu (${Math.round(menuBox?.width)}x${Math.round(menuBox?.height)} px) and its links go to ${hrefs.join(', ')}`);
		await o.page.click('#chrome [data-dest="claim"]');
		await o.page.waitForLoadState('load');
		check(new URL(o.page.url()).pathname.replace(/\/$/, '') === '/contact' && pos === 'absolute', `${tag} with script off "Claim your star" goes to ${new URL(o.page.url()).pathname}; the chrome heads the page (position ${pos})`);
		await close(o);
	}
	writeFileSync(join(OUT, 'measure.txt'), `${lines.join('\n')}\n`);
	console.log(`${lines.length} checks, ${failed} failed, ${bad} page error(s)`);
}

await browser.close();
if (failed || bad) process.exit(1);
