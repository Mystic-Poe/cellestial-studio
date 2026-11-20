// Where the stage sits in the viewport.
//
// The whole scene is laid out in the pixels of the wordmark picture (A4) and
// looked at through one camera: a scale and a shift, nothing else. Framing A
// is the C alone, large and centred; framing B is the finished word, centred.
// The C sprite is placed in wordmark pixels by EMBLEM_ON_WORDMARK, so the C
// that powers up at framing A is, to the pixel, the C of the word at B.
//
// The numbers in FRAME are repeated as CSS in src/components/scenes/Loader.astro,
// which puts the server-rendered C exactly where framing A draws it.

import { ASSETS } from '../assets';
import { EMBLEM_ON_WORDMARK as E, LETTERS } from './geometry';
import { cameraAt, lerp, type Script } from './timeline';

export const FRAME = {
	/** Framing A: the C is this much of the viewport's height (the reference: 871 of 1080)… */
	cHeight: 0.806,
	/** …but never more than this much of its width (a portrait phone). */
	cWidthMax: 0.62,
	/** Framing B: the word is this much of the viewport's width (the reference: 1660 of 1920)… */
	wordWidth: 0.866,
	/** …but never more than this much of its height (a landscape phone, an ultrawide). */
	wordHeightMax: 0.5,
	/** The C's middle, and the word's, sit this far down the viewport (the reference: 507 of 1080). */
	middle: 0.47,
} as const;

const C = ASSETS.loader.cLit.c;
const WORD = ASSETS.loader.wordmark.box;
/** The C's box in wordmark pixels. */
const C_LEFT = E.x + E.scale * C.x;
const C_WIDTH = E.scale * C.w;
const C_MIDDLE = E.y + E.scale * (C.y + C.h / 2);

export interface Layout {
	/** The overlay, in CSS pixels. */
	readonly w: number;
	readonly h: number;
	/** Canvas pixels per CSS pixel. */
	readonly dpr: number;
	/** CSS pixels per wordmark pixel at framing A and at framing B. */
	readonly kA: number;
	readonly kB: number;
	/** Where the C's left edge is on screen at each framing. */
	readonly leftA: number;
	readonly leftB: number;
	/** Where the C's middle is on screen, top to bottom. It never moves. */
	readonly cy: number;
	/** How much faster than the reference the camera has to pull back here (1 on a wide screen). */
	readonly hurry: number;
}

/** `screen = k * wordmark + (x, y)`, in CSS pixels. */
export interface Camera {
	readonly k: number;
	readonly x: number;
	readonly y: number;
}

export function camera(layout: Layout, at: { shrink: number; travel: number }): Camera {
	const k = lerp(layout.kA, layout.kB, at.shrink);
	const left = lerp(layout.leftA, layout.leftB, at.travel);
	return { k, x: left - C_LEFT * k, y: layout.cy - C_MIDDLE * k };
}

/** How far right the writing of letter `index` has reached at progress `w`, in wordmark pixels. */
function frontier(index: number, w: number): number {
	const letter = LETTERS[index];
	let right = letter.start.x;
	for (const line of letter.lines) {
		for (let i = 0; i < line.length; i += 3) {
			if (line[i + 2] > w) {
				if (i > 0) {
					const f = (w - line[i - 1]) / (line[i + 2] - line[i - 1]);
					right = Math.max(right, lerp(line[i - 3], line[i], f));
				}
				break;
			}
			right = Math.max(right, line[i]);
		}
	}
	for (const ring of letter.rings) if (ring.at <= w) right = Math.max(right, ring.x + ring.r);
	return right;
}

/**
 * The reference is 16:9 and writes to the right of a camera that is still
 * close in. On a narrow screen the same camera would let the letter being
 * written run off the edge, so here it makes the same move sooner: the
 * smallest speed-up that keeps the writing and its glow inside the frame.
 */
function hurryFor(script: Script, base: Omit<Layout, 'hurry'>): number {
	if (!script.camera) return 1;
	const margin = 30;
	for (let hurry = 1; hurry < 3; hurry += 0.05) {
		const layout = { ...base, hurry };
		let fits = true;
		for (let j = 0; j < script.letters.length && fits; j++) {
			const [start, end] = script.letters[j];
			for (let i = 0; i <= 8 && fits; i++) {
				const cam = camera(layout, cameraAt(script, lerp(start, end, i / 8) - 0.05, hurry));
				fits = cam.x + (frontier(j, i / 8) + margin) * cam.k <= base.w - 2;
			}
		}
		if (fits) return hurry;
	}
	return 3;
}

export function layoutFor(script: Script, w: number, h: number, dpr: number): Layout {
	const kA = Math.min((FRAME.cHeight * h) / C.h, (FRAME.cWidthMax * w) / C.w) / E.scale;
	const kB = Math.min((FRAME.wordWidth * w) / WORD.w, (FRAME.wordHeightMax * h) / WORD.h);
	const base = {
		w,
		h,
		dpr,
		kA,
		kB,
		leftA: w / 2 - (C_WIDTH / 2) * kA,
		leftB: w / 2 + (C_LEFT - (WORD.x + WORD.w / 2)) * kB,
		cy: FRAME.middle * h,
	};
	return { ...base, hurry: hurryFor(script, base) };
}
