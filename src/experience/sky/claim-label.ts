// Where the words "claim yours" stand by their star (B9). Under it: that is
// where a visitor looks for them, and where they stand whenever that place is
// free. The figures are real star patterns and their stars stand close, so
// the place under a star is often another star's: the words then give way to
// the star, as they do to a meaning's words (B7; "the Lamb claim yours" must
// never be read as one line), and stand beside their own star instead.
//
// The places, in the order they are tried (`LABEL_SPOTS`): under the star, to
// its right, to its left, above it; the four corners (under right, under
// left, above right, above left); and then the places between those, the
// words slid along the star's edge (under or above it but 24 or 48 px to one
// side; right or left of it but 12 px down or up). Every one is tight to the
// star, the same 7 px from it, so that the words read as that star's and no
// neighbour's.
//
// NEVER, in any place: across Cellestial's star or inside the reach of its
// turning rings; within 40 px of a meaning's words; outside the screen, or
// with their letters nearer than 16 px to its left or right side; on the
// logo, the menu or the exit button. A star with no place that keeps all of
// that is shown without the words, and is not offered by a tap.
//
// FREE is a place that keeps all of that and whose box stands 4 px clear of
// the disc of every other star that is drawn. The far figures' POINTS (a
// disc 6 px across or less: the figures three and more stations on, and the
// faintest stars of the two before them) are counted by what the words cover
// of them, and a place may cover as much as ONE such point: a dim dot behind
// a letter does not by itself drive the words from under their star, where a
// visitor expects them; a star's disc does. The words take the first free
// place. Where no place is free (a star in a knot of its figure; a far
// figure, small in the middle of the screen, which is a crowd of points) they
// take the place that takes least of the stars, by area: of each star, what
// the words would cover of its disc and of the 4 px of air round it, so that
// a far point counts for little and a near star's disc for much, and words
// jammed against a star count for something; under the star is forgiven one
// point there too.
//
// Once in a place the words stay there while it will still do: a place is
// TAKEN with 4 px of air round every star and LEFT only when the words there
// cover more of the stars than one far point, or a rule above is broken; and
// where no place is free, only for a place that covers less than half as much.
//
// WHILE THE SKY MOVES (the Home key's glide is the one flight a visitor can
// make with the words showing: up to six stations in three seconds, the
// figures in between sweeping across the screen) the words keep the place
// they have, whatever star passes through it: to dodge each would flick them
// from side to side four times a second. They leave it in flight only for
// what they must never cross (the list above), and when the sky comes to rest
// they are placed again by the whole rule.
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
	/** Cellestial's star, as the full reach of its turning rings: the words are never written across it. */
	rings?: boolean;
}

export type LabelSide =
	| 'under'
	| 'right'
	| 'left'
	| 'above'
	| 'under-right'
	| 'under-left'
	| 'above-right'
	| 'above-left';

/**
 * A place by a star: the side, and how far the words are slid along the star's edge from
 * the middle of that side, px (to the right under or above the star, downwards to its
 * right or left; a corner has no slide).
 */
export interface LabelSpot {
	side: LabelSide;
	slide: number;
}

/** The sides and corners, in the order they are tried. */
export const LABEL_SIDES: readonly LabelSide[] = [
	'under',
	'right',
	'left',
	'above',
	'under-right',
	'under-left',
	'above-right',
	'above-left',
];

/** Every place, in the order it is tried: the sides and corners, then the places between them. */
export const LABEL_SPOTS: readonly LabelSpot[] = [
	...LABEL_SIDES.map((side) => ({ side, slide: 0 })),
	...[24, -24, 48, -48].map((slide) => ({ side: 'under' as const, slide })),
	...[12, -12].map((slide) => ({ side: 'right' as const, slide })),
	...[12, -12].map((slide) => ({ side: 'left' as const, slide })),
	...[24, -24, 48, -48].map((slide) => ({ side: 'above' as const, slide })),
];

