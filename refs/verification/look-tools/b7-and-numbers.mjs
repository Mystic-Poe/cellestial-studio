#!/usr/bin/env node
// The inspector's own captures (look lens): B7 at all twelve figures, and numbers.
//   node refs/verification/look-tools/b7-and-numbers.mjs [--url http://localhost:4612]
// 1. Every star of every figure is seeded as claimed (localStorage "cellestial:claims"), the
//    camera is stood at each figure in turn and its meaning photographed once written, at
//    1440x900 and 390x844. Sheets: matrix/sky/b7-all-desk.jpg, b7-all-phone.jpg. For each:
//    where the words stand, their size and colour (sampled from the screenshot), what they touch.
// 2. Colours sampled from PNG screenshots of the real page; tap targets and overflow on the phone.
// Output: matrix/numbers.txt
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../src/content/constellations.ts';
import { ROOT, SIZES, launch, openPage, sheet, sharp } from '../../../tools/roots/lib.mjs';

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:4612' } } });
const OUT = join(ROOT, 'refs/verification/matrix');
const out = [];
const log = (s) => { console.log(s); out.push(s); };
const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const browser = await launch({ gpu: true });

/** Mean colour of the pixels of a PNG region that pass `keep(r,g,b)`. */
async function sample(png, clip, keep, dpr = 1) {
	const { data, info } = await sharp(png)
		.extract({ left: Math.max(0, Math.round(clip.x * dpr)), top: Math.max(0, Math.round(clip.y * dpr)), width: Math.round(clip.width * dpr), height: Math.round(clip.height * dpr) })
		.raw().toBuffer({ resolveWithObject: true });
	let r = 0, g = 0, b = 0, n = 0, total = 0, black = 0, peak = [0, 0, 0], peakL = -1;
	for (let i = 0; i < data.length; i += info.channels) {
		total++;
		const R = data[i], G = data[i + 1], B = data[i + 2];
		if (R === 0 && G === 0 && B === 0) black++;
		const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
		if (L > peakL) { peakL = L; peak = [R, G, B]; }
		if (keep(R, G, B)) { r += R; g += G; b += B; n++; }
	}
	return { n, total, black, mean: n ? hex(r / n, g / n, b / n) : null, peak: hex(...peak) };
}

// ---------- 1. B7 at all twelve figures ----------
const all = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({ slot, ask: 'A site for my bakery' }));
log(`B7, every figure complete (${all.length} claims seeded)`);
for (const size of ['desk', 'phone']) {
	const dpr = SIZES[size].deviceScaleFactor;
	const { width: W, height: H } = SIZES[size].viewport;
	const o = await openPage(browser, size, null);
	await o.page.addInitScript((list) => {
		sessionStorage.setItem('cellestial:round', '1');
		localStorage.setItem('cellestial:claims', JSON.stringify(list));
	}, all);
	await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning && window.__cellestial?.claims);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await o.page.waitForTimeout(1500);
	const cells = [];
	for (let k = 0; k < CONSTELLATIONS.length; k++) {
		const name = CONSTELLATIONS[k].name;
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await o.page.waitForTimeout(k === 11 ? 6500 : 4200);
		const png = await o.page.screenshot({ type: 'png' });
		const m = await o.page.evaluate(([n, w, h]) => {
			const el = document.querySelector(`.sky-meaning[data-meaning="${n}"]`);
			if (!el || el.hidden) return null;
			const r = el.getBoundingClientRect();
			const stars = [...document.querySelectorAll('button.sky-star:not([hidden])')].map((b) => { const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }).filter((p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h);
			const ys = stars.map((s) => s.y), xs = stars.map((s) => s.x);
			const b11 = document.querySelector('[data-descend]').getBoundingClientRect();
			const gap = Math.min(...stars.map((s) => Math.hypot(Math.max(r.left - s.x, 0, s.x - r.right), Math.max(r.top - s.y, 0, s.y - r.bottom))));
			return { text: el.textContent.trim().replace(/\s+/g, ' '), x: r.x, y: r.y, w: r.width, h: r.height, font: getComputedStyle(el).fontSize, figTop: Math.min(...ys), figBottom: Math.max(...ys), figLeft: Math.min(...xs), figRight: Math.max(...xs), starGap: gap, toB11: b11.top - r.bottom, n: stars.length };
		}, [name, W, H]);
		if (!m) { log(`${size} ${name}: NO MEANING SHOWN`); cells.push({ img: png, label: `${k + 1} ${name}: none` }); continue; }
		const col = await sample(png, { x: m.x, y: m.y, width: m.w, height: m.h }, (r, g, b) => Math.max(r, g, b) > 110, dpr);
		const where = m.y >= m.figBottom ? 'UNDER the figure' : m.y + m.h <= m.figTop ? 'ABOVE the figure' : 'inside the figure\'s height';
		const whole = m.x >= 0 && m.y >= 0 && m.x + m.w <= W && m.y + m.h <= H;
		log(`${size} ${String(k + 1).padStart(2)} ${name.padEnd(12)} "${m.text}" ${Math.round(m.w)}x${Math.round(m.h)} at ${Math.round(m.x)},${Math.round(m.y)} font ${m.font}; ${where} (figure y ${Math.round(m.figTop)}..${Math.round(m.figBottom)}, ${Math.round(m.y - m.figBottom)} px below its lowest star); nearest star centre ${Math.round(m.starGap)} px; ${Math.round(m.toB11)} px above B11; whole on screen ${whole}; mean colour of the letters ${col.mean} (${col.n} px)`);
		cells.push({ img: png, label: `${k + 1} ${name}: "${m.text}"` });
	}
	await sheet(join(OUT, `sky/b7-all-${size}.jpg`), cells, size === 'desk' ? { cols: 4, cellW: 390, cellH: 244 } : { cols: 6, cellW: 258, cellH: 558 });
	await o.context.close();
}

