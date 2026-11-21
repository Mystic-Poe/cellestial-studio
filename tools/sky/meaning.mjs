#!/usr/bin/env node
// B7, the meaning written in light: strips of frames to be LOOKED AT, and checks.
//
//   node tools/sky/meaning.mjs [--url http://localhost:4500] [--only strips,checks]
//
// Needs the dev server running (see PROGRESS.md). The sky starts empty, so the
// stars are lit by seeding this device's claims (localStorage
// "cellestial:claims") before the page loads: every star of Aries (4) and of
// Leo (9). The camera is then stood at the figure (sky.debug.setCoord) and
// the writing is photographed in real time on the real GPU, at 1440x900 and
// 390x844 (scale 2, touch). Writes into refs/sky/compare/:
//
//   meaning-aries-desk.jpg, -phone.jpg   the writing, twelve moments
//   meaning-leo-desk.jpg, -phone.jpg     the same, with the final line after it
//   meaning-settled.jpg                  both, written, at both sizes, and the
//                                        words close up
//   meaning.txt                          the checks, "ok" or "FAIL"
//
// Exits non-zero if a check failed or the page logged an error.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS, FINAL_LINE } from '../../src/content/constellations.ts';
import { launch, openPage, ROOT, sharp, sheet, shot } from '../roots/lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'strips,checks' },
	},
});
const only = new Set(values.only.split(','));
const OUT = join(ROOT, 'refs/sky/compare');
mkdirSync(OUT, { recursive: true });
const NOISE = /sandboxed and the 'allow-scripts'|turnstile|challenges\.cloudflare|Failed to load resource/i;
const SIZES = ['desk', 'phone'];
const figure = (name) => CONSTELLATIONS.findIndex((c) => c.name === name);
const slots = (name) => CONSTELLATIONS[figure(name)].stars.map((s) => s.slot).filter(Boolean);
const claims = (...names) => names.flatMap((n) => slots(n)).map((slot) => ({ slot, ask: 'A site for my bakery' }));

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
async function open(size, seed, query = '') {
	const o = await openPage(browser, size, null);
	await o.page.addInitScript((list) => {
		sessionStorage.setItem('cellestial:round', '1');
		if (list.length && !localStorage.getItem('cellestial:claims')) {
			localStorage.setItem('cellestial:claims', JSON.stringify(list));
		}
	}, seed);
	await o.page.goto(`${values.url}/?scene=sky&debug${query}`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning && window.__cellestial?.claims);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await o.page.waitForTimeout(1300);
	return o;
}
const close = async (o) => {
	bad += o.errors.filter((e) => !NOISE.test(e)).length;
	await o.context.close();
};
const state = (page) => page.evaluate(() => window.__cellestial.sky.meaning.state());
const goTo = (page, name) => page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), figure(name));

/** Photograph the screen as fast as it comes for `ms` (see tools/transitions/strip.mjs). */
async function film(page, start, ms) {
	const cdp = await page.context().newCDPSession(page);
	const frames = [];
	const t0 = Date.now();
	await start();
	for (;;) {
		const at = Date.now() - t0;
		if (at > ms) break;
		const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
		frames.push({ at, img: Buffer.from(data, 'base64') });
	}
	await cdp.detach();
	return frames;
}
const nearest = (frames, times) =>
	times.map((t) => frames.reduce((a, b) => (Math.abs(b.at - t) < Math.abs(a.at - t) ? b : a)));
const box = (page, name) =>
	page.evaluate((n) => {
		const el = document.querySelector(`.sky-meaning[data-meaning="${n}"]`);
		if (!el || el.hidden) return null;
		const r = el.getBoundingClientRect();
		return { x: r.x, y: r.y, width: r.width, height: r.height };
	}, name);

