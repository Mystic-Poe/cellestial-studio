#!/usr/bin/env node
// The third look's own: on a TURNED figure on the phone, does everything that answers a touch still
// answer at the right star? Production build, real GPU, real touches.
//   node phone-claim.mjs [--size phone] [--fig 4]        (4 is Capricornus)
// 1. a tap on empty sky: the beads run the honeycomb to an empty star, "claim yours" stands under it
//    (recorded; a strip every 100 ms; which star the words stand under, by measurement)
// 2. a tap on an empty star: its panel
// 3. a build request sent from that panel, /api/contact answered 200 from here: which star lights,
//    measured in the picture (the mean light inside every star's disc before and after)
// 4. a reload: is it still lit, in the store, in the sky and in the picture; a tap on it: what it says
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'phone' }, fig: { type: 'string', default: '4' } } });
const size = values.size, K = Number(values.fig), c = CONSTELLATIONS[K];
const { width: W, height: H } = SIZES[size].viewport;
const dpr = SIZES[size].deviceScaleFactor ?? 1;
const dir = outDir(size === 'desk' ? 'desk-sky' : 'phone-sky');
const tag = `${c.name.toLowerCase()}-${W}`;
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
await o.context.route('**/api/contact', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
const stand = async () => {
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.claims);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1500);
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), K);
	await sleep(2800);
};
const circles = async () => (await o.page.evaluate((slots) => slots.map((s) => (s ? { slot: s, ...window.__cellestial.sky.hooks.starCircle(s) } : null)), c.stars.map((s) => s.slot))).filter((q) => q && Number.isFinite(q.x));
const lightOf = async (png, cs) => {
	const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
	return cs.map((q) => {
		let s = 0, n = 0;
		const R = Math.max(2, q.r * 0.8) * dpr;
		for (let y = Math.round(q.y * dpr - R); y <= q.y * dpr + R; y++) for (let x = Math.round(q.x * dpr - R); x <= q.x * dpr + R; x++) {
			if (x < 0 || y < 0 || x >= info.width || y >= info.height || Math.hypot(x - q.x * dpr, y - q.y * dpr) > R) continue;
			const p = (y * info.width + x) * info.channels;
			s += 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]; n++;
		}
		return { slot: q.slot, L: n ? s / n : 0 };
	});
};
await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
await stand();
const turned = await o.page.evaluate(() => window.__cellestial.sky.debug.stats().stations.filter((s) => s.turned).map((s) => s.figure));
say(`${W}x${H}, ${c.name} (${turned.includes(c.name) ? 'TURNED' : 'upright'}), the sky empty`);
let cs = await circles();
const stills = [];
// 1. the beads
const free = await o.page.evaluate(([w, h, list]) => {
	let best = null;
	for (let fy = 0.2; fy <= 0.8; fy += 0.05) for (let fx = 0.12; fx <= 0.88; fx += 0.08) {
		const x = w * fx, y = h * fy;
		const el = document.elementFromPoint(x, y);
		if (el?.closest('button, a, [role=dialog]')) continue;
		const d = Math.min(...list.map((q) => Math.hypot(q.x - x, q.y - y) - q.r));
		if (!best || d > best.d) best = { x, y, d };
	}
	return best;
}, [W, H, cs]);
const rec = await recorder(o, { quality: 88 });
await sleep(200);
const t0 = Date.now();
await o.pressAt(free.x, free.y);
await sleep(2800);
await rec.stop();
await sheet(join(dir, `beads-${tag}.jpg`), rec.cut('beads', t0, t0 + 2300, 100), size === 'desk' ? { cols: 6, cellW: 258, cellH: 161 } : { cols: 12, cellW: 125, cellH: Math.round((125 * H) / W) });
const words = await o.page.evaluate(() => [...document.querySelectorAll('[data-claim-words]')].filter((e) => !e.hidden && e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x: r.x + r.width / 2, y: r.y, w: r.width, h: r.height, font: cs.fontSize, opacity: cs.opacity, text: e.textContent.trim() }; }));
cs = await circles();
const nearestToTap = [...cs].sort((a, b) => Math.hypot(a.x - free.x, a.y - free.y) - Math.hypot(b.x - free.x, b.y - free.y))[0];
if (words.length) {
	const w0 = words[0];
	const under = [...cs].sort((a, b) => Math.hypot(a.x - w0.x, a.y + a.r - w0.y) - Math.hypot(b.x - w0.x, b.y + b.r - w0.y))[0];
	say(`1. a tap on empty sky at ${Math.round(free.x)},${Math.round(free.y)} (${Math.round(free.d)} px from the nearest star's edge): "${w0.text}" stands ${w0.w.toFixed(0)}x${w0.h.toFixed(0)} px at ${Math.round(w0.x)},${Math.round(w0.y)} (type ${w0.font}), ${Math.round(w0.y - (under.y + under.r))} px under the edge of ${under.slot} (centre ${Math.round(under.x)},${Math.round(under.y)}, ${Math.abs(w0.x - under.x).toFixed(1)} px off its middle); the star nearest the tap was ${nearestToTap.slot}; inside the screen: ${w0.x - w0.w / 2 >= 0 && w0.x + w0.w / 2 <= W && w0.y + w0.h <= H}`);
} else say(`1. a tap on empty sky at ${Math.round(free.x)},${Math.round(free.y)}: NO "claim yours" FOUND`);
stills.push({ img: await o.page.screenshot({ type: 'png' }), label: '1. after the beads: "claim yours"' });
await o.page.keyboard.press('Escape');
await sleep(600);
// 2. an empty star's panel: the star furthest down the turned figure that is clear of the chrome
await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), K);
await sleep(600);
cs = await circles();
const pick = [...cs].filter((q) => q.y > 140 && q.y < H - 160).sort((a, b) => a.x - b.x)[0];
const before = await lightOf(await o.page.screenshot({ type: 'png' }), cs);
await o.page.evaluate(() => { window.__picked = []; window.__cellestial.sky.hooks.on('star-pick', (e) => window.__picked.push(e.slot)); });
await o.pressAt(pick.x, pick.y);
await sleep(1300);
const picked = await o.page.evaluate(() => window.__picked);
const panel = await o.page.evaluate(() => { const b = document.querySelector('#sky-ui [data-sky-claim]'); const p = b?.closest('[role=dialog], .sky-panel, section, div'); if (!p) return null; const r = p.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: p.innerText.replace(/\s+/g, ' ').trim().slice(0, 260) }; });
say(`2. a tap on the empty star ${pick.slot} at ${Math.round(pick.x)},${Math.round(pick.y)} (r ${pick.r.toFixed(1)}): the sky picked ${JSON.stringify(picked)}; its panel ${panel ? `${panel.w}x${panel.h} at ${panel.x},${panel.y}, inside the screen ${panel.x >= 0 && panel.y >= 0 && panel.x + panel.w <= W && panel.y + panel.h <= H}: "${panel.text}"` : 'NOT FOUND'}`);
stills.push({ img: await o.page.screenshot({ type: 'png' }), label: `2. the empty star ${pick.slot} tapped: its panel` });
// 3. the build request
await o.press('#sky-ui [data-sky-claim]');
await sleep(900);
await o.page.fill('#claim-form-name', 'Test Visitor');
await o.page.fill('#claim-form-email', 'visitor@example.com');
await o.page.fill('#claim-form-message', "A site for my bakery, with the week's bread on the first page.");
await sleep(2500);
const starField = await o.page.evaluate(() => document.querySelector('#claim-form [data-star-input]')?.value);
const token = await o.page.evaluate(() => !!document.querySelector('#claim-form [name="cf-turnstile-response"]')?.value);
stills.push({ img: await o.page.screenshot({ type: 'png' }), label: '3. the build request, filled in' });
await o.press('#claim-form button[type="submit"]');
await sleep(6000);
stills.push({ img: await o.page.screenshot({ type: 'png' }), label: '3. after Send' });
const litPanel = await o.page.evaluate(() => { const a = document.querySelector('#sky-ui [data-sky-ask]'); const p = a?.closest('[role=dialog], .sky-panel, section, div'); return p ? p.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; });
say(`3. the build request: the form's star field "${starField}", spam-check token present ${token}; after Send: ${pick.slot} lit in the store ${await o.page.evaluate((s) => window.__cellestial.claims.isLit(s), pick.slot)}, lit in the sky ${await o.page.evaluate((s) => window.__cellestial.sky.hooks.isLit(s), pick.slot)}; the panel shown: ${JSON.stringify(litPanel)}`);
await o.page.keyboard.press('Escape');
await sleep(800);
await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), K);
await sleep(2800);
cs = await circles();
const after = await lightOf(await o.page.screenshot({ type: 'png' }), cs);
const gain = after.map((a) => ({ slot: a.slot, d: a.L - (before.find((b) => b.slot === a.slot)?.L ?? 0), L: a.L })).sort((a, b) => b.d - a.d);
say(`   in the picture (mean light inside each star's disc, before -> after): brightened most: ${gain.slice(0, 3).map((g) => `${g.slot} +${g.d.toFixed(0)} (now ${g.L.toFixed(0)})`).join(', ')}; the rest changed by at most ${Math.max(...gain.slice(1).map((g) => Math.abs(g.d))).toFixed(0)}  => ${gain[0].slot === pick.slot && gain[0].d > 25 ? 'THE RIGHT STAR IS LIT' : 'WRONG'}`);
stills.push({ img: await o.page.screenshot({ type: 'png' }), label: `3. ${c.name} with ${pick.slot} lit` });
// 4. the reload
await o.page.reload({ waitUntil: 'load' });
await stand();
cs = await circles();
const again = await lightOf(await o.page.screenshot({ type: 'png' }), cs);
const g2 = again.map((a) => ({ slot: a.slot, d: a.L - (before.find((b) => b.slot === a.slot)?.L ?? 0) })).sort((a, b) => b.d - a.d);
say(`4. after a reload: ${pick.slot} lit in the store ${await o.page.evaluate((s) => window.__cellestial.claims.isLit(s), pick.slot)}, in the sky ${await o.page.evaluate((s) => window.__cellestial.sky.hooks.isLit(s), pick.slot)}; in the picture the brightest gain is ${g2[0].slot} +${g2[0].d.toFixed(0)}, the next ${g2[1].slot} ${g2[1].d >= 0 ? '+' : ''}${g2[1].d.toFixed(0)}  => ${g2[0].slot === pick.slot && g2[0].d > 25 ? 'STILL LIT, THE RIGHT STAR' : 'WRONG'}`);
stills.push({ img: await o.page.screenshot({ type: 'png' }), label: '4. after a reload' });
const lit = cs.find((q) => q.slot === pick.slot);
await o.pressAt(lit.x, lit.y);
await sleep(3400);
const says = await o.page.evaluate(() => { const a = document.querySelector('#sky-ui [data-sky-ask]'); const p = a?.closest('[role=dialog], .sky-panel, section, div'); return p ? p.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; });
say(`   the lit star tapped: ${JSON.stringify(says)}`);
stills.push({ img: await o.page.screenshot({ type: 'png' }), label: '4. the lit star tapped' });
say(`console errors: ${o.errors.length ? o.errors.join(' | ').slice(0, 400) : 'none'}`);
await sheet(join(dir, `claim-${tag}.jpg`), stills, size === 'desk' ? { cols: 3, cellW: 520, cellH: 325 } : { cols: 7, cellW: 220, cellH: Math.round((220 * H) / W) });
writeFileSync(join(dir, `claim-${tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
