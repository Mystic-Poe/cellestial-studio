#!/usr/bin/env node
// Round 4's own: "claim yours" WHILE THE SKY MOVES, motion on, production build, real GPU.
// What a visitor can do (read in src/experience/sky/index.ts and shown here in the page, case "hands"):
// a wheel, a swipe or an arrow key puts the words out with its first push (thrust(): 'dismiss'), and a
// press while the sky moves stops it dead before the tap is answered (down(): flight.halt()). So in a
// flight made with the hands the words are never showing. The ONE flight a visitor can make with the
// words showing is the Home key: it glides to the nearest Virgo, 1.1 to 3.2 s, through up to six
// stations, forward or back, and puts nothing out (home()).
//   --case hands   a real tap, the words, then a wheel notch / a swipe / ArrowDown: are the words still there?
//                  and a press during a flight: does the sky stop, and where do the words then stand?
//   --case home    at stations 4, 5, 6, 7, 8, 9 (back four, five and six stations; forward five, four,
//                  three): a real tap, the words, Home; EVERY FRAME of the glide: the words' place and box,
//                  their star, and what the box touches of everything drawn. With --bare no tap is made:
//                  the same glides without the words, for the frame times.
//   --case thrust  NOT a visitor's case, the rule under the hardest flight: the wheel (or swipes) forward
//                  through the stations and back again while sky.answer.touch() (the debug hook: what a
//                  tap calls, without the press that would stop the flight) writes the words again and
//                  again. Every frame, as above.
//   [R3_BASE=http://localhost:4616] node r4-flight.mjs --case home [--sizes desk,phone] [--throttle 4] [--bare] [--strip] [--name before]
//   writes flight/<case>-<size>[-xN][-bare][-<name>].txt (and, with --strip, a .jpg: the words cut out of the recording)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, frameTimes, launch, open, outDir, pnow, recorder, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { case: { type: 'string', default: 'home' }, sizes: { type: 'string', default: 'desk,phone' }, throttle: { type: 'string', default: '1' }, bare: { type: 'boolean', default: false }, strip: { type: 'boolean', default: false }, name: { type: 'string', default: '' } } });
const throttle = Number(values.throttle);
const dir = outDir('flight');
const browser = await launch({ gpu: true });

