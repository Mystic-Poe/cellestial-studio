#!/usr/bin/env node
// The Sky's rules, driven for real and measured: the flight, the round, the
// guards, reduced motion, frame times, the governor, and picking.
//
//   node tools/sky/measure.mjs [--url http://localhost:4500]
//        [--only input,endless,round,guards,still,frames,throttle,pick,fall]
//
// Needs the dev server running (see PROGRESS.md). Every section opens the real
// page ("/?scene=sky&debug") in a fresh browser context, so storage starts
// empty, and drives it with real wheel, key, touch and mouse events. It reads
// the sky's state through window.__cellestial.sky.hooks (hooks.ts) and never
// moves the camera by script, except in `endless`, where two poses are set by
// script only to be compared with the poses that were flown to.
//
//   input     wheel, keys and touch, forward and back; speed against time;
//             the tap that stops it; coming to rest on a station
//   endless   thirty layers forward, fifteen back: figures repeat every twelve
//             and the pose after the flight is the pose of the first round
//   round     roundComplete() and the exit button: not before the twelfth
//             figure, then there to stay, also after a reload
//   guards    no flight under a dialog, with focus in a form field, or on the Roots
//   still     reduced motion: no animation frames at rest, the exit button,
//             no flight, a star still picked by a click
//   frames    frame times over a flight of 4.6 layers forward and 1.6 back, real GPU
//   throttle  the same flight for 24 s in software rendering with the CPU
//             slowed 4x: the governor's level and the frame time, second by second
//   pick      a button over every star: how far its centre is from the star's,
//             at rest and in flight; what a click on an empty, a waiting-ask
//             and a lit star does
//   fall      fall() against a rising ground line, then restore()
//
// It prints what it measured and writes the same text to refs/sky/measure.txt
// (only when every section was run). Exits non-zero if a check failed or the
// page logged an error.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ALL = 'input,endless,round,guards,still,frames,throttle,pick,fall';
const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: ALL },
	},
});
const only = new Set(values.only.split(','));
const GPU = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'];
const SIZES = {
	desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
	},
};

