#!/usr/bin/env node
// The transitions between scenes, in numbers: the fall and the crash (D1, D2),
// the warp back (G2) and the menu teleports (C4), on the real page with real
// clicks, in real time.
//
//   node tools/transitions/measure.mjs [--url http://localhost:4500] [--only fall,warp,teleport]
//
// Needs the dev server running (see PROGRESS.md). Prints one line per check,
// "ok" or "FAIL", writes them all to refs/transitions/measure.txt and exits
// non-zero if one failed or the page logged an error. Everything runs at
// 1440x900 and 390x844 (scale 2, touch); the sky is drawn on the real GPU,
// and the frame times are taken a second time in software with the CPU
// slowed 4x.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../src/content/constellations.ts';
import { launch, openPage, ROOT } from '../roots/lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'fall,warp,teleport' },
	},
});
const only = new Set(values.only.split(','));
const NOISE = /sandboxed and the 'allow-scripts'|turnstile|challenges\.cloudflare|Failed to load resource/i;
const SIZES = ['desk', 'phone'];
/** Virgo's stars: the figure of the opening pose. */
const VIRGO = CONSTELLATIONS[0].stars.map((star) => star.slot).filter(Boolean);
const MENU = { sky: 'The Sky', build: 'What we build', claim: 'Claim your star', contact: 'Contact me' };

