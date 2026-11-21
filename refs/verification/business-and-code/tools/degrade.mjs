// What the home page is when things are missing: no WebGL, no JavaScript, a script
// that never arrives, reduced motion. Production build.
// Run: node refs/verification/business-and-code/tools/degrade.mjs
import path from 'node:path';
import sharp from 'sharp';
import { OFFERS, offerText } from '../../../../src/content/offers.ts';
import { BASE, check, DESK, launch, note, openPage, PHONE, SHOTS, sleep, tally } from './lib.mjs';

const SIZES = [['desk', DESK], ['phone', PHONE]];

/** Mean luminance (0..255) and share of pure-black pixels of a PNG buffer. */
async function light(buf) {
	const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	let sum = 0;
	let black = 0;
	const n = info.width * info.height;
	for (let i = 0; i < data.length; i += 3) {
		const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
		sum += l;
		if (l < 2) black++;
	}
	return { mean: sum / n, black: black / n };
}

/** What can be read on the page as it stands. */
const readable = (page) =>
	page.evaluate(() => {
		const seen = (el) => {
			if (!el) return false;
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
		};
		const tiles = [...document.querySelectorAll('#roots .panel')].map((p) => ({
			seen: seen(p),
			title: p.querySelector('.panel__title')?.textContent.trim(),
			text: p.innerText.replace(/\s+/g, ' ').trim(),
			top: Math.round(p.getBoundingClientRect().top + scrollY),
			left: Math.round(p.getBoundingClientRect().left),
			right: Math.round(p.getBoundingClientRect().right),
		}));
		const links = [...document.querySelectorAll('#roots a[href]')].filter(seen).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') }));
		return {
			scene: document.documentElement.dataset.scene ?? null,
			noSky: 'noSky' in document.documentElement.dataset,
			motion: document.documentElement.dataset.motion ?? null,
			logo: seen(document.querySelector('.chrome-logo img')),
			logoNatural: document.querySelector('.chrome-logo img')?.naturalWidth ?? 0,
			menuButton: seen(document.querySelector('.chrome-bars')),
			loader: seen(document.querySelector('#loader')),
			skyCanvas: seen(document.querySelector('#sky-canvas')),
			descend: seen(document.querySelector('[data-descend]')),
			ascend: seen(document.querySelector('[data-ascend]')),
			tiles,
			links,
			scrollW: document.documentElement.scrollWidth,
			innerW: innerWidth,
			scrollH: document.documentElement.scrollHeight,
		};
	});

function judgeRoots(r, label) {
	// innerText includes the visually hidden word "slashed", so this is the addendum's own text.
	const squash = (t) => t.replace(/\s+/g, '');
	const want = OFFERS.map((o) => squash(`${o.title} ${offerText(o)}`));
	const got = r.tiles.map((t) => squash(t.text));
	check(r.tiles.length === 5 && r.tiles.every((t) => t.seen), `${label}: five tiles on the page, all visible`);
	check(JSON.stringify(r.tiles.map((t) => t.title)) === JSON.stringify(OFFERS.map((o) => o.title)), `${label}: in the spec's order`, r.tiles.map((t) => t.title).join(' / '));
	check(got.every((g, i) => g === want[i]), `${label}: each tile's text is the addendum's, character for character (spaces apart)`, got.map((g, i) => (g === want[i] ? 'same' : `DIFF: ${g.slice(0, 80)}…`)).join(' | '));
	check(r.tiles.every((t, i) => i === 0 || t.top > r.tiles[i - 1].top), `${label}: one under another`);
	check(r.scrollW <= r.innerW + 1, `${label}: no sideways scroll`, `${r.scrollW} vs ${r.innerW}`);
	check(r.links.length === 2 && r.links.every((l) => l.href === '/contact'), `${label}: two links to /contact`, JSON.stringify(r.links));
	check(r.logo && r.logoNatural > 0, `${label}: the logo is there`);
}