if (only.has('strips')) {
	const settled = [];
	for (const size of SIZES) {
		const o = await open(size, claims('Aries', 'Leo'));
		for (const [name, times] of [
			['Aries', [60, 200, 340, 480, 620, 760, 900, 1100, 1300, 1600, 2000, 2600]],
			['Leo', [100, 400, 700, 1000, 1300, 1600, 1900, 2200, 2500, 2800, 3300, 4200]],
		]) {
			const frames = await film(o.page, () => goTo(o.page, name), times.at(-1) + 60);
			await sheet(
				join(OUT, `meaning-${name.toLowerCase()}-${size}.jpg`),
				nearest(frames, times).map((f) => ({ img: f.img, label: `${name}: ${f.at} ms after arriving` })),
				size === 'desk' ? { cols: 4, cellW: 390, cellH: 244 } : { cols: 6, cellW: 258, cellH: 558 },
			);
			await o.page.waitForTimeout(600);
			settled.push({ img: await shot(o.page), label: `${name}, ${size}: written` });
			const b = await box(o.page, name);
			if (b) {
				const pad = 14;
				const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + 2 * pad, height: b.height + 2 * pad };
				const img = await shot(o.page, clip);
				const meta = await sharp(img).metadata();
				const k = Math.min(3, 520 / (meta.width / (size === 'phone' ? 2 : 1)));
				settled.push({
					img: await sharp(img).resize({ width: Math.round((meta.width / (size === 'phone' ? 2 : 1)) * k), kernel: 'cubic' }).png().toBuffer(),
					label: `${name}, ${size}: the words, enlarged ${k.toFixed(1)}x`,
					enlarge: true,
				});
			}
		}
		await close(o);
	}
	await sheet(join(OUT, 'meaning-settled.jpg'), settled, { cols: 4, cellW: 390, cellH: 330 });
}

