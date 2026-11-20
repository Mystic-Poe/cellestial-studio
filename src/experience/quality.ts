// Frame-time governor: keeps a scene smooth on slow phones by shedding work.
// Pure: fed frame durations and timestamps, returns a quality level.
//
// A scene samples it once per frame and, when the level changes, applies the
// level's two generic dials however suits it:
//
//   dpr     the most device pixels per CSS pixel to render at
//           (use Math.min(devicePixelRatio, dpr))
//   detail  how much of the optional work to do, 1 = all of it
//           (particle counts, trail lengths, glow passes, far layers)
//
// Detail is shed before resolution: thinning particles costs nothing to
// switch, while a new pixel ratio means resizing the drawing buffer.

export interface QualityLevel {
	readonly dpr: 2 | 1.5 | 1;
	readonly detail: 1 | 0.75 | 0.5 | 0.35;
}

/** From full to lightest. The governor's `level` indexes this. */
export const QUALITY_LEVELS: readonly [QualityLevel, QualityLevel, QualityLevel, QualityLevel] = [
	{ dpr: 2, detail: 1 },
	{ dpr: 2, detail: 0.75 },
	{ dpr: 1.5, detail: 0.5 },
	{ dpr: 1, detail: 0.35 },
];

export interface Governor {
	readonly level: number;
	/** Feed one frame: how long it took, and when. Returns the level to draw at. */
	sample(frameMs: number, nowMs: number): number;
}

/**
 * Averages frame times over `windowMs`. An average over `budgetMs` steps the
 * level down (lighter), one step per window, as far as the lightest. After
 * `goodWindowsToStepUp` windows in a row under `upMs` it steps back up, once
 * only, so a device on the edge settles instead of flickering between two
 * levels.
 */
export function createGovernor(
	opts: { budgetMs?: number; upMs?: number; windowMs?: number; goodWindowsToStepUp?: number } = {},
): Governor {
	const budget = opts.budgetMs ?? 20;
	const upMs = opts.upMs ?? 12;
	const windowMs = opts.windowMs ?? 1000;
	const need = opts.goodWindowsToStepUp ?? 3;
	const max = QUALITY_LEVELS.length - 1;

	let level = 0;
	let windowStart = -1;
	let sum = 0;
	let n = 0;
	let good = 0;
	let steppedUp = false;

	return {
		get level() {
			return level;
		},
		sample(frameMs: number, nowMs: number): number {
			if (windowStart < 0) windowStart = nowMs;
			sum += frameMs;
			n++;
			if (nowMs - windowStart < windowMs) return level;

			const avg = sum / n;
			windowStart = nowMs;
			sum = 0;
			n = 0;

			if (avg > budget) {
				if (level < max) level++;
				good = 0;
			} else if (avg < upMs && level > 0 && !steppedUp) {
				good++;
				if (good >= need) {
					level--;
					steppedUp = true;
					good = 0;
				}
			} else {
				good = 0;
			}
			return level;
		},
	};
}
