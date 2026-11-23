// The loading scene (A1 → A5): the mount.
//
// What is drawn is painter.ts; when it is drawn is timeline.ts; where,
// layout.ts. This file is the rest: the canvas, the clock, the skip, the
// choice of the full or the short version, the freeze for screenshots, and
// the hand-off to the sky.
//
// The run, in order:
//   intro     second 0 to `script.end` of the script: A1 to A4 (painter.intro),
//             played at the script's tempo
//   hold      the finished wordmark, its node breathing, while the sky is
//             not ready; at most HOLD_MAX seconds
//   hand-off  A5, HANDOFF seconds (painter.handoff drives the sky)
//   fade      only if there is no sky to hand over to: the overlay fades
//   done      the overlay is off the page, everything is let go of
//
// The clock is the visitor's: it starts when the loader's picture is first
// SEEN, which on a slow line is the unlit C of the server's own markup, shown
// whole by the markup's own script (Loader.astro) once its file has arrived,
// and standing there before this script has. The full version is planned
// to take `script.end / tempo` seconds and the hand-off after it: 7.1 s.
// `wall` is the time the picture has really been on screen (clock.ts); it
// says how late the run is. A run that is behind (the script or the pictures
// were slow to arrive, a frame stalled, the sky was not ready) may end up to
// LATE seconds past the plan; if that is not enough it plays its hand-off
// faster, down to HANDOFF_MIN, and past that hurries the script itself by at
// most HURRY_MAX. It never ends under FLOOR seconds after the first sight.
// (The three pictures besides the unlit C are asked for by the markup's
// script too, the moment the unlit C is in, so that they are not a second and
// a half behind this script. And a tap or a key made before this script had
// arrived is not lost: the markup's script wrote it down, skip.ts judges it.)
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
import {
	FLOOR_SPARE,
	firstSeen,
	handoffLength,
	paceAt,
	paintedAfter,
	waitedBefore,
} from './clock.ts';
import { WORDMARK_MATTE } from './geometry.ts';
import { layoutFor } from './layout.ts';
import { createPainter, type Images, type Painter } from './painter.ts';
import { anySkip, type Early, isSkip } from './skip.ts';
import {
	FADE_OUT,
	FLOOR,
	FULL,
	HANDOFF,
	HOLD_MAX,
	type Script,
	SETTLE,
	SHORT,
} from './timeline.ts';

/** Set once a run has finished or been skipped: the next visit this session is the short one. */
const SEEN_KEY = 'cellestial:loader';
/** The script never jumps further than this in one frame, so a stall is not a skip. */
const STEP_MAX = 0.08;
/** One frame counts for at most this much lateness: a tab that was put away has not made the run late. */
const WALL_STEP_MAX = 1;
/** The server-rendered C has been on screen already: at most this much of the script is credited. */
const POSTER_CREDIT = 0.25;
/** The still moment is waited for this long, in milliseconds, before heavy work is let through anyway. */
const QUIET_MAX_MS = 4500;
/** The pictures are given this long, in seconds on screen, before the loader lets go. */
const PICTURES_MAX = 8;
/** Canvas pixels per CSS pixel: at most 2, coarser if the device cannot keep up. */
const DPR_STEPS = [2, 1.5, 1];
/** Over this many milliseconds a frame, averaged over the first second, the canvas gets coarser. */
const SLOW_FRAME = 22;
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

/** When the browser first painted anything of the page, in ms on performance.now()'s clock, if it will say. */
function firstPaint(): number | null {
	try {
		const paint = performance.getEntriesByName('first-contentful-paint')[0];
		return paint ? paint.startTime : null;
	} catch {
		return null;
	}
}

/** What the markup's own script did before this one arrived (Loader.astro), if it ran. */
function earlier(): Early | null {
	return (window as unknown as { __loaderEarly?: Early }).__loaderEarly ?? null;
}

