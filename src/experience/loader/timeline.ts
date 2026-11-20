// The loading scene's clock: what happens when, in seconds.
//
// The full version follows the reference video
// (cellestial-assets/images/a-loading/A2-A3_power-up-and-lightning-writing.mp4)
// one to one up to the cooled wordmark. The times below were read off its
// frames at 24 fps; the camera's path was measured on them (the C's size and
// its left edge in every frame from 3.42 s to 5.83 s).

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 below `a`, 1 above `b`, a smooth S between. */
export function smoothstep(a: number, b: number, x: number): number {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
}
/** The moment at which a smoothstep from 0 to 1 reaches `y`. */
export const smoothstepAt = (y: number) => 0.5 - Math.sin(Math.asin(1 - 2 * clamp01(y)) / 3);

/** A value read off a row of `[time, value]` keys, straight lines between them. */
export function keyed(keys: readonly (readonly [number, number])[], t: number): number {
	if (t <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i++) {
		if (t <= keys[i][0]) {
			const [t0, v0] = keys[i - 1];
			const [t1, v1] = keys[i];
			return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
		}
	}
	return keys[keys.length - 1][1];
}

export interface Script {
	readonly mode: 'full' | 'short';
	/** A4 is complete: the finished wordmark, and the moment A5 may begin. */
	readonly end: number;
	/**
	 * A2. The light leaves the main node at `start` and has run through the
	 * whole C by `end` (those two are the times stored in CIRCUIT). The lines
	 * stay hot until `hold` and are back to plain blue by `gone`.
	 */
	readonly reveal: { start: number; end: number; hold: number; gone: number } | null;
	/** The unlit picture gives way to the lit one between these. */
	readonly lit: readonly [number, number] | null;
	/** The overload bolt: it strikes, holds, thins, and is gone. */
	readonly strike: { hit: number; hold: number; thin: number; gone: number } | null;
	/** The camera leaves framing A and arrives at framing B. Without it the frame is B throughout. */
	readonly camera: readonly [number, number] | null;
	/** The light in the main node's lens, as `[time, strength]` keys. */
	readonly energy: readonly (readonly [number, number])[];
	/** Small arcs play at the main node between these. */
	readonly arcs: readonly [number, number];
	/** When each of the nine letters is written: e, l, l, e, s, t, i, a, l. */
	readonly letters: readonly (readonly [number, number])[];
	/** The star above the i lights. */
	readonly star: number;
	/** The neon cools to brass between these. */
	readonly cool: readonly [number, number];
}

export const FULL: Script = {
	mode: 'full',
	end: 6.2,
	reveal: { start: 0.29, end: 1.65, hold: 1.36, gone: 1.92 },
	lit: [1.98, 2.8],
	strike: { hit: 2.875, hold: 3.33, thin: 3.42, gone: 3.58 },
	camera: [3.417, 5.833],
	energy: [
		[1.98, 0],
		[2.08, 0.4],
		[2.8, 0.95],
		[2.86, 1.15],
		[2.9, 2.5],
		[3.0, 2.3],
		[3.17, 2.0],
		[3.33, 1.4],
		[3.5, 1.0],
		[3.7, 0.85],
		[5.6, 0.8],
		[5.75, 0.5],
		[6.17, 0.32],
	],
	arcs: [2.0, 5.72],
	// Each letter is written in about a tenth of a second, then the lightning
	// plays over it for as long again before it jumps on (read off the frames).
	letters: [
		[3.65, 3.84],
		[3.92, 4.04],
		[4.12, 4.22],
		[4.36, 4.52],
		[4.67, 4.77],
		[4.87, 4.97],
		[5.04, 5.15],
		[5.28, 5.48],
		[5.56, 5.68],
	],
	star: 5.2,
	cool: [5.6, 6.17],
};

/** A return visit in the same session: the C is already lit and in its place; one fast bolt writes the word. */
export const SHORT: Script = {
	mode: 'short',
	end: 1.9,
	reveal: null,
	lit: null,
	strike: null,
	camera: null,
	energy: [
		[0, 0],
		[0.22, 0.9],
		[1.25, 0.8],
		[1.4, 0.4],
		[1.68, 0],
	],
	arcs: [0.06, 1.34],
	letters: Array.from({ length: 9 }, (_, i): [number, number] => [
		0.3 + i * 0.105,
		0.425 + i * 0.105,
	]),
	star: 1.0,
	cool: [1.33, 1.68],
};

/** A5, the hand-off to the sky, in seconds. */
export const HANDOFF = 1.5;
/** The longest the finished wordmark waits for a sky that is not ready. */
export const HOLD_MAX = 6;
/** Then the overlay fades away by itself, over this long. */
export const FADE_OUT = 0.4;
/** A skip dissolves into the finished wordmark over this long. */
export const SETTLE = 0.18;

// The camera, measured on the reference: how far the C has shrunk towards
// its size in the word, and how far its left edge has travelled towards its
// place in the word, at each frame from 3.417 s to 5.833 s (24 per second).
const SHRINK = [
	0, 0.0023, 0.0064, 0.0124, 0.0201, 0.0292, 0.0392, 0.0506, 0.0633, 0.0777, 0.0935, 0.1109, 0.1294,
	0.1491, 0.1702, 0.1934, 0.2178, 0.2433, 0.2698, 0.2979, 0.3271, 0.3569, 0.3871, 0.4186, 0.4507,
	0.4832, 0.5154, 0.5476, 0.5794, 0.6106, 0.6404, 0.6692, 0.6967, 0.7235, 0.7487, 0.7725, 0.7942,
	0.815, 0.8348, 0.8536, 0.8706, 0.8857, 0.8995, 0.9122, 0.9239, 0.9347, 0.944, 0.9531, 0.9611,
	0.9688, 0.9752, 0.9806, 0.9849, 0.9889, 0.993, 0.9963, 0.9987, 0.9997, 1,
];
const TRAVEL = [
	0, 0.0024, 0.0065, 0.0121, 0.0186, 0.0261, 0.0351, 0.0457, 0.058, 0.0718, 0.0873, 0.1045, 0.1233,
	0.1437, 0.1657, 0.1896, 0.2152, 0.2423, 0.2704, 0.2996, 0.3299, 0.3613, 0.3937, 0.4271, 0.4609,
	0.4953, 0.5296, 0.5637, 0.5969, 0.629, 0.6602, 0.6907, 0.72, 0.7475, 0.7732, 0.7971, 0.8196,
	0.8404, 0.8595, 0.8769, 0.8929, 0.9074, 0.9202, 0.9316, 0.9415, 0.9507, 0.9589, 0.9664, 0.9727,
	0.978, 0.9826, 0.9867, 0.9903, 0.9932, 0.9956, 0.9976, 0.999, 0.9998, 1,
];

function table(values: readonly number[], f: number): number {
	const at = clamp01(f) * (values.length - 1);
	const i = Math.min(values.length - 2, Math.floor(at));
	return lerp(values[i], values[i + 1], at - i);
}

/**
 * Where the camera is between framing A (0) and framing B (1) at second
 * `t`: its scale and its travel, which the reference moves a little apart.
 * `hurry` above 1 plays the same move faster from the same start; a narrow
 * screen needs that to keep the letter being written in the frame.
 */
export function cameraAt(script: Script, t: number, hurry = 1): { shrink: number; travel: number } {
	if (!script.camera) return { shrink: 1, travel: 1 };
	const [start, end] = script.camera;
	const f = ((t - start) * hurry) / (end - start);
	return { shrink: table(SHRINK, f), travel: table(TRAVEL, f) };
}
