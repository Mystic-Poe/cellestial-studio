#!/usr/bin/env node
// The third look's own: is each figure on the phone still the real pattern?
// (1) NUMBERS. At every station, at 390x844, 360x740 and 375x667 (and 1440x900 for comparison), the
//     places the sky gives its stars (hooks.starCircle, and Cellestial's own coreCircle for Virgo's
//     epicentre) are fitted to the figure's stars in src/content/constellations.ts by a turn, a scale and
//     a shift (least squares), once as the pattern is and once MIRRORED. Printed: the turn in degrees
//     (0 upright; +90 is a quarter counter-clockwise as seen on the screen), which hand fits, and how far
//     the worst star stands from where the real pattern, so turned, would put it.
// (2) PICTURES. Each turned figure cut from the phone's screen and turned BACK a quarter, beside the
//     same figure cut from the desktop's screen (upright): the same stars joined by the same lines?
//     -> phone-sky/turned-back-1.jpg, -2.jpg
// (3) The smallest stars at each phone size, device pixels, enlarged: -> phone-sky/smallest-stars.jpg
// Production build, real GPU, the sky empty.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, sharp, sheet, sleep } from './lib.mjs';
const dir = outDir('phone-sky');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
// least-squares similarity: q = s R(theta) p + t
const fit = (P, Q) => {
	const n = P.length;
	const mp = P.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
	const mq = Q.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
	let a = 0, b = 0, d = 0;
	for (let i = 0; i < n; i++) {
		const px = P[i][0] - mp[0], py = P[i][1] - mp[1], qx = Q[i][0] - mq[0], qy = Q[i][1] - mq[1];
		a += px * qx + py * qy; b += px * qy - py * qx; d += px * px + py * py;
	}
	const s = Math.hypot(a, b) / d, th = Math.atan2(b, a);
	let worst = 0;
	for (let i = 0; i < n; i++) {
		const px = P[i][0] - mp[0], py = P[i][1] - mp[1];
		const x = mq[0] + s * (px * Math.cos(th) - py * Math.sin(th)), y = mq[1] + s * (px * Math.sin(th) + py * Math.cos(th));
		worst = Math.max(worst, Math.hypot(x - Q[i][0], y - Q[i][1]));
	}
	return { s, th, worst };
};
const shots = {};
const small = [];
for (const size of ['phone', 'small', 'short', 'desk']) {
	const { width: W, height: H } = SIZES[size].viewport;
	const dpr = SIZES[size].deviceScaleFactor ?? 1;
	const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1500);
	const turned = await o.page.evaluate(() => window.__cellestial.sky.debug.stats().stations.filter((s) => s.turned).map((s) => s.figure));
	say(`${W}x${H}: the sky says it has turned: ${turned.join(', ') || 'none'}`);
	const radii = [];
	for (let k = 0; k < 12; k++) {
		const c = CONSTELLATIONS[k];
		await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
		await sleep(2600);
		const circles = await o.page.evaluate((slots) => slots.map((s) => (s ? window.__cellestial.sky.hooks.starCircle(s) : window.__cellestial.sky.coreCircle())), c.stars.map((s) => s.slot));
		const idx = circles.map((q, i) => (q ? i : -1)).filter((i) => i >= 0);
		// the screen's y runs down: the real pattern as the eye sees it is (x, -y)
		const P = idx.map((i) => [c.stars[i].x, -c.stars[i].y]);
		const Pm = idx.map((i) => [-c.stars[i].x, -c.stars[i].y]);
		const Q = idx.map((i) => [circles[i].x, circles[i].y]);
		const f = fit(P, Q), fm = fit(Pm, Q);
		// a turn of the screen's picture counter-clockwise by a quarter is theta = -90 in y-down coordinates
		const deg = (-f.th * 180) / Math.PI;
		say(`   ${String(k + 1).padStart(2)} ${c.name.padEnd(12)} ${idx.length} of ${c.stars.length} stars placed; as the real pattern: turned ${deg.toFixed(1)} deg (counter-clockwise on the screen), ${f.s.toFixed(1)} px to the unit, the worst star ${f.worst.toFixed(2)} px from its place; as its MIRROR image the worst star would be ${fm.worst.toFixed(1)} px off  => ${f.worst < 1.5 && fm.worst > 5 ? 'THE REAL PATTERN' : f.worst < fm.worst ? 'the real pattern, loosely' : 'MIRRORED OR WRONG'}${turned.includes(c.name) ? ' (turned)' : ''}`);
		const cs = circles.filter(Boolean);
		const box = { x0: Math.max(0, Math.min(...cs.map((q) => q.x - q.r)) - 26), y0: Math.max(0, Math.min(...cs.map((q) => q.y - q.r)) - 26), x1: Math.min(W, Math.max(...cs.map((q) => q.x + q.r)) + 26), y1: Math.min(H, Math.max(...cs.map((q) => q.y + q.r)) + 26) };
		if (size === 'phone' || size === 'desk') {
			const png = await o.page.screenshot({ type: 'png' });
			const cut = await sharp(png).extract({ left: Math.round(box.x0 * dpr), top: Math.round(box.y0 * dpr), width: Math.round((box.x1 - box.x0) * dpr), height: Math.round((box.y1 - box.y0) * dpr) }).png().toBuffer();
			shots[`${size}-${k}`] = { img: cut, turned: turned.includes(c.name) };
		}
		for (const [n, q] of circles.entries()) if (q && c.stars[n].slot) radii.push({ k, name: c.name, slot: c.stars[n].slot, ...q });
	}
	if (size !== 'desk') {
		radii.sort((a, b) => a.r - b.r);
		say(`   star radii at ${W}x${H}: smallest ${radii.slice(0, 6).map((q) => `${q.name} ${q.slot} r ${q.r.toFixed(1)}`).join('; ')}; the usual (median) r ${radii[Math.floor(radii.length / 2)].r.toFixed(1)}; largest r ${radii[radii.length - 1].r.toFixed(1)}; stars under r 8: ${radii.filter((q) => q.r < 8).length}, under r 10: ${radii.filter((q) => q.r < 10).length}, of ${radii.length}`);
		const seen = new Set();
		for (const q of radii) {
			if (seen.has(q.k) || seen.size >= 2) continue;
			seen.add(q.k);
			await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), q.k);
			await sleep(2600);
			const png = await o.page.screenshot({ type: 'png' });
			const R = 60;
			const left = Math.round(Math.min(Math.max(0, q.x - R), W - 2 * R) * dpr), top = Math.round(Math.min(Math.max(0, q.y - R), H - 2 * R) * dpr);
			small.push({ img: await sharp(png).extract({ left, top, width: 2 * R * dpr, height: 2 * R * dpr }).png().toBuffer(), label: `${W}x${H} ${q.name}: the smallest star r ${q.r.toFixed(1)} px (device px; ${2 * R} css px across)`, enlarge: true });
		}
	}
	await o.context.close();
}
const pairs = [];
for (let k = 0; k < 12; k++) {
	const p = shots[`phone-${k}`], d = shots[`desk-${k}`];
	if (!p?.turned) continue;
	pairs.push({ img: await sharp(p.img).rotate(90).png().toBuffer(), label: `${CONSTELLATIONS[k].name}: the phone's, turned BACK a quarter`, enlarge: true });
	pairs.push({ img: d.img, label: `${CONSTELLATIONS[k].name}: the desktop's (upright)` });
}
for (let i = 0, n = 1; i < pairs.length; i += 6, n++) await sheet(join(dir, `turned-back-${n}.jpg`), pairs.slice(i, i + 6), { cols: 2, cellW: 780, cellH: 420 });
await sheet(join(dir, 'smallest-stars.jpg'), small, { cols: 3, cellW: 500, cellH: 500 });
writeFileSync(join(dir, 'phone-figures.txt'), `${log.join('\n')}\n`);
await browser.close();
