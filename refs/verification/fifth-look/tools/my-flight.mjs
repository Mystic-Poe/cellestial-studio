#!/usr/bin/env node
// The fifth look's own: "CLAIM YOURS" AS A VISITOR MEETS IT, AND IN FLIGHT. Motion on, production build, real GPU.
//   --mode meet   at a station: a real tap on empty sky, the time to the words, where they stand; a tap on the
//                 WORDS (their star picked? its panel open?); again, a tap on the STAR itself; then the words
//                 showing and one push of the flight (wheel, or a swipe on a touch screen): are they taken off?
//   --mode words  the words showing, then the Home key (the glide to the nearest Virgo: the one flight that
//                 keeps the words): every frame the words' place, side and box, their star's disc, how many
//                 other discs (r > 3 px) the box lies on; a strip of the screen (flight/<name>.jpg)
//   --mode time   the same flight, nothing recorded but the frames' times (lib.mjs logs every frame)
//   --mode bare   the same flight without the words (no tap)
//   node my-flight.mjs --size desk|phone --mode meet|words|time|bare [--from 4,8,6] [--throttle 4]
//   R3_BASE / R3_OUT as in lib.mjs. Writes <OUT>/flight/.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { GRID, PROD, SIZES, frameTimes, launch, open, outDir, pnow, recorder, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, mode: { type: 'string', default: 'words' }, from: { type: 'string', default: '4,8,6' }, throttle: { type: 'string', default: '1' }, tag: { type: 'string', default: '' } } });
const size = values.size, mode = values.mode, throttle = Number(values.throttle);
const dir = outDir('flight');
const { width: W, height: H } = SIZES[size].viewport;
const ALL = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean));
const name = `${mode}-${size}${throttle > 1 ? `-x${throttle}` : ''}${values.tag ? `-${values.tag}` : ''}`;
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });

const WORDS = () => {
	const w = document.querySelector('[data-claim-words]');
	if (!w || w.hidden || getComputedStyle(w).visibility === 'hidden') return null;
	const b = w.getBoundingClientRect();
	return { slot: w.dataset.slot, side: w.dataset.side ?? 'under', slide: Number(w.dataset.slide ?? 0), x: b.x, y: b.y, w: b.width, h: b.height, star: window.__cellestial.sky.hooks.starCircle(w.dataset.slot) };
};
const PANEL = () => { const p = [...document.querySelectorAll('[data-sky-panel]')].find((e) => !e.hidden); return p ? { kind: p.dataset.skyPanel, focused: window.__picks?.at(-1) ?? null, picks: window.__picks?.length ?? 0 } : null; };

async function station(k) {
	const o = await open(browser, size, { throttle, init: { fn: () => { sessionStorage.setItem('cellestial:round', '1'); } } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(2500);
	// Which star a pick took: the sky's own event.
	await o.page.evaluate(() => { window.__picks = []; window.__cellestial.sky.hooks.on('star-pick', (e) => window.__picks.push(e.slot)); });
	await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k);
	await sleep(1500);
	return o;
}
/** A point of empty sky: nothing but the sky under it and no star's disc within 46 px. `n` picks among them. */
async function emptyPoint(o, k, n = 0) {
	const own = CONSTELLATIONS[k].stars.map((s) => s.slot).filter(Boolean);
	const pts = await o.page.evaluate(([slots, W, H, touch]) => {
		const discs = slots.map((s) => window.__cellestial.sky.hooks.starCircle(s)).filter((c) => c && Number.isFinite(c.x));
		const out = [];
		for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
			const x = W * (0.14 + 0.12 * i), y = (touch ? 150 : 110) + (H - 300) * (j / 6);
			const el = document.elementFromPoint(x, y);
			if (!el || el.closest('button, a, .sky-claim, #chrome')) continue;
			const d = Math.min(...discs.map((c) => Math.hypot(c.x - x, c.y - y) - c.r));
			if (d > 46 && d < 160) out.push([x, y]);
		}
		return out;
	}, [own, W, H, o.phone]);
	return pts[Math.min(pts.length - 1, Math.floor((pts.length * (n + 1)) / 4))] ?? null;
}
async function tapForWords(o, k, n = 0) {
	const pt = await emptyPoint(o, k, n);
	if (!pt) return null;
	const t0 = Date.now();
	await o.pressAt(...pt);
	let w = null;
	for (let i = 0; i < 120 && !w; i++) { await sleep(50); w = await o.page.evaluate(WORDS); }
	return w ? { ...w, pt, ms: Date.now() - t0 } : { pt, none: true };
}
const atRest = async (o) => {
	let still = 0;
	for (let i = 0; i < 200 && still < 8; i++) { await sleep(50); const f = await o.page.evaluate(() => window.__cellestial.sky.hooks.flight()); still = f.mode === 'rest' ? still + 1 : 0; }
};
const gap = (b, s) => Math.hypot(Math.max(b.x - s.x, 0, s.x - (b.x + b.w)), Math.max(b.y - s.y, 0, s.y - (b.y + b.h))) - s.r;