const lines = [];
let failed = 0;
let bad = 0;
const say = (s) => {
	console.log(s);
	lines.push(s);
};
const check = (ok, what) => {
	if (!ok) failed++;
	say(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

/** Runs in the page before its scripts: a record of what the page did. */
function probe() {
	sessionStorage.setItem('cellestial:round', '1');
	const rec = { scenes: [], frames: [], tops: [], impacts: 0, hits: [], grows: 0, coverAtSky: null, on: false };
	window.__rec = rec;
	document.addEventListener('cellestial:scene', (e) => {
		rec.scenes.push({ to: e.detail.to, at: performance.now() });
		if (e.detail.to === 'sky' && e.detail.from === 'warp') {
			// What is on the effects canvas once this frame's drawing is done: a task
			// posted now runs after every animation-frame callback of this frame.
			const ch = new MessageChannel();
			ch.port1.onmessage = () => {
				const c = document.getElementById('fx-canvas');
				const g = c.getContext('2d');
				let min = 255;
				if (c.width && getComputedStyle(c).display !== 'none') {
					const d = g.getImageData(0, 0, c.width, c.height).data;
					for (let k = 3; k < d.length; k += 16) if (d[k] < min) min = d[k];
				} else min = 0;
				rec.coverAtSky = min;
			};
			ch.port2.postMessage(0);
		}
	});
	let last = 0;
	const tick = (now) => {
		if (rec.on) {
			if (last) rec.frames.push(now - last);
			if (last && now - last > (rec.worst?.dt ?? 0)) rec.worst = { dt: now - last, at: now };
			const ground = document.getElementById('roots');
			rec.tops.push({
				scene: document.documentElement.dataset.scene,
				top: ground.getBoundingClientRect().top,
			});
		}
		last = now;
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
}

async function open(browser, size, scene, opts = {}) {
	const o = await openPage(browser, size, null, opts.context);
	await o.page.addInitScript(probe);
	await o.page.goto(`${values.url}/?scene=${scene}&debug${opts.query ?? ''}`, { waitUntil: 'load' });
	await o.page.waitForFunction(
		() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.fx,
	);
	await o.page.evaluate(async () => {
		await window.__cellestial.sky.ready;
		await document.fonts.ready;
		// Count what the director asks of the other parts.
		const { fx, roots } = window.__cellestial;
		const impact = fx.impact.bind(fx);
		fx.impact = (x, y, size) => {
			window.__rec.impacts++;
			// Where the burst is on the screen: the effects canvas is carried with the ground.
			const carried = Number(/translateY\((-?[\d.]+)px\)/.exec(document.getElementById('fx-canvas').style.transform)?.[1] ?? 0);
			const hit = { x, y: y + carried, size: size ?? 1, at: performance.now(), h: innerHeight, w: innerWidth, ground: roots.surfaceY() };
			window.__rec.hits.push(hit);
			if (!window.__rec.impactAt) window.__rec.impactAt = hit;
			impact(x, y, size);
		};
		const grow = roots.growFrom.bind(roots);
		roots.growFrom = (x) => {
			window.__rec.grows++;
			return grow(x);
		};
	});
	await o.page.waitForTimeout(1200);
	return o;
}
const close = async (o) => {
	bad += o.errors.filter((e) => !NOISE.test(e)).length;
	await o.context.close();
};
const state = (page) =>
	page.evaluate((virgo) => {
		const c = window.__cellestial;
		const exit = document.querySelector('[data-descend]');
		return {
			scene: document.documentElement.dataset.scene,
			directorScene: c.director.scene,
			y: Math.round(window.scrollY),
			focus: document.activeElement?.id || document.activeElement?.textContent?.trim().slice(0, 30),
			grown: c.roots.debug.state().grown,
			rootsActive: c.roots.debug.state().active,
			star: virgo.filter((slot) => c.sky.hooks?.starCircle(slot)).length,
			exit: !!exit && !exit.hidden && getComputedStyle(exit).visibility === 'visible',
			spacer: document.getElementById('sky-window').offsetHeight,
			fx: getComputedStyle(document.getElementById('fx-canvas')).display,
			fxTransform: document.getElementById('fx-canvas').style.transform,
		};
	}, VIRGO);
const stats = (ft) => {
	const a = [...ft].sort((x, y) => x - y);
	if (!a.length) return 'no frames';
	const avg = a.reduce((s, v) => s + v, 0) / a.length;
	return `avg ${avg.toFixed(1)} ms, p95 ${a[Math.floor(a.length * 0.95)].toFixed(1)} ms, worst ${a.at(-1).toFixed(1)} ms (${a.length} frames)`;
};
/** Start recording, do `act` in the page, wait until the director is done, stop. */
async function timed(page, act) {
	return page.evaluate(async (code) => {
		const rec = window.__rec;
		rec.scenes.length = 0;
		rec.frames.length = 0;
		rec.tops.length = 0;
		rec.worst = null;
		rec.on = true;
		const t0 = performance.now();
		const done = new Function(`return (${code})()`)();
		await done;
		const ms = performance.now() - t0;
		rec.on = false;
		return {
			ms,
			scenes: rec.scenes.map((s) => `${s.to} at ${Math.round(s.at - t0)}`),
			frames: [...rec.frames],
			worstAt: rec.worst ? Math.round(rec.worst.at - t0) : null,
			tops: [...rec.tops],
			impactAt: rec.impactAt ? { ...rec.impactAt, at: rec.impactAt.at - t0 } : null,
		};
	}, act);
}

// ───────────────────────────────────────────────────────────── the fall ──
if (only.has('fall')) {
	for (const gpu of [true, false]) {
		const browser = await launch({ gpu });
		for (const size of SIZES) {
			const tag = `fall, ${size}, ${gpu ? 'real GPU' : 'software, CPU slowed 4x'}:`;
			const o = await open(browser, size, 'sky');
			if (!gpu) {
				const cdp = await o.context.newCDPSession(o.page);
				await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
			}
			const before = await state(o.page);
			const r = await timed(o.page, `() => {
				const d = window.__cellestial.director;
				document.querySelector('[data-descend]').click();
				// A second press, and the menu, while it plays: both must be ignored.
				setTimeout(() => document.querySelector('[data-descend]').click(), 300);
				setTimeout(() => d.go('sky'), 500);
				setTimeout(() => d.ascend(), 700);
				return new Promise((resolve) => {
					const poll = () => (d.scene === 'roots' && document.activeElement?.id === 'roots' ? resolve() : setTimeout(poll, 16));
					setTimeout(poll, 100);
				});
			}`);
			await o.page.waitForTimeout(600);
			const after = await state(o.page);
			say(`${tag} scenes ${r.scenes.join(', ')}; over (focus on the ground) at ${Math.round(r.ms)} ms; frames ${stats(r.frames)}, the worst one ending ${r.worstAt} ms in`);
			if (gpu) {
				check(before.exit, `${tag} B11 was on screen before`);
				check(r.scenes.length === 2 && r.scenes[0].startsWith('fall') && r.scenes[1].startsWith('roots'), `${tag} the scene went fall, then roots, and nothing else (a second press, the menu and E6 pressed meanwhile did nothing)`);
				const roots = Number(r.scenes[1]?.split(' at ')[1]);
				check(roots >= 2000 && roots <= 3000, `${tag} the ground reached the top of the screen ${roots} ms after the press (2000 to 3000)`);
				const rec = await o.page.evaluate(() => ({ impacts: window.__rec.impacts, grows: window.__rec.grows, hits: window.__rec.hits }));
				// Every star strikes the ground: the twelve of Virgo, the figure in front, at full
				// size, each at its own place, and the figures behind it smaller; one growth.
				const front = rec.hits.filter((h) => h.size === 1);
				const places = new Set(front.map((h) => Math.round(h.x)));
				check(front.length === VIRGO.length && places.size === VIRGO.length && rec.grows === 1, `${tag} every star of the figure in front struck the ground, each where it landed: ${front.length} bursts of ${VIRGO.length} at ${places.size} places (and ${rec.impacts - front.length} smaller ones for the figures behind); one growth (${rec.grows})`);
				const offLine = Math.max(...rec.hits.map((h) => Math.abs(h.y - h.ground)));
				const offScreen = rec.hits.filter((h) => h.x < 0 || h.x > h.w || h.y < 0 || h.y > h.h).length;
				check(rec.hits.length > 0 && offLine <= 1 && offScreen === 0, `${tag} every burst was on the ground line (${offLine.toFixed(2)} px off at most) and on the screen (${offScreen} off it)`);
				const t0 = rec.hits[0]?.at ?? 0;
				const span = Math.max(...front.map((h) => h.at)) - t0;
				check(span > 150 && span < 1200, `${tag} the figure in front landed over ${Math.round(span)} ms, not all at once`);
				const ia = r.impactAt;
				check(ia && ia.y > ia.h * 0.5 && ia.y <= ia.h, `${tag} the first star struck on screen, at x ${Math.round(ia?.x)}, y ${Math.round(ia?.y)} of ${ia?.h}, ${Math.round(ia?.at)} ms after the press`);
				// The ground only ever rises, and stays put when the spacer goes.
				let back = 0;
				let jumpAtSwap = 0;
				for (let i = 1; i < r.tops.length; i++) {
					const d = r.tops[i].top - r.tops[i - 1].top;
					if (d > 0.5) back = Math.max(back, d);
					if (r.tops[i].scene === 'roots' && r.tops[i - 1].scene === 'fall') jumpAtSwap = Math.abs(d);
				}
				const biggest = Math.max(...r.tops.slice(1).map((t, i) => Math.abs(t.top - r.tops[i].top)));
				check(back === 0, `${tag} the ground never moved back down (${back.toFixed(1)} px)`);
				check(jumpAtSwap <= 1, `${tag} the ground moved ${jumpAtSwap.toFixed(2)} px in the frame the spacer collapsed (the biggest step in any frame was ${biggest.toFixed(0)} px)`);
				check(after.scene === 'roots' && after.directorScene === 'roots' && after.y === 0 && after.spacer === 0, `${tag} ends on the Roots at the top (scene ${after.scene}, scrollY ${after.y}, spacer ${after.spacer})`);
				check(after.focus === 'roots', `${tag} focus is on the ground ("${after.focus}")`);
				check(after.grown && after.rootsActive, `${tag} the Roots are active and growing`);
				check(after.star > 0, `${tag} the sky's stars are back, unseen (${after.star} of Virgo's have a place on screen again)`);
				check(after.fxTransform === '', `${tag} the effects canvas is where it belongs`);
			}
			await close(o);
		}
		if (gpu) {
			for (const size of SIZES) {
				const tag = `fall, ${size}:`;
				// A reload in the middle.
				let o = await open(browser, size, 'sky');
				await o.page.evaluate(() => document.querySelector('[data-descend]').click());
				await o.page.waitForTimeout(700);
				await o.page.reload({ waitUntil: 'load' });
				await o.page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots);
				await o.page.waitForTimeout(2500);
				let s = await state(o.page);
				check(s.scene === 'sky' && s.y === 0 && s.star, `${tag} reloaded 700 ms in: the page opens on the sky again (scene ${s.scene}, scrollY ${s.y})`);
				await close(o);
				// Back and forward in the middle.
				// /contact loads Cloudflare's Turnstile script, which can stall for half a
				// minute: nothing here waits for it (this run once died waiting for "load").
				o = await openPage(browser, size, null);
				await o.page.goto(`${values.url}/contact`, { waitUntil: 'domcontentloaded' });
				await o.page.waitForTimeout(400);
				await o.page.addInitScript(probe);
				await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
				await o.page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.fx);
				await o.page.evaluate(() => window.__cellestial.sky.ready);
				await o.page.waitForTimeout(1200);
				await o.page.evaluate(() => document.querySelector('[data-descend]').click());
				await o.page.waitForTimeout(700);
				await o.page.goBack({ waitUntil: 'domcontentloaded' });
				const away = o.page.url();
				await o.page.goForward({ waitUntil: 'load' });
				await o.page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots);
				await o.page.waitForTimeout(3500);
				s = await state(o.page);
				const sound = (s.scene === 'sky' && s.y === 0 && s.star) || (s.scene === 'roots' && s.spacer === 0 && s.grown);
				check(away.endsWith('/contact') && sound, `${tag} back 700 ms in (to ${new URL(away).pathname}) and forward again: the page is whole (scene ${s.scene}, scrollY ${s.y})`);
				await close(o);
				// Reduced motion keeps the plain fade.
				o = await open(browser, size, 'sky', { query: '&rm=1' });
				const r = await timed(o.page, `() => window.__cellestial.director.descend()`);
				s = await state(o.page);
				const rec = await o.page.evaluate(() => window.__rec.impacts);
				check(r.scenes.length === 1 && r.scenes[0].startsWith('roots') && rec === 0 && s.grown && s.y === 0 && s.focus === 'roots', `${tag} reduced motion: a fade straight to the Roots in ${Math.round(r.ms)} ms (scenes ${r.scenes.join(', ')}; no impact; the network whole)`);
				await close(o);
			}
		}
		await browser.close();
	}
}