const lines = [];
let failed = 0;
const log = (text = '') => {
	lines.push(text);
	console.log(text);
};
const check = (what, ok, detail = '') => {
	if (!ok) failed++;
	log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `: ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : String(n));

const browsers = {};
async function browser(gpu) {
	const key = gpu ? 'gpu' : 'soft';
	browsers[key] ??= await chromium.launch({
		executablePath: '/usr/bin/chromium',
		args: gpu ? GPU : [],
	});
	return browsers[key];
}

/** The real page on the sky, up and ready. `init` runs before any of its scripts. */
async function open(size, { gpu = true, query = '?scene=sky&debug', init, context } = {}) {
	const ctx = context ?? (await (await browser(gpu)).newContext(SIZES[size]));
	const page = await ctx.newPage();
	if (init) await page.addInitScript(init);
	// Astro's dev toolbar sits at bottom centre, over the exit button. Gone on every load.
	await page.addInitScript(() =>
		addEventListener('DOMContentLoaded', () => {
			const style = document.createElement('style');
			style.textContent = 'astro-dev-toolbar { display: none !important; }';
			document.head.append(style);
		}),
	);
	page.on('console', (m) => {
		// The Turnstile test widget in the build-request dialog logs this from its own frame.
		if (m.type() === 'error' && !/frame is sandboxed/.test(m.text())) {
			failed++;
			log(`  FAIL  console error: ${m.text()}`);
		}
	});
	page.on('pageerror', (e) => {
		failed++;
		log(`  FAIL  page error: ${e.message}`);
	});
	await page.goto(`${values.url}/${query}`, { waitUntil: 'networkidle' });
	await page.waitForFunction(() => window.__cellestial?.sky?.hooks);
	await page.evaluate(() => window.__cellestial.sky.ready);
	await page.waitForTimeout(900); // the page comes up out of black
	const state = () =>
		page.evaluate(() => {
			const { sky } = window.__cellestial;
			return {
				...sky.hooks.flight(),
				round: sky.roundComplete(),
				exit: !document.querySelector('[data-descend]').hidden,
				scene: document.documentElement.dataset.scene,
			};
		});
	/** Wait until the flight is standing still; returns the seconds it took. */
	const rest = async (limit = 9000) => {
		const t0 = Date.now();
		while (Date.now() - t0 < limit) {
			const s = await state();
			if (s.mode === 'rest' || s.mode === 'halt') return (Date.now() - t0) / 1000;
			await sleep(40);
		}
		return Number.NaN;
	};
	/** Hold a key until the position passes `coord` (in the key's direction). */
	const holdUntil = async (key, coord, limit = 60000) => {
		const forward = (await state()).coord < coord;
		await page.keyboard.down(key);
		const t0 = Date.now();
		while (Date.now() - t0 < limit) {
			const s = await state();
			if (forward ? s.coord >= coord : s.coord <= coord) break;
			await sleep(30);
		}
		await page.keyboard.up(key);
		return (Date.now() - t0) / 1000;
	};
	return { page, ctx, state, rest, holdUntil, close: () => ctx.close() };
}

/** Turn the wheel every 40 ms for `ms`, noting the speed at the given moments. */
async function wheelFor(view, ms, dy, sampleAt = []) {
	const speeds = [];
	const t0 = Date.now();
	let next = 0;
	while (Date.now() - t0 < ms) {
		await view.page.mouse.wheel(0, dy);
		if (next < sampleAt.length && Date.now() - t0 >= sampleAt[next] * 1000) {
			speeds.push([sampleAt[next], (await view.state()).vel]);
			next++;
		}
		await sleep(40);
	}
	return speeds;
}

const isWhole = (coord) => Math.abs(coord - Math.round(coord)) < 1e-3;

/** A point of empty sky: nothing but the canvas under it. */
const emptyPoint = (view) =>
	view.page.evaluate(() => {
		for (const [fx, fy] of [
			[0.12, 0.8],
			[0.88, 0.8],
			[0.12, 0.3],
			[0.88, 0.3],
			[0.5, 0.75],
		]) {
			const x = Math.round(innerWidth * fx);
			const y = Math.round(innerHeight * fy);
			if (document.elementFromPoint(x, y)?.id === 'sky-canvas') return { x, y };
		}
		return null;
	});

// ────────────────────────────────────────────────────────────── input ──

if (only.has('input')) {
	log('INPUT, 1440x900 (wheel and keys)');
	const view = await open('desk');
	await view.page.mouse.move(720, 450);

	const at = [0.3, 1, 2, 3, 4, 5, 6, 7];
	const speeds = await wheelFor(view, 7300, 100, at);
	log(`  wheel turned for 7.3 s: speed (world units a second) ${speeds.map(([t, v]) => `${t}s ${f2(v)}`).join(', ')}`);
	const early = speeds[0][1];
	const late = speeds.slice(-3).map(([, v]) => v);
	check('the first turn of the wheel starts a medium cruise', early > 0.8 && early < 3.5, f2(early));
	check('speed builds with continued scrolling', speeds[3][1] > speeds[1][1] * 1.5);
	check(
		'and has a ceiling',
		Math.max(...late) <= 8.05 && Math.max(...late) - Math.min(...late) < 0.2,
		`${f2(Math.min(...late))} to ${f2(Math.max(...late))} over the last three seconds`,
	);
	let secs = await view.rest();
	let s = await view.state();
	check('input stops: it glides and comes to rest on a station', isWhole(s.coord), `layer ${f2(s.coord)} after ${f2(secs)} s`);
	const forwardEnd = s.coord;

	await wheelFor(view, 1500, -100);
	s = await view.state();
	check('wheel up flies backward', s.vel < -1, `speed ${f2(s.vel)}`);
	await view.rest();
	s = await view.state();
	check('and rests on a station behind', isWhole(s.coord) && s.coord < forwardEnd, `layer ${f2(s.coord)}`);

	// The tap that stops it dead.
	await wheelFor(view, 1200, 100);
	const before = await view.state();
	const point = await emptyPoint(view);
	await view.page.mouse.move(point.x, point.y);
	await view.page.mouse.down();
	const after = await view.state();
	await view.page.mouse.up();
	await sleep(1200);
	const later = await view.state();
	check(
		'a click on empty sky stops it dead',
		after.vel === 0 && after.mode === 'halt' && Math.abs(later.pos - after.pos) < 1e-9,
		`speed ${f2(before.vel)} before, ${after.vel} on the press; ${f2(Math.abs(after.pos - before.pos))} units travelled between the two readings; still at layer ${later.coord.toFixed(3)} 1.2 s later`,
	);
	check('where it was, not on a station', !isWhole(later.coord));

	for (const [key, dir] of [
		['ArrowDown', 1],
		['ArrowUp', -1],
		['PageDown', 1],
		['PageUp', -1],
		['Space', 1],
	]) {
		const from = (await view.state()).coord;
		await view.page.keyboard.down(key);
		await sleep(700);
		const mid = await view.state();
		await view.page.keyboard.up(key);
		await view.rest();
		const to = await view.state();
		check(
			`${key} flies ${dir > 0 ? 'forward' : 'backward'} and rests on a station`,
			Math.sign(mid.vel) === dir && isWhole(to.coord) && Math.sign(to.coord - from) === dir,
			`layer ${f2(from)} to ${f2(to.coord)}`,
		);
	}
	await view.holdUntil('ArrowDown', (await view.state()).coord + 2.6);
	await view.rest();
	const away = (await view.state()).coord;
	await view.page.keyboard.press('Home');
	await sleep(200);
	secs = await view.rest();
	s = await view.state();
	const core = await view.page.evaluate(() => window.__cellestial.sky.coreCircle());
	check(
		'Home returns to the opening pose (the nearest Virgo, its star in the middle of the screen)',
		isWhole(s.coord) && Math.round(s.coord) % 12 === 0 && Math.abs(core.x - 720) < 0.01 && Math.abs(core.y - 450) < 0.01,
		`from layer ${f2(away)} to layer ${f2(s.coord)} in ${f2(secs + 0.2)} s`,
	);
	await view.close();

	log('INPUT, 390x844 (touch)');
	const phone = await open('phone');
	const cdp = await phone.ctx.newCDPSession(phone.page);
	const swipe = async (y0, y1, ms = 260) => {
		const steps = 13;
		const touch = (type, y) =>
			cdp.send('Input.dispatchTouchEvent', {
				type,
				touchPoints: type === 'touchEnd' ? [] : [{ x: 200, y, id: 1 }],
			});
		await touch('touchStart', y0);
		for (let i = 1; i <= steps; i++) {
			await touch('touchMove', y0 + ((y1 - y0) * i) / steps);
			await sleep(ms / steps);
		}
		await touch('touchEnd', y1);
	};
	await swipe(640, 300);
	s = await phone.state();
	check('a swipe up flies forward', s.vel > 0.8, `speed ${f2(s.vel)}`);
	const one = s.vel;
	// Seven more, as a thumb does it: a fifth of a second on the glass, a third of a second off it.
	const built = [];
	for (let i = 0; i < 7; i++) {
		await sleep(330);
		await swipe(640, 300, 200);
		built.push((await phone.state()).vel);
	}
	s = await phone.state();
	check('swipe after swipe builds speed, up to the ceiling', s.vel > one * 2 && s.vel <= 8.05, `${f2(one)} after one, then ${built.map(f2).join(', ')}`);
	secs = await phone.rest();
	s = await phone.state();
	check('and it rests on a station', isWhole(s.coord), `layer ${f2(s.coord)} after ${f2(secs)} s`);
	const top = s.coord;
	await swipe(300, 640);
	s = await phone.state();
	check('a swipe down flies backward', s.vel < -0.8, `speed ${f2(s.vel)}`);
	await phone.rest();
	s = await phone.state();
	check('and rests on a station behind', isWhole(s.coord) && s.coord < top, `layer ${f2(s.coord)}`);
	await swipe(640, 300);
	await swipe(640, 300);
	const moving = await phone.state();
	const p = await emptyPoint(phone);
	await phone.page.touchscreen.tap(p.x, p.y);
	const stopped = await phone.state();
	await sleep(800);
	const held = await phone.state();
	check(
		'a tap on empty sky stops it dead',
		stopped.vel === 0 && stopped.mode === 'halt' && held.pos === stopped.pos && !isWhole(held.coord),
		`speed ${f2(moving.vel)} before, ${stopped.vel} after; still at layer ${held.coord.toFixed(3)}`,
	);
	check('the document did not scroll', (await phone.page.evaluate(() => scrollY)) === 0);
	await phone.close();
	log();
}

// ──────────────────────────────────────────────────────────── endless ──

if (only.has('endless')) {
	log('ENDLESS, 1440x900');
	const view = await open('desk');
	await view.page.evaluate(() => {
		window.__stations = [];
		window.__cellestial.sky.hooks.on('station', (e) => window.__stations.push(e));
	});
	/** Every star of the figure in front, and Cellestial's star, on screen. */
	const pose = () =>
		view.page.evaluate(() => {
			const { sky } = window.__cellestial;
			const { hooks } = sky;
			const flight = hooks.flight();
			const out = { figure: flight.figure, coord: flight.coord, circles: [] };
			for (const star of hooks.layout().plans[flight.figure].stars) {
				const c = star.slot ? hooks.starCircle(star.slot) : sky.coreCircle();
				out.circles.push(c ? [c.x, c.y, c.r] : null);
			}
			return out;
		});
	const apart = (a, b) => {
		let worst = 0;
		for (const [i, c] of a.circles.entries()) {
			const d = b.circles[i];
			if (!c || !d) return Number.POSITIVE_INFINITY;
			worst = Math.max(worst, Math.abs(c[0] - d[0]), Math.abs(c[1] - d[1]), Math.abs(c[2] - d[2]));
		}
		return worst;
	};
	let secs = await view.holdUntil('ArrowDown', 29.7);
	await view.rest();
	const far = await pose();
	const stations = await view.page.evaluate(() => window.__stations.splice(0));
	check(`thirty layers forward`, far.coord >= 30 && isWhole(far.coord), `at layer ${f2(far.coord)} after ${f2(secs)} s of holding the key`);
	const inOrder = stations.every((e, i) => e.figure === ((e.layer % 12) + 12) % 12 && (i === 0 || e.layer === stations[i - 1].layer + 1));
	check('every station passed in order, the figures repeating every twelve', inOrder && stations.length >= 30, `${stations.length} stations, layers ${stations[0]?.layer} to ${stations.at(-1)?.layer}`);
	secs = await view.holdUntil('ArrowUp', far.coord - 14.7);
	await view.rest();
	const back = await pose();
	const stationsBack = await view.page.evaluate(() => window.__stations.splice(0));
	check('fifteen layers back', back.coord <= far.coord - 15 && isWhole(back.coord), `at layer ${f2(back.coord)} after ${f2(secs)} s`);
	check('every station passed in order on the way back', stationsBack.every((e, i) => i === 0 || e.layer === stationsBack[i - 1].layer - 1) && stationsBack.length >= 15, `${stationsBack.length} stations`);
	// The same figures in the first round, placed by script, to compare.
	const placed = async (coord) => {
		await view.page.evaluate((c) => window.__cellestial.sky.debug.setCoord(c), coord);
		await sleep(100);
		return pose();
	};
	const farHome = await placed(((far.coord % 12) + 12) % 12);
	const backHome = await placed(((back.coord % 12) + 12) % 12);
	const drift = Math.max(apart(far, farHome), apart(back, backHome));
	check('nothing drifts: every star is where it is in the first round', drift < 0.01, `largest difference ${drift.toExponential(1)} px (layer ${far.coord} against ${farHome.coord}, layer ${back.coord} against ${backHome.coord})`);
	await view.close();
	log();
}

// ────────────────────────────────────────────────────────────── round ──

if (only.has('round')) {
	log('ONE FULL ROUND, 1440x900');
	const view = await open('desk');
	let s = await view.state();
	check('at the start: no round, no exit button', !s.round && !s.exit);
	// Every station it comes to from here on, and whether the round was complete just before it.
	await view.page.evaluate(() => {
		const { sky } = window.__cellestial;
		window.__round = null;
		const seen = new Set([sky.hooks.flight().figure]);
		window.__seen = seen;
		sky.hooks.on('station', (e) => {
			const before = sky.roundComplete();
			seen.add(e.figure);
			// This listener runs before the scene marks the figure; look again once it has.
			queueMicrotask(() => {
				if (!window.__round && sky.roundComplete()) {
					window.__round = { layer: e.layer, before, figures: seen.size };
				}
			});
		});
	});
	// Five layers out and most of the way back is not a round.
	await view.holdUntil('ArrowDown', 4.7);
	await view.rest();
	await view.holdUntil('ArrowUp', 2.6);
	await view.rest();
	s = await view.state();
	const seenSoFar = await view.page.evaluate(() => window.__seen.size);
	check('out and back over a few layers: still no round, no exit button', !s.round && !s.exit, `at layer ${f2(s.coord)}, ${seenSoFar} figures seen`);
	await view.page.keyboard.down('ArrowDown');
	let early = false;
	for (;;) {
		s = await view.state();
		if (s.round) break;
		if (s.exit) early = true;
		if (s.coord > 14) break;
		await sleep(30);
	}
	await view.page.keyboard.up('ArrowDown');
	const moment = await view.page.evaluate(() => window.__round);
	check('roundComplete() turns true on reaching the twelfth figure, not before', s.round && moment?.figures === 12 && moment.before === false && !early, `at the station of layer ${moment?.layer}, the ${moment?.figures}th figure`);
	await sleep(100);
	s = await view.state();
	check('the exit button appears then', s.exit);
	await view.rest();
	await view.holdUntil('ArrowUp', 8.5);
	await view.rest();
	s = await view.state();
	check('and stays while flying on', s.exit && s.round);
	const words = await view.page.evaluate(() => document.querySelector('[data-descend]').textContent.trim());
	check('its words', words === 'See what holds up the sky', `"${words}"`);
	const box = await view.page.evaluate(() => {
		const r = document.querySelector('[data-descend]').getBoundingClientRect();
		return { mid: r.left + r.width / 2, bottom: innerHeight - r.bottom, w: innerWidth };
	});
	check('bottom centre', Math.abs(box.mid - box.w / 2) < 1 && box.bottom > 0 && box.bottom < 60, `centre ${f2(box.mid)} of ${box.w}, ${f2(box.bottom)} px above the bottom edge`);
	await view.page.reload({ waitUntil: 'networkidle' });
	await view.page.waitForFunction(() => window.__cellestial?.sky?.hooks);
	await sleep(800);
	s = await view.state();
	check('after a reload in the same session it is there from the start', s.exit && s.round);
	await view.page.click('[data-descend]');
	await sleep(1500);
	s = await view.state();
	check('pressing it leaves the sky for the Roots', s.scene === 'roots');
	await view.close();
	log();
}

// ───────────────────────────────────────────────────────────── guards ──

if (only.has('guards')) {
	log('WHEN THE SKY DOES NOT FLY, 1440x900');
	const view = await open('desk');
	await view.page.mouse.move(720, 450);
	const tryAll = async () => {
		const from = await view.state();
		await wheelFor(view, 400, 100);
		await view.page.keyboard.down('ArrowDown');
		await sleep(300);
		await view.page.keyboard.up('ArrowDown');
		await view.page.keyboard.press('PageDown');
		await sleep(300);
		const to = await view.state();
		return { moved: to.pos !== from.pos || to.vel !== 0, to };
	};
	await view.page.evaluate(() => window.__cellestial.claimFlow.openClaim());
	await view.page.waitForSelector(':modal');
	let r = await tryAll();
	check('a dialog is open (:modal): wheel and keys do nothing', !r.moved);
	await view.page.keyboard.press('Escape');
	await view.page.waitForFunction(() => !document.querySelector(':modal'));
	// A form field outside any dialog: there is none on the page, so one is made for the test.
	await view.page.evaluate(() => {
		const field = document.createElement('input');
		field.id = 'test-field';
		field.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:60';
		document.body.append(field);
		field.focus();
	});
	r = await tryAll();
	check('focus is in a form field: wheel and keys do nothing', !r.moved);
	await view.page.evaluate(() => document.getElementById('test-field').remove());
	// Focus on the menu button: the keys belong to the menu.
	await view.page.focus('#chrome button');
	const from = await view.state();
	await view.page.keyboard.press('ArrowDown');
	await sleep(300);
	check('focus is in the menu: the keys do nothing', (await view.state()).pos === from.pos);
	await view.page.evaluate(() => document.activeElement.blur());
	// And it does fly when none of that is so: the test itself is sound.
	await wheelFor(view, 400, 100);
	check('with none of those, the same wheel flies', (await view.state()).vel > 0.5);
	await view.rest();
	await view.page.evaluate(() => window.__cellestial.director.go('build'));
	await sleep(1500);
	const scene = (await view.state()).scene;
	const y0 = await view.page.evaluate(() => scrollY);
	r = await tryAll();
	const y1 = await view.page.evaluate(() => scrollY);
	check('the scene is the Roots: wheel and keys do not fly the sky', scene === 'roots' && !r.moved);
	check('they scroll the page instead', y1 > y0, `scrollY ${y0} to ${y1}`);
	await view.close();
	log();
}

// ────────────────────────────────────────────────────── reduced motion ──

if (only.has('still')) {
	log('REDUCED MOTION, 1440x900 and 390x844 ("/?rm=1")');
	for (const size of ['desk', 'phone']) {
		const view = await open(size, {
			query: '?rm=1&debug',
			init: () => {
				window.__raf = 0;
				const real = window.requestAnimationFrame.bind(window);
				window.requestAnimationFrame = (fn) => {
					window.__raf++;
					return real(fn);
				};
			},
		});
		await sleep(1500);
		const n0 = await view.page.evaluate(() => window.__raf);
		await sleep(3000);
		const n1 = await view.page.evaluate(() => window.__raf);
		check(`${size}: no animation frames at rest`, n1 === n0, `${n1 - n0} requestAnimationFrame calls in 3 s`);
		let s = await view.state();
		check(`${size}: the exit button is present, with no round flown`, s.exit && !s.round);
		if (size === 'desk') {
			await view.page.mouse.move(720, 450);
			await wheelFor(view, 400, 100);
			await view.page.keyboard.press('ArrowDown');
		}
		await sleep(300);
		s = await view.state();
		check(`${size}: no flight`, s.vel === 0 && Math.abs(s.coord) < 1e-9);
		const target = await view.page.evaluate(() => {
			const b = document.querySelector('#sky-ui .sky-star:not([hidden])');
			const c = window.__cellestial.sky.hooks.starCircle(b.dataset.slot);
			return { slot: b.dataset.slot, x: c.x, y: c.y };
		});
		if (size === 'desk') await view.page.mouse.click(target.x, target.y);
		else await view.page.touchscreen.tap(target.x, target.y);
		await sleep(200);
		const picked = await view.page.evaluate(() => window.__cellestial.claims.picked());
		check(`${size}: a star is still picked by a ${size === 'desk' ? 'click' : 'tap'}`, picked === target.slot, `${picked}`);
		await view.close();
	}
	log();
}

// ────────────────────────────────────────────────────────────── frames ──

/** Record every frame's duration while `drive` runs. */
async function recordFrames(view, drive) {
	await view.page.evaluate(() => {
		window.__frames = [];
		window.__levels = [];
		let last = 0;
		const { hooks } = window.__cellestial.sky;
		const tick = (now) => {
			if (window.__frames === null) return;
			if (last > 0) {
				window.__frames.push(now - last);
				window.__levels.push(hooks.quality().level);
			}
			last = now;
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	await drive();
	return view.page.evaluate(() => {
		const out = { frames: window.__frames, levels: window.__levels, quality: window.__cellestial.sky.hooks.quality() };
		window.__frames = null;
		return out;
	});
}

const stats = (frames) => {
	const sorted = [...frames].sort((a, b) => a - b);
	const sum = frames.reduce((a, b) => a + b, 0);
	return {
		n: frames.length,
		avg: sum / frames.length,
		p95: sorted[Math.floor(sorted.length * 0.95)],
		worst: sorted.at(-1),
		over33: frames.filter((f) => f > 33.4).length,
	};
};

if (only.has('frames')) {
	log('FRAME TIMES, real GPU: 4.6 layers forward, rest, 1.6 back, rest');
	for (const size of ['desk', 'phone']) {
		const view = await open(size);
		const rec = await recordFrames(view, async () => {
			await view.holdUntil('ArrowDown', 4.6);
			await view.rest();
			await view.holdUntil('ArrowUp', 3.4);
			await view.rest();
		});
		const s = stats(rec.frames);
		const end = await view.state();
		log(
			`  ${size === 'desk' ? '1440x900' : '390x844 '}  ${s.n} frames: average ${f2(s.avg)} ms, 95th percentile ${f2(s.p95)} ms, worst ${f2(s.worst)} ms, ${s.over33} frames over 33 ms; ended at layer ${f2(end.coord)}; governor at level ${rec.quality.level} of ${rec.quality.levels - 1}, pixel ratio ${rec.quality.dpr}`,
		);
		check(`${size}: smooth`, s.avg < 18 && s.p95 < 20, '');
		await view.close();
	}
	log();
}

if (only.has('throttle')) {
	log('THE GOVERNOR, 390x844, software rendering (SwiftShader), CPU slowed 4x');
	const view = await open('phone', { gpu: false });
	const cdp = await view.ctx.newCDPSession(view.page);
	const renderer = await view.page.evaluate(() => {
		const gl = document.createElement('canvas').getContext('webgl2');
		const info = gl?.getExtension('WEBGL_debug_renderer_info');
		return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
	});
	log(`  renderer: ${renderer}`);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
	const rec = await recordFrames(view, async () => {
		// Forward and back for 24 s, never resting for long.
		const t0 = Date.now();
		let key = 'ArrowDown';
		while (Date.now() - t0 < 24000) {
			await view.page.keyboard.down(key);
			await sleep(2800);
			await view.page.keyboard.up(key);
			await sleep(200);
			key = key === 'ArrowDown' ? 'ArrowUp' : 'ArrowDown';
		}
	});
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
	// Second by second.
	const rows = [];
	let t = 0;
	let bucket = [];
	let levels = [];
	for (const [i, ms] of rec.frames.entries()) {
		bucket.push(ms);
		levels.push(rec.levels[i]);
		t += ms;
		if (t >= 2000) {
			rows.push({ avg: bucket.reduce((a, b) => a + b, 0) / bucket.length, worst: Math.max(...bucket), level: Math.min(...levels) === Math.max(...levels) ? `${levels[0]}` : `${Math.min(...levels)} to ${Math.max(...levels)}` });
			t = 0;
			bucket = [];
			levels = [];
		}
	}
	for (const [i, row] of rows.entries()) {
		log(`  ${String(i * 2).padStart(2)}-${String(i * 2 + 2).padStart(2)} s  average ${f2(row.avg).padStart(6)} ms  worst ${f2(row.worst).padStart(7)} ms  governor level ${row.level}`);
	}
	const first = rows[0];
	const last = rows.slice(-3);
	const lastAvg = last.reduce((a, r) => a + r.avg, 0) / last.length;
	const top = Math.max(...rec.levels);
	log(`  pixel ratio at the end ${rec.quality.dpr} (it began at 2); level ${rec.quality.level} of ${rec.quality.levels - 1}`);
	check('the governor stepped down by itself', top >= 1, `to level ${top}`);
	check('and the frame time recovered', lastAvg < first.avg * 0.8 || lastAvg < 22, `${f2(first.avg)} ms in the first two seconds, ${f2(lastAvg)} ms over the last six`);
	await view.close();
	log();
}

// ─────────────────────────────────────────────────────────────── pick ──

/**
 * The stars of the figure in front against their buttons: once (`ms` 0), or
 * on every frame for `ms` milliseconds, keeping the worst of it.
 */
const BUTTONS = (ms) =>
	new Promise((done) => {
		const { hooks } = window.__cellestial.sky;
		const out = { stars: 0, onScreen: 0, covered: 0, worst: 0, smallest: Infinity, frames: 0, missing: 0, coord: 0 };
		const measure = () => {
			const figure = ((hooks.lattice.layer() % 12) + 12) % 12;
			const slots = hooks.layout().plans[figure].stars.filter((s) => s.slot).map((s) => s.slot);
			let onScreen = 0;
			let covered = 0;
			for (const slot of slots) {
				const c = hooks.starCircle(slot);
				if (!c) continue;
				onScreen++;
				const b = document.querySelector(`#sky-ui .sky-star[data-slot="${slot}"]:not([hidden])`);
				if (!b) continue;
				covered++;
				const r = b.getBoundingClientRect();
				out.worst = Math.max(out.worst, Math.hypot(r.left + r.width / 2 - c.x, r.top + r.height / 2 - c.y));
				out.smallest = Math.min(out.smallest, r.width, r.height);
			}
			out.stars = slots.length;
			out.onScreen = onScreen;
			out.covered = covered;
			out.frames++;
			out.coord = hooks.flight().coord;
			if (covered < onScreen) out.missing++;
		};
		const t0 = performance.now();
		const tick = () => {
			measure();
			if (performance.now() - t0 < ms) requestAnimationFrame(tick);
			else done(out);
		};
		if (ms > 0) requestAnimationFrame(tick);
		else tick();
	});

