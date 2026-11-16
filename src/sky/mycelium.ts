// Mycelium: the sky's threads continued underground, branching into the tiers.

import type { Rand } from './field.ts';

export interface Pt {
	x: number;
	y: number;
}

export interface Branch {
	points: Pt[];
	width: number;
	main: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function growMycelium(opts: {
	width: number;
	targets: Pt[];
	rand: Rand;
	steps?: number;
	sidesPerRoot?: number;
}): Branch[] {
	const { width, targets, rand } = opts;
	const steps = opts.steps ?? 14;
	const sides = opts.sidesPerRoot ?? 3;
	const floor = Math.max(0, ...targets.map((t) => t.y));
	const out: Branch[] = [];

	for (const target of targets) {
		const startX = clamp(target.x + (rand() - 0.5) * 240, 0, width);
		const main: Pt[] = [];
		for (let i = 0; i <= steps; i++) {
			const u = i / steps;
			const jitter = (rand() - 0.5) * 60 * (1 - u); // fades to zero at the card
			main.push({
				x: i === steps ? target.x : clamp(startX + (target.x - startX) * u + jitter, 0, width),
				y: i === steps ? target.y : target.y * u,
			});
		}
		out.push({ points: main, width: 1.4, main: true });

		for (let s = 0; s < sides; s++) {
			const from = main[1 + Math.floor(rand() * (steps - 2))];
			const dir = rand() < 0.5 ? -1 : 1;
			const len = 3 + Math.floor(rand() * 3);
			const pts: Pt[] = [{ ...from }];
			let { x, y } = from;
			for (let k = 0; k < len; k++) {
				x = clamp(x + dir * (14 + rand() * 22), 0, width);
				y = clamp(y + 10 + rand() * 18, 0, floor);
				pts.push({ x, y });
			}
			out.push({ points: pts, width: 0.7, main: false });
		}
	}
	return out;
}
