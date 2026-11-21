#!/usr/bin/env node
// The Roots' rules, driven on the real page with real clicks, taps and keys.
//
//   node tools/roots/measure.mjs [--url http://localhost:4500] [--only contract,tiles,...]
//
// Needs the dev server running (see PROGRESS.md). Opens "/?scene=roots&debug"
// at 1440x900, at 390x844 and at 320x568 (the phones at scale 2, mobile,
// touch). Every line it prints is one check; the whole output is written to
// refs/roots/measure.txt. Exits non-zero if a check failed or the page
// logged an error.
//
//   contract   the RootsScene contract called from the page: setActive,
//              surfaceY, anchorY x3, focusClose, showGrown, growFrom
//   tiles      one tile at a time: a real click or tap opens, another node
//              closes it, the close button, Escape, a click outside; focus in
//              and back; the tile whole on the screen and clear of the logo
//   chrome     the menu's three destinations on the ground, F1 and F2 open
//              the two dialogs, E6 returns to the sky
//   keys       Tab order (E6, the five nodes, F1, F2), Enter and Space open,
//              Escape closes, focus returns; the accessibility tree of a node
//              and its tile
//   phones     no sideways scroll, tap targets, body text size
//   still      reduced motion: grown at once, nothing travelling, nothing
//              breathing, no animation frames at rest
//   nojs       script off, and the scene's script blocked: the same readable page
//   frames     scrolling the whole page at 390x844 with the CPU slowed 4x

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch, openPage, ROOT, rootsReady } from './lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'contract,tiles,chrome,keys,phones,still,nojs,frames' },
	},
});
const only = new Set(values.only.split(','));
const URL = `${values.url}/?scene=roots&debug`;
const TITLES = ['Site', 'Site + Systems', 'Site + App', 'Add-ons — AI + automation', 'Care'];
const IDS = ['site', 'systems', 'app', 'addons', 'care'];
/** Third-party noise that is not the page's: the Turnstile widget offline. */
const NOISE = /sandboxed and the 'allow-scripts'|turnstile|challenges\.cloudflare|ERR_INTERNET|ERR_NAME|Failed to load resource/i;

