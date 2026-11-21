// The effects layer itself: what is playing, when each thing in it happens,
// and the one frame loop that draws them. The pictures are in flash.ts,
// impact.ts and warp.ts; this file is the timekeeping and the promises.
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
import { createImpact, IMPACT_MS, IMPACT_SIZE, type Impact } from './impact.ts';
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

/** A wait for swap() is held at the peak for this long at most. */
const HOLD_MAX_MS = 1000;
/** With no frame for this long, the heartbeat moves time on by itself. */
const BEAT_MS = 120;
/** The frame after swap() pays for the new section. Past this, its lateness is swap time. */
const SWAP_FRAME_MS = 34;
/** The burst of the farthest star is this share of the nearest's. */
const IMPACT_FAR = 0.3;
/** On a phone a burst is this share of a desktop's, so a dozen side by side stay a dozen. */
const IMPACT_NARROW = 0.72;
/** How many bursts (D2) play at once. */
const IMPACTS_MAX = 18;
/** Reduced motion: the fade is solid black from here to the same distance past the peak. */
const FADE_SOLID_FROM = 0.47;

interface FlashRun {
	swap: () => void | Promise<void>;
	dir: FlashDir;
	resolve: () => void;
	reject: (reason: unknown) => void;
	/** Null for the plain fade of reduced motion. */
	art: Flash | null;
	/** Its length in ms, without any wait. */
	total: number;
	solidFrom: number;
	t0: number;
	stage: 'in' | 'hold' | 'out';
	/** Total ms its timeline has stood still: waiting for swap(), mostly. */
	paused: number;
	holdFrom: number;
	/** A frame that was solid black has been drawn on an earlier tick. */
	solidDrawn: boolean;
	settled: boolean;
	failed: boolean;
	error: unknown;
	finished: boolean;
	/** The next tick is the first since swap() finished. */
	afterSwap: boolean;
	lastTick: number;
	/** Where it is on this tick, 0 to 1, and how long it has stood still by now. */
	u: number;
	held: number;
}

interface ImpactRun {
	art: Impact;
	t0: number;
	u: number;
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
	const canvas = opts.canvas ?? (document.getElementById('fx-canvas') as HTMLCanvasElement | null);
	const surface = canvas instanceof HTMLCanvasElement ? createSurface(canvas) : null;
	if (!surface) return blind;
	const clock = opts.clock ?? wallClock;

	let seed = (opts.seed ?? Math.floor(Math.random() * 0x100000000)) >>> 0;
	const takeSeed = (): number => {
		const s = seed;
		seed = nextSeed(seed);
		return s;
	};

	let flash: FlashRun | null = null;
	const queue: FlashRun[] = [];
	let impacts: ImpactRun[] = [];
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
		run.t0 = now;
		run.lastTick = now;
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
		const before = clock.now();
		try {
			result = run.swap();
		} catch (error) {
			run.failed = true;
			run.error = error;
			result = undefined;
		}
		// However long swap() itself took, the flash does not count it.
		run.paused += Math.max(0, clock.now() - before);
		run.afterSwap = true;
		if (result && typeof (result as Promise<void>).then === 'function') {
			run.stage = 'hold';
			run.holdFrom = now;
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
		} else {
			run.settled = true;
			run.stage = 'out';
		}
	};

	/** Move a flash on to `now`. False once it is over. */
	const advanceFlash = (run: FlashRun, now: number): boolean => {
		const gap = now - run.lastTick;
		run.lastTick = now;
		if (run.stage === 'in') {
			const u = (now - run.t0 - run.paused) / run.total;
			if (u >= FLASH_PEAK) {
				if (run.solidDrawn) {
					// The frame has been solid black on screen since an earlier tick:
					// nothing of the old section can show. Swap, and carry on from the peak.
					run.paused = now - run.t0 - FLASH_PEAK * run.total;
					callSwap(run, now);
				} else {
					// A long frame jumped the solid stretch. Show the peak first; swap next tick.
					run.paused = now - run.t0 - FLASH_PEAK * run.total;
				}
			}
		} else if (run.stage === 'hold') {
			if (run.settled || now - run.holdFrom >= HOLD_MAX_MS) {
				run.paused += now - run.holdFrom;
				run.stage = 'out';
				run.afterSwap = true;
			}
		} else if (run.afterSwap) {
			// The first frame after swap() is the browser laying the new section
			// out. If it came late, that was swap time too.
			run.afterSwap = false;
			if (gap > SWAP_FRAME_MS) run.paused += gap - SWAP_FRAME_MS;
		}
		run.held = run.paused + (run.stage === 'hold' ? now - run.holdFrom : 0);
		run.u = Math.max(0, (now - run.t0 - run.held) / run.total);
		return run.u < 1;
	};

	// ───────────────────────────────────────────────────────── drawing ──

	const render = (): void => {
		surface.clear();
		const { g, w, h } = surface;
		try {
			for (const run of impacts) run.art.draw(g, run.u);
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
			impacts = [];
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
	};

	const tick = (now: number): void => {
		if (ticking) return;
		ticking = true;
		lastTick = now;
		const settle: (() => void)[] = [];

		if (flash && !advanceFlash(flash, now)) {
			const run = flash;
			flash = null;
			run.finished = true;
			settle.push(() => (run.failed ? run.reject(run.error) : run.resolve()));
		}
		if (!flash) {
			const next = queue.shift();
			if (next) startFlash(next, now);
		}
		for (const run of impacts) run.u = Math.max(0, (now - run.t0) / IMPACT_MS);
		impacts = impacts.filter((run) => run.u < 1);
		for (const run of warps) {
			run.u = Math.max(0, (now - run.t0) / run.ms);
			if (run.u >= 1) settle.push(run.resolve);
		}
		warps = warps.filter((run) => run.u < 1);

		if (flash || impacts.length > 0 || warps.length > 0) render();
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

	surface.onResize = () => {
		flash?.art?.resize(surface.w, surface.h);
		for (const run of warps) run.art?.resize(surface.w, surface.h);
		render();
	};

	// ───────────────────────────────────────────────────── the contract ──

	return {
		teleportFlash(swap, dir) {
			return new Promise<void>((resolve, reject) => {
				const run: FlashRun = {
					swap,
					dir: dir === 'up' || dir === 'down' ? dir : 'none',
					resolve,
					reject,
					art: null,
					total: FLASH_MS,
					solidFrom: FLASH_SOLID_FROM,
					t0: 0,
					stage: 'in',
					paused: 0,
					holdFrom: 0,
					solidDrawn: false,
					settled: false,
					failed: false,
					error: undefined,
					finished: false,
					afterSwap: false,
					lastTick: 0,
					u: 0,
					held: 0,
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
			wake();
			// A whole sky can land within half a second. Past this many at once the
			// oldest, which is all but spent, makes way: frame time is kept.
			if (impacts.length >= IMPACTS_MAX) impacts.shift();
			try {
				impacts.push({
					art: createImpact(
						takeSeed(),
						x,
						y,
						surface.w,
						surface.h,
						// A narrow screen has the same stars landing closer together.
						IMPACT_SIZE *
							Math.min(1, Math.max(IMPACT_NARROW, surface.w / 900)) *
							Math.min(1, Math.max(IMPACT_FAR, Number.isFinite(size) ? size : 1)),
					),
					t0: clock.now(),
					u: 0,
				});
			} catch (error) {
				report(error);
			}
			// The burst is on screen in the same frame the star lands, not the next.
			if (!ticking) render();
		},

		warp(ms) {
			if (!(ms > 0) || !Number.isFinite(ms)) return Promise.resolve();
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