if (only.has('checks')) {
	for (const size of SIZES) {
		const tag = `${size}:`;
		// An empty sky: nothing is written.
		let o = await open(size, []);
		await goTo(o.page, 'Aries');
		await o.page.waitForTimeout(800);
		let s = await state(o.page);
		check(s.length === 0 && (await o.page.locator('.sky-meaning').count()) === 0, `${tag} with no star lit there is no meaning anywhere, at launch or at Aries`);
		await close(o);

		// Aries and Leo complete.
		o = await open(size, claims('Aries', 'Leo'));
		s = await state(o.page);
		check(s.length === 2 && s.every((e) => e.state === 'fresh' && !e.shown), `${tag} at launch (Virgo) two figures are complete (${s.map((e) => e.name).join(', ')}) and nothing is written or shown`);
		for (const name of ['Aries', 'Leo']) {
			const want = name === 'Leo' ? [CONSTELLATIONS[figure(name)].meaning, FINAL_LINE] : [CONSTELLATIONS[figure(name)].meaning];
			await goTo(o.page, name);
			await o.page.waitForTimeout(250);
			const during = (await state(o.page)).find((e) => e.name === name);
			await o.page.waitForFunction((n) => window.__cellestial.sky.meaning.state().find((e) => e.name === n)?.state === 'written', name, { timeout: 9000 });
			const took = await o.page.evaluate(() => performance.now());
			const m = await o.page.evaluate((n) => {
				const el = document.querySelector(`.sky-meaning[data-meaning="${n}"]`);
				const r = el.getBoundingClientRect();
				const say = [...el.querySelectorAll('.sky-meaning__say')].map((x) => x.textContent);
				const ink = [...el.querySelectorAll('.sky-meaning__ink')].map((x) => x.textContent);
				const inkHidden = [...el.querySelectorAll('.sky-meaning__ink')].every((x) => x.getAttribute('aria-hidden') === 'true');
				// The stars' buttons of the layer in front.
				const hit = [...document.querySelectorAll('#sky-ui .sky-star')]
					.filter((b) => !b.hidden && getComputedStyle(b).display !== 'none')
					.map((b) => b.getBoundingClientRect())
					.filter((b) => b.width > 0 && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom)).length;
				const exit = document.querySelector('[data-descend]').getBoundingClientRect();
				const chrome = [...document.querySelectorAll('#chrome > a, #chrome > button')].map((c) => c.getBoundingClientRect());
				const over = (b) => !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
				return {
					rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
					inside: r.left >= 8 && r.right <= innerWidth - 8 && r.top >= 0 && r.bottom <= innerHeight,
					say,
					ink,
					inkHidden,
					hit,
					buttons: document.querySelectorAll('#sky-ui .sky-star:not([hidden])').length,
					overExit: over(exit),
					overChrome: chrome.some(over),
					settled: el.hasAttribute('data-settled'),
					canvas: el.querySelectorAll('canvas').length,
					size: getComputedStyle(el).fontSize,
					family: getComputedStyle(el).fontFamily.split(',')[0],
					pointer: getComputedStyle(el).pointerEvents,
					lettersOn: [...el.querySelectorAll('i')].every((i) => getComputedStyle(i).opacity === '1'),
				};
			}, name);
			check(during?.state === 'writing' && during.shown, `${tag} ${name}: on arriving the meaning is being written (${during?.state})`);
			check(JSON.stringify(m.say) === JSON.stringify(want) && JSON.stringify(m.ink) === JSON.stringify(want), `${tag} ${name}: the words are exactly ${want.map((w) => `"${w}"`).join(' then ')}`);
			check(m.inkHidden && m.say.length === want.length, `${tag} ${name}: a screen reader gets each line once (the letters seen are hidden from it)`);
			check(m.inside, `${tag} ${name}: the words are whole on screen: ${m.rect.w}x${m.rect.h} px at ${m.rect.x}, ${m.rect.y}, type ${m.size} ${m.family}`);
			check(m.hit === 0 && m.buttons > 0, `${tag} ${name}: they cover none of the ${m.buttons} star buttons`);
			check(!m.overExit && !m.overChrome && m.pointer === 'none', `${tag} ${name}: clear of the exit button and the chrome, and they take no pointer`);
			check(m.settled && m.canvas === 0 && m.lettersOn, `${tag} ${name}: written: every letter there, the lightning's canvas gone`);
			void took;
		}
		// Leave and come back: simply there.
		await goTo(o.page, 'Taurus');
		await o.page.waitForTimeout(400);
		await goTo(o.page, 'Aries');
		await o.page.waitForTimeout(150);
		s = (await state(o.page)).find((e) => e.name === 'Aries');
		const again = await o.page.evaluate(() => {
			const el = document.querySelector('.sky-meaning[data-meaning="Aries"]');
			const i = el.querySelector('i');
			return { hidden: el.hidden, canvas: el.querySelectorAll('canvas').length, cooling: getComputedStyle(i, '::before').animationName };
		});
		check(s.state === 'written' && s.shown && !again.hidden && again.canvas === 0 && again.cooling === 'none', `${tag} Aries again after flying on: the words are simply there, nothing is written twice`);
		await close(o);

		// The last star of a figure lit while the visitor is there.
		const all = claims('Aries');
		o = await open(size, all.slice(0, -1));
		await goTo(o.page, 'Aries');
		await o.page.waitForTimeout(700);
		const before = await state(o.page);
		await o.page.evaluate((slot) => window.__cellestial.claims.recordSent('The last one', slot), all.at(-1).slot);
		await o.page.waitForFunction(() => window.__cellestial.sky.meaning.state()[0]?.state === 'written', null, { timeout: 12000 });
		s = await state(o.page);
		check(before.length === 0 && s.length === 1 && s[0].name === 'Aries' && s[0].shown, `${tag} three of Aries' four stars lit: nothing; the fourth lit while there: the meaning is written`);
		await close(o);

		// Reduced motion: the still sky is Virgo's; its meaning is simply there.
		o = await open(size, claims('Virgo'), '&rm=1');
		await o.page.waitForTimeout(500);
		s = await state(o.page);
		const still = await o.page.evaluate(() => {
			const el = document.querySelector('.sky-meaning[data-meaning="Virgo"]');
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return { hidden: el.hidden, canvas: el.querySelectorAll('canvas').length, text: el.querySelector('.sky-meaning__say').textContent, inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, opacity: getComputedStyle(el.querySelector('i')).opacity };
		});
		check(s.length === 1 && s[0].state === 'written' && still && !still.hidden && still.canvas === 0 && still.opacity === '1' && still.text === CONSTELLATIONS[0].meaning && still.inside, `${tag} reduced motion, Virgo complete: "${still?.text}" is simply there, never written`);
		if (size === 'desk') {
			await sheet(join(OUT, 'meaning-still.jpg'), [{ img: await shot(o.page), label: 'reduced motion, Virgo complete, 1440x900' }], { cols: 1, cellW: 1200, cellH: 750 });
		}
		await close(o);
	}
	writeFileSync(join(OUT, 'meaning.txt'), `${lines.join('\n')}\n`);
	console.log(`${lines.length} checks, ${failed} failed, ${bad} page error(s)`);
}

await browser.close();
if (failed || bad) process.exit(1);
