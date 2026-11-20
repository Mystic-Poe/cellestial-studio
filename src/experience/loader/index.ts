// The loading scene (A1 → A5): the mount.
//
// What is drawn is painter.ts; when it is drawn is timeline.ts; where,
// layout.ts. This file is the rest: the canvas, the clock, the skip, the
// choice of the full or the short version, the freeze for screenshots, and
// the hand-off to the sky.
//
// The run, in order:
//   intro     second 0 to `script.end`: A1 to A4 (painter.intro)
//   hold      the finished wordmark, its node breathing, while the sky is
//             not ready; at most HOLD_MAX seconds
//   hand-off  A5, HANDOFF seconds (painter.handoff drives the sky)
//   fade      only if there is no sky to hand over to: the overlay fades
//   done      the overlay is off the page, everything is let go of
//
// Whatever happens (a picture that will not load, an exception in a frame, a
// sky that never comes) the run ends and `done` resolves. The loader may
// never trap the visitor.
//
// Debug: `opts.freezeAt` and `seek(t)` freeze the timeline at second `t` and
// draw that exact frame. Past the end of the script, `t` runs on into A5:
// `script.end + 0.5` is half a second into the hand-off.

import { ASSETS } from '../assets.ts';
import type { LoaderScene, MountLoader, SkyScene } from '../contracts.ts';
import { WORDMARK_MATTE } from './geometry.ts';
import { layoutFor } from './layout.ts';
import { createPainter, type Images, type Painter } from './painter.ts';
import { FADE_OUT, FULL, HANDOFF, HOLD_MAX, type Script, SETTLE, SHORT } from './timeline.ts';

/** Set once a run has finished or been skipped: the next visit this session is the short one. */
const SEEN_KEY = 'cellestial:loader';
/** The clock never jumps further than this in one frame, so a stall is not a skip. */
const STEP_MAX = 0.05;
/** The server-rendered C has been on screen already: at most this much of the script is credited. */
const POSTER_CREDIT = 0.25;
/** The pictures are given this long, in seconds on screen, before the loader lets go. */
const PICTURES_MAX = 8;
/** Canvas pixels per CSS pixel: at most 2, coarser if the device cannot keep up. */
const DPR_STEPS = [2, 1.5, 1];
/** Over this many milliseconds a frame, averaged over the first second, the canvas gets coarser. */
const SLOW_FRAME = 22;
/** Keys that are not a wish to skip: moving focus, and modifiers pressed alone. */
const QUIET_KEYS = new Set([
	'Tab',
	'Shift',
	'Control',
	'Alt',
	'AltGraph',
	'Meta',
	'OS',
	'CapsLock',
	'NumLock',
	'ScrollLock',
	'Fn',
	'FnLock',
	'Hyper',
	'Super',
	'Symbol',
	'SymbolLock',
	'Dead',
	'Unidentified',
]);

function seenBefore(): boolean {
	try {
		return sessionStorage.getItem(SEEN_KEY) !== null;
	} catch {
		return false; // storage is blocked: every visit plays the full version
	}
}

function remember(): void {
	try {
		sessionStorage.setItem(SEEN_KEY, '1');
	} catch {
		// blocked: nothing to remember
	}
}

function load(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => {
			// Decoded before its first draw, so no frame waits on it.
			img.decode().then(
				() => resolve(img),
				() => resolve(img),
			);
		};
		img.onerror = () => reject(new Error(`loader: ${url} did not load`));
		img.src = url;
	});
}

type Phase = 'loading' | 'intro' | 'handoff' | 'fade' | 'done';