/** Installed in the page: every animation frame, the words and what they stand among. */
const RECORD = () => {
	const sky = window.__cellestial.sky, hooks = sky.hooks, layout = hooks.layout();
	const w = document.querySelector('[data-claim-words]');
	const FIG = 12, SP = 6, RING = 0.215;
	window.__r4 = [];
	window.__r4on = true;
	const gap = (box, s) => Math.hypot(Math.max(box.x0 - s.x, 0, s.x - box.x1), Math.max(box.y0 - s.y, 0, s.y - box.y1)) - s.r;
	const cover = (box, s) => { const dx = Math.max(box.x0 - s.x, 0, s.x - box.x1), dy = Math.max(box.y0 - s.y, 0, s.y - box.y1); const d = dx > 0 || dy > 0 ? Math.hypot(dx, dy) : -Math.min(s.x - box.x0, box.x1 - s.x, s.y - box.y0, box.y1 - s.y); return d >= s.r ? 0 : d <= -s.r ? Math.PI * s.r * s.r : s.r * s.r * Math.acos(d / s.r) - d * Math.sqrt(s.r * s.r - d * d); };
	const tick = (t) => {
		if (!window.__r4on) return;
		const f = hooks.flight();
		const row = { t, wall: performance.timeOrigin + t, mode: f.mode, pos: f.pos, coord: f.coord, slot: null };
		if (w && !w.hidden && w.dataset.slot && w.style.visibility !== 'hidden') {
			const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(w.style.transform);
			const own = hooks.starCircle(w.dataset.slot);
			if (m && own) {
				const x = Number(m[1]), y = Number(m[2]);
				// The stylesheet centres the words on x: the box is 96 by 24.
				const box = { x0: x - 48, y0: y, x1: x + 48, y1: y + 24 };
				const front = hooks.lattice.layer();
				let stars = 0, deep = 0, points = 0, pointCover = 0, starCover = 0, rings = Infinity;
				for (let layer = front; layer <= front + 11; layer++) {
					const g = ((layer % FIG) + FIG) % FIG, plan = layout.plans[g], fit = layout.fits[g];
					if (!plan || !fit) continue;
					for (let i = 0; i < plan.stars.length; i++) {
						const star = plan.stars[i];
						if (star.slot === w.dataset.slot) continue;
						const p = hooks.project(star.x, star.y, -layer * SP);
						if (p.scale <= 0 || p.depth < 0.25) continue;
						if (layer > front + 5 && (i !== plan.epicentre || p.depth >= 54)) continue;
						const isRings = i === plan.epicentre;
						const r = isRings ? RING * layout.b3 * p.scale : Math.max(fit.starR * layout.sizeOf(star) * p.scale, 1.25);
						if (p.x < -r || p.x > layout.w + r || p.y < -r || p.y > layout.h + r) continue;
						const s = { x: p.x, y: p.y, r };
						const d = gap(box, s);
						if (isRings) { rings = Math.min(rings, d); continue; }
						if (d >= 0) continue;
						if (r > 3) { stars++; deep = Math.max(deep, -d); starCover += cover(box, s); } else { points++; pointCover += cover(box, s); }
					}
				}
				Object.assign(row, { slot: w.dataset.slot, place: `${w.dataset.side ?? 'under'}${Number(w.dataset.slide ?? 0) ? (Number(w.dataset.slide) > 0 ? '+' : '') + w.dataset.slide : ''}`, x, y, own, tight: gap(box, { x: own.x, y: own.y, r: own.r * 1.1 }), stars, deep, starCover, points, pointCover, rings, edge: Math.min(box.x0 + 8, layout.w - box.x1 + 8), inside: box.y0 >= 0 && box.y1 <= layout.h });
			}
		}
		window.__r4.push(row);
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
};
const words = (page) => page.evaluate(() => { const w = document.querySelector('[data-claim-words]'); return w && !w.hidden && w.style.visibility !== 'hidden' ? { slot: w.dataset.slot, side: w.dataset.side ?? 'under', slide: w.dataset.slide ?? '0' } : null; });
const flight = (page) => page.evaluate(() => { const f = window.__cellestial.sky.hooks.flight(); return { mode: f.mode, pos: f.pos, coord: f.coord }; });
const untilRest = async (page, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if ((await flight(page)).mode === 'rest') return true; await sleep(40); } return false; };
const untilWords = async (page, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { const r = await words(page); if (r) return r; await sleep(40); } return null; };

/** What one stretch of frames shows of the words. */
function judge(rows) {
	const shown = rows.filter((r) => r.slot);
	const changes = [];
	let prev = null;
	for (const r of shown) {
		if (prev && prev.slot === r.slot && prev.place !== r.place) changes.push({ t: r.t, from: prev.place, to: r.place, slot: r.slot });
		prev = r;
	}
	let aba = 0;
	for (let i = 1; i < changes.length; i++) if (changes[i].slot === changes[i - 1].slot && changes[i].to === changes[i - 1].from && changes[i].t - changes[i - 1].t < 1000) aba++;
	const max = (k) => shown.reduce((a, r) => Math.max(a, r[k]), 0);
	const loose = shown.filter((r) => Math.abs(r.tight - 7) > 0.6).length;
	return { frames: rows.length, shown: shown.length, changes, aba, loose, onStars: shown.filter((r) => r.stars > 0 && r.starCover > 30).length, nicks: shown.filter((r) => r.stars > 0 && r.starCover <= 30).length, deepest: max('deep'), onPoints: shown.filter((r) => r.pointCover > 30).length, inRings: shown.filter((r) => r.rings < 0).length, nearSide: shown.filter((r) => r.edge < 16 - 0.05).length, outside: shown.filter((r) => !r.inside).length };
}
const tell = (j) => `${j.frames} frames, the words showing in ${j.shown}; they changed place ${j.changes.length} time(s)${j.changes.length ? ` (${j.changes.map((c) => `${c.from} to ${c.to}`).join(', ')})` : ''}; there and back within a second ${j.aba}; frames in which they stood off their star (not 7 px from it) ${j.loose}; across a star (more than one point's worth, 30 px2) ${j.onStars}, a nick of one ${j.nicks} (deepest ${j.deepest.toFixed(1)} px); across more than a point's worth of far points ${j.onPoints}; inside the reach of Cellestial's rings ${j.inRings}; letters nearer a side than 16 px ${j.nearSide}; off the screen ${j.outside}`;