// ---------- 2. Colours ----------
log('');
log('COLOURS sampled from PNG screenshots (1440x900, real GPU)');
{
	const o = await openPage(browser, 'desk', null);
	await o.page.addInitScript(() => sessionStorage.setItem('cellestial:round', '1'));
	await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.waitForTimeout(1800);
	let png = await o.page.screenshot({ type: 'png' });
	let s = await sample(png, { x: 0, y: 0, width: 1440, height: 900 }, () => false);
	log(`sky at Virgo: ${(100 * s.black / s.total).toFixed(1)}% of all pixels are exactly #000000`);
	s = await sample(png, { x: 980, y: 520, width: 440, height: 280 }, (r, g, b) => Math.max(r, g, b) >= 10);
	log(`honeycomb (a corner with nothing else, pixels of 10 or more): mean ${s.mean}, brightest ${s.peak}, ${(100 * s.n / s.total).toFixed(1)}% of the region; the rest ${(100 * s.black / s.total).toFixed(1)}% exactly black`);
	const star = await o.page.evaluate(() => { const b = [...document.querySelectorAll('button.sky-star:not([hidden])')].map((x) => x.getBoundingClientRect()).filter((r) => r.x > 100 && r.x < 500)[0]; return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
	s = await sample(png, { x: star.x - 22, y: star.y - 22, width: 44, height: 44 }, (r, g, b) => Math.max(r, g, b) > 120);
	log(`an empty star (B4) at its station: rim pixels over 120: mean ${s.mean}, brightest ${s.peak}`);
	s = await sample(png, { x: star.x - 8, y: star.y - 8, width: 16, height: 16 }, () => true);
	log(`its body (the middle 16 px): mean ${s.mean}, brightest ${s.peak}`);
	const b11 = await o.page.evaluate(() => { const r = document.querySelector('[data-descend]').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
	s = await sample(png, b11, (r, g, b) => r > 120 && r > b + 20);
	log(`B11's brass face: mean ${s.mean} (${b11.width.toFixed(0)}x${b11.height.toFixed(0)} px)`);
	const studio = await o.page.evaluate(() => { const e = document.querySelector('.chrome-studio'); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, color: getComputedStyle(e).color, font: getComputedStyle(e).fontSize }; });
	s = await sample(png, studio, (r, g, b) => Math.max(r, g, b) > 110);
	log(`"studio": mean of the letters ${s.mean}; computed colour ${studio.color}, ${studio.font}`);
	// the teleport flash, mid-way
	await o.page.click('#chrome button[popovertarget]');
	await o.page.waitForTimeout(300);
	const item = o.page.locator('#chrome-menu [data-dest="build"]');
	await item.evaluate((el) => el.click());
	await o.page.waitForTimeout(175);
	png = await o.page.screenshot({ type: 'png' });
	writeFileSync(join(OUT, 'fx/flash-mid-desk.png'), png);
	{
		const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
		const runs = [];
		for (const y of [120, 240, 700, 800]) {
			let run = 0;
			for (let x = 0; x < info.width; x++) {
				const i = (y * info.width + x) * info.channels;
				const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
				if (L > 110) run++;
				else { if (run > 1 && run < 80) runs.push(run); run = 0; }
			}
		}
		runs.sort((a, b) => a - b);
		const sm = await sample(png, { x: 0, y: 0, width: 1440, height: 900 }, (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b > 110);
		log(`teleport flash about 175 ms in: bright traces crossed on four rows: ${runs.length} runs, median width ${runs[Math.floor(runs.length / 2)]} px, widths ${runs.slice(0, 40).join(',')}; mean colour of bright pixels ${sm.mean} (${(100 * sm.n / sm.total).toFixed(1)}% of the frame)`);
	}
	await o.page.waitForTimeout(1800);
	png = await o.page.screenshot({ type: 'png' });
	// the trunk: brightest pixel on rows crossing it below node 1
	const node = await o.page.evaluate(() => { const r = document.querySelector('.roots-stop button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.bottom }; });
	for (const dy of [60, 120, 180]) {
		const t = await sample(png, { x: node.x - 160, y: node.y + dy, width: 320, height: 1 }, (r, g, b) => Math.min(r, g, b) > 200);
		log(`mycelium trunk ${dy} px under node 1: brightest pixel ${t.peak}; ${t.n} px on that row have every channel over 200 (white)`);
	}
	const soil = await sample(png, { x: 1000, y: 300, width: 300, height: 300 }, () => true);
	log(`soil away from the light: mean ${soil.mean}`);
	await o.context.close();
}
// A1 lit: its circuit lines, for comparison
{
	const a1 = join(ROOT, 'cellestial-assets/images/a-loading/A1_c-emblem_lit.jpg');
	const { data, info } = await sharp(a1).raw().toBuffer({ resolveWithObject: true });
	let r = 0, g = 0, b = 0, n = 0;
	for (let i = 0; i < data.length; i += info.channels) {
		const R = data[i], G = data[i + 1], B = data[i + 2];
		if (B > 150 && B > R + 50) { r += R; g += G; b += B; n++; }
	}
	log(`A1_c-emblem_lit.jpg (${info.width}x${info.height}): its blue line pixels (B over 150 and 50 over R): mean ${hex(r / n, g / n, b / n)}, ${n} px`);
}

// ---------- 3. Tap targets and overflow on the phone ----------
log('');
log('PHONE 390x844: tap targets and overflow');
{
	const o = await openPage(browser, 'phone', null);
	await o.page.addInitScript(() => sessionStorage.setItem('cellestial:round', '1'));
	await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.waitForTimeout(1500);
	const targets = (label) => o.page.evaluate((lab) => {
		const seen = [];
		for (const el of document.querySelectorAll('a[href], button, input, textarea, select, [role=button], [tabindex]')) {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle(el);
			if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]') || el.closest('[inert]')) continue;
			if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
			if (el.closest('astro-dev-toolbar') || el.getAttribute('tabindex') === '-1') continue;
			if (el.closest('.cf-turnstile, iframe')) continue;
			const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 28);
			seen.push({ name, w: Math.round(r.width), h: Math.round(r.height), out: r.left < -0.5 || r.right > innerWidth + 0.5 });
		}
		const small = seen.filter((s) => s.w < 44 || s.h < 44);
		const outs = seen.filter((s) => s.out);
		return `${lab}: ${seen.length} targets on screen; under 44 px: ${small.length ? small.map((s) => `"${s.name}" ${s.w}x${s.h}`).join('; ') : 'none'}; past the screen's sides: ${outs.length ? outs.map((s) => s.name).join('; ') : 'none'}; page width ${document.documentElement.scrollWidth} of ${innerWidth}`;
	}, label);
	log(await targets('sky at Virgo'));
	await o.page.click('#chrome button[popovertarget]');
	await o.page.waitForTimeout(400);
	log(await targets('menu open'));
	await o.page.keyboard.press('Escape');
	const pt = await o.page.evaluate(() => { const r = [...document.querySelectorAll('button.sky-star:not([hidden])')].map((b) => b.getBoundingClientRect()).filter((q) => q.y > 150 && q.y < 600)[0]; return [r.x + r.width / 2, r.y + r.height / 2]; });
	await o.page.touchscreen.tap(...pt);
	await o.page.waitForTimeout(900);
	log(await targets('empty-star panel open'));
	await o.page.locator('#sky-claim-star').evaluate((el) => el.click());
	await o.page.waitForTimeout(1200);
	log(await targets('build request open'));
	await o.page.keyboard.press('Escape');
	await o.page.waitForTimeout(400);
	await o.page.goto(`${values.url}/?scene=roots&debug`, { waitUntil: 'load' });
	await o.page.waitForTimeout(2500);
	log(await targets('roots, top'));
	await o.page.locator('.roots-stop button').first().evaluate((el) => el.click());
	await o.page.waitForTimeout(700);
	log(await targets('roots, tile 1 open'));
	await o.page.keyboard.press('Escape');
	await o.page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
	await o.page.waitForTimeout(700);
	log(await targets('roots, the Close'));
	await o.page.locator('[data-open-contact]').evaluate((el) => el.click());
	await o.page.waitForTimeout(1200);
	log(await targets('message box open'));
	await o.context.close();
}
writeFileSync(join(OUT, 'numbers.txt'), `${out.join('\n')}\n`);
await browser.close();
