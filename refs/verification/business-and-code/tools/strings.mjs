// Every string a visitor can see (or a screen reader can hear) on the home page, and where
// it comes from. Production build. Run: node refs/verification/business-and-code/tools/strings.mjs
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { BASE, DESK, HERE, launch, openPage, sleep } from './lib.mjs';

const ROOT = path.join(HERE, '..', '..', '..', '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const git = (p) => execSync(`git show a31d2ee:${p}`, { cwd: ROOT, encoding: 'utf8' });
const norm = (s) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
const SOURCES = [
	['SPEC-ADDENDUM.md', norm(read('SPEC-ADDENDUM.md'))],
	['BUILD_SPEC.md', norm(read('BUILD_SPEC.md'))],
	['MASTER-PROMPT.md', norm(read('MASTER-PROMPT.md'))],
	['the form as it was on the live site (a31d2ee: ContactForm.astro, ClaimDialog.astro, contact-submit.ts)', norm(git('src/components/ContactForm.astro') + git('src/components/ClaimDialog.astro') + git('src/scripts/contact-submit.ts'))],
	['src/content/home.json (unchanged, the CMS file)', norm(read('src/content/home.json'))],
	["the contact Worker's own error text (workers/contact, unchanged)", norm(read('workers/contact/src/index.ts'))],
];
let sheet = null;
try {
	sheet = norm(readFileSync('/home/poe/Downloads/Cellestial-Setup-Pack-2026-11-19/payload/reference/redesign-spec-sheet-2026-11-18.md', 'utf8'));
	SOURCES.push(["the owner's Nov 18 spec sheet (NOT in the repo: ~/Downloads/Cellestial-Setup-Pack-2026-11-19/payload/reference/redesign-spec-sheet-2026-11-18.md)", sheet]);
} catch {}
const sourceOf = (s) => {
	const n = norm(s);
	for (const [name, text] of SOURCES) if (text.includes(n)) return name;
	// The prices are shown without the hidden word "slashed".
	const withSlashed = n.replace(' → ', ' slashed → ');
	if (SOURCES[0][1].includes(withSlashed)) return 'SPEC-ADDENDUM.md (the word "slashed" is hidden from sight)';
	return null;
};

const VISIBLE = () => {
	const seen = [];
	const heard = [];
	const ok = (el) => {
		for (let a = el; a; a = a.parentElement) {
			const s = getComputedStyle(a);
			if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
			if (a.matches?.('dialog:not([open]), [popover]:not(:popover-open), [hidden]')) return false;
		}
		return true;
	};
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const t = n.nodeValue.replace(/\s+/g, ' ').trim();
		const el = n.parentElement;
		if (!t || !el || el.closest('script,style,noscript,iframe')) continue;
		if (!ok(el)) continue;
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle(el);
		const clipped = r.width <= 2 || r.height <= 2 || cs.clipPath === 'inset(50%)' || cs.clip === 'rect(0px, 0px, 0px, 0px)';
		(clipped ? heard : seen).push(t);
	}
	for (const el of document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) {
		if (!ok(el)) continue;
		for (const a of ['aria-label', 'title', 'alt', 'placeholder']) {
			const v = el.getAttribute(a);
			if (v) heard.push(`${a}: ${v}`);
		}
	}
	// Generated content.
	for (const el of document.querySelectorAll('body *')) {
		if (!ok(el)) continue;
		for (const pseudo of ['::before', '::after']) {
			const c = getComputedStyle(el, pseudo).content;
			if (c && c !== 'none' && c !== 'normal' && c !== '""' && !/^url|^counter|attr\(/.test(c)) seen.push(`(generated ${pseudo}) ${c}`);
		}
	}
	return { seen, heard };
};

const browser = await launch();
const all = new Map(); // string -> { states:Set, heardOnly:boolean }
const add = (state, { seen, heard }) => {
	for (const s of seen) { const e = all.get(s) ?? { states: new Set(), seen: false }; e.states.add(state); e.seen = true; all.set(s, e); }
	for (const s of heard) { const e = all.get(s) ?? { states: new Set(), seen: false }; e.states.add(state); all.set(s, e); }
};

{
	const { context, page } = await openPage(browser, DESK, { stub: { status: 400, json: { error: 'The spam check did not pass. Please try again.' } } });
	const snap = async (state) => add(state, await page.evaluate(VISIBLE));
	await page.goto(`${BASE}/?debug`, { waitUntil: 'commit' });
	for (const at of [800, 3000, 5500]) { await sleep(at === 800 ? 800 : 2400); await snap('loader'); }
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 20000 });
	await page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(2000);
	await snap('sky');
	await page.click('.chrome-bars'); await sleep(300); await snap('menu'); await page.keyboard.press('Escape');
	await page.click('#sky-ui .sky-star[data-slot="slot-34"]'); await sleep(700); await snap('empty-star panel (B10)'); await page.keyboard.press('Escape');
	await page.mouse.click(720, 700); await sleep(1200); await snap('"claim yours" (B9)');
	await context.close();
}
{
	// A lit star, B11, and a completed figure (Aries, then Leo): seeded on this device.
	const { context, page } = await openPage(browser, DESK, { stub: { status: 400, json: { error: 'The spam check did not pass. Please try again.' } } });
	const lit = [];
	for (const name of ['Aries', 'Leo']) for (const st of CONSTELLATIONS.find((c) => c.name === name).stars) if (st.slot) lit.push({ slot: st.slot, ask: 'A site for my bakery.' });
	lit.push({ slot: 'slot-3', ask: 'A site for my bakery.' });
	await context.addInitScript((claims) => { try { localStorage.setItem('cellestial:claims', JSON.stringify(claims)); } catch {} }, lit);
	const snap = async (state) => add(state, await page.evaluate(VISIBLE));
	await page.goto(`${BASE}/?scene=sky&rm=1&debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots, null, { timeout: 20000 });
	await page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1500);
	await snap('sky, still: B11');
	await page.click('#sky-ui .sky-star[data-slot="slot-3"]');
	await page.waitForFunction(() => !document.querySelector('[data-sky-panel="lit"]').hidden, null, { timeout: 8000 }).catch(() => {});
	await sleep(500); await snap('lit-star panel (the ask is the visitor\'s own words)'); await page.keyboard.press('Escape');
	for (const name of ['Aries', 'Leo']) {
		const i = CONSTELLATIONS.findIndex((c) => c.name === name);
		await page.evaluate((k) => window.__cellestial.sky.debug?.setCoord?.(k), i).catch(() => {});
		await sleep(2500);
		await snap(`B7: ${name} complete`);
	}
	// The Roots.
	await page.goto(`${BASE}/?scene=roots&debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.roots, null, { timeout: 20000 });
	await sleep(1200);
	await snap('roots');
	for (let i = 0; i < 5; i++) {
		const node = page.locator('#roots .roots-node__bulb').nth(i);
		await node.scrollIntoViewIfNeeded(); await node.click(); await sleep(450);
		await snap(`roots: tile ${i + 1}`);
		await page.keyboard.press('Escape'); await sleep(200);
	}
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
	await snap('close');
	await page.click('#roots [data-open-claim]'); await page.waitForSelector('#claim-dialog[open]'); await sleep(300);
	await snap('build request dialog');
	await page.fill('#claim-form-name', 'T'); await page.fill('#claim-form-email', 't@example.com'); await page.fill('#claim-form-message', 'x');
	await page.click('#claim-form button[type="submit"]'); await sleep(150); await snap('build request dialog: sending / failed'); await sleep(800); await snap('build request dialog: sending / failed');
	await page.keyboard.press('Escape');
	await page.click('#roots [data-open-contact]'); await page.waitForSelector('#contact-dialog[open]'); await sleep(300);
	await snap('message box dialog');
	const head = await page.evaluate(() => ({ title: document.title, description: document.querySelector('meta[name="description"]')?.content }));
	add('browser tab / search result', { seen: [`<title> ${head.title}`, `<meta description> ${head.description}`], heard: [] });
	await context.close();
}
{
	const { context, page } = await openPage(browser, DESK, { js: false });
	await page.goto(`${BASE}/`, { waitUntil: 'load' });
	add('without script', await page.evaluate(VISIBLE));
	await context.close();
}
await browser.close();

const meanings = new Map(CONSTELLATIONS.map((c) => [c.meaning, c.name]));
const lines = [];
let unsourced = 0;
for (const [s, e] of [...all.entries()].sort((a, b) => Number(b[1].seen) - Number(a[1].seen))) {
	const bare = s.replace(/^(aria-label|title|alt|placeholder): /, '').replace(/^<(title|meta description)> /, '').replace(/^\(generated ::(before|after)\) "?|"$/g, '');
	let src = sourceOf(bare);
	if (!src && bare === 'A site for my bakery.') src = "(the visitor's own ask, seeded by this script)";
	if (!src && bare === 'studio') src = 'BUILD_SPEC.md C1 ("the word \\"studio\\"")';
	if (!src && bare === 'T' ) continue;
	if (!src) unsourced++;
	lines.push(`${e.seen ? 'SEEN ' : 'heard'} | ${JSON.stringify(s)} | ${[...e.states].join('; ')} | ${src ?? '*** NO SOURCE FOUND ***'}`);
}
lines.push('', `${all.size} strings; ${unsourced} with no source found in the spec, the addendum, the master prompt, the owner's Nov 18 sheet, the old form or the Worker`);
writeFileSync(path.join(HERE, '..', 'strings.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