for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	const log = [];
	const say = (s) => { console.log(s); log.push(s); };
	const o = await open(browser, size, { throttle, init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(2500);
	const touch = (type, x, y) => o.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
	const swipe = async (d) => { const y0 = d > 0 ? 640 : 300; await touch('touchStart', 200, y0); for (let i = 1; i <= 10; i++) { await touch('touchMove', 200, y0 - d * i * 34); await sleep(18); } await touch('touchEnd', 200, y0 - d * 340); };
	const push = async (d) => { if (o.phone) { await swipe(d); await sleep(160); } else { await o.page.mouse.wheel(0, d * 100); await sleep(50); } };
	const station = async (k) => { await o.page.keyboard.press('Escape'); await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k); await sleep(o.phone || throttle > 1 ? 2200 : 1600); };
	const POINTS = [[0.3, 0.42], [0.66, 0.56], [0.5, 0.3], [0.4, 0.68]].map(([a, b]) => [Math.round(W * a), Math.round(H * b)]);
	say(`${size} (${W}x${H}), CPU x${throttle}, ${PROD}${values.bare ? ', no tap: the same flights without the words' : ''}`);

	if (values.case === 'hands') {
		for (const [what, act] of [['a wheel notch or a swipe', () => (o.phone ? swipe(1) : o.page.mouse.wheel(0, 100))], ['ArrowDown', () => o.page.keyboard.press('ArrowDown')], ['a wheel notch or a swipe back', () => (o.phone ? swipe(-1) : o.page.mouse.wheel(0, -100))]]) {
			await station(5);
			// A point of empty sky whose tap is answered with the words (a tap on a star opens its panel instead).
			let before = null, at = POINTS[0];
			for (const pt of POINTS) {
				at = pt;
				await o.pressAt(...pt);
				before = await untilWords(o.page, 2500);
				if (before) break;
				await o.page.keyboard.press('Escape');
				await sleep(300);
			}
			await sleep(300);
			await act();
			await sleep(120);
			const after = await words(o.page);
			const f = await flight(o.page);
			say(`  Aquarius, a real tap at ${at}: the words ${before ? `by ${before.slot} (${before.side})` : 'NOT shown'}; then ${what}: the flight is in "${f.mode}", the words are ${after ? 'STILL SHOWING' : 'put out'}`);
			await untilRest(o.page);
		}
		// A press during a flight.
		await station(5);
		for (let i = 0; i < 12; i++) await push(1);
		const f0 = await flight(o.page);
		await o.pressAt(...POINTS[1]);
		const f1 = await flight(o.page);
		await sleep(60);
		const f2 = await flight(o.page);
		const got = await untilWords(o.page);
		const f3 = await flight(o.page);
		say(`  a press at ${POINTS[1]} during a flight (the flight in "${f0.mode}" at ${f0.pos.toFixed(2)}): straight after it "${f1.mode}" at ${f1.pos.toFixed(3)}, 60 ms on at ${f2.pos.toFixed(3)}; the words ${got ? `come by ${got.slot} (${got.side}) with the flight in "${f3.mode}" at ${f3.pos.toFixed(3)}: the sky ${Math.abs(f3.pos - f1.pos) < 1e-3 ? 'has not moved since the press' : `HAS MOVED ${Math.abs(f3.pos - f1.pos).toFixed(3)}`}` : 'do not come'}`);
	}

	if (values.case === 'home') {
		const rec = values.strip ? await recorder(o, { quality: 86 }) : null;
		const cells = [];
		const total = { frames: 0, shown: 0, changes: 0, aba: 0, loose: 0, onStars: 0, nicks: 0, onPoints: 0, inRings: 0, nearSide: 0, outside: 0, deepest: 0 };
		const ft = [];
		if (!values.bare) await o.page.evaluate(RECORD);
		for (const k of [4, 5, 6, 7, 8, 9]) {
			for (const pt of values.bare ? [POINTS[0]] : POINTS.slice(0, 3)) {
				await station(k);
				let got = null;
				if (!values.bare) {
					const hit = await o.page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el?.closest('button, a, .sky-claim') ? 'a control' : 'sky'; }, pt);
					if (hit !== 'sky') continue;
					await o.pressAt(...pt);
					got = await untilWords(o.page);
					if (!got) { say(`  ${CONSTELLATIONS[k].name}, tap at ${pt}: no words came`); continue; }
					await sleep(500);
				}
				const p0 = await pnow(o.page);
				const from = await flight(o.page);
				await o.page.keyboard.press('Home');
				await sleep(150);
				await untilRest(o.page, 8000);
				const p1 = await pnow(o.page);
				const to = await flight(o.page);
				const t = await frameTimes(o.page, p0, p1);
				ft.push(t);
				if (values.bare) { say(`  ${CONSTELLATIONS[k].name}, Home: station ${from.coord + 1} to ${((to.coord % 12) + 12) % 12 + 1} in ${Math.round(p1 - p0)} ms; ${t.text}`); continue; }
				const rows = await o.page.evaluate(([a, b]) => window.__r4.filter((r) => r.t >= a && r.t <= b), [p0, p1]);
				const j = judge(rows);
				for (const key of Object.keys(total)) total[key] = key === 'deepest' ? Math.max(total[key], j[key]) : total[key] + (key === 'changes' ? j.changes.length : j[key]);
				say(`  ${CONSTELLATIONS[k].name}, tap at ${pt}: the words by ${got.slot} (${got.side}${Number(got.slide) ? ` ${got.slide}` : ''}); Home: station ${from.coord + 1} to ${((to.coord % 12) + 12) % 12 + 1} in ${Math.round(p1 - p0)} ms: ${tell(j)}; ${t.text}`);
				if (rec) {
					// Twelve moments of this glide in which the words show, cut out of the recording round the words.
					const shown = rows.filter((r) => r.slot);
					const picks = [];
					for (let n = 0; n < 12 && shown.length; n++) picks.push(shown[Math.min(shown.length - 1, Math.round((n * (shown.length - 1)) / 11))]);
					for (const r of picks) {
						const f = rec.at(r.wall);
						if (!f) continue;
						const meta = await sharp(f.img).metadata();
						const s = meta.width / W;
						const cw = 220, ch = 150;
						const left = Math.max(0, Math.min(W - cw, r.x - cw / 2)), top = Math.max(0, Math.min(H - ch, r.y + 12 - ch / 2 - (r.own.y < r.y ? 14 : -14)));
						const box = { left: Math.round(left * s), top: Math.round(top * s), width: Math.min(meta.width - Math.round(left * s), Math.round(cw * s)), height: Math.min(meta.height - Math.round(top * s), Math.round(ch * s)) };
						cells.push({ img: await sharp(f.img).extract(box).resize(cw, ch, { fit: 'fill' }).png().toBuffer(), label: `${CONSTELLATIONS[k].name} ${r.slot.replace('slot-', '')} +${Math.round(r.t - p0)}: ${r.place}` });
					}
				}
			}
		}
		if (!values.bare) say(`${size}, CPU x${throttle}, ALL THE GLIDES: ${total.frames} frames, the words showing in ${total.shown}; they changed place ${total.changes} time(s); there and back within a second ${total.aba}; off their star ${total.loose}; across a star ${total.onStars} (a nick ${total.nicks}; deepest ${total.deepest.toFixed(1)} px); across far points ${total.onPoints}; inside the rings' reach ${total.inRings}; letters nearer a side than 16 px ${total.nearSide}; off the screen ${total.outside}`);
		const n = ft.reduce((a, t) => a + t.n, 0);
		say(`${size}, CPU x${throttle}, THE FRAMES OF ALL THE GLIDES${values.bare ? ' (no words)' : ' (the words showing)'}: ${n} frames, avg ${(ft.reduce((a, t) => a + t.avg * t.n, 0) / Math.max(1, n)).toFixed(1)} ms, over 17.5 ms ${ft.reduce((a, t) => a + t.over17, 0)}, over 34 ms ${ft.reduce((a, t) => a + t.over34, 0)}, over 50 ms ${ft.reduce((a, t) => a + t.over50, 0)}, worst ${Math.max(...ft.map((t) => t.worst)).toFixed(0)} ms`);
		if (rec) { await rec.stop(); for (let part = 0; part * 72 < cells.length; part++) await sheet(join(dir, `home-${size}${values.name ? `-${values.name}` : ''}-${part + 1}.jpg`), cells.slice(part * 72, part * 72 + 72), { cols: 12, cellW: 126, cellH: 86, gap: 4 }); }
	}

	if (values.case === 'thrust') {
		await station(2);
		if (!values.bare) await o.page.evaluate(RECORD);
		if (!o.phone) await o.page.mouse.move(W / 2, H / 2);
		const p0 = await pnow(o.page);
		let n = 0, last = 0;
		for (const [d, ms] of [[1, 9000], [-1, 9000]]) {
			const end = Date.now() + ms;
			while (Date.now() < end) {
				await push(d);
				if (!values.bare && Date.now() - last > 900) { last = Date.now(); const pt = POINTS[n++ % POINTS.length]; await o.page.evaluate(([x, y]) => window.__cellestial.sky.answer.touch(x, y), pt); }
			}
		}
		const p1 = await pnow(o.page);
		const t = await frameTimes(o.page, p0, p1);
		const end = await flight(o.page);
		if (!values.bare) {
			const rows = await o.page.evaluate(([a, b]) => window.__r4.filter((r) => r.t >= a && r.t <= b), [p0, p1]);
			const pos = rows.map((r) => r.pos);
			say(`  the wheel or swipes forward 9 s and back 9 s from Scorpius, sky.answer.touch() about every 0.9 s (${n} times): flown from ${pos[0].toFixed(1)} to ${Math.max(...pos).toFixed(1)} and back to ${end.pos.toFixed(1)} (a station is 6): ${tell(judge(rows))}`);
			const stars = new Set(rows.filter((r) => r.slot).map((r) => r.slot));
			say(`  the words were written by ${stars.size} different stars`);
		}
		say(`${size}, CPU x${throttle}, THE FRAMES${values.bare ? ' (no words)' : ' (the words written again and again)'}: ${t.text}, over 17.5 ms ${t.over17}`);
	}
	const errs = o.errors.filter((e) => !/about:blank/.test(e));
	say(`  console errors ${errs.length}${errs.length ? `: ${errs.join(' | ').slice(0, 300)}` : ''}`);
	writeFileSync(join(dir, `${values.case}-${size}${throttle > 1 ? `-x${throttle}` : ''}${values.bare ? '-bare' : ''}${values.name ? `-${values.name}` : ''}.txt`), `${log.join('\n')}\n`);
	await o.context.close();
}
await browser.close();