export const mount: MountLoader = (ctx, opts) => {
	let finish = () => {};
	const done = new Promise<void>((resolve) => {
		finish = resolve;
	});
	// The pictures are in, or are not waited for any longer: the line is free
	// for what the page needs next (main.ts holds the sky's script back for it).
	let fed = () => {};
	const loaded = new Promise<void>((resolve) => {
		fed = resolve;
	});
	const idle: LoaderScene = {
		done,
		skip() {},
		seek() {},
		quiet: Promise.resolve(),
		loaded: Promise.resolve(),
	};

	// What was pressed on this page before this script was here to hear it
	// (skip.ts). Taken before anything else: taking it is also what stops the
	// markup's listening, whatever becomes of this mount.
	const early = earlier();
	const skippedEarly = early ? anySkip(early.take()) : false;

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
	const mountedAt = performance.now();
	/** When the canvas first drew the loader's picture, in ms on the same clock. */
	let drawnAt: number | null = null;
	/**
	 * When the visitor first SAW the loader's picture: the server's unlit C,
	 * shown whole by the markup's script, or the canvas's first frame if that
	 * came first; and not before the browser says it painted. Null until then.
	 */
	const seenAt = () => firstSeen(firstPaint(), early ? early.seenAt : null, drawnAt);
	/** What the visitor had already waited before the mount: the unlit C, standing. Full version only. */
	const credit = script.mode === 'full' ? waitedBefore(mountedAt, seenAt()) : 0;
	/** Seconds the loader's picture has really been on screen: the measure of how late the run is. */
	let wall = credit;
	/**
	 * Seconds on the visitor's clock: `wall`, less the moment between the mount
	 * and the first sight of the picture where the script was there first (a
	 * fast line; or a slow one on which the script outran the unlit C).
	 */
	const seen = () =>
		wall - (script.mode === 'full' && credit === 0 ? paintedAfter(mountedAt, seenAt()) : 0);
	/** How long this run's hand-off takes; a late run's is shorter. */
	let handoffFor = HANDOFF;
	/** `wall` at the skip, or -1. */
	let skippedAt = -1;

	// The still moment: the power-up has run, the lines have cooled, and for an
	// instant nothing on screen moves. Heavy work started here (the sky) holds a
	// picture that was standing still anyway. A run that does not play the
	// power-up, or is frozen for a screenshot, has no reason to wait.
	let calm = () => {};
	const quiet = new Promise<void>((resolve) => {
		calm = resolve;
	});
	const quietAt = script.reveal ? script.reveal.gone : 0;
	if (quietAt <= 0) calm();
	const quietTimer = window.setTimeout(calm, QUIET_MAX_MS);
	/** Debug: the second the timeline is frozen at. */
	let frozen: number | null =
		opts?.freezeAt !== undefined && Number.isFinite(opts.freezeAt)
			? Math.max(0, opts.freezeAt)
			: null;
	if (frozen !== null) calm();

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
		if (drawnAt === null) drawnAt = performance.now();
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
		skippedAt = wall;
		calm();
		fed(); // a skip waits for the sky and for nothing else: its script is not held back
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
		if (!isSkip(event.key)) return;
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
	// A tap or a key before this script had arrived: a skip made now, at the first moment.
	if (skippedEarly) skip();

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
		clearTimeout(quietTimer);
		calm();
		fed();
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
		// A run that is behind its plan gives the time back here, as far as the
		// hand-off can; and never ends under the floor (clock.ts).
		handoffFor = handoffLength(script, wall, seen(), skippedAt);
		prime(to);
	}

	/** Seconds of script to a second on the clock, now: the tempo, and more when the run is late. */
	const pace = (): number => paceAt(script, t, wall, skippedAt >= 0);

	// ──────────────────────────────────────────────────── the clock ──

	function step(dt: number): void {
		if (is('intro')) {
			t += dt * pace();
			if (t >= quietAt) calm();
			if (settleFrom) {
				settle += dt;
				if (settle >= SETTLE) settleFrom = null;
			}
			if (t >= script.end && !settleFrom) {
				if (sky) beginHandoff(sky);
				else if (skyLost || t >= script.end + HOLD_MAX) {
					// The floor holds here too: a sky that never came does not make the run short.
					const early =
						script.mode === 'full' && skippedAt < 0 && seen() < FLOOR - FADE_OUT + FLOOR_SPARE;
					if (!early) letGo();
				}
			}
		} else if (is('handoff')) {
			u += (dt * HANDOFF) / handoffFor;
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
			wall += Math.min(WALL_STEP_MAX, Math.max(0, ms / 1000));
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
		fed();
		if (!is('loading') || !canvas) return;
		painter = createPainter(canvas, images, script);
		fit();
		phase = 'intro';
		// The unlit C has been on screen since the page arrived.
		t = script.mode === 'full' ? Math.min(wall * script.tempo, POSTER_CREDIT) : 0;
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
		quiet,
		loaded,
		skip,
		seek(to) {
			if (is('done') || !Number.isFinite(to)) return;
			frozen = Math.max(0, to);
			if (painter) draw();
		},
	};
};
