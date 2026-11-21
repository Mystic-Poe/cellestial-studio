// Contrast of every text colour on what is really behind it. Production build.
// For each state of the page: every element that holds visible text is found, and the screen is
// photographed twice, as it is and with every glyph made transparent. Where the two differ is
// the text: its colour is read from the pixels of the first photograph that changed most (the
// cores of the strokes, so gradients, clipped backgrounds and opacity are all in it), and what
// is behind it from the second: the median, and the twentieth of it nearest the text's own
// lightness (the worst case). Nothing is taken from the stylesheet. WCAG AA: 4.5:1, or 3:1 for
// large text (24 px, or 18.66 px bold).
// Run: node refs/verification/business-and-code/tools/contrast.mjs
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { BASE, DESK, HERE, launch, openPage, PHONE, sleep } from './lib.mjs';

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]; return (hi + 0.05) / (lo + 0.05); };
const over = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const COLLECT = () => {
	const out = [];
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	const seenEl = new Set();
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		if (!n.nodeValue.trim()) continue;
		const el = n.parentElement;
		if (!el || seenEl.has(el) || el.closest('script,style,noscript,[data-contrast-skip]')) continue;
		const cs = getComputedStyle(el);
		if (cs.visibility === 'hidden' || cs.display === 'none') continue;
		let opacity = 1;
		let hidden = false;
		for (let a = el; a; a = a.parentElement) {
			const s = getComputedStyle(a);
			opacity *= Number(s.opacity);
			if (s.display === 'none' || s.visibility === 'hidden') hidden = true;
			if (a.matches?.('dialog:not([open]), [popover]:not(:popover-open), [hidden]')) hidden = true;
		}
		if (hidden || opacity < 0.05) continue;
		const range = document.createRange();
		range.selectNodeContents(n);
		const rects = [...range.getClientRects()].filter((r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth);
		if (!rects.length) continue;
		// Clipped to nothing (visually hidden text)?
		const box = el.getBoundingClientRect();
		if (box.width <= 2 || box.height <= 2 || cs.clipPath === 'inset(50%)' || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
		// Is this text actually the top thing at its place (not covered by a dialog etc.)?
		const r0 = rects[0];
		const top = document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2);
		if (top && !(el.contains(top) || top.contains(el))) continue;
		seenEl.add(el);
		const m = /rgba?\(([^)]+)\)/.exec(cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor : cs.color);
		const parts = m ? m[1].split(/[,\s/]+/).filter(Boolean).map(Number) : [255, 255, 255, 1];
		out.push({
			text: n.nodeValue.replace(/\s+/g, ' ').trim().slice(0, 34),
			where: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`,
			rgb: parts.slice(0, 3),
			alpha: (parts[3] ?? 1) * opacity,
			size: parseFloat(cs.fontSize),
			weight: Number(cs.fontWeight) || 400,
			rects: rects.slice(0, 3).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })),
		});
	}
	return out;
};

const rows = [];
async function measure(page, state, dpr) {
	const items = await page.evaluate(COLLECT);
	const clear = (buf) => sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
	const shown = await clear(await page.screenshot());
	// Text painted as a background clipped to its glyphs ("studio") needs its background gone too.
	await page.evaluate(() => {
		for (const el of document.querySelectorAll('body *')) {
			const cs = getComputedStyle(el);
			if ((cs.backgroundClip || cs.webkitBackgroundClip || '').includes('text')) el.setAttribute('data-clip-text', '');
		}
	});
	const style = await page.addStyleTag({
		content: '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; text-decoration-color: transparent !important; transition: none !important; } ::placeholder { color: transparent !important; } [data-clip-text] { background: none !important; }',
	});
	await sleep(150);
	const bare = await clear(await page.screenshot());
	await style.evaluate((el) => el.remove());
	await page.evaluate(() => { for (const el of document.querySelectorAll('[data-clip-text]')) el.removeAttribute('data-clip-text'); });
	const A = shown.data;
	const B = bare.data;
	const W = shown.info.width;
	const Ht = shown.info.height;
	for (const it of items) {
		const px = [];
		for (const r of it.rects) {
			const x0 = Math.max(0, Math.floor(r.x * dpr));
			const y0 = Math.max(0, Math.floor(r.y * dpr));
			const x1 = Math.min(W, Math.ceil((r.x + r.w) * dpr));
			const y1 = Math.min(Ht, Math.ceil((r.y + r.h) * dpr));
			for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
				const i = (y * W + x) * 3;
				const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
				px.push([d, A[i], A[i + 1], A[i + 2], B[i], B[i + 1], B[i + 2]]);
			}
		}
		if (px.length < 8) continue;
		const maxD = px.reduce((m, p) => Math.max(m, p[0]), 0);
		if (maxD < 12) { rows.push({ state, ...it, fg: 'n/a', bg: 'n/a', bgWorst: 'n/a', rMed: Number.NaN, rWorst: Number.NaN, need: 4.5, unseen: true }); continue; }
		// The cores of the strokes: the pixels that changed most.
		const core = px.filter((p) => p[0] >= maxD * 0.8);
		const med = (list, k) => list.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(list.length / 2)];
		const fg = [med(core, 1), med(core, 2), med(core, 3)];
		const bgs = px.map((p) => [lum([p[4], p[5], p[6]]), p[4], p[5], p[6]]).sort((a, b) => a[0] - b[0]);
		const bgMed = bgs[Math.floor(bgs.length / 2)].slice(1);
		const light = bgs[Math.floor(bgs.length * 0.95)].slice(1);
		const dark = bgs[Math.floor(bgs.length * 0.05)].slice(1);
		const worstBg = lum(fg) > lum(bgMed) ? light : dark;
		const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700);
		rows.push({ state, ...it, fg: hex(fg), bg: hex(bgMed), bgWorst: hex(worstBg), rMed: ratio(fg, bgMed), rWorst: ratio(fg, worstBg), need: large ? 3 : 4.5 });
	}
}

const browser = await launch();
async function visit(sizeName, size) {
	const dpr = size.deviceScaleFactor;
	const { context, page } = await openPage(browser, size, { stub: { status: 400, json: { error: 'The spam check did not pass. Please try again.' } } });
	await context.addInitScript(() => {
		try {
			localStorage.setItem('cellestial:claims', JSON.stringify([{ slot: 'slot-3', ask: 'A site for my bakery, with the bread of the week on the first page.' }]));
		} catch {}
	});
	const go = async (url) => {
		await page.goto(BASE + url, { waitUntil: 'load' });
		await page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots, null, { timeout: 20000 });
		await page.evaluate(() => window.__cellestial.sky.ready);
		await sleep(1800);
	};
	const tap = (sel) => (size.hasTouch ? page.tap(sel) : page.click(sel));
	// Sky, still (so B11 is there), menu closed.
	await go('/?scene=sky&rm=1&debug');
	await measure(page, `${sizeName} sky: logo, B11`, dpr);
	await page.click('.chrome-bars');
	await sleep(400);
	await measure(page, `${sizeName} sky: menu open`, dpr);
	await page.keyboard.press('Escape');
	await tap('#sky-ui .sky-star[data-slot="slot-34"]');
	await sleep(700);
	await measure(page, `${sizeName} sky: empty-star panel (B10)`, dpr);
	await page.keyboard.press('Escape');
	await sleep(300);
	await tap('#sky-ui .sky-star[data-slot="slot-3"]');
	await page.waitForFunction(() => !document.querySelector('[data-sky-panel="lit"]').hidden, null, { timeout: 8000 }).catch(() => {});
	await sleep(600);
	await measure(page, `${sizeName} sky: lit-star panel`, dpr);
	await page.keyboard.press('Escape');
	await sleep(300);
	// "claim yours": a tap on empty sky marks the nearest empty star.
	await page.mouse.click(size.viewport.width * 0.5, size.viewport.height * 0.72);
	await sleep(900);
	await measure(page, `${sizeName} sky: "claim yours"`, dpr);
	// Roots: each tile, then the Close.
	await go('/?scene=roots&debug');
	for (let i = 0; i < 5; i++) {
		const node = page.locator('#roots .roots-node__bulb').nth(i);
		await node.scrollIntoViewIfNeeded();
		await node.click();
		await sleep(500);
		await measure(page, `${sizeName} roots: tile ${i + 1}`, dpr);
		await page.keyboard.press('Escape');
		await sleep(250);
	}
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await sleep(500);
	await measure(page, `${sizeName} close: F1, F2`, dpr);
	await page.click('#roots [data-open-claim]');
	await page.waitForSelector('#claim-dialog[open]');
	await page.fill('#claim-form-name', 'Test Visitor');
	await page.fill('#claim-form-email', 'visitor@example.com');
	await page.fill('#claim-form-message', 'A site for my bakery.');
	await page.click('#claim-form button[type="submit"]');
	await sleep(900);
	await measure(page, `${sizeName} build request dialog (with error)`, dpr);
	// Typed text in fields is not a text node: read it directly.
	const field = await page.evaluate(() => {
		const i = document.querySelector('#claim-form-name');
		const cs = getComputedStyle(i);
		return { color: cs.color, bg: cs.backgroundColor, size: cs.fontSize };
	});
	rows.push({ state: `${sizeName} build request dialog`, text: '(typed text in a field)', where: 'input', fg: field.color, bg: field.bg, bgWorst: field.bg, rMed: Number.NaN, rWorst: Number.NaN, need: 4.5, size: parseFloat(field.size), weight: 400, raw: true });
	await page.keyboard.press('Escape');
	await page.click('#roots [data-open-contact]');
	await page.waitForSelector('#contact-dialog[open]');
	await sleep(600);
	await measure(page, `${sizeName} message box dialog`, dpr);
	// The other pages.
	await page.goto(`${BASE}/contact/`, { waitUntil: 'load' });
	await sleep(1500);
	await measure(page, `${sizeName} /contact`, dpr);
	await page.goto(`${BASE}/start/new/`, { waitUntil: 'load' });
	await page.fill('[data-builder] [name="name"]', 'Rosa');
	await page.fill('[data-builder] [name="email"]', 'rosa@example.com');
	await page.fill('[data-builder] [name="domain"]', 'example.com');
	await sleep(300);
	await measure(page, `${sizeName} /start/new (top)`, dpr);
	const href = await page.evaluate(() => document.querySelector('[data-link]').href);
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await sleep(200);
	await measure(page, `${sizeName} /start/new (link)`, dpr);
	const u = new URL(href);
	await page.goto(`${BASE}${u.pathname}${u.hash}`, { waitUntil: 'load' });
	await sleep(600);
	await measure(page, `${sizeName} /start flow, step 1`, dpr);
	await context.close();
}
await visit('desk', DESK);
await visit('phone', PHONE);
await browser.close();

// One line per distinct (state, colour, size, background): the worst of each.
const key = (r) => `${r.state}|${r.where}|${r.size}|${r.weight}|${String(r.fg).slice(0, 4)}|${String(r.bg).slice(0, 4)}`;
const best = new Map();
for (const r of rows) {
	const k = key(r);
	if (!best.has(k) || (r.rWorst < best.get(k).rWorst)) best.set(k, r);
}
const lines = ['state | text | element | size/weight | text colour | behind it (median; worst 5%) | ratio median | ratio worst | needs | verdict'];
let fails = 0;
let soft = 0;
for (const r of best.values()) {
	if (r.raw) { lines.push(`${r.state} | ${r.text} | ${r.where} | ${r.size}px | ${r.fg} | ${r.bg} | - | - | 4.5 | (computed colours as declared)`); continue; }
	if (r.unseen) { lines.push(`${r.state} | ${r.text} | ${r.where} | ${r.size}px/${r.weight} | - | - | - | - | - | (no pixel changed when the text was hidden: not painted, or painted another way)`); continue; }
	const verdict = r.rMed < r.need ? 'FAIL' : r.rWorst < r.need ? 'passes on the median, fails on its lightest/darkest 5%' : 'AA';
	if (verdict === 'FAIL') fails++;
	else if (verdict !== 'AA') soft++;
	lines.push(`${r.state} | ${r.text} | ${r.where} | ${r.size}px/${r.weight} | ${r.fg} | ${r.bg}; ${r.bgWorst} | ${r.rMed.toFixed(2)} | ${r.rWorst.toFixed(2)} | ${r.need} | ${verdict}`);
}
lines.push('', `${best.size} distinct text colours in context; ${fails} fail AA on the median background; ${soft} pass on the median and fail on the worst 5% of the pixels behind them`);
writeFileSync(path.join(HERE, '..', 'contrast.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