// ───────────────────────────────────────────────────────────── the warp ──
if (only.has('warp')) {
	for (const gpu of [true, false]) {
		const browser = await launch({ gpu });
		for (const size of SIZES) {
			for (const from of [0, 1800]) {
				const tag = `warp, ${size}, from scrollY ${from}, ${gpu ? 'real GPU' : 'software, CPU slowed 4x'}:`;
				const o = await open(browser, size, 'roots');
				if (!gpu) {
					const cdp = await o.context.newCDPSession(o.page);
					await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
				}
				await o.page.evaluate((y) => window.scrollTo(0, y), from);
				await o.page.waitForTimeout(200);
				const r = await timed(o.page, `() => {
					const d = window.__cellestial.director;
					const press = () => document.querySelector('[data-ascend]').click();
					press();
					setTimeout(press, 300);
					setTimeout(() => d.go('build'), 500);
					setTimeout(() => d.descend(), 1200);
					return new Promise((resolve) => {
						const poll = () => (d.scene === 'sky' && document.activeElement?.id === 'sky-ui' ? resolve() : setTimeout(poll, 16));
						setTimeout(poll, 100);
					});
				}`);
				await o.page.waitForTimeout(700);
				const s = await state(o.page);
				say(`${tag} scenes ${r.scenes.join(', ')}; over (focus on the sky) at ${Math.round(r.ms)} ms; frames ${stats(r.frames)}, the worst one ending ${r.worstAt} ms in`);
				const cover = await o.page.evaluate(() => window.__rec.coverAtSky);
				check(cover === 255, `${tag} when the page became the sky the warp covered every pixel (lowest alpha ${cover})`);
				if (gpu) {
					check(r.scenes.length === 2 && r.scenes[0].startsWith('warp') && r.scenes[1].startsWith('sky'), `${tag} the scene went warp, then sky, and nothing else (a second press, the menu and B11 pressed meanwhile did nothing)`);
					check(r.ms >= 1400 && r.ms <= 1700, `${tag} it took ${Math.round(r.ms)} ms`);
					check(s.scene === 'sky' && s.y === 0 && s.star, `${tag} ends on the sky with its stars back (scene ${s.scene}, scrollY ${s.y})`);
					check(s.exit, `${tag} B11 is still there`);
					check(s.focus === 'sky-ui', `${tag} focus is on the sky ("${s.focus}")`);
					check(s.fx === 'none' && !s.rootsActive, `${tag} the effects canvas is put away and the Roots are at rest`);
				}
				await close(o);
			}
			if (gpu) {
				const tag = `warp, ${size}:`;
				const o = await open(browser, size, 'roots', { query: '&rm=1' });
				const r = await timed(o.page, `() => window.__cellestial.director.ascend()`);
				const s = await state(o.page);
				check(r.scenes.length === 1 && r.scenes[0].startsWith('sky') && s.scene === 'sky' && s.exit && s.focus === 'sky-ui', `${tag} reduced motion: a fade straight to the still sky in ${Math.round(r.ms)} ms, B11 there`);
				await close(o);
			}
		}
		await browser.close();
	}
}