if (only.has('pick')) {
	for (const size of ['desk', 'phone']) {
		log(`PICKING, ${size === 'desk' ? '1440x900' : '390x844'}`);
		const view = await open(size);
		let v = view;
		const click = (x, y) => (size === 'desk' ? v.page.mouse.click(x, y) : v.page.touchscreen.tap(x, y));
		// At rest, at four stations.
		let worstRest = 0;
		let smallest = Infinity;
		let all = true;
		const counts = [];
		for (let k = 0; k < 4; k++) {
			const m = await view.page.evaluate(BUTTONS, 0);
			worstRest = Math.max(worstRest, m.worst);
			smallest = Math.min(smallest, m.smallest);
			all &&= m.covered === m.stars && m.onScreen === m.stars;
			counts.push(`${m.covered} of ${m.stars} (layer ${Math.round(m.coord)})`);
			if (k < 3) {
				await view.holdUntil('ArrowDown', m.coord + 0.6);
				await view.rest();
			}
		}
		check('at rest, every star of the figure in front has a button over it', all, `at four stations: ${counts.join(', ')}`);
		check('button centre on star centre, at rest', worstRest < 0.5, `largest offset ${worstRest.toFixed(3)} px`);
		check('no button smaller than 44 px', smallest >= 43.99, `smallest ${smallest} px`);
		const labels = await view.page.evaluate(() => [...new Set([...document.querySelectorAll('#sky-ui .sky-star:not([hidden])')].map((b) => b.getAttribute('aria-label')))]);
		check('each is a real <button> with a name', labels.length > 0 && labels.every((l) => /^(Empty|Claimed) star in \w+$/.test(l)), labels.join('; '));
		// In flight: sampled on every frame for three seconds.
		await view.page.keyboard.down('ArrowDown');
		const flying = await view.page.evaluate(BUTTONS, 3000);
		await view.page.keyboard.up('ArrowDown');
		check('button centre on star centre, in flight', flying.worst < 0.5, `largest offset ${flying.worst.toFixed(3)} px over ${flying.frames} frames`);
		log(`        (frames in which a star on screen had no button: ${flying.missing}; a button is withdrawn within 0.13 units of the lens)`);
		await view.rest();
		await view.close();

		// A click on an empty star.
		const events = () => {
			window.__events = [];
			const wait = setInterval(() => {
				const hooks = window.__cellestial?.sky?.hooks;
				if (!hooks) return;
				clearInterval(wait);
				for (const type of ['star-pick', 'open-empty', 'open-lit', 'ignite', 'focus', 'tap-empty', 'dismiss']) {
					hooks.on(type, (e) => window.__events.push({ type, ...e }));
				}
			}, 5);
		};
		const starAt = (v, slot) => v.page.evaluate((s) => window.__cellestial.sky.hooks.starCircle(s), slot);
		v = await open(size, { init: events });
		let c = await starAt(v, 'slot-34');
		await click(c.x, c.y);
		await sleep(300);
		let got = await v.page.evaluate(() => ({ picked: window.__cellestial.claims.picked(), lit: window.__cellestial.claims.isLit('slot-34'), events: window.__events }));
		const open1 = got.events.find((e) => e.type === 'open-empty');
		check('an empty star: claims.pick(slot), and nothing is claimed', got.picked === 'slot-34' && !got.lit);
		check("the hook for part B fires: 'open-empty' with the slot and the star's circle", open1?.slot === 'slot-34' && Math.abs(open1.circle.x - c.x) < 0.5 && Math.abs(open1.circle.y - c.y) < 0.5, JSON.stringify(open1));
		check('a click on a star is not a tap on empty sky', !got.events.some((e) => e.type === 'tap-empty'));
		const p = await emptyPoint(v);
		await click(p.x, p.y);
		await sleep(200);
		got = await v.page.evaluate(() => window.__events);
		check("a click on empty sky is: 'tap-empty' with the point", got.some((e) => e.type === 'tap-empty' && Math.abs(e.x - p.x) < 1.5 && Math.abs(e.y - p.y) < 1.5));
		await v.close();

		// An ask is waiting for a star.
		v = await open(size, {
			init: () => localStorage.setItem('cellestial:unplaced', 'A site for my bakery.'),
		});
		await v.page.evaluate(events);
		await sleep(100);
		check('an ask is waiting', (await v.page.evaluate(() => window.__cellestial.claims.unplaced())) === 'A site for my bakery.');
		c = await starAt(v, 'slot-34');
		await click(c.x, c.y);
		await sleep(300);
		got = await v.page.evaluate(() => ({
			lit: window.__cellestial.claims.isLit('slot-34'),
			ask: window.__cellestial.claims.all().get('slot-34')?.ask,
			unplaced: window.__cellestial.claims.unplaced(),
			shown: window.__cellestial.sky.hooks.isLit('slot-34'),
			events: window.__events,
		}));
		check('then an empty star: claims.place(slot), and the star ignites', got.lit && got.ask === 'A site for my bakery.' && got.unplaced === null && got.shown && got.events.some((e) => e.type === 'ignite' && e.slot === 'slot-34'));
		await sleep(2600);
		// Now it is lit: a click flies in on it.
		c = await starAt(v, 'slot-34');
		await v.page.evaluate(() => window.__events.splice(0));
		await click(c.x, c.y);
		await sleep(2400);
		got = await v.page.evaluate(() => ({ focused: window.__cellestial.sky.hooks.focused(), events: window.__events, circle: window.__cellestial.sky.hooks.starCircle('slot-34'), layout: (({ safeX, safeY }) => ({ safeX, safeY }))(window.__cellestial.sky.hooks.layout()) }));
		const lit1 = got.events.find((e) => e.type === 'open-lit');
		check('a lit star: focusStar(slot) flies in on it', got.focused === 'slot-34' && got.circle.r > 2.5 * c.r, `radius ${f2(c.r)} px to ${f2(got.circle.r)} px, ${f2(Math.hypot(got.circle.x - got.layout.safeX, got.circle.y - got.layout.safeY))} px from the middle of the safe area`);
		check("the hook for part B fires: 'open-lit' with the slot and the star's circle", lit1?.slot === 'slot-34' && Math.abs(lit1.circle.r - got.circle.r) < 1, JSON.stringify(lit1));
		await v.page.keyboard.press('Escape');
		await sleep(1200);
		got = await v.page.evaluate(() => ({ focused: window.__cellestial.sky.hooks.focused(), events: window.__events }));
		check("Escape lets it go: 'focus' with slot null", got.focused === null && got.events.some((e) => e.type === 'focus' && e.slot === null));
		await v.close();
		log();
	}
}

