// The teleport flash's clock: where the flash is, 0 to 1, on each tick, with
// the time swap() takes left out of it. Timekeeping and nothing else (no
// canvas, no promise), so it can be played through in a test
// (../fx-flash-time.test.ts). layer.ts calls swap() and draws.
//
// The rule this file exists for: once the flash has reached its peak it is
// AT the peak when swap() returns, and from there it only goes on. It is
// never under the peak again and never goes back. Round 2 found it doing
// both, on the desktop from the sky to the ground, where swap() blocks for
// about 100 ms: that time was taken off the flash's clock twice (once when
// swap() returned, and again on the next tick, whose gap is measured from the
// tick that called swap() and so holds the same 100 ms), and the tick that
// called swap() was drawn with a clock that had not yet seen the block at
// all. The flash stood a quarter of its length before the peak when the new
// section came up, and rose to its peak a second time: two flashes.
// Now the block is counted once, by the tick after it, and the tick that
// calls swap() is drawn at the peak.

/** A wait for swap() is held at the peak for this long at most. */
export const HOLD_MAX_MS = 1000;
/** The frame after swap() pays for the new section. Past this, its lateness is swap time. */
export const SWAP_FRAME_MS = 34;

export interface FlashTime {
	/** Its length in ms, without any wait. */
	total: number;
	t0: number;
	/** Rising to the peak; at the peak, waiting for swap()'s promise; past the swap. */
	stage: 'in' | 'hold' | 'out';
	/** Total ms its timeline has stood still: waiting for swap(), mostly. */
	paused: number;
	holdFrom: number;
	/** A frame that was solid black has been drawn on an earlier tick. */
	solidDrawn: boolean;
	/** swap() is over: it returned nothing, or its promise has settled. */
	settled: boolean;
	/** The next tick is the first since swap() finished. */
	afterSwap: boolean;
	lastTick: number;
	/** Where it is on this tick, 0 to 1, and how long it has stood still by now. */
	u: number;
	held: number;
}

export const flashTime = (total: number): FlashTime => ({
	total,
	t0: 0,
	stage: 'in',
	paused: 0,
	holdFrom: 0,
	solidDrawn: false,
	settled: false,
	afterSwap: false,
	lastTick: 0,
	u: 0,
	held: 0,
});

/** The flash begins at `now`. */
export function beginFlash(run: FlashTime, now: number): void {
	run.t0 = now;
	run.lastTick = now;
}

/**
 * swap() has just been called, on the tick at `now`. `pending` if it left a
 * promise to wait for (settle it with `run.settled = true`). However long the
 * call itself took, the flash stands at the peak: the tick after this one
 * finds the time gone in its gap and takes it off the clock there, once.
 */
export function swapped(run: FlashTime, now: number, pending: boolean): void {
	if (pending) {
		run.stage = 'hold';
		run.holdFrom = now;
	} else {
		run.settled = true;
		run.stage = 'out';
		run.afterSwap = true;
	}
}

/**
 * Move the flash on to `now`. At the peak, with the old section safely behind
 * black, it calls `swap` (which calls swapped()). False once it is over.
 */
export function advanceFlash(
	run: FlashTime,
	now: number,
	peak: number,
	swap: (now: number) => void,
): boolean {
	const gap = now - run.lastTick;
	run.lastTick = now;
	if (run.stage === 'in') {
		const u = (now - run.t0 - run.paused) / run.total;
		if (u >= peak) {
			// Stand at the peak, whatever this tick overshot it by.
			run.paused = now - run.t0 - peak * run.total;
			// If the frame has been solid black on screen since an earlier tick,
			// nothing of the old section can show: swap, and carry on from the peak.
			// If not, a long frame jumped the solid stretch: show the peak first,
			// and swap on the next tick.
			if (run.solidDrawn) swap(now);
		}
	} else if (run.stage === 'hold') {
		if (run.settled || now - run.holdFrom >= HOLD_MAX_MS) {
			run.paused += now - run.holdFrom;
			run.stage = 'out';
			run.afterSwap = true;
		}
	} else if (run.afterSwap) {
		// The first tick after swap(): the time swap() blocked for is in its gap,
		// and so is the browser laying the new section out. A frame's worth of
		// it is the flash's own; the rest is swap time.
		run.afterSwap = false;
		if (gap > SWAP_FRAME_MS) run.paused += gap - SWAP_FRAME_MS;
	}
	run.held = run.paused + (run.stage === 'hold' ? now - run.holdFrom : 0);
	run.u = Math.max(0, (now - run.t0 - run.held) / run.total);
	return run.u < 1;
}
