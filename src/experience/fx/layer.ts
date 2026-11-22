// The effects layer itself: what is playing, when each thing in it happens,
// and the one frame loop that draws them. The pictures are in flash.ts,
// impact.ts and warp.ts; this file is the timekeeping and the promises (the
// flash's own clock, with swap()'s time left out of it, is flash-time.ts).
//
// Nothing runs while nothing plays. The first effect opens the canvas and
// starts the loop; the last one to end clears it, closes it and stops the
// loop. Time is wall-clock time, so an effect that was mid-flight when the
// tab was hidden is simply further on (or over) when it comes back, and a
// slow heartbeat keeps the clockwork moving while frames are not coming, so
// swap() still runs and every promise still settles.

import type { FxLayer, SceneContext } from '../contracts.ts';
import {
	createFlash,
	drawFade,
	FADE_MS,
	FLASH_MS,
	FLASH_PEAK,
	FLASH_SOLID_FROM,
	type Flash,
	type FlashDir,
} from './flash.ts';
import { advanceFlash, beginFlash, type FlashTime, flashTime, swapped } from './flash-time.ts';
import {
	createGlint,
	createImpact,
	createSparks,
	GLINT_MS,
	IMPACT_MS,
	IMPACT_SIZE,
	type Impact,
} from './impact.ts';
import { createImpacts } from './impacts.ts';
import { nextSeed } from './rng.ts';
import { createSurface } from './surface.ts';
import { createWarp, drawWarpFade, type Warp } from './warp.ts';

/** Time and frames. The real ones by default; the test page drives its own to freeze a frame. */
export interface Clock {
	now(): number;
	/** Ask for one frame; `fn` gets the time of that frame. */
	frame(fn: (now: number) => void): number;
	cancelFrame(id: number): void;
	/** Call `fn` every `ms` until stopped. */
	beat(ms: number, fn: () => void): number;
	stopBeat(id: number): void;
}

export const wallClock: Clock = {
	now: () => performance.now(),
	frame: (fn) => requestAnimationFrame(fn),
	cancelFrame: (id) => cancelAnimationFrame(id),
	beat: (ms, fn) => window.setInterval(fn, ms),
	stopBeat: (id) => window.clearInterval(id),
};

export interface FxOptions {
	/** Where to draw. `#fx-canvas` when left out. */
	canvas?: HTMLCanvasElement | null;
	/** Seed of the first effect; each one after steps on from it. Random when left out. */
	seed?: number;
	clock?: Clock;
}

/** With no frame for this long, the heartbeat moves time on by itself. */
const BEAT_MS = 120;
/**
 * A star this near, against the nearest (1), strikes with a burst (D2), as big
 * as it is near. One farther off, a star of a figure further on, lands as a glint.
 */
const BURST_FROM = 0.6;
/** On a phone a burst is this share of a desktop's, so a dozen side by side stay a dozen. */
const IMPACT_NARROW = 0.72;
/** The glints of the far stars, however many land together, glow like this many alone. */
const GLINT_CAP = 1.2;
/**
 * The warm-up (see warm() below): for this many frames the canvas is this
 * faint, and what is on it are these moments of a burst and of a glint.
 */
const WARM_FRAMES = 3;
const WARM_OPACITY = '0.01';
const WARM_BURSTS = [0.02, 0.08, 0.16, 0.3, 0.45, 0.6, 0.8];
const WARM_GLINTS = [0.05, 0.3, 0.6];
/** Reduced motion: the fade is solid black from here to the same distance past the peak. */
const FADE_SOLID_FROM = 0.47;

/** A flash: its clock (flash-time.ts), and what the clock is for. */
interface FlashRun extends FlashTime {
	swap: () => void | Promise<void>;
	dir: FlashDir;
	resolve: () => void;
	reject: (reason: unknown) => void;
	/** Null for the plain fade of reduced motion. */
	art: Flash | null;
	solidFrom: number;
	failed: boolean;
	error: unknown;
	finished: boolean;
}