// ─────────────────────────────────────────────────────────────── fall ──

if (only.has('fall')) {
	log('THE FALL (the contract only; the transition belongs to the Roots), 1440x900');
	const view = await open('desk', {
		init: () =>
			localStorage.setItem('cellestial:claims', JSON.stringify([{ slot: 'slot-3', ask: 'A site.' }])),
	});
	const before = await view.page.evaluate(() => window.__cellestial.sky.hooks.starCircle('slot-34'));
	const result = await view.page.evaluate(
		() =>
			new Promise((done) => {
				const { sky } = window.__cellestial;
				const t0 = performance.now();
				const impacts = [];
				const samples = [];
				// The ground rises from the bottom edge to 60% of the height over 1.2 s.
				const groundY = () => innerHeight - 0.4 * innerHeight * Math.min(1, (performance.now() - t0) / 1200);
				const watch = () => {
					const a = sky.hooks.starCircle('slot-34');
					const b = sky.hooks.starCircle('slot-3');
					samples.push([Math.round(performance.now() - t0), a ? a.y : null, b ? b.y : null]);
					if (samples.length < 400) requestAnimationFrame(watch);
				};
				requestAnimationFrame(watch);
				sky.fall({ groundY, onImpact: (x) => impacts.push({ x, at: Math.round(performance.now() - t0), ground: Math.round(groundY()) }) }).then(() => {
					const took = Math.round(performance.now() - t0);
					samples.length = Math.min(samples.length, 400);
					requestAnimationFrame(() => done({ impacts, took, samples, after: sky.hooks.starCircle('slot-34') }));
				});
			}),
	);
	const fell = result.samples.filter((s) => s[1] !== null);
	const drops = fell.filter((_, i) => i % 8 === 0).slice(0, 7).map((s) => `${s[0]} ms ${Math.round(s[1])}`);
	log(`  an empty star's y on screen: ${drops.join(', ')}`);
	check('onImpact fires once', result.impacts.length === 1, JSON.stringify(result.impacts));
	check('fall() resolves', result.took > 0, `after ${result.took} ms`);
	check('the stars are gone', result.after === null);
	// Empty and lit fall alike: the same drop at the same moment, each from its own release.
	const pair = result.samples.filter((s) => s[1] !== null && s[2] !== null);
	const accel = (k) => {
		// Second difference of y over time: the acceleration, px/s².
		const a = pair[10];
		const b = pair[20];
		const c = pair[30];
		if (!a || !b || !c) return Number.NaN;
		const v1 = (b[k] - a[k]) / ((b[0] - a[0]) / 1000);
		const v2 = (c[k] - b[k]) / ((c[0] - b[0]) / 1000);
		return (v2 - v1) / ((c[0] - a[0]) / 2000);
	};
	const g1 = accel(1);
	const g2 = accel(2);
	check('an empty and a lit star fall alike', Math.abs(g1 - g2) / g1 < 0.03, `${Math.round(g1)} and ${Math.round(g2)} px/s² on screen`);
	await view.page.evaluate(() => window.__cellestial.sky.restore());
	await sleep(200);
	const back = await view.page.evaluate(() => window.__cellestial.sky.hooks.starCircle('slot-34'));
	check('restore() puts every star back', back && Math.abs(back.x - before.x) < 0.01 && Math.abs(back.y - before.y) < 0.01);
	await view.close();
	log();
}

for (const b of Object.values(browsers)) await b.close();
if (values.only === ALL) {
	mkdirSync(join(ROOT, 'refs/sky'), { recursive: true });
	writeFileSync(join(ROOT, 'refs/sky/measure.txt'), `${lines.join('\n')}\n`);
	console.log(`written to ${join(ROOT, 'refs/sky/measure.txt')}`);
}
if (failed > 0) {
	console.error(`${failed} check(s) failed`);
	process.exit(1);
}