// ───────────────────────────────────────────────────────── the teleport ──
if (only.has('teleport')) {
	const browser = await launch({ gpu: true });
	for (const size of SIZES) {
		for (const from of ['sky', 'roots']) {
			for (const [dest, words] of Object.entries(MENU)) {
				const tag = `teleport, ${size}, ${from} → "${words}":`;
				const o = await open(browser, size, from);
				if (from === 'roots') await o.page.evaluate(() => window.scrollTo(0, 1500));
				await o.page.click('#chrome button[popovertarget]');
				await o.page.waitForTimeout(300);
				const item = o.page.locator(`#chrome [data-dest="${dest}"]`);
				const text = (await item.textContent()).trim();
				// Which way the flash is asked to go.
				await o.page.evaluate(() => {
					const fx = window.__cellestial.fx;
					const flash = fx.teleportFlash.bind(fx);
					fx.teleportFlash = (swap, dir) => {
						window.__rec.dir = dir;
						const t0 = performance.now();
						return flash(swap, dir).then(() => {
							window.__rec.flashMs = performance.now() - t0;
						});
					};
				});
				await item.click();
				await o.page.waitForTimeout(1300);
				const s = await o.page.evaluate((virgo) => {
					const box = (el) => {
						if (!el) return null;
						const r = el.getBoundingClientRect();
						return r.top >= 0 && r.bottom <= innerHeight && r.width > 0;
					};
					const ground = document.getElementById('roots');
					return {
						scene: document.documentElement.dataset.scene,
						y: Math.round(window.scrollY),
						groundTop: Math.round(ground.getBoundingClientRect().top),
						focus: document.activeElement?.id || document.activeElement?.textContent?.trim().slice(0, 30),
						f1: box(document.querySelector('#roots [data-open-claim]')),
						f2: box(document.querySelector('#roots [data-open-contact]')),
						dialog: document.querySelector('dialog[open]')?.id ?? null,
						dir: window.__rec.dir,
						flashMs: Math.round(window.__rec.flashMs ?? -1),
						star: virgo.filter((slot) => window.__cellestial.sky.hooks?.starCircle(slot)).length > 0,
						menuOpen: !!document.querySelector('#chrome [popover]:popover-open'),
					};
				}, VIRGO);
				const where =
					dest === 'sky'
						? s.scene === 'sky' && s.y === 0 && s.star && s.focus === 'sky-ui'
						: dest === 'build'
							? s.scene === 'roots' && s.y === 0 && s.groundTop === 0 && s.focus === 'roots'
							: dest === 'claim'
								? s.scene === 'roots' && s.f1 && s.f2 && s.focus === 'Claim your star' && s.dialog === null
								: s.scene === 'roots' && s.f1 && s.f2 && s.dialog !== null;
				const wantDir = dest === 'sky' ? (from === 'sky' ? 'none' : 'up') : from === 'sky' ? 'down' : dest === 'build' ? 'up' : 'down';
				check(text === words, `${tag} the item reads "${text}"`);
				check(where, `${tag} landed: scene ${s.scene}, scrollY ${s.y}, focus "${s.focus}"${s.dialog ? `, ${s.dialog} open` : ''}${dest === 'claim' || dest === 'contact' ? `, F1 on screen ${s.f1}, F2 on screen ${s.f2}` : ''}`);
				check(s.dir === wantDir, `${tag} the flash went "${s.dir}" (wanted "${wantDir}")`);
				// 300 to 500 ms is the flash alone; the frame in which the new section is laid out and
				// drawn (the whole network, on arriving in the Roots) is held at the peak on top of that.
				check(s.flashMs >= 300 && s.flashMs <= 700, `${tag} the flash took ${s.flashMs} ms with the swap in it`);
				check(!s.menuOpen, `${tag} the menu closed`);
				await close(o);
			}
		}
	}
	await browser.close();
}

mkdirSync(join(ROOT, 'refs/transitions'), { recursive: true });
const file = join(ROOT, 'refs/transitions/measure.txt');
let old = '';
try {
	const { readFileSync } = await import('node:fs');
	old = readFileSync(file, 'utf8');
} catch {}
// A run of one part replaces that part's lines and keeps the others.
const part = (l) => l.replace(/^(ok {2}|FAIL) /, '').split(/[, ]/)[0];
const mine = new Set(lines.map(part));
const kept = old.split('\n').filter((l) => l && !mine.has(part(l)));
writeFileSync(file, `${[...kept, ...lines].join('\n')}\n`);
console.log(`${lines.filter((l) => /^(ok|FAIL)/.test(l)).length} checks, ${failed} failed, ${bad} page error(s)`);
if (failed || bad) process.exit(1);
