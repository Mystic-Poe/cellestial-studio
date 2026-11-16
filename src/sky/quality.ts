// Frame-time governor: keeps the sky smooth on slow phones by shedding work.
// Pure: fed frame durations and timestamps, returns a quality level.

export const QUALITY_LEVELS = [
	{ threads: true, dustScale: 1, maxDpr: 2 },
	{ threads: false, dustScale: 1, maxDpr: 2 },
	{ threads: false, dustScale: 0.5, maxDpr: 2 },
	{ threads: false, dustScale: 0.5, maxDpr: 1 },
] as const;

export interface Governor {
	readonly level: number;
	sample(frameMs: number, nowMs: number): number;
}

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
