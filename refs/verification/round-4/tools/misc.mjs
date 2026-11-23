#!/usr/bin/env node
// Part 4 and 5: reduced motion, the page with JavaScript off, the tab icon, the tiles' words against the
// addendum, and that /contact, /admin and /start answer. Production build.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, ROOT, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('owner-list');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });

// ---- 1. Reduced motion
say('REDUCED MOTION (prefers-reduced-motion: reduce), a first visit to "/"');
for (const size of ['desk', 'phone']) {
	const o = await open(browser, size, { reducedMotion: true });
	const rec = await recorder(o, { quality: 85 });
	const t0 = Date.now();
	await o.page.goto(`${PROD}/?debug`, { waitUntil: 'commit' });
	await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 20000 });
	const tSky = Date.now() - t0;
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1800);
	const a = await o.page.screenshot({ type: 'png' });
	const st = await o.page.evaluate(() => {
		const l = document.getElementById('loader'); const b = document.querySelector('[data-descend]'); const r = b.getBoundingClientRect();
		return { loaderShown: l ? getComputedStyle(l).display !== 'none' && getComputedStyle(l).visibility !== 'hidden' && Number(getComputedStyle(l).opacity) > 0.01 : false, b11: { hidden: b.hidden, opacity: getComputedStyle(b).opacity, y: Math.round(r.y), w: Math.round(r.width) }, still: window.__cellestial.sky.hooks.isStill(), pos: window.__cellestial.sky.hooks.flight().pos };
	});
	await sleep(1500);
	const b = await o.page.screenshot({ type: 'png' });
	const [ra, rb] = await Promise.all([a, b].map((x) => sharp(x).greyscale().raw().toBuffer()));
	let diff = 0; for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) diff++;
	// input: a wheel / swipe must not fly
	if (o.phone) { await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 600, id: 1 }] }); for (let i = 1; i <= 8; i++) { await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 600 - i * 40, id: 1 }] }); await sleep(20); } await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
	else { await o.page.mouse.move(o.W / 2, o.H / 2); for (let i = 0; i < 12; i++) { await o.page.mouse.wheel(0, 100); await sleep(40); } }
	await sleep(1200);
	const pos2 = await o.page.evaluate(() => ({ pos: window.__cellestial.sky.hooks.flight().pos, scene: document.documentElement.dataset.scene, y: scrollY }));
	const early = rec.frames.filter((f) => f.ts <= t0 + tSky + 200);
	say(`${size}: scene "sky" ${tSky} ms after navigation; the loader shown at 1.8 s: ${st.loaderShown}; the sky still: ${st.still}; exit button hidden ${st.b11.hidden}, opacity ${st.b11.opacity}, at y ${st.b11.y}; two screenshots 1.5 s apart differ in ${diff} pixels; after a wheel/swipe the flight is at ${pos2.pos} (was ${st.pos}), scene ${pos2.scene}, scrollY ${pos2.y}`);
	const cells = [];
	for (const f of early.filter((_, i) => i % Math.max(1, Math.floor(early.length / 5)) === 0).slice(0, 5)) cells.push({ img: f.img, label: `load +${Math.round(f.ts - t0)} ms` });
	cells.push({ img: b, label: 'the still sky, exit button present' });
	// B11: no falling, a fade
	const t1 = Date.now();
	await o.press('[data-descend]');
	await sleep(1600);
	for (const t of [100, 300, 500, 800, 1400]) { const f = rec.at(t1 + t); if (f) cells.push({ img: f.img, label: `exit button pressed +${t} ms` }); }
	const after = await o.page.evaluate(() => document.documentElement.dataset.scene);
	// E6 back, then a menu teleport: fades
	await o.page.evaluate(() => scrollTo(0, 0));
	await sleep(300);
	const t2 = Date.now();
	await o.press('[data-ascend]');
	await sleep(1500);
	for (const t of [100, 300, 500, 900]) { const f = rec.at(t2 + t); if (f) cells.push({ img: f.img, label: `return button pressed +${t} ms` }); }
	await o.press('#chrome button[popovertarget]');
	await sleep(400);
	const t3 = Date.now();
	await o.press('#chrome-menu [data-dest="claim"]');
	await sleep(1400);
	for (const t of [100, 250, 400, 600, 1000]) { const f = rec.at(t3 + t); if (f) cells.push({ img: f.img, label: `menu "Claim your star" +${t} ms` }); }
	await rec.stop();
	say(`   exit button pressed: lands in scene ${after}; then the return button and a menu teleport: scene ${await o.page.evaluate(() => document.documentElement.dataset.scene)}, scrollY ${await o.page.evaluate(() => Math.round(scrollY))}; console errors ${[...new Set(o.errors)].join(' | ').slice(0, 200) || 'none'}`);
	await sheet(join(dir, `reduced-motion-${size}.jpg`), cells, size === 'desk' ? { cols: 5, cellW: 310, cellH: 194 } : { cols: 10, cellW: 150, cellH: 325 });
	await o.context.close();
}