interface WarpRun {
	/** Null for the plain fade of reduced motion. */
	art: Warp | null;
	ms: number;
	t0: number;
	u: number;
	resolve: () => void;
}

function report(error: unknown): void {
	if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
	else setTimeout(() => Promise.reject(error));
}

/** With no canvas to draw on, the layer still keeps its promises. */
const blind: FxLayer = {
	teleportFlash: async (swap) => {
		await swap();
	},
	impact() {},
	warp: (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms || 0))),
};

export function createFx(ctx: SceneContext, opts: FxOptions = {}): FxLayer {
	const found = opts.canvas ?? document.getElementById('fx-canvas');
	const canvas = found instanceof HTMLCanvasElement ? found : null;
	const surface = canvas ? createSurface(canvas) : null;
	if (!canvas || !surface) return blind;
	const clock = opts.clock ?? wallClock;

	let seed = (opts.seed ?? Math.floor(Math.random() * 0x100000000)) >>> 0;
	const takeSeed = (): number => {
		const s = seed;
		seed = nextSeed(seed);
		return s;
	};

	let flash: FlashRun | null = null;
	const queue: FlashRun[] = [];
	// Every strike plays out its own length: nothing is taken off these lists
	// to make room (impacts.ts). Bursts share their soft light among bursts,
	// glints among glints.
	const bursts = createImpacts<Impact>();
	const glints = createImpacts<Impact>(GLINT_CAP);
	const sparks = createSparks();
	/** A strike has landed since the last frame was drawn. */
	let landed = false;
	/** Frames of the warm-up still to come; 0 when it is not running. */
	let warming = 0;
	let warps: WarpRun[] = [];

	let frameId = 0;
	let beatId = 0;
	let lastTick = 0;
	let lastFrame = 0;
	let ticking = false;
	/** Set if drawing ever throws: from then on every effect is a plain fade. */
	let broken = false;

	// ─────────────────────────────────────────────────────────── flash ──

	const startFlash = (run: FlashRun, now: number): void => {
		flash = run;
		beginFlash(run, now);
		if (!ctx.reducedMotion && !broken) {
			try {
				run.art = createFlash(takeSeed(), run.dir, surface.w, surface.h);
			} catch (error) {
				report(error);
			}
		}
		if (!run.art) {
			run.total = FADE_MS * 2;
			run.solidFrom = FADE_SOLID_FROM;
		}
	};

	const callSwap = (run: FlashRun, now: number): void => {
		let result: void | Promise<void>;
		try {
			result = run.swap();
		} catch (error) {
			run.failed = true;
			run.error = error;
			result = undefined;
		}
		// However long swap() itself took, the flash does not count it: it stands
		// at the peak, and the next tick takes the time off its clock (flash-time.ts).
		const pending = !!result && typeof (result as Promise<void>).then === 'function';
		swapped(run, now, pending);
		if (pending) {
			(result as Promise<void>).then(
				() => {
					run.settled = true;
				},
				(error: unknown) => {
					run.settled = true;
					if (run.finished) {
						// It failed after the flash had given up waiting and gone.
						report(error);
					} else {
						run.failed = true;
						run.error = error;
					}
				},
			);
		}
	};

	// ───────────────────────────────────────────────────────── drawing ──

	const render = (): void => {
		surface.clear();
		const { g, w, h } = surface;
		try {
			for (const list of [glints, bursts]) {
				for (const run of list.runs) {
					run.art.draw(g, run.u, run.gain, run.wide);
					run.art.sparks(sparks, run.u);
				}
			}
			sparks.flush(g);
			if (flash) {
				if (flash.art && !broken) flash.art.draw(g, flash.u, flash.held);
				else {
					const u = flash.u;
					const edge = flash.solidFrom;
					drawFade(g, w, h, u < FLASH_PEAK ? u / edge : (1 - u) / edge);
				}
				if (flash.stage === 'in' && flash.u >= flash.solidFrom) flash.solidDrawn = true;
			}
			for (const run of warps) {
				if (run.art && !broken) run.art.draw(g, run.u);
				else drawWarpFade(g, w, h, run.u, run.ms);
			}
		} catch (error) {
			// A picture failed. Never leave the screen half drawn: wipe it, fall
			// back to plain fades, and keep the clockwork (and swap) going.
			broken = true;
			bursts.clear();
			glints.clear();
			surface.clear();
			report(error);
		}
	};

	// ──────────────────────────────────────────────────────── the loop ──

	const sleep = (): void => {
		if (frameId) clock.cancelFrame(frameId);
		if (beatId) clock.stopBeat(beatId);
		frameId = 0;
		beatId = 0;
		lastFrame = 0;
		surface.clear();
		surface.close();
		// (However the warm-up ended, the canvas is never left faint.)
		warming = 0;
		if (canvas.style.opacity) canvas.style.opacity = '';
	};

	const tick = (now: number): void => {
		if (ticking) return;
		ticking = true;
		lastTick = now;
		const settle: (() => void)[] = [];

		const playing = flash;
		if (playing && !advanceFlash(playing, now, FLASH_PEAK, (at) => callSwap(playing, at))) {
			const run = playing;
			flash = null;
			run.finished = true;
			settle.push(() => (run.failed ? run.reject(run.error) : run.resolve()));
		}
		if (!flash) {
			const next = queue.shift();
			if (next) startFlash(next, now);
		}
		bursts.advance(now);
		glints.advance(now);
		landed = false;
		for (const run of warps) {
			run.u = Math.max(0, (now - run.t0) / run.ms);
			if (run.u >= 1) settle.push(run.resolve);
		}
		warps = warps.filter((run) => run.u < 1);

		if (flash || bursts.runs.length > 0 || glints.runs.length > 0 || warps.length > 0) render();
		else sleep();
		ticking = false;
		// Only now, with the canvas clear of them, do finished effects report.
		for (const fn of settle) fn();
	};

	const onFrame = (now: number): void => {
		frameId = 0;
		const gap = lastFrame ? now - lastFrame : 0;
		lastFrame = now;
		// A frame callback can carry a time just before the call that asked for it.
		tick(Math.max(now, lastTick));
		// The warm-up lasts its few frames and no longer.
		if (warming > 1) warming--;
		else if (warming === 1) endWarm();
		if (!surface.isOpen) return;
		if (gap > 0 && surface.paced(gap)) render();
		if (!frameId) frameId = clock.frame(onFrame);
	};

	const onBeat = (): void => {
		const now = clock.now();
		// Frames have stopped coming (a hidden tab, most likely): keep time moving.
		if (now - lastTick < BEAT_MS) return;
		lastFrame = 0;
		tick(now);
	};

	/** Make sure the canvas is up and the loop is running. */
	const wake = (): void => {
		if (!surface.isOpen) {
			surface.open();
			lastTick = clock.now();
		}
		if (!frameId) frameId = clock.frame(onFrame);
		if (!beatId) beatId = clock.beat(BEAT_MS, onBeat);
	};

	// ───────────────────────────────────────────────────── the warm-up ──
	//
	// The first time the browser is asked for each kind of mark a burst is made
	// of, its graphics process stops to build the program that draws it: about
	// 140 ms in all, measured, in the frames of the first star's crash, where a
	// stall is seen (one frame of 67 to 83 ms on a desktop). So the same marks
	// are asked for once beforehand, at the loader's one still moment (or at
	// once, where no loader plays): a handful of bursts and glints at different
	// moments of their length, on the canvas at one hundredth of its strength,
	// which nobody can see, for three frames. Any real effect ends it at once.

	const endWarm = (): void => {
		if (!warming) return;
		warming = 0;
		bursts.clear();
		glints.clear();
		canvas.style.opacity = '';
	};

	const warm = (): void => {
		// Something is playing already: it builds what it needs as it goes.
		if (ctx.reducedMotion || broken || surface.isOpen || flash) return;
		if (document.hidden) {
			// No frame is drawn in a tab nobody is looking at: when it is looked at.
			document.addEventListener('visibilitychange', warm, { once: true });
			return;
		}
		canvas.style.opacity = WARM_OPACITY;
		wake();
		const now = clock.now();
		const { w, h } = surface;
		const narrow = Math.min(1, Math.max(IMPACT_NARROW, w / 900));
		try {
			WARM_BURSTS.forEach((u, i) => {
				const x = w * (0.2 + (0.6 * i) / WARM_BURSTS.length);
				bursts.add(
					createImpact(0x5eed + i, x, h * 0.6, w, h, IMPACT_SIZE * narrow),
					now - u * IMPACT_MS,
				);
			});
			WARM_GLINTS.forEach((u, i) => {
				glints.add(
					createGlint(0x91e4 + i, w * (0.45 + 0.05 * i), h * 0.6, w, h, narrow, 0.3),
					now - u * GLINT_MS,
				);
			});
			warming = WARM_FRAMES;
		} catch (error) {
			report(error);
			bursts.clear();
			glints.clear();
			canvas.style.opacity = '';
		}
	};

	// A clock handed in is a test page freezing frames: it gets no warm-up.
	if (!opts.clock && !ctx.reducedMotion) {
		ctx
			.when('loader')
			.then((loader) => loader.quiet)
			.then(warm, () => {});
	}

	surface.onResize = () => {
		flash?.art?.resize(surface.w, surface.h);
		for (const run of warps) run.art?.resize(surface.w, surface.h);
		render();
	};

	// ───────────────────────────────────────────────────── the contract ──

	return {
		teleportFlash(swap, dir) {
			endWarm();
			return new Promise<void>((resolve, reject) => {
				const run: FlashRun = {
					...flashTime(FLASH_MS),
					swap,
					dir: dir === 'up' || dir === 'down' ? dir : 'none',
					resolve,
					reject,
					art: null,
					solidFrom: FLASH_SOLID_FROM,
					failed: false,
					error: undefined,
					finished: false,
				};
				wake();
				// One at a time: a second call waits for the first to clear.
				if (flash) queue.push(run);
				else startFlash(run, clock.now());
			});
		},

		impact(x, y, size = 1) {
			// Reduced motion has no fall, so nothing lands.
			if (ctx.reducedMotion || broken) return;
			if (!Number.isFinite(x) || !Number.isFinite(y)) return;
			endWarm();
			wake();
			const near = Number.isFinite(size) ? Math.min(1, Math.max(0, size)) : 1;
			// A narrow screen has the same stars landing closer together.
			const narrow = Math.min(1, Math.max(IMPACT_NARROW, surface.w / 900));
			try {
				const seed = takeSeed();
				if (near >= BURST_FROM) {
					bursts.add(
						createImpact(seed, x, y, surface.w, surface.h, IMPACT_SIZE * narrow * near),
						clock.now(),
					);
				} else {
					glints.add(createGlint(seed, x, y, surface.w, surface.h, narrow, near), clock.now());
				}
			} catch (error) {
				report(error);
			}
			// The strike is on screen in the same frame the star lands, not the
			// next; and the dozen that land in one frame are drawn once, together.
			if (!landed) {
				landed = true;
				queueMicrotask(() => {
					if (!landed) return;
					landed = false;
					if (!ticking && surface.isOpen) render();
				});
			}
		},

		warp(ms) {
			if (!(ms > 0) || !Number.isFinite(ms)) return Promise.resolve();
			endWarm();
			return new Promise<void>((resolve) => {
				wake();
				let art: Warp | null = null;
				if (!ctx.reducedMotion && !broken) {
					try {
						art = createWarp(takeSeed(), ms, surface.w, surface.h);
					} catch (error) {
						report(error);
					}
				}
				warps.push({ art, ms, t0: clock.now(), u: 0, resolve });
			});
		},
	};
}
