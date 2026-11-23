// Where the words "claim yours" stand by their star (B9). Under it: that is
// where a visitor looks for them, and where they stand whenever nothing is in
// the way. Only when that place would bring them within 40 px of a meaning's
// words (B7; "the Lamb claim yours" must never be read as one line) do they
// go to another side of the star: above it, then to its right, then to its
// left, the first of those that is inside the screen, off the logo, the menu
// and the exit button, off every other star, and 40 px clear of every meaning.
// If no side will do, the star is shown without the words.
//
// Pure geometry in viewport pixels, so that it can be tested without a page:
// answer.ts measures the page and asks here.

import { B11 } from './config.ts';

export interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface Disc {
	x: number;
	y: number;
	r: number;
}

export type LabelSide = 'under' | 'above' | 'right' | 'left';

/** The sides, in the order they are tried. */
export const LABEL_SIDES: readonly LabelSide[] = ['under', 'above', 'right', 'left'];

/**
 * The words as the stylesheet makes them (`.sky-claim`: 13 px type, 4 px by 8 px of
 * padding): half their box's width and its height; the gap between the star and the box;
 * how far the box stays from a meaning's words; the air kept from the screen's edge and
 * from another star's disc; and how far in the middle of the words is held from a side
 * of the screen when they stand under or above their star.
 */
export const LABEL = {
	half: 48,
	height: 24,
	gap: 7,
	clear: 40,
	edge: 4,
	star: 2,
	hold: 48,
} as const;

/** The logo and the menu button (16..118 by 12..90 on every screen), with a little air. */
const CHROME: Box = { x0: 0, y0: 0, x1: 126, y1: 98 };
/** The exit button: half its width, with a little air (it is 271 px wide on every screen). */
const EXIT_HALF = 144;

export interface LabelScene {
	/** The screen. */
	w: number;
	h: number;
	/** The boxes of the meanings that are showing. */
	meanings: readonly Box[];
	/** Every star that is drawn, the words' own among them (it is skipped). Asked for only when 'under' will not do. */
	stars: () => readonly Disc[];
}

export interface LabelPlace {
	side: LabelSide;
	/** The middle of the words' box, and its top. */
	x: number;
	y: number;
	box: Box;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The distance between two boxes: 0 if they touch or overlap. */
export function boxGap(a: Box, b: Box): number {
	return Math.hypot(Math.max(a.x0 - b.x1, 0, b.x0 - a.x1), Math.max(a.y0 - b.y1, 0, b.y0 - a.y1));
}

const overlaps = (a: Box, b: Box): boolean =>
	a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** The words on one side of a star. */
export function labelAt(star: Disc, side: LabelSide, w: number): LabelPlace {
	const reach = star.r * 1.1 + LABEL.gap;
	let x = star.x;
	let y = star.y - LABEL.height / 2;
	if (side === 'under' || side === 'above') {
		// Over the star's centre; beside a screen edge, only as far in as keeps them whole.
		x = clamp(star.x, LABEL.hold, w - LABEL.hold);
		y = side === 'under' ? star.y + reach : star.y - reach - LABEL.height;
	} else {
		x = side === 'right' ? star.x + reach + LABEL.half : star.x - reach - LABEL.half;
	}
	return {
		side,
		x,
		y,
		box: { x0: x - LABEL.half, y0: y, x1: x + LABEL.half, y1: y + LABEL.height },
	};
}

/** True if the box is `LABEL.clear` from every meaning. */
export function clearOfMeanings(box: Box, meanings: readonly Box[]): boolean {
	for (const m of meanings) if (boxGap(box, m) < LABEL.clear) return false;
	return true;
}

/** True if words that leave their place under the star may stand here. */
function fits(place: LabelPlace, star: Disc, scene: LabelScene): boolean {
	const { box } = place;
	if (box.x0 < LABEL.edge || box.x1 > scene.w - LABEL.edge) return false;
	if (box.y0 < LABEL.edge || box.y1 > scene.h - LABEL.edge) return false;
	if (overlaps(box, CHROME)) return false;
	const exit: Box = {
		x0: scene.w / 2 - EXIT_HALF,
		x1: scene.w / 2 + EXIT_HALF,
		y0: scene.h - B11.above - B11.height - LABEL.edge,
		y1: scene.h,
	};
	if (overlaps(box, exit)) return false;
	if (!clearOfMeanings(box, scene.meanings)) return false;
	for (const s of scene.stars()) {
		// The words' own star.
		if (Math.hypot(s.x - star.x, s.y - star.y) < 0.5) continue;
		const d =
			Math.hypot(Math.max(box.x0 - s.x, 0, s.x - box.x1), Math.max(box.y0 - s.y, 0, s.y - box.y1)) -
			s.r;
		if (d < LABEL.star) return false;
	}
	return true;
}

/**
 * Where the words stand by this star, or null if they can stand nowhere. Under it unless a
 * meaning is within `LABEL.clear` of that place. `now` is the side they stand on already:
 * they stay there as long as it will do, so that a flight does not flick them from side to side.
 */
export function placeLabel(
	star: Disc,
	scene: LabelScene,
	now: LabelSide | null = null,
): LabelPlace | null {
	const under = labelAt(star, 'under', scene.w);
	const ok = (place: LabelPlace): boolean =>
		place.side === 'under' ? clearOfMeanings(place.box, scene.meanings) : fits(place, star, scene);
	if (now && now !== 'under') {
		const stay = labelAt(star, now, scene.w);
		if (ok(stay)) return stay;
	}
	if (ok(under)) return under;
	for (const side of LABEL_SIDES) {
		if (side === 'under' || side === now) continue;
		const place = labelAt(star, side, scene.w);
		if (ok(place)) return place;
	}
	return null;
}