const lines = [];
let failed = 0;
const say = (text) => {
	lines.push(text);
	console.log(text);
};
const check = (name, ok, detail = '') => {
	if (!ok) failed++;
	say(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}`);
};
const section = (name) => say(`\n## ${name}`);
const real = (errors) => errors.filter((e) => !NOISE.test(e));

const browser = await launch();

/** What is open, and where, as the page has it. */
const tileState = (page) =>
	page.evaluate(() => {
		const out = {};
		for (const stop of document.querySelectorAll('.roots-stop')) {
			const tile = stop.querySelector('.roots-tile');
			const r = tile.getBoundingClientRect();
			out[stop.dataset.offer] = {
				visible: getComputedStyle(tile).display !== 'none' && r.width > 0,
				expanded: stop.querySelector('.roots-node__bulb').getAttribute('aria-expanded'),
				top: r.top,
				bottom: r.bottom,
				left: r.left,
				right: r.right,
			};
		}
		const a = document.activeElement;
		return {
			tiles: out,
			focus: a?.classList.contains('roots-tile')
				? `tile:${a.id}`
				: a?.classList.contains('roots-node__bulb')
					? `bulb:${a.closest('.roots-stop').dataset.offer}`
					: (a?.tagName ?? 'none'),
			vw: innerWidth,
			vh: innerHeight,
			y: scrollY,
		};
	});
const openIds = (s) => IDS.filter((id) => s.tiles[id].visible);

if (only.has('contract')) {
	for (const size of ['desk', 'phone']) {
		section(`contract, ${size}`);
		const { page, errors, context } = await openPage(browser, size, URL);
		await rootsReady(page);
		const c = await page.evaluate(async () => {
			const r = window.__cellestial.roots;
			const out = {};
			out.top = r.anchorY('top');
			out.surface0 = r.surfaceY();
			scrollTo(0, 300);
			out.surface300 = r.surfaceY();
			const first = r.anchorY('first-node');
			scrollTo(0, first);
			const b = document.querySelector('.roots-node__bulb').getBoundingClientRect();
			out.first = { y: first, top: b.top, bottom: b.bottom, vh: innerHeight };
			const close = r.anchorY('close');
			scrollTo(0, close);
			const f1 = document.querySelector('#roots [data-open-claim]');
			const f2 = document.querySelector('#roots [data-open-contact]');
			out.close = { y: close, f1: f1.getBoundingClientRect().top, f2: f2.getBoundingClientRect().bottom, vh: innerHeight, max: document.documentElement.scrollHeight - innerHeight };
			const y = scrollY;
			r.focusClose('claim');
			out.focusClaim = document.activeElement === f1 && scrollY === y;
			r.focusClose('contact');
			out.focusContact = document.activeElement === f2 && scrollY === y;
			return out;
		});
		check('anchorY("top") is the top of the ground', c.top === 0, `${c.top}`);
		check('surfaceY() is the soil edge, a few px under the top of #roots', c.surface0 > 0 && c.surface0 < 26, `${c.surface0}`);
		check('surfaceY() follows the scroll', Math.abs(c.surface300 - (c.surface0 - 300)) < 0.01, `${c.surface300} after scrolling 300`);
		check('anchorY("first-node") puts node 1 whole on screen', c.first.top >= 0 && c.first.bottom <= c.first.vh, `y ${c.first.y}; bulb ${c.first.top.toFixed(0)}..${c.first.bottom.toFixed(0)} of ${c.first.vh}`);
		check('anchorY("close") puts F1 and F2 on screen', c.close.f1 >= 0 && c.close.f2 <= c.close.vh, `y ${c.close.y} (page ends at ${c.close.max}); F1 top ${c.close.f1.toFixed(0)}, F2 bottom ${c.close.f2.toFixed(0)} of ${c.close.vh}`);
		check('focusClose("claim") focuses F1 without scrolling', c.focusClaim);
		check('focusClose("contact") focuses F2 without scrolling', c.focusContact);

		// The network: nothing before, everything after showGrown, grown again by growFrom.
		const g = await page.evaluate(async () => {
			const r = window.__cellestial.roots;
			const ink = () => {
				let n = 0;
				for (const c of document.querySelectorAll('.roots-net canvas')) {
					if (!c.width || !c.height || c.dataset.role === 'pulse') continue;
					const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
					for (let i = 3; i < d.length; i += 16) if (d[i] > 8) n++;
				}
				return n;
			};
			const lit = () => document.querySelectorAll('.roots-node[data-lit]').length;
			const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
			const out = {};
			scrollTo(0, 0);
			await sleep(400);
			out.grown = { ink: ink(), lit: lit() };
			out.stats = r.debug.net.debug.stats();
			out.times = r.debug.net.debug.times(innerWidth * 0.3);
			r.setActive(false);
			out.off = { ink: ink(), lit: lit(), grown: r.debug.state().grown };
			r.setActive(true);
			out.onAgain = { ink: ink(), lit: lit() };
			const t0 = performance.now();
			const x = innerWidth * 0.3;
			await r.growFrom(x);
			out.resolved = { ms: performance.now() - t0, lit: lit(), first: document.querySelector('.roots-node').hasAttribute('data-lit'), ink: ink() };
			while (r.debug.net.debug.busy() && performance.now() - t0 < 20000) await sleep(100);
			out.grewIn = performance.now() - t0;
			await sleep(500);
			out.settled = { lit: lit(), ink: ink() };
			r.setActive(false);
			r.setActive(true);
			r.showGrown();
			await sleep(400);
			out.shownAgain = { lit: lit(), ink: ink() };
			return out;
		});
		check('showGrown(): the network is drawn and all five nodes are lit', g.grown.ink > 500 && g.grown.lit === 5, `${g.grown.ink} lit samples, ${g.grown.lit} nodes`);
		check('setActive(false): the ground is bare again', g.off.ink === 0 && g.off.lit === 0 && g.off.grown === false, `${g.off.ink} samples, ${g.off.lit} nodes`);
		check('setActive(true) alone shows nothing (the arrival grows it)', g.onAgain.ink === 0 && g.onAgain.lit === 0);
		say(`     the network: ${g.stats.strands} threads, ${g.stats.points} points, ${g.stats.joints} joints, in ${g.stats.bands} bands`);
		check('growFrom(x) resolves once the light has passed the first node', g.resolved.first && g.resolved.lit < 5 && g.resolved.ms > 150 && g.resolved.ms < 2500, `${g.resolved.ms.toFixed(0)} ms after an impact at 30% of the width, ${g.resolved.lit} node(s) lit then; nodes light at ${g.times.nodes.map((t) => Math.round(t)).join(', ')} ms; all grown at ${Math.round(g.times.settled)} ms`);
		check('growFrom(x) goes on to the whole network', g.settled.lit === 5 && Math.abs(g.settled.ink - g.grown.ink) / g.grown.ink < 0.02, `${g.settled.lit} nodes, ${g.settled.ink} samples (showGrown: ${g.grown.ink}), ${Math.round(g.grewIn)} ms on this machine`);
		check('showGrown() after another arrival draws the same network', g.shownAgain.ink === g.grown.ink && g.shownAgain.lit === 5, `${g.shownAgain.ink} samples`);

		// The nodes: five real buttons, named by their offer, each deeper than the last.
		const nodes = await page.evaluate(() =>
			[...document.querySelectorAll('.roots-node__bulb')].map((b) => {
				const r = b.getBoundingClientRect();
				return { tag: b.tagName, name: b.textContent.trim(), y: r.top + scrollY + r.height / 2, x: r.left + r.width / 2, d: r.width, disabled: b.disabled, hidden: b.getAttribute('aria-hidden') };
			}),
		);
		check('five nodes, each a real button', nodes.length === 5 && nodes.every((n) => n.tag === 'BUTTON' && !n.disabled && n.hidden === null));
		for (let i = 0; i < 5; i++) {
			const count = await page.getByRole('button', { name: TITLES[i], exact: true }).count();
			check(`node ${i + 1} is named "${TITLES[i]}"`, count === 1 && nodes[i].name === TITLES[i], `${count} button(s) by that name`);
		}
		const gaps = nodes.slice(1).map((n, i) => Math.round(n.y - nodes[i].y));
		const vh = page.viewportSize().height;
		check('each node is deeper than the last, with a stretch of soil between', gaps.every((d) => d > vh * 0.6), `bulb to bulb ${gaps.join(', ')} px on a ${vh} px screen; bulb ${nodes[0].d.toFixed(0)} px across; x ${nodes.map((n) => Math.round(n.x)).join(', ')}`);
		const e6 = await page.evaluate(() => {
			const b = document.querySelector('#roots [data-ascend]');
			const r = b.getBoundingClientRect();
			return { y: r.top + scrollY, h: r.height, w: r.width, x: r.left + r.width / 2, label: b.getAttribute('aria-label'), text: b.textContent.trim() };
		});
		check('E6 is at the top of the ground, without words, named "Return to the sky"', e6.y < 160 && e6.label === 'Return to the sky' && e6.text === '', `top ${e6.y.toFixed(0)} px, ${e6.w}x${e6.h}, centre x ${e6.x.toFixed(0)}`);
		check('no page errors', real(errors).length === 0, real(errors).join(' | '));
		await context.close();
	}
}

if (only.has('tiles')) {
	for (const size of ['desk', 'phone', 'narrow']) {
		section(`tiles, ${size}`);
		const { page, errors, context } = await openPage(browser, size, URL);
		await rootsReady(page);
		const touch = size !== 'desk';
		const press = async (id) => {
			const bulb = page.locator(`.roots-stop[data-offer="${id}"] .roots-node__bulb`);
			await bulb.scrollIntoViewIfNeeded();
			await page.waitForTimeout(150);
			if (touch) await bulb.tap();
			else await bulb.click();
			await page.waitForTimeout(900); // the tile's fade and the scroll into view
		};
		let s = await tileState(page);
		check('at first no tile is open', openIds(s).length === 0);
		for (const id of IDS) {
			await press(id);
			s = await tileState(page);
			const t = s.tiles[id];
			const logo = t.left < 110 && t.top < 80;
			check(`${id}: a ${touch ? 'tap' : 'click'} opens it and only it`, openIds(s).join() === id && t.expanded === 'true', `open: ${openIds(s).join(', ') || 'none'}`);
			check(`${id}: focus is in the tile`, s.focus === `tile:offer-${id}`, s.focus);
			check(`${id}: whole on the screen, no taller than it, clear of the logo`, t.top >= 0 && t.bottom <= s.vh && t.left >= 0 && t.right <= s.vw && !logo, `x ${t.left.toFixed(0)}..${t.right.toFixed(0)} of ${s.vw}, y ${t.top.toFixed(0)}..${t.bottom.toFixed(0)} of ${s.vh} (${(t.bottom - t.top).toFixed(0)} px tall)`);
		}
		// The close button.
		await page.locator('.roots-tile[data-open] [data-tile-close]').click();
		await page.waitForTimeout(400);
		s = await tileState(page);
		check('the close button closes it and focus returns to its node', openIds(s).length === 0 && s.focus === 'bulb:care' && s.tiles.care.expanded === 'false', s.focus);
		// Escape.
		await press('app');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(400);
		s = await tileState(page);
		check('Escape closes it and focus returns to its node', openIds(s).length === 0 && s.focus === 'bulb:app', s.focus);
		// A click outside: on bare soil at the left edge, level with the node.
		await press('systems');
		s = await tileState(page);
		const t = s.tiles.systems;
		const outside = t.top > 60 ? { x: s.vw - 8, y: t.top - 30 } : { x: 6, y: t.bottom + 20 };
		if (touch) await page.touchscreen.tap(outside.x, outside.y);
		else await page.mouse.click(outside.x, outside.y);
		await page.waitForTimeout(400);
		s = await tileState(page);
		check('a press outside closes it and focus returns to its node', openIds(s).length === 0 && s.focus === 'bulb:systems', `pressed at ${outside.x}, ${outside.y.toFixed(0)}; focus ${s.focus}`);
		// The same node again closes its own tile.
		await press('site');
		await press('site');
		s = await tileState(page);
		check('pressing the open tile’s own node closes it', openIds(s).length === 0);
		const st = await page.evaluate(() => window.__cellestial.roots.debug.state());
		check('what was opened is remembered as read', st.read.length === 5, st.read.join(', '));
		check('no page errors', real(errors).length === 0, real(errors).join(' | '));
		await context.close();
	}
}

if (only.has('chrome')) {
	for (const size of ['desk', 'phone']) {
		section(`chrome and close, ${size}`);
		const { page, errors, context } = await openPage(browser, size, URL);
		await rootsReady(page);
		const menu = async (dest) => {
			await page.locator('#chrome .chrome-bars').click();
			await page.locator(`#chrome-menu [data-dest="${dest}"]`).click();
			await page.waitForTimeout(1500);
		};
		await page.evaluate(() => scrollTo(0, 1500));
		await menu('build');
		let v = await page.evaluate(() => ({ scene: document.documentElement.dataset.scene, y: scrollY, top: window.__cellestial.roots.anchorY('top'), grown: window.__cellestial.roots.debug.state().grown }));
		check('menu "What we build" lands on the top of the ground, grown', v.scene === 'roots' && v.y === v.top && v.grown, `scrollY ${v.y}`);
		await menu('claim');
		v = await page.evaluate(() => {
			const f1 = document.querySelector('#roots [data-open-claim]');
			const r = f1.getBoundingClientRect();
			return { focus: document.activeElement === f1, top: r.top, bottom: r.bottom, vh: innerHeight, dialog: !!document.querySelector('dialog[open]') };
		});
		check('menu "Claim your star" lands on F1, focused, on screen', v.focus && v.top >= 0 && v.bottom <= v.vh && !v.dialog, `F1 at ${v.top.toFixed(0)}..${v.bottom.toFixed(0)} of ${v.vh}`);
		await page.evaluate(() => scrollTo(0, 0));
		await menu('contact');
		v = await page.evaluate(() => ({ open: document.querySelector('#contact-dialog')?.open === true, y: scrollY, close: window.__cellestial.roots.anchorY('close') }));
		check('menu "Contact me" lands on the Close and opens the message box', v.open && v.y === v.close, `scrollY ${v.y}`);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);
		const texts = await page.evaluate(() => {
			const c = document.querySelector('.roots-close');
			const kids = [...c.children].map((k) => ({ tag: k.tagName, text: k.textContent.trim(), href: k.getAttribute('href'), h: k.getBoundingClientRect().height, w: k.getBoundingClientRect().width, top: k.getBoundingClientRect().top, cx: k.getBoundingClientRect().left + k.getBoundingClientRect().width / 2, size: getComputedStyle(k).fontSize }));
			return { kids, all: c.textContent.replace(/\s+/g, ' ').trim(), vw: innerWidth };
		});
		const [a, b] = texts.kids;
		check('the Close is exactly two links: "Claim your star", then "Contact me"', texts.kids.length === 2 && a.text === 'Claim your star' && b.text === 'Contact me' && a.tag === 'A' && b.tag === 'A' && a.href === '/contact' && b.href === '/contact', JSON.stringify(texts.all));
		check('F1 is the larger, F2 smaller directly under it, both centred', a.h > b.h && a.w > b.w && b.top > a.top + a.h && Math.abs(a.cx - texts.vw / 2) < 1 && Math.abs(b.cx - texts.vw / 2) < 1, `F1 ${a.w.toFixed(0)}x${a.h.toFixed(0)} at ${a.size}; F2 ${b.w.toFixed(0)}x${b.h.toFixed(0)} at ${b.size}, ${(b.top - a.top - a.h).toFixed(0)} px under it`);
		await page.locator('#roots [data-open-claim]').click();
		await page.waitForTimeout(600);
		check('F1 opens the build request', await page.evaluate(() => document.querySelector('#claim-dialog')?.open === true));
		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);
		await page.locator('#roots [data-open-contact]').click();
		await page.waitForTimeout(600);
		check('F2 opens the message box', await page.evaluate(() => document.querySelector('#contact-dialog')?.open === true));
		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);
		await page.evaluate(() => scrollTo(0, 0));
		await page.locator('#roots [data-ascend]').click();
		await page.waitForTimeout(1500);
		v = await page.evaluate(() => ({ scene: document.documentElement.dataset.scene, state: window.__cellestial.roots.debug.state() }));
		check('E6 returns to the sky, and the ground is left bare for the next arrival', v.scene === 'sky' && !v.state.active && !v.state.grown, v.scene);
		check('no page errors', real(errors).length === 0, real(errors).join(' | '));
		await context.close();
	}
}

