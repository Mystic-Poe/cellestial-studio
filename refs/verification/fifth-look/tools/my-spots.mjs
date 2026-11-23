#!/usr/bin/env node
// The fifth look's own: for one star at one station, every place the rule knows (the eight sides and corners
// and the slid places) and what stands in each by my measure: discs touched (with 4 px of air), the rings,
// the screen's sides; and the nearest other star to the box.
//   node my-spots.mjs --size phone --fig Virgo --slot slot-53 [--old] [--complete]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, SIZES } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'phone' }, fig: { type: 'string' }, slot: { type: 'string' }, old: { type: 'boolean', default: false }, complete: { type: 'boolean', default: false }, suffix: { type: 'string' } } });
const { width: W, height: H } = SIZES[values.size].viewport;
const t = JSON.parse(readFileSync(join(ROOT, 'refs/verification/fifth-look', values.old ? 'old' : '', 'labels', `${values.size}${values.complete ? '-complete' : values.suffix ? `-${values.suffix}` : ''}.json`))).find((x) => x.what === 'label' && x.fig === values.fig && x.slot === values.slot);
if (!t) { console.log('no such label'); process.exit(0); }
const gap = (b, s) => Math.hypot(Math.max(b.x - s.x, 0, s.x - (b.x + b.w)), Math.max(b.y - s.y, 0, s.y - (b.y + b.h))) - s.r;
const cover = (b, s) => { const dx = Math.max(b.x - s.x, 0, s.x - (b.x + b.w)), dy = Math.max(b.y - s.y, 0, s.y - (b.y + b.h)); const d = dx > 0 || dy > 0 ? Math.hypot(dx, dy) : -Math.min(s.x - b.x, b.x + b.w - s.x, s.y - b.y, b.y + b.h - s.y); if (d >= s.r) return 0; if (d <= -s.r) return Math.PI * s.r * s.r; return s.r * s.r * Math.acos(d / s.r) - d * Math.sqrt(s.r * s.r - d * d); };
const boxAt = (star, side, slide = 0) => {
	const reach = star.r * 1.1 + 7, hw = 48, h = 24;
	let x = star.x, y = star.y - h / 2;
	if (side === 'under' || side === 'above') { x = Math.min(Math.max(star.x + slide, 56), W - 56); y = side === 'under' ? star.y + reach : star.y - reach - h; }
	else if (side === 'right' || side === 'left') { x = side === 'right' ? star.x + reach + hw : star.x - reach - hw; y += slide; }
	else { const d = reach * Math.SQRT1_2; x = side.endsWith('right') ? star.x + d + hw : star.x - d - hw; y = side.startsWith('under') ? star.y + d : star.y - d - h; }
	return { x: x - hw, y, w: 96, h };
};
const SPOTS = [...['under', 'right', 'left', 'above', 'under-right', 'under-left', 'above-right', 'above-left'].map((s) => [s, 0]), ...[24, -24, 48, -48].map((v) => ['under', v]), ...[12, -12].map((v) => ['right', v]), ...[12, -12].map((v) => ['left', v]), ...[24, -24, 48, -48].map((v) => ['above', v])];
console.log(`${values.size} ${t.fig} ${t.slot}: star ${t.star.x.toFixed(0)},${t.star.y.toFixed(0)} r ${t.star.r.toFixed(1)}; the page put the words ${t.side}${t.slide ? ` slid ${t.slide}` : ''} at ${t.box.x.toFixed(0)},${t.box.y.toFixed(0)}`);
for (const [side, slide] of SPOTS) {
	const b = boxAt(t.star, side, slide);
	const w = [];
	let cost = 0;
	for (const s of t.others) { const g = gap(b, s); if (s.r > 3) { cost += cover(b, { ...s, r: s.r + 4 }); if (g < 4) w.push(`${s.slot} r ${s.r.toFixed(1)} ${g < 0 ? `${(-g).toFixed(1)} in` : `${g.toFixed(1)} off`}`); } else cost += cover(b, s); }
	if (t.core?.r && gap(b, { x: t.core.x, y: t.core.y, r: t.core.r / 0.27 }) < 0) w.push(`RINGS ${(-gap(b, { x: t.core.x, y: t.core.y, r: t.core.r / 0.27 })).toFixed(1)} in`);
	if (b.x < 8 || b.x + b.w > W - 8) w.push('SIDE OF SCREEN');
	if (b.y < 4 || b.y + b.h > H - 4) w.push('TOP/BOTTOM');
	const near = t.others.filter((s) => s.r > 3).map((s) => ({ s, g: gap(b, s) })).sort((a, c) => a.g - c.g)[0];
	console.log(`  ${`${side}${slide ? ` ${slide}` : ''}`.padEnd(14)} box ${b.x.toFixed(0)},${b.y.toFixed(0)}  cost ${cost.toFixed(0).padStart(4)} px2  ${w.join('; ') || 'FREE'}${near ? `   (nearest star ${near.s.slot} ${near.g.toFixed(1)} px)` : ''}`);
}