// ───────────────────────────────────────────────────────── no WebGL ──
{
	console.log('\n# WebGL unavailable (--disable-gpu --disable-software-rasterizer)');
	const browser = await launch(['--disable-gpu', '--disable-software-rasterizer']);
	for (const [name, size] of SIZES) {
		for (const [what, url, reduced] of [['first visit, /', '/?debug', false], ['reduced motion, /', '/?debug', true], ['/?scene=sky', '/?scene=sky&debug', false]]) {
			const { context, page, errors } = await openPage(browser, size, { reduced });
			const t0 = Date.now();
			await page.goto(BASE + url, { waitUntil: 'load' });
			const gl = await page.evaluate(() => {
				const c = document.createElement('canvas');
				return { webgl2: Boolean(c.getContext('webgl2')), webgl: Boolean(c.getContext('webgl')) };
			});
			// Photograph it as it settles: nothing may be a black page for long.
			const trail = [];
			for (const at of [300, 1000, 2500, 5000, 9000, 13000]) {
				await sleep(Math.max(0, at - (Date.now() - t0)));
				const buf = await page.screenshot();
				const l = await light(buf);
				const scene = await page.evaluate(() => document.documentElement.dataset.scene ?? 'none');
				trail.push(`${(at / 1000).toFixed(1)}s ${scene} mean=${l.mean.toFixed(1)} black=${(l.black * 100).toFixed(0)}%`);
			}
			const label = `no WebGL, ${name}, ${what}`;
			note(`${label}: webgl=${JSON.stringify(gl)}; ${trail.join('; ')}`);
			const r = await readable(page);
			const shot = await page.screenshot({ path: path.join(SHOTS, `nogl-${name}-${what.replace(/[^a-z]+/gi, '-')}.png`) });
			const l = await light(shot);
			check(!gl.webgl2 && !gl.webgl, `${label}: WebGL really is unavailable`);
			check(r.scene === 'roots' && r.noSky, `${label}: the page became the Roots`, `scene=${r.scene} noSky=${r.noSky}`);
			check(l.mean > 6 && l.black < 0.6, `${label}: not a black page`, `mean luminance ${l.mean.toFixed(1)}, ${(l.black * 100).toFixed(0)}% black`);
			check(!r.loader && !r.descend, `${label}: no loader left over the page, no sky buttons`);
			check(!r.ascend, `${label}: no "Return to the sky" button leading nowhere`);
			// Open each tile and read it.
			const opened = [];
			for (let i = 0; i < 5; i++) {
				await page.evaluate((k) => document.querySelectorAll('#roots .roots-node__bulb, #roots button[aria-expanded]')[k]?.click(), i);
				await sleep(350);
				opened.push(await page.evaluate(() => {
					const open = [...document.querySelectorAll('#roots .panel')].filter((p) => {
						const cs = getComputedStyle(p);
						return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.5 && p.getBoundingClientRect().height > 0;
					});
					return open.map((p) => p.querySelector('.panel__title')?.textContent.trim());
				}));
			}
			note(`${label}: tiles open after pressing each node: ${JSON.stringify(opened)}`);
			check(opened.every((o, i) => o.includes(OFFERS[i].title)), `${label}: every node opens its tile`);
			const menu = await page.evaluate(() => {
				document.querySelector('.chrome-bars').click();
				return [...document.querySelectorAll('#chrome-menu a')].filter((a) => a.getBoundingClientRect().height > 0).map((a) => a.textContent.trim());
			});
			note(`${label}: menu offers ${JSON.stringify(menu)}`);
			note(`${label}: console: ${errors.length ? errors.map((e) => e.slice(0, 160)).join(' | ') : 'none'}`);
			await context.close();
		}
	}
	await browser.close();
}

const browser = await launch();

// ──────────────────────────────────────────────────────── no script ──
console.log('\n# JavaScript off');
for (const [name, size] of SIZES) {
	const { context, page } = await openPage(browser, size, { js: false });
	await page.goto(`${BASE}/`, { waitUntil: 'load' });
	await sleep(500);
	const r = await readable(page);
	const label = `no JS, ${name}`;
	check(r.scene === null, `${label}: no scene is set`);
	check(!r.loader && !r.skyCanvas && !r.descend && !r.ascend, `${label}: no loader, no sky canvas, no buttons that need script`);
	judgeRoots(r, label);
	const shot = await page.screenshot({ path: path.join(SHOTS, `nojs-${name}-top.png`) });
	const l = await light(shot);
	check(l.mean > 6, `${label}: the first screen is not black`, `mean ${l.mean.toFixed(1)}`);
	await page.screenshot({ path: path.join(SHOTS, `nojs-${name}-full.png`), fullPage: true });
	const nav = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => `${a.textContent.trim() || a.getAttribute('aria-label')} → ${a.getAttribute('href')}`));
	note(`${label}: every link in the document: ${JSON.stringify(nav)}`);
	// The two links really lead to the contact page.
	await page.click('#roots a[data-open-claim]');
	await page.waitForLoadState('load');
	check(new URL(page.url()).pathname.replace(/\/$/, '') === '/contact', `${label}: "Claim your star" leads to /contact`, page.url());
	await context.close();
}

