// The frame-time governor: "if frame rate drops, scale effects down
// automatically rather than shipping jank."
//
// Pure: it is fed the duration of each frame and the time, and answers with a
// quality level, 0 being everything on. What a level means is the caller's
// business. The idea is that of src/sky/quality.ts (average a window, step
// down when it is over budget), with a careful way back up: after a spell of
// good frames it tries one level higher, and if that try fails it waits twice
// as long before the next one.

export interface GovernorOptions {
	/** How many levels there are, level 0 included. */
	levels: number;
	/** A window whose mean frame is longer than this steps down. */
	budgetMs?: number;
	/** A window whose mean frame is shorter than this counts as headroom. */
	upMs?: number;
	windowMs?: number;
	/** A frame longer than this is "slow"; a window with a quarter of them steps down too. */
	slowMs?: number;
	/** Frames are ignored for this long after a change: the change itself costs a hitch. */
	settleMs?: number;
	/** Good frames for this long before the first try at stepping up. */
	backoffMs?: number;
	maxBackoffMs?: number;
}

export interface Governor {
	readonly level: number;
	/** How long it now waits before trying a level up, milliseconds. */
	readonly backoffMs: number;
	/** Feed one frame. Returns the level, which may have just changed. */
	sample(frameMs: number, nowMs: number): number;
	/** Drop the window in progress (after a pause, a resize, a tab switch). */
	reset(): void;
}

export function createGovernor(opts: GovernorOptions): Governor {
	const max = Math.max(0, opts.levels - 1);
	const budget = opts.budgetMs ?? 21.5;
	const upMs = opts.upMs ?? 18.5;
	const windowMs = opts.windowMs ?? 700;
	const slowMs = opts.slowMs ?? 34;
	const settleMs = opts.settleMs ?? 450;
	const firstBackoff = opts.backoffMs ?? 4000;
	const maxBackoff = opts.maxBackoffMs ?? 60000;

	let level = 0;
	let backoff = firstBackoff;
	let windowStart = -1;
	let sum = 0;
	let n = 0;
	let slow = 0;
	let quietUntil = -1;
	let goodSince = -1;
	let lastUp = -Infinity;

	const reset = () => {
		windowStart = -1;
		sum = 0;
		n = 0;
		slow = 0;
	};

	return {
		get level() {
			return level;
		},
		get backoffMs() {
			return backoff;
		},
		reset() {
			reset();
			goodSince = -1;
		},
		sample(frameMs, nowMs) {
			// A pause is not a slow frame.
			if (!(frameMs > 0) || frameMs > 250) {
				reset();
				return level;
			}
			if (nowMs < quietUntil) return level;
			if (windowStart < 0) windowStart = nowMs;
			sum += frameMs;
			n++;
			if (frameMs > slowMs) slow++;
			if (nowMs - windowStart < windowMs || n < 6) return level;

			const mean = sum / n;
			const slowShare = slow / n;
			reset();

			if (mean > budget || slowShare > 0.25) {
				goodSince = -1;
				if (level < max) {
					// Stepping down straight after a try upward: that try failed. Wait longer next time.
					if (nowMs - lastUp < 3000) backoff = Math.min(maxBackoff, backoff * 2);
					level++;
					quietUntil = nowMs + settleMs;
				}
			} else if (mean < upMs && slowShare <= 0.05) {
				if (goodSince < 0) goodSince = nowMs;
				if (level > 0 && nowMs - goodSince >= backoff) {
					level--;
					lastUp = nowMs;
					goodSince = -1;
					quietUntil = nowMs + settleMs;
				}
			} else {
				goodSince = -1;
			}
			return level;
		},
	};
}