const froms = values.from.split(',').map(Number);
if (mode === 'meet') {
	for (const k of froms) {
		const c = CONSTELLATIONS[k];
		const o = await station(k);
		const w = await tapForWords(o, k);
		if (!w || w.none) { say(`${size} ${c.name}: the tap at ${w?.pt?.map(Math.round)} gave no words in 6 s`); await o.context.close(); continue; }
		await sleep(700);
		const png = await o.page.screenshot({ type: 'jpeg', quality: 85 });
		// A tap on the WORDS.
		await o.pressAt(w.x + w.w / 2, w.y + w.h / 2);
		await sleep(900);
		const p1 = await o.page.evaluate(PANEL);
		say(`${size} ${c.name}: tap at ${w.pt.map(Math.round)}: the words by ${w.slot} ${w.side}${w.slide ? ` slid ${w.slide}` : ''} after ${w.ms} ms, ${gap(w, w.star).toFixed(1)} px from its disc; a tap on the WORDS: ${p1 ? `the ${p1.kind} panel, star ${p1.focused}${p1.focused === w.slot ? ' (theirs)' : '  <<< NOT THEIRS'}` : 'NO PANEL  <<<'}`);
		await o.page.keyboard.press('Escape');
		await sleep(900);
		// Again, and a tap on the STAR itself.
		const w2 = await tapForWords(o, k, 1);
		if (w2 && !w2.none) {
			await sleep(500);
			const s = await o.page.evaluate((slot) => window.__cellestial.sky.hooks.starCircle(slot), w2.slot);
			await o.pressAt(s.x, s.y);
			await sleep(900);
			const p2 = await o.page.evaluate(PANEL);
			say(`${size} ${c.name}: tap at ${w2.pt.map(Math.round)}: the words by ${w2.slot} ${w2.side} after ${w2.ms} ms; a tap on the STAR: ${p2 ? `the ${p2.kind} panel, star ${p2.focused}${p2.focused === w2.slot ? ' (that star)' : '  <<< ANOTHER'}` : 'NO PANEL  <<<'}`);
			await o.page.keyboard.press('Escape');
			await sleep(900);
		}
		// The words showing, then one push of the flight.
		const w3 = await tapForWords(o, k, 2);
		if (w3 && !w3.none) {
			await sleep(400);
			if (o.phone) {
				const x = W / 2, y0 = H * 0.62;
				await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
				for (let i = 1; i <= 8; i++) { await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - i * 22 }] }); await sleep(16); }
				await o.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			} else { await o.page.mouse.move(W / 2, H / 2); await o.page.mouse.wheel(0, 240); }
			await sleep(500);
			const after = await o.page.evaluate(WORDS);
			const f = await o.page.evaluate(() => window.__cellestial.sky.hooks.flight());
			say(`${size} ${c.name}: the words by ${w3.slot}, then ${o.phone ? 'a swipe' : 'the wheel'}: the flight ${f.mode}, coord ${f.coord.toFixed(2)}; the words ${after ? 'STILL SHOWING' : 'taken off'}`);
		}
		writeFileSync(join(dir, `meet-${size}-${k + 1}.jpg`), png);
		say(`${size} ${c.name}: console errors ${o.errors.filter((e) => !/about:blank/.test(e)).length}`);
		await o.context.close();
	}
} else {
	const cells = [];
	for (const k of froms) {
		const c = CONSTELLATIONS[k];
		const o = await station(k);
		let w = null;
		if (mode !== 'bare') {
			w = await tapForWords(o, k);
			if (!w || w.none) { say(`${name} from ${c.name}: no words`); await o.context.close(); continue; }
			await sleep(600);
		} else await sleep(1800);
		let rec = null;
		if (mode === 'words') {
			rec = await recorder(o, { every: 1, quality: 70 });
			await o.page.evaluate((all) => {
				const sky = window.__cellestial.sky;
				window.__rec = [];
				const tick = (t) => {
					const w = document.querySelector('[data-claim-words]');
					const f = sky.hooks.flight();
					const r = { t, mode: f.mode, coord: f.coord };
					if (w && !w.hidden) {
						const b = w.getBoundingClientRect();
						const box = { x: b.x, y: b.y, w: b.width, h: b.height };
						const c = sky.hooks.starCircle(w.dataset.slot);
						let on = 0;
						for (const s of all) { if (s === w.dataset.slot) continue; const d = sky.hooks.starCircle(s); if (!d || !(d.r > 3)) continue; if (Math.hypot(Math.max(box.x - d.x, 0, d.x - (box.x + box.w)), Math.max(box.y - d.y, 0, d.y - (box.y + box.h))) - d.r < 0) on++; }
						Object.assign(r, { slot: w.dataset.slot, vis: w.style.visibility !== 'hidden', side: w.dataset.side, slide: w.dataset.slide, box, c, on });
					}
					window.__rec.push(r);
					requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			}, ALL);
			await sleep(300);
		}
		const p0 = await pnow(o.page);
		const t0 = Date.now();
		await o.page.keyboard.press('Home');
		await atRest(o);
		await sleep(700);
		const p1 = await pnow(o.page);
		const ft = await frameTimes(o.page, p0, p1);
		const f = await o.page.evaluate(() => window.__cellestial.sky.hooks.flight());
		if (mode !== 'words') {
			say(`${name} from ${c.name} (station ${k + 1}) by Home to coord ${f.coord.toFixed(2)}${w ? `, the words by ${w.slot}` : ', no words'}: ${ft.text}`);
		} else {
			const r = (await o.page.evaluate(() => window.__rec)).filter((x) => x.t >= p0);
			const withW = r.filter((x) => x.slot);
			const shown = withW.filter((x) => x.vis);
			const key = (x) => `${x.side}${Number(x.slide) ? ` slid ${x.slide}` : ''}`;
			const changes = [];
			for (let i = 1; i < shown.length; i++) if (key(shown[i]) !== key(shown[i - 1])) changes.push({ t: shown[i].t - p0, from: key(shown[i - 1]), to: key(shown[i]), mode: shown[i].mode });
			let aba = 0;
			for (let i = 2; i < changes.length; i++) if (changes[i].to === changes[i - 2].to && changes[i].t - changes[i - 2].t < 1000) aba++;
			for (let i = 1; i < changes.length; i++) if (changes[i].to === changes[i - 1].from && changes[i].t - changes[i - 1].t < 1000) aba++;
			// The run as a line: each stretch of frames in one state (a place, or hidden), with when it began and the flight's mode.
			const segs = [];
			for (const x of withW) { const st = x.vis ? key(x) : 'HIDDEN'; if (!segs.length || segs.at(-1).st !== st) segs.push({ st, t: x.t - p0, n: 1, mode: x.mode, r: x.c?.r }); else segs.at(-1).n++; }
			say(`  ${name} from ${c.name}, the words frame by frame: ${segs.map((g) => `+${Math.round(g.t)} ms ${g.st} for ${g.n} frames (${g.mode}${g.r ? `, star r ${g.r.toFixed(1)}` : ', star off the screen'})`).join('; ')}`);
			const gaps = shown.filter((x) => x.c).map((x) => gap(x.box, x.c));
			const flying = shown.filter((x) => x.mode !== 'rest');
			const last = shown.at(-1);
			say(`${name} from ${c.name} (station ${k + 1}) by Home to coord ${f.coord.toFixed(2)}: ${r.length} frames in ${Math.round(p1 - p0)} ms; the words on the page in ${withW.length}, showing in ${shown.length}, hidden (waiting) in ${withW.length - shown.length}; star ${[...new Set(withW.map((x) => x.slot))].join(', ')}; the box from its own star's disc ${gaps.length ? `${Math.min(...gaps).toFixed(1)} to ${Math.max(...gaps).toFixed(1)}` : '--'} px; changes of place ${changes.length}${changes.length ? `: ${changes.map((x) => `+${Math.round(x.t)} ms ${x.from} -> ${x.to} (${x.mode})`).join('; ')}` : ''}; A, B, A within a second: ${aba}; frames in flight with the box on another star (r > 3 px): ${flying.filter((x) => x.on).length} of ${flying.length}; at rest at the end: ${last ? `${key(last)}, on ${last.on} star(s)` : 'no words'}; ${ft.text}`);
			await rec.stop();
			const p2w = (t) => t0 + (t - p0);
			cells.push(...rec.cut(`${c.name}`, p2w(p0), p2w(p1), (p1 - p0) / (o.phone ? 11.01 : 5.01)));
		}
		say(`${name} from ${c.name}: console errors ${o.errors.filter((e) => !/about:blank/.test(e)).length}`);
		await o.context.close();
	}
	if (cells.length) await sheet(join(dir, `${name}.jpg`), cells, GRID[o_size()]);
}
function o_size() { return SIZES[size].hasTouch ? 'phone' : 'desk'; }
writeFileSync(join(dir, `${name}.txt`), `${log.join('\n')}\n`);
await browser.close();