// ─────────────────────────────── script on, but a chunk never arrives ──
console.log('\n# A script that never arrives');
for (const [what, pattern, expectScene] of [
	['the page script (first chunk) is blocked', /index\.astro_astro_type_script_index_0_lang\.[^/]+\.js$/, null],
	['the sky chunk is blocked', /\/sky\.[^/]+\.js$/, 'roots'],
	['the roots chunk is blocked', /\/roots\.[^/]+\.js$/, 'sky'],
	['the fx chunk is blocked', /\/fx\.[^/]+\.js$/, 'sky'],
]) {
	const { context, page, errors } = await openPage(browser, DESK);
	await context.route(pattern, (route) => route.abort());
	await page.goto(`${BASE}/?scene=sky`, { waitUntil: 'load' });
	await sleep(7000);
	const r = await readable(page);
	const shot = await page.screenshot({ path: path.join(SHOTS, `blocked-${what.replace(/[^a-z]+/gi, '-')}.png`) });
	const l = await light(shot);
	check(r.scene === expectScene, `${what}: scene is ${expectScene}`, `${r.scene}`);
	if (expectScene !== 'sky') check(l.mean > 6, `${what}: not a black page`, `mean ${l.mean.toFixed(1)}`);
	if (expectScene === null) judgeRoots(r, what);
	note(`${what}: console: ${errors.map((e) => e.slice(0, 140)).join(' | ') || 'none'}`);
	if (what.startsWith('the roots chunk')) {
		// Can the visitor still get to the offers?
		await page.evaluate(() => document.querySelector('.chrome-bars').click());
		await page.click('#chrome-menu a[data-dest="build"]');
		await sleep(2500);
		const after = await readable(page);
		check(after.scene === 'roots' && after.tiles.every((t) => t.seen), `${what}: the menu still reaches the Roots, tiles all readable`, `scene=${after.scene}`);
		await page.screenshot({ path: path.join(SHOTS, 'blocked-roots-after-menu.png') });
	}
	if (what.startsWith('the fx chunk')) {
		await page.evaluate(() => document.querySelector('.chrome-bars').click());
		await page.click('#chrome-menu a[data-dest="build"]');
		await sleep(6000);
		const after = await readable(page);
		check(after.scene === 'roots', `${what}: the menu still reaches the Roots (plain fade)`, `scene=${after.scene}`);
	}
	await context.close();
}