/**
 * The words as the stylesheet makes them (`.sky-claim`: 13 px type, 4 px by 8 px of
 * padding): half their box's width and its height; the gap between the star and the box;
 * how far the box stays from a meaning's words; the air kept from the screen's top and
 * bottom; how far the box stays from the screen's left and right sides (its letters are
 * 8 px inside it: 16 px from the side); the air round another star's disc when a place is
 * taken; the radius of the largest disc that is a far figure's point and not a star; what
 * a place may cover of such points and still be free, px² (one whole point: 28 px²), which
 * is also how much of the stars words that have a place may come to cover before they
 * leave it, and what the place under the star is forgiven when no place is free; and how
 * far in the middle of the words is held from a side of the screen when they stand under
 * or above their star.
 */
export const LABEL = {
	half: 48,
	height: 24,
	gap: 7,
	clear: 40,
	edge: 4,
	inset: 8,
	star: 4,
	dot: 3,
	point: 30,
	hold: 56,
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
	/** Every star that is drawn, the words' own among them (it is skipped), and Cellestial's star as the reach of its rings. */
	stars: () => readonly Disc[];
}

export interface LabelPlace extends LabelSpot {
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

/** How far a box stands from a disc's edge: negative when it reaches into the disc. */
export function discGap(box: Box, s: Disc): number {
	return (
		Math.hypot(Math.max(box.x0 - s.x, 0, s.x - box.x1), Math.max(box.y0 - s.y, 0, s.y - box.y1)) -
		s.r
	);
}

/**
 * How much of a disc a box covers, px²: the part of the disc beyond the edge of the box
 * that is nearest its centre (all of it once it lies wholly inside). 0 if they do not touch.
 */
export function discCover(box: Box, s: Disc): number {
	const dx = Math.max(box.x0 - s.x, 0, s.x - box.x1);
	const dy = Math.max(box.y0 - s.y, 0, s.y - box.y1);
	// The centre's distance from the box: negative when it is inside.
	const d =
		dx > 0 || dy > 0
			? Math.hypot(dx, dy)
			: -Math.min(s.x - box.x0, box.x1 - s.x, s.y - box.y0, box.y1 - s.y);
	if (d >= s.r) return 0;
	if (d <= -s.r) return Math.PI * s.r * s.r;
	return s.r * s.r * Math.acos(d / s.r) - d * Math.sqrt(s.r * s.r - d * d);
}

/** The words in one place by a star. */
export function labelAt(star: Disc, side: LabelSide, w: number, slide = 0): LabelPlace {
	const reach = star.r * 1.1 + LABEL.gap;
	let x = star.x;
	let y = star.y - LABEL.height / 2;
	if (side === 'under' || side === 'above') {
		// Over the star's centre; beside a screen edge, only as far in as keeps the letters 16 px from it.
		x = clamp(star.x + slide, LABEL.hold, w - LABEL.hold);
		y = side === 'under' ? star.y + reach : star.y - reach - LABEL.height;
	} else if (side === 'right' || side === 'left') {
		x = side === 'right' ? star.x + reach + LABEL.half : star.x - reach - LABEL.half;
		y += slide;
	} else {
		// A corner: the box's own corner on the star's diagonal, as far from the disc as the sides are.
		const d = reach * Math.SQRT1_2;
		x = side.endsWith('right') ? star.x + d + LABEL.half : star.x - d - LABEL.half;
		y = side.startsWith('under') ? star.y + d : star.y - d - LABEL.height;
	}
	return {
		side,
		slide,
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

/** True if this is the words' own star. */
const own = (s: Disc, star: Disc): boolean => Math.hypot(s.x - star.x, s.y - star.y) < 0.5;

/** True if the words may stand here at all: what is never done, in any place. */
function allowed(box: Box, star: Disc, scene: LabelScene): boolean {
	if (box.x0 < LABEL.inset || box.x1 > scene.w - LABEL.inset) return false;
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
		if (s.rings && !own(s, star) && discGap(box, s) < 0) return false;
	}
	return true;
}

/**
 * What the words in a place take of the other stars, px²: of a star, what the box covers of
 * its disc and of the 4 px of air round it; of a far figure's point, what it covers of the
 * point. A place that takes nothing of the stars and no more than one point is free.
 */
function taken(box: Box, star: Disc, scene: LabelScene): { stars: number; points: number } {
	let stars = 0;
	let points = 0;
	for (const s of scene.stars()) {
		if (own(s, star)) continue;
		if (s.rings || s.r > LABEL.dot) {
			stars += discCover(box, { x: s.x, y: s.y, r: s.r + LABEL.star });
		} else points += discCover(box, s);
	}
	return { stars, points };
}

/** How much of the other stars the box covers, px². */
function covered(box: Box, star: Disc, scene: LabelScene): number {
	let sum = 0;
	for (const s of scene.stars()) {
		if (!own(s, star)) sum += discCover(box, s);
	}
	return sum;
}

/**
 * WHICH STAR A TOUCH OFFERS is not this file's to change, and round 4 did not change it. Until
 * round 4 a star was offered when the words had a place by it under the rule of round 3: under
 * the star, 40 px from every meaning (nothing else was asked of that place, and its middle was
 * held 48 px from a side of the screen); or else above it, to its right or to its left, inside
 * the screen by 4 px, off the logo, the menu and the exit button, 40 px from every meaning and
 * 2 px off every other star. This is that question, kept as it was, so that a tap offers the
 * star it offered before: a star that had no place then is not offered now because the words
 * have more places to go. (A star they could not be written by without crossing Cellestial's
 * star is no longer offered: `placeLabel` is asked as well.)
 */
export function hadPlace(star: Disc, scene: LabelScene): boolean {
	const reach = star.r * 1.1 + LABEL.gap;
	const at = (x: number, y: number): Box => ({
		x0: x - LABEL.half,
		y0: y,
		x1: x + LABEL.half,
		y1: y + LABEL.height,
	});
	const held = clamp(star.x, LABEL.half, scene.w - LABEL.half);
	if (clearOfMeanings(at(held, star.y + reach), scene.meanings)) return true;
	const mid = star.y - LABEL.height / 2;
	const beside = [
		at(held, star.y - reach - LABEL.height),
		at(star.x + reach + LABEL.half, mid),
		at(star.x - reach - LABEL.half, mid),
	];
	const exit: Box = {
		x0: scene.w / 2 - EXIT_HALF,
		x1: scene.w / 2 + EXIT_HALF,
		y0: scene.h - B11.above - B11.height - LABEL.edge,
		y1: scene.h,
	};
	return beside.some((box) => {
		if (box.x0 < LABEL.edge || box.x1 > scene.w - LABEL.edge) return false;
		if (box.y0 < LABEL.edge || box.y1 > scene.h - LABEL.edge) return false;
		if (overlaps(box, CHROME) || overlaps(box, exit)) return false;
		if (!clearOfMeanings(box, scene.meanings)) return false;
		for (const s of scene.stars()) {
			if (!own(s, star) && discGap(box, s) < 2) return false;
		}
		return true;
	});
}

/**
 * Where the words stand by this star, or null if they can stand nowhere. `now` is the
 * place they have already: they stay in it while it will still do. `moving` is true while
 * the sky is in flight: the words then keep their place whatever star passes through it,
 * and leave it only for what they must never cross.
 */
export function placeLabel(
	star: Disc,
	scene: LabelScene,
	now: LabelSpot | LabelSide | null = null,
	moving = false,
): LabelPlace | null {
	const held: LabelSpot | null = typeof now === 'string' ? { side: now, slide: 0 } : now;
	if (held) {
		const stay = labelAt(star, held.side, scene.w, held.slide);
		if (allowed(stay.box, star, scene)) {
			if (moving || covered(stay.box, star, scene) <= LABEL.point) return stay;
		}
	}
	// The first place that is free.
	const open: { place: LabelPlace; cost: number }[] = [];
	for (const spot of LABEL_SPOTS) {
		const place = labelAt(star, spot.side, scene.w, spot.slide);
		if (!allowed(place.box, star, scene)) continue;
		const t = taken(place.box, star, scene);
		if (t.stars === 0 && t.points <= LABEL.point) return place;
		open.push({ place, cost: t.stars + t.points });
	}
	// None is: the one that takes least. Under the star is forgiven a far point; the place
	// the words have is left only for one that takes less than half as much.
	let best: LabelPlace | null = null;
	let least = Number.POSITIVE_INFINITY;
	for (const { place, cost: full } of open) {
		const stays = held !== null && place.side === held.side && place.slide === held.slide;
		let cost = stays ? full / 2 : full;
		if (place.side === 'under' && place.slide === 0) cost -= LABEL.point;
		if (cost < least) {
			least = cost;
			best = place;
		}
	}
	return best;
}