// ---- 2. JavaScript off
say('');
say('JAVASCRIPT OFF, "/"');
for (const size of ['desk', 'phone']) {
	const o = await open(browser, size, { js: false });
	await o.page.goto(`${PROD}/`, { waitUntil: 'load' });
	await sleep(500);
	const shot = await o.page.screenshot({ type: 'png', fullPage: true });
	const meta = await sharp(shot).metadata();
	// with script off page.evaluate still runs in the page's world
	const d = await o.page.evaluate(() => {
		const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && r.width > 2 && r.height > 2; };
		const logo = document.querySelector('.chrome-logo');
		const tiles = [...document.querySelectorAll('[data-offer]')].map((t) => ({ id: t.id || t.dataset.offer, visible: vis(t), h: Math.round(t.getBoundingClientRect().height), words: t.innerText.trim().split(/\s+/).length, font: getComputedStyle(t.querySelector('p') ?? t).fontSize, color: getComputedStyle(t.querySelector('p') ?? t).color }));
		const links = [...document.querySelectorAll('a[href]')].filter(vis).map((a) => ({ text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) || a.getAttribute('aria-label'), href: a.getAttribute('href'), w: Math.round(a.getBoundingClientRect().width), h: Math.round(a.getBoundingClientRect().height) }));
		const hiddenJs = [...document.querySelectorAll('[data-needs-js]')].filter(vis).length;
		return { logo: vis(logo) && vis(logo.querySelector('img')), logoImg: logo?.querySelector('img')?.getAttribute('src'), studio: document.querySelector('.chrome-studio')?.textContent, tiles, links, hiddenJs, menu: vis(document.querySelector('#chrome button[popovertarget]')), canvasShown: [...document.querySelectorAll('canvas')].filter(vis).length, scrollW: document.documentElement.scrollWidth, w: innerWidth, bg: getComputedStyle(document.body).backgroundColor };
	});
	say(`${size}: the logo shown ${d.logo} (${d.logoImg}, "${d.studio}"); menu button shown ${d.menu}; tiles: ${d.tiles.map((t) => `${t.id} ${t.visible ? 'shown' : 'HIDDEN'} ${t.words} words ${t.font}`).join('; ')}; links shown: ${d.links.map((l) => `"${l.text}" -> ${l.href} (${l.w}x${l.h})`).join(', ')}; things marked data-needs-js still shown: ${d.hiddenJs}; canvases shown ${d.canvasShown}; page width ${d.scrollW} of ${d.w}; page ${meta.width}x${meta.height} device px`);
	// the page cut into screen-high pieces
	const pieces = [];
	const dpr = size === 'phone' ? 2 : 1;
	const ph = o.H * dpr;
	for (let y = 0; y < meta.height && pieces.length < 10; y += ph) pieces.push({ img: await sharp(shot).extract({ left: 0, top: y, width: meta.width, height: Math.min(ph, meta.height - y) }).png().toBuffer(), label: `no script, y ${y / dpr}` });
	await sheet(join(dir, `nojs-${size}.jpg`), pieces, size === 'desk' ? { cols: 3, cellW: 520, cellH: 325 } : { cols: 8, cellW: 190, cellH: 412 });
	await o.context.close();
}

// ---- 3. The tiles' words against the addendum
say('');
say('THE TILES\' WORDS against SPEC-ADDENDUM.md, character for character (textContent, white space folded)');
{
	const add = readFileSync(join(ROOT, 'SPEC-ADDENDUM.md'), 'utf8');
	const want = [];
	for (const m of add.matchAll(/^\*\*(\d)\. ([^*]+):\*\* (.+)$/gm)) want.push({ n: Number(m[1]), title: m[2], body: m[3].replace(/\*\*/g, '') });
	const o = await open(browser, 'desk');
	await o.page.goto(`${PROD}/?scene=roots&debug`, { waitUntil: 'load' });
	await sleep(1500);
	const got = await o.page.evaluate(() => [...document.querySelectorAll('[data-offer]')].map((t) => ({ title: t.querySelector('[id$="-title"]')?.textContent.trim().replace(/\s+/g, ' '), body: (t.querySelector('.roots-tile__body')?.textContent ?? '').trim().replace(/\s+/g, ' '), seen: (t.querySelector('.roots-tile__body')?.innerText ?? '').trim().replace(/\s+/g, ' ') })));
	const fold = (s) => s.replace(/\s+/g, ' ').trim();
	for (const w of want) {
		const g = got[w.n - 1];
		if (!g) { say(`tile ${w.n}: NOT ON THE PAGE`); continue; }
		const same = fold(g.body) === fold(w.body);
		let at = -1;
		if (!same) { const a = fold(g.body), b = fold(w.body); for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { at = i; break; } }
		say(`tile ${w.n}: title on the page "${g.title}" (addendum "${w.title}") ${g.title === w.title ? 'same' : 'DIFFERENT'}; body ${same ? `the same, ${fold(w.body).length} characters` : `DIFFERS at character ${at}: page "…${fold(g.body).slice(Math.max(0, at - 30), at + 40)}…" addendum "…${fold(w.body).slice(Math.max(0, at - 30), at + 40)}…"`}`);
		if (w.n === 1) say(`   as seen (innerText): "${g.seen.slice(0, 260)}"`);
	}
	await o.context.close();
}

// ---- 4. The other pages answer
say('');
say('THE OTHER PAGES');
{
	const o = await open(browser, 'desk');
	for (const path of ['/contact', '/contact/', '/start', '/start/', '/start/new', '/start/new/', '/admin/', '/admin/index.html', '/credits.txt', '/favicon.png', '/favicon.ico', '/favicon.svg', '/nothing-here']) {
		const r = await o.page.request.get(`${PROD}${path}`, { maxRedirects: 5 }).catch((e) => ({ status: () => `ERR ${e}`, headers: () => ({}) }));
		say(`${path}: ${r.status()} ${r.headers?.()['content-type'] ?? ''}`);
	}
	await o.context.close();
}
writeFileSync(join(dir, 'owner-list.txt'), `${log.join('\n')}\n`);
await browser.close();