export const mount: MountLoader = (ctx, opts) => {
	let finish = () => {};
	const done = new Promise<void>((resolve) => {
		finish = resolve;
	});
	const idle: LoaderScene = { done, skip() {}, seek() {} };

	const overlay = document.getElementById('loader');
	const canvas = overlay?.querySelector('canvas') ?? null;
	if (!overlay || !canvas) {
		finish();
		return idle;
	}
	// The script is alive: the stylesheet's own way out (Loader.astro) stands down.
	overlay.classList.add('is-live');
	if (ctx.reducedMotion) {
		overlay.style.display = 'none';
		finish();
		return idle;
	}

	const mode = opts?.mode ?? (seenBefore() ? 'short' : 'full');
	const script: Script = mode === 'short' ? SHORT : FULL;
	overlay.dataset.mode = script.mode;

	let phase: Phase = 'loading';
	const is = (which: Phase) => phase === which;
	let painter: Painter | null = null;
	/** The second of the script on screen. Past `script.end` the wordmark is finished and waiting. */
	let t = 0;
	/** Seconds into A5, or into the fade. */
	let u = 0;
	/** Seconds this page has been on screen since the mount (the clock, clamped like the rest). */
	let shown = 0;
	/** Debug: the second the timeline is frozen at. */
	let frozen: number | null =
		opts?.freezeAt !== undefined && Number.isFinite(opts.freezeAt)
			? Math.max(0, opts.freezeAt)
			: null;

	let sky: SkyScene | null = null;
	let skyLost = false;
	let primed = false;

	let skipped = false;
	/** The frame a skip left, and how long ago: it dissolves into the finished wordmark. */
	let settleFrom: HTMLCanvasElement | null = null;
	let settle = 0;

	let raf = 0;
	let last = 0;
	let dprStep = 0;
	let slowFrames = 0;
	let slowTotal = 0;
	let measured = false;

	const dpr = () => Math.min(window.devicePixelRatio || 1, DPR_STEPS[dprStep]);

	// ───────────────────────────────────────────────────── drawing ──

	function fit(): void {
		if (!painter) return;
		const w = overlay?.clientWidth || window.innerWidth;
		const h = overlay?.clientHeight || window.innerHeight;
		painter.resize(layoutFor(script, w, h, dpr()));
	}

	function backdrop(black: number): void {
		if (!overlay) return;
		overlay.style.backgroundColor = black >= 1 ? '' : `rgb(0 0 0 / ${Math.max(0, black)})`;
	}

	/** Tell the sky where the little star is, once, the moment A5 begins. */
	function prime(to: SkyScene): void {
		if (primed || !painter || !overlay) return;
		primed = true;
		const star = painter.star();
		const box = overlay.getBoundingClientRect();
		// The sky's core sits inside the brass star: a little under half its tip radius.
		to.introPrime({ x: box.left + star.x, y: box.top + star.y, r: star.r * 0.45 });
	}

	function draw(): void {
		if (!painter || !overlay) return;
		if (frozen !== null) {
			// A frozen frame is the frame the run would show at that second.
			if (frozen > script.end && sky) {
				prime(sky);
				backdrop(painter.handoff(Math.min(HANDOFF, frozen - script.end), sky));
			} else {
				painter.intro(Math.min(frozen, script.end));
				backdrop(1);
			}
		} else if (is('handoff') && sky) {
			backdrop(painter.handoff(u, sky));
		} else {
			painter.intro(t);
			if (settleFrom) painter.dissolve(settleFrom, settle / SETTLE);
			if (is('fade')) overlay.style.opacity = String(Math.max(0, 1 - u / FADE_OUT));
		}
		overlay.classList.add('is-drawn');
	}

	// ─────────────────────────────────────────────────────── the sky ──

	ctx
		.when('sky')
		.then((found) =>
			found.ready.then(() => {
				sky = found;
				if (frozen !== null && !is('done')) draw();
			}),
		)
		.catch(() => {
			skyLost = true;
		});

	// ─────────────────────────────────────────────────────── inputs ──

	function skip(): void {
		if (is('done') || is('handoff') || is('fade')) return;
		if (frozen !== null) {
			// A frozen loader that is skipped lets go of the freeze and ends as a skipped one does.
			t = Math.min(frozen, script.end);
			frozen = null;
			backdrop(1);
			last = 0;
		}
		if (skipped) return;
		skipped = true;
		remember();
		if (is('loading') || !painter) return; // the pictures are not here yet: start() carries on
		if (t >= script.end) return; // already on the finished wordmark
		try {
			settleFrom = painter.snapshot();
			settle = 0;
		} catch {
			settleFrom = null;
		}
		t = script.end;
	}

	function onPointer(): void {
		skip();
	}
	function onKey(event: KeyboardEvent): void {
		if (QUIET_KEYS.has(event.key)) return;
		skip();
	}
	function onResize(): void {
		if (is('done')) return;
		try {
			fit();
			if (frozen !== null || !is('loading')) draw();
		} catch (err) {
			console.error('[cellestial] the loader stopped', err);
			end();
		}
	}

	window.addEventListener('pointerdown', onPointer, true);
	window.addEventListener('keydown', onKey, true);
	window.addEventListener('resize', onResize);
	window.addEventListener('orientationchange', onResize);
	const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
	observer?.observe(overlay);

	// A frame loop that has died cannot end the run; this can. It counts only
	// while the page is on screen, as the clock does.
	let watched = 0;
	const limit = script.end + HOLD_MAX + HANDOFF + PICTURES_MAX + 4;
	const watch = window.setInterval(() => {
		if (document.hidden || frozen !== null) return;
		watched += 1;
		if (watched > limit) end();
	}, 1000);

	// ─────────────────────────────────────────────────────── ending ──

	function end(): void {
		if (is('done')) return;
		phase = 'done';
		cancelAnimationFrame(raf);
		clearInterval(watch);
		window.removeEventListener('pointerdown', onPointer, true);
		window.removeEventListener('keydown', onKey, true);
		window.removeEventListener('resize', onResize);
		window.removeEventListener('orientationchange', onResize);
		observer?.disconnect();
		remember();
		if (overlay) overlay.style.display = 'none';
		try {
			painter?.release();
		} catch {
			// nothing to release
		}
		painter = null;
		settleFrom = null;
		finish();
	}

	/** There is nothing to hand over to: let the overlay go, gently. */
	function letGo(): void {
		if (is('done') || is('fade')) return;
		phase = 'fade';
		u = 0;
	}

	function beginHandoff(to: SkyScene): void {
		phase = 'handoff';
		u = 0;
		settleFrom = null;
		prime(to);
	}

	// ──────────────────────────────────────────────────── the clock ──

	function step(dt: number): void {
		if (is('intro')) {
			t += dt;
			if (settleFrom) {
				settle += dt;
				if (settle >= SETTLE) settleFrom = null;
			}
			if (t >= script.end && !settleFrom) {
				if (sky) beginHandoff(sky);
				else if (skyLost || t >= script.end + HOLD_MAX) letGo();
			}
		} else if (is('handoff')) {
			u += dt;
			if (u >= HANDOFF) {
				// The sky's last word from the loader: exactly its opening pose.
				if (sky && painter) painter.handoff(HANDOFF, sky);
				end();
			}
		} else if (is('fade')) {
			u += dt;
			if (u >= FADE_OUT) end();
		}
	}

	/** The first second tells whether this device can afford the canvas at this size. */
	function gauge(ms: number): void {
		if (measured) return;
		slowFrames++;
		slowTotal += ms;
		if (slowTotal < 1000) return;
		measured = true;
		const next = DPR_STEPS[dprStep + 1];
		if (next === undefined || slowTotal / slowFrames <= SLOW_FRAME) return;
		if ((window.devicePixelRatio || 1) <= next) return;
		dprStep++;
		fit();
		// One more look, at the coarser canvas.
		measured = false;
		slowFrames = 0;
		slowTotal = 0;
	}

	function frame(now: number): void {
		if (is('done')) return;
		raf = requestAnimationFrame(frame);
		const ms = last ? now - last : 0;
		last = now;
		if (frozen !== null) return;
		try {
			const dt = Math.min(STEP_MAX, Math.max(0, ms / 1000));
			shown += dt;
			if (is('loading')) {
				if (shown > PICTURES_MAX) end();
				return;
			}
			if (ms > 0) gauge(ms);
			step(dt);
			if (!is('done')) draw();
		} catch (err) {
			console.error('[cellestial] the loader stopped', err);
			end();
		}
	}

	// ───────────────────────────────────────────────────── starting ──

	function start(images: Images): void {
		if (!is('loading') || !canvas) return;
		painter = createPainter(canvas, images, script);
		fit();
		phase = 'intro';
		// The unlit C has been on screen since the page arrived.
		t = script.mode === 'full' ? Math.min(shown, POSTER_CREDIT) : 0;
		if (skipped) t = script.end;
		draw();
	}

	const L = ASSETS.loader;
	Promise.all([
		load(L.cUnlit.url),
		load(L.cLit.url),
		load(L.wordmark.url),
		load(WORDMARK_MATTE.url),
	])
		.then(([unlit, lit, wordmark, matte]) => start({ unlit, lit, wordmark, matte }))
		.catch((err) => {
			console.error('[cellestial] the loader could not start', err);
			end();
		});

	raf = requestAnimationFrame(frame);

	return {
		done,
		skip,
		seek(to) {
			if (is('done') || !Number.isFinite(to)) return;
			frozen = Math.max(0, to);
			if (painter) draw();
		},
	};
};
