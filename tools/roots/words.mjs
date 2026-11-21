#!/usr/bin/env node
// The words of the Roots, checked in the browser against the locked copy.
//
//   node tools/roots/words.mjs [--url http://localhost:4500]
//
// Needs the dev server running. The copy is locked in SPEC-ADDENDUM.md
// ("Roots tile copy"); src/content/offers.ts holds it as data. This opens the
// real page three ways (1440x900 and 390x844 with script, each tile opened by
// its node; 390x844 with script off, every tile open) and for each tile checks:
//
//   - the tile body's textContent, whitespace collapsed and trimmed, is
//     offerText(OFFERS[i]), and is the addendum's paragraph with its ** marks
//     and its "N. Title:" lead-in taken off, character for character
//   - what the eye can read is visibleText(OFFERS[i])
//   - the heading is OFFERS[i].title, and the addendum's title
//   - the words set in brass are exactly the addendum's bold words
//   - "$990" and "$69/mo" are struck through, "FREE" and "$39/mo" follow them,
//     and "slashed" is in the text and cannot be seen
//   - body text is at least 16 px
//
// Then it lists every string a visitor can see in the scene and where it
// comes from; a string that is not from the addendum or the brief ("Claim
// your star", "Contact me") is a fault. Names that are heard and not seen
// (aria-label, visually hidden text) are listed apart.
//
// Prints everything, writes it to refs/roots/words.txt, exits non-zero on any fault.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch, openPage, ROOT, rootsReady } from './lib.mjs';

const { OFFERS, offerText, visibleText } = await import(join(ROOT, 'src/content/offers.ts'));
const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:4500' } } });

