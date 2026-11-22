// The strikes of the fall that are playing: who is on the list, how far each
// one is through its own length, and how much of its soft light each may give.
// Bookkeeping only: no canvas, no clock of its own, so it runs anywhere and
// is tested in node (src/experience/fx-impacts.test.ts).
//
// Two rules, both the owner's:
//
// 1. A strike leaves the list when its own time is over, and for no other
//    reason. A whole sky lands inside a second; however many are playing,
//    none is taken off to make room.
//
// 2. Strikes that land close together share their soft light. Drawn
//    additively, a crowd of flashes and glows adds up to one flat white
//    shape; so each strike is told what share of its glow to give (`gain`),
//    such that the glow of a crowd is about that of `cap` strikes alone. A
//    strike with no neighbour gives all of it. Its broad light (what it
//    spreads along the ground, three times as far) is shared the same way
//    over that wider reach (`wide`). What is crisp in a strike (its rays, its
//    sparks) is not shared out: that is what tells them apart.

/** What the list needs to know of one strike. */
export interface Strike {
	/** Where it struck along the ground, CSS px. */
	readonly x: number;
	/** Its own length, ms. */
	readonly ms: number;
	/** How far along the ground its glow is felt, CSS px. */
	readonly reach: number;
	/** How much glow it has at `u` (0 to 1 of its length), against a full burst at its brightest. */
	heat(u: number): number;
}

export interface Run<A extends Strike> {
	readonly art: A;
	readonly t0: number;
	/** Where it is, 0 to 1 of its own length. */
	u: number;
	/** The share of its glow it may give, 0 to 1. */
	gain: number;
	/** The share of its broad light, the light it spreads along the ground, it may give. */
	wide: number;
}

export interface Impacts<A extends Strike> {
	/** The strikes playing, oldest first. */
	readonly runs: readonly Run<A>[];
	add(art: A, now: number): Run<A>;
	/** Move every strike on to `now`, let go of those whose own time is over, and share out the glow. */
	advance(now: number): void;
	clear(): void;
}

/** The glow of a crowd is held to that of this many strikes alone. */
export const GLOW_CAP = 1.5;
/** A strike's broad light is felt this many times as far as its glow, and a crowd's is held to this many times the cap. */
export const WIDE_REACH = 3;
export const WIDE_CAP = 1.35;

/**
 * Share out the light: each run's `gain` is 1 where it stands alone and
 * `cap / crowd` where the glow of its neighbours and its own, weighed by how
 * near they are, comes to more than `cap`; `wide` likewise, over the wider reach.
 */
export function shareGlow<A extends Strike>(runs: readonly Run<A>[], cap = GLOW_CAP): void {
	const n = runs.length;
	if (n === 0) return;
	const heat = new Array<number>(n);
	for (let i = 0; i < n; i++) heat[i] = Math.max(0, runs[i].art.heat(runs[i].u));
	const wideCap = cap * WIDE_CAP;
	for (let i = 0; i < n; i++) {
		const a = runs[i].art;
		let crowd = heat[i];
		let far = heat[i];
		for (let j = 0; j < n; j++) {
			if (j === i || heat[j] <= 0) continue;
			const b = runs[j].art;
			const apart = Math.abs(a.x - b.x) / (a.reach + b.reach || 1);
			if (apart < 1) crowd += heat[j] * (1 - apart);
			if (apart < WIDE_REACH) far += heat[j] * (1 - apart / WIDE_REACH);
		}
		runs[i].gain = crowd > cap ? cap / crowd : 1;
		runs[i].wide = far > wideCap ? wideCap / far : 1;
	}
}

export function createImpacts<A extends Strike>(cap = GLOW_CAP): Impacts<A> {
	let runs: Run<A>[] = [];
	const place = (run: Run<A>, now: number): void => {
		run.u = Math.max(0, (now - run.t0) / run.art.ms);
	};
	return {
		get runs() {
			return runs;
		},
		add(art, now) {
			const run: Run<A> = { art, t0: now, u: 0, gain: 1, wide: 1 };
			runs.push(run);
			shareGlow(runs, cap);
			return run;
		},
		advance(now) {
			let over = false;
			for (const run of runs) {
				place(run, now);
				if (run.u >= 1) over = true;
			}
			// Only its own end takes a strike off the list.
			if (over) runs = runs.filter((run) => run.u < 1);
			shareGlow(runs, cap);
		},
		clear() {
			runs = [];
		},
	};
}