// ─────────────────────────────────────────────────── reduced motion ──
console.log('\n# prefers-reduced-motion: reduce');
const COUNT = `
	(() => {
		const raf = window.requestAnimationFrame.bind(window);
		window.__raf = 0;
		window.requestAnimationFrame = (fn) => { window.__raf++; return raf(fn); };
		window.__scenes = [];
		const log = () => {
			const s = document.documentElement.dataset.scene ?? 'none';
			if (window.__scenes.at(-1) !== s) window.__scenes.push(s);
		};
		new MutationObserver(log).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-scene'] });
		document.addEventListener('DOMContentLoaded', log);
		// Everything that is ever painted large: the loader's poster would be among it.
		window.__painted = [];
		new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__painted.push((e.element?.className || e.element?.id || e.element?.tagName || '?') + ' ' + (e.url || '')); }).observe({ type: 'largest-contentful-paint', buffered: true });
	})();
`;
const rest = async (page, ms) => {
	const a = await page.evaluate(() => window.__raf);
	await sleep(ms);
	const b = await page.evaluate(() => window.__raf);
	const running = await page.evaluate(() =>
		document.getAnimations().filter((x) => x.playState === 'running').map((x) => `${x.animationName ?? x.transitionProperty ?? 'anim'} on ${x.effect?.target?.className || x.effect?.target?.id || x.effect?.target?.tagName}`),
	);
	return { frames: b - a, running };
};
for (const [name, size] of SIZES) {
	const { context, page, errors } = await openPage(browser, size, { reduced: true });
	await page.addInitScript(COUNT);
	const label = `reduced motion, ${name}`;
	await page.goto(`${BASE}/?debug`, { waitUntil: 'commit' });
	// From the very first frames: is the loader ever seen? Photographs every 100 ms for the
	// first 1.2 s (the loader's poster is a lit emblem in the middle of a black screen).
	const early = [];
	for (let i = 0; i < 12; i++) {
		const buf = await page.screenshot().catch(() => null);
		if (buf) {
			const l = await light(buf);
			const shown = await page.evaluate(() => { const el = document.getElementById('loader'); if (!el) return 'absent'; const r = el.getBoundingClientRect(); return document.styleSheets.length && r.width > 0 && getComputedStyle(el).display !== 'none' ? 'SHOWN' : 'none'; }).catch(() => 'n/a');
			early.push(`${shown}:${l.mean.toFixed(1)}`);
		}
		await sleep(100);
	}
	check(early.every((d) => !d.startsWith('SHOWN')), `${label}: the loader is never on screen in the first 1.2 s (state:mean luminance of each photograph)`, early.join(' '));
	await page.waitForFunction(() => window.__cellestial?.sky, null, { timeout: 20000 });
	await page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(2500);
	let r = await readable(page);
	check(r.scene === 'sky' && r.motion === 'off', `${label}: the page opens on the sky`, `scene=${r.scene} motion=${r.motion}`);
	check(r.descend, `${label}: the exit button is already present, no round flown`);
	check(await page.evaluate(() => window.__scenes.includes('loading')) === false, `${label}: the scene was never "loading"`, await page.evaluate(() => window.__scenes.join('>')));
	const painted = await page.evaluate(() => window.__painted);
	check(!painted.some((p) => /loader/.test(p)), `${label}: nothing of the loader was ever painted`, painted.join(' | ') || 'no large paint recorded');
	let q = await rest(page, 3000);
	check(q.frames === 0 && q.running.length === 0, `${label}: the sky is still at rest (animation frames in 3 s, running CSS animations)`, `${q.frames} frames; ${q.running.join(', ') || 'none running'}`);
	const shot = await page.screenshot({ path: path.join(SHOTS, `rm-${name}-sky.png`) });
	const l = await light(shot);
	check(l.mean > 0.3, `${label}: the still sky is drawn, not black`, `mean ${l.mean.toFixed(2)}`);
	// A wheel turn and a key must not fly.
	const before = await page.evaluate(() => JSON.stringify(window.__cellestial.sky.hooks.flight()));
	await page.mouse.move(size.viewport.width / 2, size.viewport.height / 2);
	await page.mouse.wheel(0, 800);
	await page.keyboard.press('ArrowDown');
	await sleep(900);
	const after = await page.evaluate(() => JSON.stringify(window.__cellestial.sky.hooks.flight()));
	check(before === after, `${label}: wheel and keys do not fly`, `${before} → ${after}`);
	// Down: a plain fade, never the fall.
	await page.evaluate(() => { window.__scenes.length = 0; });
	await page.click('[data-descend]');
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'roots', null, { timeout: 8000 });
	await sleep(1200);
	const down = await page.evaluate(() => window.__scenes.join('>'));
	check(down === 'roots', `${label}: down is a plain fade (scenes passed through)`, down);
	q = await rest(page, 3000);
	check(q.frames === 0 && q.running.length === 0, `${label}: the Roots are still at rest`, `${q.frames} frames; ${q.running.join(', ') || 'none running'}`);
	await page.screenshot({ path: path.join(SHOTS, `rm-${name}-roots.png`) });
	// A tile opens without moving.
	await page.click('#roots button[aria-expanded]');
	await sleep(80);
	const tile = await page.evaluate(() => {
		const p = [...document.querySelectorAll('#roots .panel')].find((x) => getComputedStyle(x).visibility !== 'hidden');
		const cs = p ? getComputedStyle(p) : null;
		return cs ? { opacity: cs.opacity, transform: cs.transform } : null;
	});
	check(tile && tile.opacity === '1' && (tile.transform === 'none' || tile.transform === 'matrix(1, 0, 0, 1, 0, 0)'), `${label}: a tile is simply there, 80 ms after the press`, JSON.stringify(tile));
	await page.keyboard.press('Escape');
	// Menu teleport: a plain fade.
	await page.evaluate(() => { window.__scenes.length = 0; });
	await page.click('.chrome-bars');
	await page.click('#chrome-menu a[data-dest="sky"]');
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 8000 });
	const fxDrawn = await page.evaluate(async () => {
		// Was anything painted on the effects canvas during the fade?
		const c = document.getElementById('fx-canvas');
		const cs = getComputedStyle(c);
		return `${cs.display}/${cs.visibility}/${cs.opacity}`;
	});
	await sleep(1200);
	check((await page.evaluate(() => window.__scenes.join('>'))) === 'sky', `${label}: the menu's teleport is a plain fade`, `${await page.evaluate(() => window.__scenes.join('>'))}; fx canvas ${fxDrawn}`);
	// Back down, then E6: a plain fade, never the warp.
	await page.click('[data-descend]');
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'roots', null, { timeout: 8000 });
	await sleep(900);
	await page.evaluate(() => { window.__scenes.length = 0; });
	await page.click('[data-ascend]');
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 8000 });
	await sleep(900);
	check((await page.evaluate(() => window.__scenes.join('>'))) === 'sky', `${label}: E6 is a plain fade`, await page.evaluate(() => window.__scenes.join('>')));
	check(errors.length === 0, `${label}: no console errors`, errors.join(' | '));
	await context.close();
}

await browser.close();
process.exit(tally() ? 1 : 0);