const lines = [];
let failed = 0;
const say = (t = '') => {
	lines.push(t);
	console.log(t);
};
/** Compare two strings; on a difference say where. */
const same = (name, got, want) => {
	if (got === want) {
		say(`ok   ${name} (${want.length} characters)`);
		return;
	}
	failed++;
	let i = 0;
	while (i < got.length && i < want.length && got[i] === want[i]) i++;
	say(`FAIL ${name}: differs at character ${i}`);
	say(`       page: …${JSON.stringify(got.slice(Math.max(0, i - 20), i + 30))}`);
	say(`       want: …${JSON.stringify(want.slice(Math.max(0, i - 20), i + 30))}`);
};
const check = (name, ok, detail = '') => {
	if (!ok) failed++;
	say(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail === '' ? '' : ` — ${detail}`}`);
};

// ── The addendum, read here and now: lines 24, 26, 28, 30 and 33 ──────────
const md = readFileSync(join(ROOT, 'SPEC-ADDENDUM.md'), 'utf8').split(/\r?\n/);
const ADDENDUM = [24, 26, 28, 30, 33].map((n) => {
	const raw = md[n - 1];
	const m = /^\*\*(\d+)\. (.+?):\*\* (.+)$/.exec(raw);
	if (!m) throw new Error(`SPEC-ADDENDUM.md line ${n} is not a tile paragraph: ${raw}`);
	const parts = m[3].split('**');
	return { line: n, title: m[2], text: parts.join(''), bold: parts.filter((_, i) => i % 2 === 1) };
});

/** Everything the page can tell about one tile. Runs in the page. */
const readTile = (id) => {
	const tile = document.getElementById(`offer-${id}`);
	const body = tile.querySelector('.roots-tile__body');
	const squash = (s) => s.replace(/\s+/g, ' ').trim();
	const seen = (el) => {
		for (let e = el; e && e !== tile.parentElement; e = e.parentElement) {
			const cs = getComputedStyle(e);
			if (cs.display === 'none' || cs.visibility !== 'visible' || Number(cs.opacity) === 0) return false;
			if (cs.clipPath !== 'none') return false;
			if (e !== tile && e.tagName !== 'P' && e.tagName !== 'DIV') {
				const r = e.getBoundingClientRect();
				if (r.width <= 2 || r.height <= 2) return false;
			}
		}
		return true;
	};
	const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
	let visible = '';
	const brass = [];
	const struck = [];
	const hidden = [];
	let run = null; // adjacent brass text in one paragraph is one run
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const el = n.parentElement;
		const isSeen = seen(el);
		if (isSeen) visible += n.data;
		else if (n.data.trim() !== '') hidden.push(n.data);
		if (n.data.trim() === '' && el === body) {
			run = null;
			continue;
		}
		const cs = getComputedStyle(el);
		const isBrass = cs.color === 'rgb(174, 138, 104)';
		if (isBrass) {
			if (run && run.p === el.closest('p')) run.text += n.data;
			else {
				run = { p: el.closest('p'), text: n.data };
				brass.push(run);
			}
			if (isSeen && cs.textDecorationLine.includes('line-through')) struck.push(n.data);
		} else run = null;
	}
	const sizes = [...body.querySelectorAll('p')].map((p) => Number.parseFloat(getComputedStyle(p).fontSize));
	const h = tile.querySelector('h2');
	return {
		text: squash(body.textContent),
		visible: squash(visible),
		title: h.textContent,
		titleSeen: seen(h),
		brass: brass.map((b) => b.text),
		struck,
		hidden,
		minFont: Math.min(...sizes),
		white: getComputedStyle(body.querySelector('p')).color,
	};
};

/** Every text a visitor can see inside #roots right now. Runs in the page. */
const seenStrings = () => {
	const root = document.getElementById('roots');
	const out = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (n.data.trim() === '') continue;
		let ok = true;
		for (let e = n.parentElement; e && e !== root.parentElement; e = e.parentElement) {
			const cs = getComputedStyle(e);
			const r = e.getBoundingClientRect();
			if (cs.display === 'none' || cs.visibility !== 'visible' || cs.clipPath !== 'none' || Number(cs.opacity) === 0 || ((r.width <= 2 || r.height <= 2) && e !== root)) ok = false;
		}
		if (ok) out.push(n.data);
	}
	return out;
};

/** Names that are heard and not seen. Runs in the page. */
const heard = () => {
	const root = document.getElementById('roots');
	const out = [];
	for (const el of [root, ...root.querySelectorAll('[aria-label]')]) {
		const v = el.getAttribute('aria-label');
		if (v) out.push(`aria-label on <${el.tagName.toLowerCase()}${el.id ? ` #${el.id}` : ''}${el.className ? ` .${String(el.className).split(' ')[0]}` : ''}>: ${JSON.stringify(v)}`);
	}
	for (const el of root.querySelectorAll('.roots-sr, .sr-only')) out.push(`visually hidden text in <${el.parentElement.tagName.toLowerCase()}>: ${JSON.stringify(el.textContent)}`);
	for (const el of root.querySelectorAll('img')) out.push(`img alt: ${JSON.stringify(el.getAttribute('alt'))}`);
	return [...new Set(out)];
};

// ── Where a visible string may come from ───────────────────────────────────
const SOURCES = new Map();
const source = (text, from) => SOURCES.set(text, SOURCES.has(text) ? `${SOURCES.get(text)}; ${from}` : from);
OFFERS.forEach((o, i) => {
	source(o.title, `offers.ts OFFERS[${i}].title = addendum line ${ADDENDUM[i].line}, the tile's name`);
	for (const line of o.lines) for (const seg of line) if (!seg.srOnly) source(seg.text, `offers.ts OFFERS[${i}] (${o.id}) = addendum line ${ADDENDUM[i].line}`);
});
source('Claim your star', 'the brief and BUILD_SPEC F1');
source('Contact me', 'the brief and BUILD_SPEC F2');

