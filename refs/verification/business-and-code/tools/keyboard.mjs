// The whole visit by keyboard, and the accessibility tree at each scene. Production build, 1440x900.
// Run: node refs/verification/business-and-code/tools/keyboard.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, check, DESK, HERE, launch, note, openPage, SHOTS, sleep, tally } from './lib.mjs';

const browser = await launch();
const { context, page, errors } = await openPage(browser, DESK, { stub: { status: 200, json: { ok: true } } });
const trees = [];
const tree = async (name) => {
	const snap = await page.locator('body').ariaSnapshot();
	trees.push(`\n===== ${name} =====\n${snap}`);
};
const at = () =>
	page.evaluate(() => {
		const el = document.activeElement;
		if (!el || el === document.body) return { what: 'body' };
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle(el);
		const name = el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) || el.getAttribute('name') || '';
		return {
			what: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.dataset.slot ? `[${el.dataset.slot}]` : ''} "${name}"`,
			onScreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && r.width > 0,
			ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? `${cs.outlineWidth} ${cs.outlineColor}` : (cs.boxShadow !== 'none' ? 'box-shadow' : 'NONE'),
			inert: Boolean(el.closest('[inert]')),
			hiddenAncestor: getComputedStyle(el).visibility === 'hidden',
		};
	});
const tabs = async (n, key = 'Tab') => {
	const seen = [];
	for (let i = 0; i < n; i++) {
		await page.keyboard.press(key);
		await sleep(60);
		seen.push(await at());
	}
	return seen;
};
const show = (list) => list.map((s) => `${s.what}${s.onScreen === false ? ' (OFF SCREEN)' : ''}${s.ring === 'NONE' ? ' (NO RING)' : ''}`).join('\n       → ');
const scene = () => page.evaluate(() => document.documentElement.dataset.scene);

// ── loading ──
await page.goto(`${BASE}/?debug`, { waitUntil: 'commit' });
await sleep(1500);
await tree('LOADING (1.5 s in)');
check((await scene()) === 'loading', 'a first visit opens on the loader');
const inLoader = await tabs(3);
note(`Tab during the loader: \n       → ${show(inLoader)}`);
check((await scene()) === 'loading', 'Tab does not skip the loader');
await page.keyboard.press('Enter');
const t0 = Date.now();
await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 15000 });
note(`Enter skipped the loader: on the sky ${Date.now() - t0} ms later`);
await page.waitForFunction(() => window.__cellestial?.sky, null, { timeout: 20000 });
await page.evaluate(() => window.__cellestial.sky.ready);
await sleep(1500);

// ── the sky ──
await tree('THE SKY (opening pose)');
await page.evaluate(() => document.activeElement?.blur());
const skyTabs = await tabs(18);
note(`Tab through the sky: \n       → ${show(skyTabs)}`);
const stars = skyTabs.filter((s) => /sky-star|slot-/.test(s.what) || /star in/i.test(s.what));
check(skyTabs[0].what.includes('Skip to content'), 'first Tab: "Skip to content"', skyTabs[0].what);
check(skyTabs.some((s) => /Cellestial studio/.test(s.what)) && skyTabs.some((s) => /"Menu"/.test(s.what)), 'then the logo and the menu button');
check(stars.length >= 12, "then Virgo's twelve stars, each a button", `${stars.length}`);
check(skyTabs.every((s) => s.what === 'body' || s.ring !== 'NONE'), 'every stop shows a focus ring', skyTabs.filter((s) => s.ring === 'NONE').map((s) => s.what).join(', '));
check(skyTabs.every((s) => s.what === 'body' || s.onScreen), 'every stop is on screen', skyTabs.filter((s) => s.onScreen === false).map((s) => s.what).join(', '));
await page.screenshot({ path: path.join(SHOTS, 'kbd-sky-star-focus.png') });

// A star by keyboard: Enter opens the panel, focus goes in, Escape gives it back.
await page.evaluate(() => document.activeElement?.blur());
let hops = 0;
while (hops++ < 30 && !/star in/i.test((await at()).what)) await page.keyboard.press('Tab');
const starStop = await at();
await page.keyboard.press('Enter');
await sleep(700);
const inPanel = await at();
await tree('THE SKY, an empty star picked (B10 open)');
await page.screenshot({ path: path.join(SHOTS, 'kbd-sky-panel.png') });
const panelTabs = await tabs(3);
note(`Enter on ${starStop.what}: focus → ${inPanel.what}; then Tab: \n       → ${show(panelTabs)}`);
check(await page.evaluate(() => !document.querySelector('[data-sky-panel="empty"]').hidden), 'Enter on a star opens its panel');
check(await page.evaluate(() => document.querySelector('[data-sky-panel="empty"]').contains(document.activeElement) || document.activeElement.matches('[data-sky-panel="empty"]')), 'focus is inside the panel');
await page.keyboard.press('Escape');
await sleep(400);
const back = await at();
check(back.what === starStop.what, 'Escape closes it and focus returns to the star', back.what);

// Fly the round by keyboard.
await page.evaluate(() => document.activeElement?.blur());
const round0 = Date.now();
for (let i = 0; i < 14 && !(await page.evaluate(() => window.__cellestial.sky.roundComplete())); i++) {
	await page.keyboard.press('PageDown');
	await sleep(3600);
}
const done = await page.evaluate(() => window.__cellestial.sky.roundComplete());
check(done, 'PageDown, twelve times, flies the whole round', `${((Date.now() - round0) / 1000).toFixed(0)} s`);
check(await page.evaluate(() => { const b = document.querySelector('[data-descend]'); return !b.hidden && b.getBoundingClientRect().height > 0; }), 'B11 "See what holds up the sky" is then there');
hops = 0;
while (hops++ < 40 && !/See what holds up the sky/.test((await at()).what)) await page.keyboard.press('Tab');
check(/See what holds up the sky/.test((await at()).what), 'Tab reaches B11', `${hops} Tabs; ${(await at()).what}`);
await page.screenshot({ path: path.join(SHOTS, 'kbd-b11-focus.png') });
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.documentElement.dataset.scene === 'roots', null, { timeout: 10000 });
await sleep(1800);
const landed = await at();
check(/main#roots/.test(landed.what), 'after the fall focus is on the ground', landed.what);

// ── the Roots ──
await tree('THE ROOTS (arrived, no tile open)');
const rootTabs = await tabs(8);
note(`Tab down the Roots: \n       → ${show(rootTabs)}`);
const wantRoots = ['Return to the sky', 'Site', 'Site + Systems', 'Site + App', 'Add-ons — AI + automation', 'Care', 'Claim your star', 'Contact me'];
check(rootTabs.every((s, i) => s.what.includes(`"${wantRoots[i]}"`)), 'E6, the five nodes in order, F1, F2', rootTabs.map((s) => s.what).join(' | '));
check(rootTabs.every((s) => s.ring !== 'NONE' && s.onScreen), 'each with a ring and on screen');
// A tile by keyboard.
await page.keyboard.press('Shift+Tab'); // F1
for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab'); // back to node 1
const node1 = await at();
await page.keyboard.press('Enter');
await sleep(500);
const inTile = await at();
await tree('THE ROOTS, tile 1 "Site" open');
await page.screenshot({ path: path.join(SHOTS, 'kbd-tile-open.png') });
const tileTabs = await tabs(2);
note(`Enter on ${node1.what}: focus → ${inTile.what}; Tab → ${show(tileTabs)}`);
check(/Site/.test(node1.what) && /offer-site|Close|article/.test(inTile.what), 'Enter on node 1 opens its tile and focus goes into it', inTile.what);
await page.keyboard.press('Escape');
await sleep(400);
check((await at()).what === node1.what, 'Escape closes the tile; focus returns to its node', (await at()).what);

// F1: the build request.
hops = 0;
while (hops++ < 12 && !/"Claim your star"/.test((await at()).what)) await page.keyboard.press('Tab');
const f1 = await at();
await page.keyboard.press('Enter');
await page.waitForSelector('#claim-dialog[open]', { timeout: 5000 });
await sleep(2500);
await tree('THE BUILD REQUEST (dialog open)');
const first = await at();
const dlgTabs = await tabs(7);
note(`Enter on ${f1.what}: focus → ${first.what}; Tab ×7: \n       → ${show(dlgTabs)}`);
check(/claim-form-name/.test(first.what), 'the dialog opens with focus in "Your name"', first.what);
check(dlgTabs.every((s) => s.what === 'body' || /claim|iframe|Close|Send/.test(s.what)), 'Tab stays inside the dialog', dlgTabs.map((s) => s.what).join(' | '));
await page.screenshot({ path: path.join(SHOTS, 'kbd-claim-dialog.png') });
await page.keyboard.press('Escape');
await sleep(400);
check((await at()).what === f1.what, 'Escape closes it; focus returns to F1', (await at()).what);
// F2: the message box.
await page.keyboard.press('Tab');
const f2 = await at();
await page.keyboard.press('Enter');
await page.waitForSelector('#contact-dialog[open]', { timeout: 5000 });
await sleep(800);
await tree('THE MESSAGE BOX (dialog open)');
check(/contact-box-form-name/.test((await at()).what), 'F2 opens the message box with focus in "Your name"', (await at()).what);
await page.keyboard.press('Escape');
await sleep(400);
check((await at()).what === f2.what, 'Escape closes it; focus returns to F2', (await at()).what);

// E6 by keyboard.
hops = 0;
while (hops++ < 12 && !/Return to the sky/.test((await at()).what)) await page.keyboard.press('Shift+Tab');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 10000 });
await sleep(1500);
check(/sky-ui/.test((await at()).what), 'E6 launches back up and focus is on the sky', (await at()).what);

// ── the menu ──
hops = 0;
while (hops++ < 6 && !/"Menu"/.test((await at()).what)) await page.keyboard.press('Shift+Tab');
if (!/"Menu"/.test((await at()).what)) { hops = 0; while (hops++ < 30 && !/"Menu"/.test((await at()).what)) await page.keyboard.press('Tab'); }
await page.keyboard.press('Enter');
await sleep(400);
await tree('THE MENU (open, over the sky)');
const m0 = await at();
const menuTabs = await tabs(3);
note(`Enter on Menu: focus → ${m0.what}; Tab ×3: \n       → ${show(menuTabs)}`);
check(/The Sky/.test(m0.what) && /What we build/.test(menuTabs[0].what) && /Claim your star/.test(menuTabs[1].what) && /Contact me/.test(menuTabs[2].what), 'the menu opens with focus on "The Sky", then the other three in order');
check(await page.evaluate(() => document.querySelector('.chrome-bars').getAttribute('aria-expanded')) === 'true', 'the button says it is expanded');
await page.screenshot({ path: path.join(SHOTS, 'kbd-menu.png') });
await page.keyboard.press('Escape');
await sleep(300);
check(/"Menu"/.test((await at()).what), 'Escape closes the menu; focus returns to the button', (await at()).what);
// Each destination by keyboard.
for (const [dest, label, wantScene, wantFocus] of [
	['build', 'What we build', 'roots', /main#roots/],
	['claim', 'Claim your star', 'roots', /"Claim your star"/],
	['contact', 'Contact me', 'roots', /contact-box-form-name/],
	['sky', 'The Sky', 'sky', /sky-ui/],
]) {
	if (await page.evaluate(() => document.querySelector('#contact-dialog').open)) { await page.keyboard.press('Escape'); await sleep(300); }
	await page.focus('.chrome-bars');
	await page.keyboard.press('Enter');
	await sleep(300);
	hops = 0;
	while (hops++ < 5 && !(await at()).what.includes(`"${label}"`)) await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');
	await sleep(3200);
	const f = await at();
	check((await scene()) === wantScene && wantFocus.test(f.what), `menu → "${label}": lands on ${wantScene}, focus on ${wantFocus}`, `scene=${await scene()}, focus=${f.what}`);
}

// ── structure ──
const structure = await page.evaluate(() => ({
	lang: document.documentElement.lang,
	title: document.title,
	h1: document.querySelectorAll('h1').length,
	headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => `${h.tagName}:${h.textContent.trim()}`),
	landmarks: [...document.querySelectorAll('header,nav,main,footer,[role="region"],[role="dialog"],dialog')].map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}[${e.getAttribute('aria-label') ?? e.getAttribute('aria-labelledby') ?? ''}]`),
	imgsNoAlt: [...document.querySelectorAll('img:not([alt])')].length,
	unnamedButtons: [...document.querySelectorAll('button, a[href]')].filter((b) => !(b.getAttribute('aria-label') || b.textContent.trim() || b.getAttribute('aria-labelledby'))).map((b) => b.outerHTML.slice(0, 90)),
	viewport: document.querySelector('meta[name="viewport"]').content,
}));
note(`structure: ${JSON.stringify(structure, null, 1).replace(/\n/g, '\n     ')}`);
check(structure.lang === 'en' && structure.imgsNoAlt === 0 && structure.unnamedButtons.length === 0, 'lang is set; every image has alt; every button and link has a name');
check(structure.h1 === 1, 'the home page has exactly one <h1>', `${structure.h1}`);
check(!/user-scalable=no|maximum-scale=1/.test(structure.viewport), 'pinch zoom is not disabled', structure.viewport);
check(errors.length === 0, 'no console errors in the whole keyboard visit', errors.join(' | '));

writeFileSync(path.join(HERE, '..', 'a11y-trees.txt'), `${trees.join('\n')}\n`);
console.log(`\naccessibility trees written to refs/verification/business-and-code/a11y-trees.txt`);
await browser.close();
process.exit(tally() ? 1 : 0);