if (only.has('nojs')) {
	for (const size of ['desk', 'phone']) {
		for (const mode of ['script off', 'the scene’s script blocked']) {
			section(`no script (${mode}), ${size}`);
			const off = mode === 'script off';
			const { page, context } = await openPage(browser, size, null, off ? { javaScriptEnabled: false } : {});
			if (!off) await page.route(/experience\/roots\/|roots[.-][\w-]*\.js/, (route) => route.abort());
			await page.goto(off ? `${values.url}/` : URL, { waitUntil: 'load' });
			await page.waitForTimeout(off ? 300 : 1500);
			if (!off) await page.evaluate(() => {});
			const v = await page.evaluate(() => {
				const tiles = [...document.querySelectorAll('.roots-tile')].map((t) => {
					const r = t.getBoundingClientRect();
					return { id: t.id, top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, shown: getComputedStyle(t).display !== 'none' && getComputedStyle(t).visibility === 'visible', title: t.querySelector('h2').textContent, chars: t.querySelector('.roots-tile__body').textContent.replace(/\s+/g, ' ').trim().length, close: getComputedStyle(t.querySelector('[data-tile-close]')).display };
				});
				const links = [...document.querySelectorAll('.roots-close a')].map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), top: a.getBoundingClientRect().top + scrollY }));
				const nodes = [...document.querySelectorAll('.roots-node')].map((n) => { const r = n.getBoundingClientRect(); return { top: r.top + scrollY, w: r.width, op: getComputedStyle(n).opacity, disabled: n.querySelector('button').disabled }; });
				const e6 = document.querySelector('#roots [data-ascend]');
				return { tiles, links, nodes, e6: getComputedStyle(e6).display, live: document.getElementById('roots').hasAttribute('data-live'), sw: document.documentElement.scrollWidth, vw: innerWidth, soil: getComputedStyle(document.querySelector('.roots-soil')).backgroundImage.includes('soil') };
			});
			check('the scene’s script is not running', !v.live);
			check('all five tiles are shown, in order', v.tiles.length === 5 && v.tiles.every((t) => t.shown) && v.tiles.map((t) => t.title).join('|') === TITLES.join('|'));
			check('one under another, nothing overlapping', v.tiles.every((t, i) => i === 0 || t.top > v.tiles[i - 1].bottom), v.tiles.map((t) => `${Math.round(t.top)}..${Math.round(t.bottom)}`).join(', '));
			check('every tile inside the screen’s width', v.tiles.every((t) => t.left >= 0 && t.right <= v.vw) && v.sw <= v.vw, `page ${v.sw} px wide on ${v.vw}`);
			check('every tile has its words', v.tiles.every((t) => t.chars > 100), v.tiles.map((t) => t.chars).join(', '));
			check('the nodes are pictures: visible, not controls', v.nodes.every((n) => n.op === '1' && n.w > 100 && n.disabled));
			if (off) check('no close buttons, no return button', v.tiles.every((t) => t.close === 'none') && v.e6 === 'none');
			check('the soil is there', v.soil);
			check('the two links, both to /contact, under the last tile', v.links.length === 2 && v.links[0].text === 'Claim your star' && v.links[1].text === 'Contact me' && v.links.every((l) => l.href === '/contact') && v.links[0].top > v.tiles[4].bottom);
			await context.close();
		}
	}
}

await browser.close();
say(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
if (values.only === 'contract,tiles,chrome,keys,phones,still,nojs,frames') {
	mkdirSync(join(ROOT, 'refs/roots'), { recursive: true });
	writeFileSync(join(ROOT, 'refs/roots/measure.txt'), `${lines.join('\n')}\n`);
}
process.exit(failed === 0 ? 0 : 1);