const browser = await launch();
const RUNS = [
	{ name: '1440x900, script on, each tile opened by its node', size: 'desk', js: true },
	{ name: '390x844, script on, each tile opened by its node', size: 'phone', js: true },
	{ name: '390x844, script off, every tile open', size: 'phone', js: false },
];
const allSeen = new Set();
let heardNames = [];
for (const run of RUNS) {
	say(`\n# ${run.name}`);
	const { page, errors, context } = await openPage(browser, run.size, null, run.js ? {} : { javaScriptEnabled: false });
	await page.goto(`${values.url}/?scene=roots&debug`, { waitUntil: 'load' });
	if (run.js) await rootsReady(page);
	else await page.waitForTimeout(400);
	for (const s of await page.evaluate(seenStrings)) allSeen.add(s);
	for (let i = 0; i < OFFERS.length; i++) {
		const o = OFFERS[i];
		const a = ADDENDUM[i];
		if (run.js) {
			const bulb = page.locator(`.roots-stop[data-offer="${o.id}"] .roots-node__bulb`);
			await bulb.scrollIntoViewIfNeeded();
			if (run.size === 'desk') await bulb.click();
			else await bulb.tap();
			await page.waitForTimeout(700);
			for (const s of await page.evaluate(seenStrings)) allSeen.add(s);
		}
		const t = await page.evaluate(readTile, o.id);
		say(`\n## tile ${i + 1}, "${o.title}" (addendum line ${a.line})`);
		same('textContent === offerText(OFFERS[i])', t.text, offerText(o));
		same('textContent === the addendum, ** and lead-in removed', t.text, a.text);
		same('what the eye reads === visibleText(OFFERS[i])', t.visible, visibleText(o));
		same('heading === OFFERS[i].title', t.title, o.title);
		same('heading === the addendum’s title', t.title, a.title);
		check('the heading can be seen', t.titleSeen);
		check('the brass words are exactly the addendum’s bold words', JSON.stringify(t.brass) === JSON.stringify(a.bold), `brass on the page: ${JSON.stringify(t.brass)}; bold in the addendum: ${JSON.stringify(a.bold)}`);
		const wantStruck = o.lines.flat().filter((s) => s.strike).map((s) => s.text);
		check('struck through', JSON.stringify(t.struck) === JSON.stringify(wantStruck), JSON.stringify(t.struck));
		if (o.id === 'site') {
			check('"$990" struck with "FREE" after it; "$69/mo" struck with "$39/mo" after it', t.visible.includes('$990 → FREE') && t.visible.includes('$69/mo → $39/mo'));
			check('"slashed" is in the text and cannot be seen', t.text.includes('$990 slashed → FREE') && t.text.includes('$69/mo slashed → $39/mo') && !t.visible.includes('slashed') && JSON.stringify(t.hidden) === '[" slashed"," slashed"]', `hidden: ${JSON.stringify(t.hidden)}`);
		} else check('nothing in this tile is hidden from sight', t.hidden.length === 0, JSON.stringify(t.hidden));
		check('body text is at least 16 px', t.minFont >= 16, `${t.minFont} px`);
	}
	if (run.js) heardNames = await page.evaluate(heard);
	const real = errors.filter((e) => !/turnstile|cloudflare|sandboxed/i.test(e));
	check('no page errors', real.length === 0, real.join(' | '));
	await context.close();
}
await browser.close();

say('\n# Every string a visitor can see in the scene, and where it comes from');
for (const s of allSeen) {
	const from = SOURCES.get(s);
	if (!from) failed++;
	say(`${from ? 'ok  ' : 'FAIL'} ${JSON.stringify(s)} — ${from ?? 'NOT from the addendum or the brief'}`);
}
say(`\n${allSeen.size} different strings seen (closed, each tile open, and the page without script).`);
say('\n# Heard and not seen (accessible names; allowed by the brief)');
for (const h of heardNames) say(`     ${h}`);

say(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
writeFileSync(join(ROOT, 'refs/roots/words.txt'), `${lines.join('\n')}\n`);
process.exit(failed === 0 ? 0 : 1);
