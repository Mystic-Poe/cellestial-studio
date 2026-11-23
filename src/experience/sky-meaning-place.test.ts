// B7 and B9, where the words stand: which placing a screen gets (meaning.ts) and where
// "claim yours" goes when a meaning's words are near, or another star, or Cellestial's
// (claim-label.ts). The search itself measures the words in the page; its proof is
// refs/verification/round-3/tools/b7.mjs, and for the stars refs/verification/round-4/tools/.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	type Box,
	boxGap,
	type Disc,
	discCover,
	discGap,
	hadPlace,
	LABEL,
	LABEL_SPOTS,
	type LabelScene,
	type LabelSide,
	labelAt,
	placeLabel,
} from './sky/claim-label.ts';
import { placingFor, seenAt } from './sky/meaning.ts';

const SIDES = [
	[844, 390],
	[667, 375],
	[740, 360],
	[932, 430],
	[896, 414],
	[568, 320],
] as const;

test('a phone held on its side is placed for the hand, whatever its width', () => {
	for (const [w, h] of SIDES) {
		const { kind, by } = placingFor(w, h);
		assert.equal(kind, 'side', `${w}x${h}`);
		assert.ok(by);
		// The type is capped: 24 px at most, and 22 is tried; never the desktop's 34 or 54.
		assert.equal(Math.max(...by.sizes), 24, `${w}x${h}`);
		assert.ok(by.sizes.includes(22));
		assert.equal(Math.min(...by.sizes), 18);
		// Scored as on the phone: the far figures' points are stars, they do not yield.
		assert.equal(by.farYields, false);
		assert.equal(by.far, 4);
		assert.equal(by.least, placingFor(390, 844).by?.least);
		assert.equal(by.air, placingFor(390, 844).by?.air);
		assert.equal(by.exit, placingFor(390, 844).by?.exit);
	}
});

test('the desktop and the upright phone keep their placing, number for number', () => {
	const desk = placingFor(1440, 900);
	assert.equal(desk.kind, 'wide');
	assert.deepEqual(desk.by?.sizes, [54, 50, 46, 42, 38, 34]);
	assert.deepEqual(desk.by?.passes, [[1]]);
	assert.equal(desk.by?.tight, false);
	assert.equal(desk.by?.into, 24);
	assert.equal(placingFor(1024, 768).kind, 'wide');
	assert.equal(placingFor(1280, 560).kind, 'wide');
	for (const [w, h] of [
		[390, 844],
		[360, 740],
		[375, 667],
		[360, 640],
		[320, 568],
		[720, 1280],
	] as const) {
		const { kind, by } = placingFor(w, h);
		assert.equal(kind, 'tall', `${w}x${h}`);
		assert.deepEqual(by?.sizes, [24, 22, 21, 20, 18]);
		assert.equal(by?.into, 24);
		assert.equal(by?.far, 3);
	}
	assert.equal(placingFor(768, 1024).kind, 'band');
});

test('one row or two at every size before three; then a place that touches nothing; 18 px the least', () => {
	for (const [w, h] of [
		[375, 667],
		[844, 390],
	] as const) {
		const { by } = placingFor(w, h);
		assert.ok(by);
		// The first pass is what the search always was, so what it found before it finds again.
		assert.deepEqual(by.passes, [[1, 2], [3]]);
		assert.equal(by.tight, true);
		assert.equal(by.sizes.at(-1), 18);
		assert.deepEqual(
			[...by.sizes].sort((a, b) => b - a),
			[...by.sizes],
		);
	}
});

// ── "claim yours" ──

const scene = (meanings: Box[], stars: Disc[] = [], w = 1440, h = 900): LabelScene => ({
	w,
	h,
	meanings,
	stars: () => stars,
});
const gapTo = (place: { box: Box }, m: Box) => boxGap(place.box, m);

test("on a phone on its side the next figure's words wait until their figure is near", () => {
	// The next figure stands at 0.51 to 0.53 of its station size when the visitor is at a
	// station there (measured in the page at the four sizes): its words are not shown yet.
	for (const [w, h] of SIDES) {
		for (const rel of [0.36, 0.44, 0.51, 0.53]) {
			assert.equal(seenAt(rel, h), 0, `${w}x${h}, the next figure at ${rel} of its size`);
		}
		assert.equal(seenAt(1, h), 1, `${w}x${h}: at the station the words are whole`);
		assert.equal(seenAt(0.94, h), 1, `${w}x${h}: and where the writing may begin`);
		assert.ok(seenAt(0.7, h) > 0 && seenAt(0.7, h) < 1, `${w}x${h}: they come as the figure nears`);
		assert.equal(seenAt(2.4, h), 0, `${w}x${h}: and are gone behind the visitor as on any screen`);
	}
	// Every other screen sees them as it did: from 0.32 of the station size, whole at 0.7.
	const before = (rel: number): number => {
		const s = (a: number, b: number, x: number): number => {
			const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
			return t * t * (3 - 2 * t);
		};
		return s(0.32, 0.7, rel) * (1 - s(1.5, 2.4, rel));
	};
	for (const h of [450, 568, 667, 740, 844, 900, 1080]) {
		for (const rel of [0.2, 0.32, 0.38, 0.44, 0.53, 0.7, 1, 1.5, 1.9, 2.4, 3]) {
			assert.equal(seenAt(rel, h), before(rel), `${h} px high, ${rel}`);
		}
	}
});

test('with nothing near, the words stand under their star, where they always stood', () => {
	const star = { x: 700, y: 400, r: 10 };
	const place = placeLabel(star, scene([]));
	assert.equal(place?.side, 'under');
	assert.equal(place?.slide, 0);
	assert.equal(place?.x, 700);
	assert.equal(place?.y, 400 + 10 * 1.1 + 7);
	// A meaning 40 px away or more changes nothing; nor does a star that the words stand 4 px clear of.
	const far: Box = { x0: 700 - 48 - 40 - 300, y0: 418, x1: 700 - 48 - 40, y1: 488 };
	const beside = [star, { x: 700, y: 418 + 24 + 4 + 12, r: 12 }];
	assert.equal(placeLabel(star, scene([far], beside))?.side, 'under');
	// Beside a screen edge they are held in: the box 8 px inside, so that the letters are 16.
	// (Round 4: it was the box AT the edge, its middle 48 px in.)
	assert.equal(placeLabel({ x: 10, y: 400, r: 10 }, scene([]))?.x, 56);
	assert.equal(placeLabel({ x: 1435, y: 400, r: 10 }, scene([]))?.x, 1440 - 56);
	assert.equal(LABEL.hold - LABEL.half, 8);
});

test('Aries and Taurus on the desktop, as the third look measured them: the words leave the line', () => {
	// f8.mjs, tap 3 and tap 1: the label's box (96x24) and the meaning's box.
	for (const [label, meaning] of [
		[
			{ x: 775, y: 571 },
			{ x0: 516, y0: 563, x1: 778, y1: 633 },
		],
		[
			{ x: 709, y: 566 },
			{ x0: 196, y0: 560, x1: 711, y1: 630 },
		],
		[
			{ x: 722, y: 528 },
			{ x0: 516, y0: 563, x1: 778, y1: 633 },
		],
		[
			{ x: 624, y: 526 },
			{ x0: 196, y0: 560, x1: 711, y1: 630 },
		],
	] as const) {
		// A far figure's point, 4 px in radius, with its words where the page had them.
		const r = 4;
		const star = { x: label.x + 48, y: label.y - r * 1.1 - 7, r };
		const was = labelAt(star, 'under', 1440);
		assert.ok(Math.abs(was.box.x0 - label.x) < 1e-9 && Math.abs(was.box.y0 - label.y) < 1e-9);
		assert.ok(gapTo(was, meaning) < 12, 'the fault: under the star is beside the meaning');
		const place = placeLabel(star, scene([meaning]));
		assert.ok(place);
		assert.notEqual(place.side, 'under');
		assert.ok(gapTo(place, meaning) >= LABEL.clear, `${place.side}: ${gapTo(place, meaning)}`);
	}
});

test('a meaning under the star: the other places in order, each off every star', () => {
	const star = { x: 700, y: 400, r: 10 };
	// A meaning just under the star: to the right is clear. (Round 3 tried above first; round 4
	// has one order for a meaning and for a star: right, left, above, then the corners.)
	const below: Box = { x0: 500, y0: 455, x1: 900, y1: 525 };
	assert.equal(placeLabel(star, scene([below]))?.side, 'right');
	// A star where the words would stand on the right: then to the left.
	const right = [star, { x: 760, y: 400, r: 6 }];
	assert.equal(placeLabel(star, scene([below], right))?.side, 'left');
	// And one to the left as well: above.
	const both = [...right, { x: 640, y: 400, r: 6 }];
	assert.equal(placeLabel(star, scene([below], both))?.side, 'above');
	// Meanings round every side: no words (the star is not offered).
	assert.equal(placeLabel(star, scene([{ x0: 600, y0: 300, x1: 800, y1: 500 }])), null);
	// Above would leave the screen's top; right would leave its side.
	const top = { x: 1400, y: 20, r: 10 };
	const under: Box = { x0: 1200, y0: 80, x1: 1440, y1: 150 };
	const place = placeLabel(top, scene([under]));
	assert.equal(place?.side, 'left');
	assert.ok(place && place.box.x0 >= 8 && place.box.y0 >= 4);
	// The logo and the menu.
	const nearLogo = { x: 150, y: 110, r: 8 };
	const m: Box = { x0: 100, y0: 165, x1: 400, y1: 215 };
	const p = placeLabel(nearLogo, scene([m]));
	assert.ok(p === null || p.box.x0 >= 126 || p.box.y0 >= 98, 'never over the logo or the menu');
	assert.equal(p?.side, 'right');
	// The exit button (1440x900: x 584..856, y 816..868).
	const low = { x: 720, y: 800, r: 8 };
	const beside: Box = { x0: 760, y0: 815, x1: 1100, y1: 885 };
	const q = placeLabel(low, scene([beside]));
	assert.ok(q);
	assert.ok(q.box.y1 <= 900 - 84 - 4 || q.box.x1 <= 576 || q.box.x0 >= 864);
	assert.ok(gapTo(q, beside) >= LABEL.clear);
});

test('once in a place, the words stay there while it will do', () => {
	const star = { x: 700, y: 400, r: 10 };
	const below: Box = { x0: 500, y0: 455, x1: 900, y1: 525 };
	assert.equal(placeLabel(star, scene([below]), 'right')?.side, 'right');
	// The meaning gone: still to the right, not back and forth.
	assert.equal(placeLabel(star, scene([]), 'right')?.side, 'right');
	// The place no longer free (a star stands in it): the first that is.
	assert.equal(
		placeLabel(star, scene([below], [star, { x: 760, y: 400, r: 6 }]), 'right')?.side,
		'left',
	);
	// Under, with a meaning come near: it moves.
	assert.equal(placeLabel(star, scene([below]), 'under')?.side, 'right');
	// A place between the sides is held the same way.
	const held = placeLabel(star, scene([]), { side: 'under', slide: 24 });
	assert.deepEqual([held?.side, held?.slide, held?.x], ['under', 24, 724]);
});

test('which star a touch offers is asked as round 3 asked it', () => {
	const star = { x: 700, y: 400, r: 10 };
	// No meaning near: a place under the star, whatever stands there (as before round 4).
	assert.equal(hadPlace(star, scene([], [star, { x: 700, y: 430, r: 12 }])), true);
	// A meaning under it: above is clear.
	const below: Box = { x0: 500, y0: 455, x1: 900, y1: 525 };
	assert.equal(hadPlace(star, scene([below])), true);
	// Stars above it, to its right and to its left: it had no place, and was not offered.
	const round = [
		star,
		{ x: 700, y: 366, r: 6 },
		{ x: 760, y: 400, r: 6 },
		{ x: 640, y: 400, r: 6 },
	];
	assert.equal(hadPlace(star, scene([below], round)), false);
	// The words have a place by it now (a corner), but a touch does not offer it for that.
	const now = placeLabel(star, scene([below], round));
	assert.ok(now && now.side !== 'under');
	// Meanings round every side: none, then and now.
	const all: Box = { x0: 600, y0: 300, x1: 800, y1: 500 };
	assert.equal(hadPlace(star, scene([all])), false);
	assert.equal(placeLabel(star, scene([all])), null);
	// 2 px off a star was enough beside it, and the box might stand at the screen's edge.
	assert.equal(
		hadPlace(star, scene([below], [star, { x: 700, y: 400 - 21 - 24 - 2.5 - 6, r: 6 }])),
		true,
	);
	assert.equal(hadPlace({ x: 10, y: 400, r: 10 }, scene([])), true);
});

// ── round 4: "claim yours" and the stars ──

/** The words' box under a star at 700,400 of radius 10: x 652..748, y 418..442. */
const STAR = { x: 700, y: 400, r: 10 };
/** A knot round that star: twelve neighbours on a ring 46 px out, of 4 to 10 px, and six on one 100 px out. */
const KNOT: Disc[] = [
	...[7, 5, 9, 4, 8, 6, 10, 5, 7, 4, 9, 6].map((r, i) => ({
		x: 700 + 46 * Math.cos((i * Math.PI) / 6),
		y: 400 + 46 * Math.sin((i * Math.PI) / 6),
		r,
	})),
	...[8, 6, 9, 7, 5, 8].map((r, i) => ({
		x: 700 + 100 * Math.cos((i * Math.PI) / 3 + 0.4),
		y: 400 + 34 * Math.sin((i * Math.PI) / 3 + 0.4),
		r,
	})),
];
const touches = (place: { box: Box }, s: Disc) => discGap(place.box, s) < 0;
/** What a box takes of some stars, counted apart from the rule: each disc with 4 px of air round it. */
const took = (box: Box, stars: Disc[]) =>
	stars.reduce((sum, s) => sum + discCover(box, { ...s, r: s.r + LABEL.star }), 0);

test("under its star is another star's disc: the words go to the first free place beside it", () => {
	// A neighbour straight under the star, as in a real figure: the old rule wrote across it.
	const under = { x: 700, y: 440, r: 6 };
	assert.ok(
		touches(labelAt(STAR, 'under', 1440), under),
		'the fault: under the star is on the disc',
	);
	const order: string[] = [];
	const crowd: Disc[] = [STAR, under];
	// Each place taken is then filled with a star, and the next is asked for.
	for (let n = 0; n < LABEL_SPOTS.length - 1; n++) {
		const place = placeLabel(STAR, scene([], crowd));
		assert.ok(place);
		for (const s of crowd) {
			if (s !== STAR) assert.ok(discGap(place.box, s) >= LABEL.star, `${place.side}: 4 px of air`);
		}
		order.push(place.slide ? `${place.side} ${place.slide}` : place.side);
		if (order.length === 7) break;
		crowd.push({ x: place.x, y: place.y + 12, r: 4 });
	}
	assert.deepEqual(order, [
		'right',
		'left',
		'above',
		'under-right',
		'under-left',
		'above-right',
		'above-left',
	]);
	// Every place is tight to its own star: the box 7 px from the disc as drawn large (r * 1.1).
	for (const spot of LABEL_SPOTS) {
		const { box } = labelAt(STAR, spot.side, 1440, spot.slide);
		assert.ok(Math.abs(discGap(box, { ...STAR, r: STAR.r * 1.1 }) - LABEL.gap) < 1e-9, spot.side);
	}
});

test('the places between the sides, when no side or corner is free', () => {
	// A star at the right of the phone, its neighbour above it (Virgo at 390x844, slot-53 by
	// Cellestial's star): the side and the corners on the right are off the screen.
	const star = { x: 110, y: 388, r: 13 };
	const rings = { x: 195, y: 422, r: 48.5, rings: true };
	const neighbour = { x: 156, y: 355, r: 13 };
	const place = placeLabel(star, scene([], [star, rings, neighbour], 390, 844));
	assert.ok(place);
	assert.equal(discGap(place.box, rings) >= LABEL.star, true);
	assert.equal(discGap(place.box, neighbour) >= LABEL.star, true);
	assert.ok(place.box.x0 >= 8);
	// It is under its star still, slid to the left off the rings.
	assert.deepEqual([place.side, place.slide], ['under', -24]);
});

test('4 px of air round a disc to take a place', () => {
	const box = labelAt(STAR, 'under', 1440).box;
	// A disc of radius 6 whose edge is 3 px under the box, then 4.5 px.
	const near = { x: 700, y: box.y1 + 3 + 6, r: 6 };
	const clear = { x: 700, y: box.y1 + 4.5 + 6, r: 6 };
	assert.equal(placeLabel(STAR, scene([], [STAR, near]))?.side, 'right');
	assert.equal(placeLabel(STAR, scene([], [STAR, clear]))?.side, 'under');
	assert.equal(LABEL.star, 4);
});

test("Cellestial's star is never crossed, to the full reach of its rings", () => {
	// Virgo at 1440x900: the rings reach 100 px from 720,450. A star just outside them, above.
	const rings = { x: 720, y: 450, r: 100, rings: true };
	const star = { x: 720, y: 330, r: 12 };
	assert.ok(
		touches(labelAt(star, 'under', 1440), rings),
		'the fault: under the star is in the rings',
	);
	const place = placeLabel(star, scene([], [star, rings]));
	assert.ok(place);
	assert.ok(discGap(place.box, rings) >= LABEL.star, `${place.side}`);
	// A far star BEHIND Cellestial's star (Virgo complete, slot-25): every place is in the
	// rings' reach: no words, so the star is not offered.
	const behind = { x: 783, y: 415, r: 4 };
	assert.equal(placeLabel(behind, scene([], [behind, rings])), null);
	// Not where the words are already, either.
	assert.equal(placeLabel(behind, scene([], [behind, rings]), 'under'), null);
	// Where no place is free of every star, the least cover is never a place in the rings:
	// a crowd on every side but under, where only the rings are.
	const edge = { x: 720, y: 338, r: 4 };
	const crowd: Disc[] = [edge, rings];
	for (const spot of LABEL_SPOTS) {
		const { box, x, y } = labelAt(edge, spot.side, 1440, spot.slide);
		if (discGap(box, rings) >= 0) crowd.push({ x, y: y + 12, r: 5 });
	}
	const least = placeLabel(edge, scene([], crowd));
	assert.ok(least);
	assert.ok(discGap(least.box, rings) >= 0);
	// The rings shown far off (Taurus: 8 px in the middle of the screen) are kept off the same way.
	const far = { x: 720, y: 449, r: 7.8, rings: true };
	const by = { x: 722, y: 420, r: 20 };
	const p = placeLabel(by, scene([], [by, far]));
	assert.ok(p && discGap(p.box, far) >= LABEL.star);
	assert.notEqual(p.side, 'under');
});

test('the letters 16 px inside the screen, on every side', () => {
	// 390x844. The letters are 8 px inside the box (the stylesheet's padding).
	for (const x of [4, 20, 60, 100, 195, 290, 330, 370, 386]) {
		for (const now of [null, ...LABEL_SPOTS]) {
			const star = { x, y: 400, r: 13 };
			const place = placeLabel(star, scene([], [star], 390, 844), now);
			assert.ok(place, `${x}`);
			assert.ok(place.box.x0 + 8 >= 16 && place.box.x1 - 8 <= 390 - 16, `${x} ${place.side}`);
		}
	}
	// A star at the left edge with a neighbour under it: not to its left.
	const star = { x: 30, y: 400, r: 13 };
	const place = placeLabel(star, scene([], [star, { x: 40, y: 440, r: 13 }], 390, 844));
	assert.equal(place?.side, 'right');
});

test('never off the screen, on the logo, the menu or the exit button: under the star too', () => {
	// Under this star the words would lie on the logo (16..118 by 12..90).
	const byLogo = { x: 150, y: 60, r: 10 };
	assert.ok(
		labelAt(byLogo, 'under', 1440).box.x0 < 118 && labelAt(byLogo, 'under', 1440).box.y0 < 90,
	);
	const p = placeLabel(byLogo, scene([]));
	assert.ok(p && (p.box.x0 >= 126 || p.box.y0 >= 98), `${p?.side}`);
	// And on the exit button (1440x900: x 584..856, y 816..868).
	const byExit = { x: 720, y: 790, r: 10 };
	const q = placeLabel(byExit, scene([]));
	assert.ok(q && (q.box.y1 <= 900 - 84 - 4 || q.box.x1 <= 576 || q.box.x0 >= 864), `${q?.side}`);
	// At the foot of the screen: not below it.
	const low = { x: 300, y: 880, r: 10 };
	const r = placeLabel(low, scene([]));
	assert.ok(r && r.box.y1 <= 900 - 4, `${r?.side}`);
});

test('no place free of every star: the place that covers least', () => {
	// discCover: nothing when clear, the whole disc when inside, half when the edge runs through its centre.
	const box: Box = { x0: 0, y0: 0, x1: 96, y1: 24 };
	assert.equal(discCover(box, { x: 48, y: 40, r: 10 }), 0);
	assert.ok(Math.abs(discCover(box, { x: 48, y: 12, r: 3 }) - Math.PI * 9) < 1e-9);
	assert.ok(Math.abs(discCover(box, { x: 48, y: 24, r: 10 }) - Math.PI * 50) < 1e-9);
	// A star in a knot of its figure: its neighbours stand all round it and no place is free.
	// What is chosen is what an independent count gives: the place that takes least of the
	// stars, each star's disc counted with the 4 px of air round it.
	const knot: Disc[] = [STAR, ...KNOT];
	const takes = LABEL_SPOTS.map((spot) => {
		const { box } = labelAt(STAR, spot.side, 1440, spot.slide);
		assert.ok(
			KNOT.some((s) => discGap(box, s) < LABEL.star),
			'the knot leaves no place free',
		);
		return took(box, KNOT);
	});
	// (Under the star is forgiven one point's worth; it takes far more than that here.)
	const costs = takes.map((c, i) => (i === 0 ? c - LABEL.point : c));
	const least = LABEL_SPOTS[costs.indexOf(Math.min(...costs))];
	const place = placeLabel(STAR, scene([], knot));
	assert.deepEqual([place?.side, place?.slide], [least?.side, least?.slide]);
	// Under the star is a near star's disc there (the old rule's place): the words are not under it.
	assert.ok((takes[0] as number) > 100 && place?.side !== 'under');
	// Of two places that touch nothing, the one with more room, whatever their order: to the
	// right the words would be jammed against a star (1 px from it); to the left they are 3 px
	// from one.
	const jam = [
		STAR,
		{ x: 776, y: 412 + 1 + 9, r: 9 },
		{ x: 624, y: 412 + 3 + 9, r: 9 },
		...[
			[700, 430],
			[700, 370],
			[650, 436],
			[750, 436],
			[650, 364],
			[750, 364],
		].map(([x, y]) => ({ x: x as number, y: y as number, r: 9 })),
	];
	const right = labelAt(STAR, 'right', 1440).box;
	const left = labelAt(STAR, 'left', 1440).box;
	assert.ok(jam.every((q) => q === STAR || (discGap(right, q) >= 0 && discGap(left, q) >= 0)));
	assert.equal(placeLabel(STAR, scene([], jam))?.side, 'left');
});

test("the far figures' points: one does not drive the words from under their star", () => {
	// Cancer at 1440x900, slot-91: a point 5.6 px across of a figure three stations on lies
	// under the star, where the words go. It is behind a letter; the words stay.
	const dot = { x: 690, y: 430, r: 2.8 };
	assert.ok(discCover(labelAt(STAR, 'under', 1440).box, dot) > 24);
	assert.equal(placeLabel(STAR, scene([], [STAR, dot]))?.side, 'under');
	// A point is counted by what is covered of it: one beside the words is nothing.
	assert.equal(placeLabel(STAR, scene([], [STAR, { x: 700, y: 444, r: 1.5 }]))?.side, 'under');
	// Two such points under the star are more than one point's worth: the words go beside it.
	const two = [dot, { x: 720, y: 430, r: 2.8 }];
	assert.equal(placeLabel(STAR, scene([], [STAR, ...two]))?.side, 'right');
	// A disc 7 px across is a star, not a point: 4 px of air.
	assert.equal(placeLabel(STAR, scene([], [STAR, { x: 690, y: 430, r: 3.5 }]))?.side, 'right');
	assert.ok(Math.PI * LABEL.dot * LABEL.dot <= LABEL.point, 'one whole point is forgiven');
	// Where no place is free: a larger star in every place but under the star, where two
	// points lie. The words stay under it: it covers least. A star's disc there, and they do not.
	const round = (r: number): Disc[] => [
		{ x: 760, y: 430, r },
		{ x: 640, y: 430, r },
		{ x: 776, y: 400, r },
		{ x: 624, y: 400, r },
		{ x: 760, y: 370, r },
		{ x: 640, y: 370, r },
		{ x: 700, y: 370, r },
	];
	const at = (crowd: Disc[]) => {
		for (const spot of LABEL_SPOTS) {
			const { box } = labelAt(STAR, spot.side, 1440, spot.slide);
			const points = crowd.filter((q) => q.r <= LABEL.dot);
			assert.ok(
				crowd.some((q) => q.r > LABEL.dot && discGap(box, q) < LABEL.star) ||
					points.reduce((sum, q) => sum + discCover(box, q), 0) > LABEL.point,
				`${spot.side} ${spot.slide} is not free`,
			);
		}
		const place = placeLabel(STAR, scene([], [STAR, ...crowd]));
		return place ? `${place.side} ${place.slide}` : null;
	};
	const under = [
		{ x: 690, y: 430, r: 2.8 },
		{ x: 710, y: 430, r: 2.8 },
	];
	assert.equal(at([...under, ...round(5)]), 'under 0');
	assert.notEqual(at([{ x: 700, y: 436, r: 12 }, ...round(5)]), 'under 0');
});

test('steady: a place is taken with 4 px of air and left only when a star is covered', () => {
	const box = labelAt(STAR, 'right', 1440).box;
	// The words stand to the right. A disc comes to 2 px from them, touches them, then
	// reaches 1 px into them: they stay (a place is not left for a nick).
	for (const gap of [2, 0, -1]) {
		const s = { x: box.x1 + gap + 8, y: 400, r: 8 };
		assert.equal(placeLabel(STAR, scene([], [STAR, s]), 'right')?.side, 'right', `${gap}`);
		// Words with no place yet would not take that one.
		assert.notEqual(placeLabel(STAR, scene([], [STAR, s]))?.side, gap < LABEL.star ? 'right' : '');
	}
	// The disc well into them: they leave, for the first free place.
	const deep = { x: box.x1 - 6, y: 400, r: 8 };
	assert.equal(placeLabel(STAR, scene([], [STAR, deep]), 'right')?.side, 'under');
	// A far point 2.5 px across drifting through the words never moves them.
	for (let x = box.x0 - 6; x <= box.x1 + 6; x += 3) {
		assert.equal(
			placeLabel(STAR, scene([], [STAR, { x, y: 400, r: 1.25 }]), 'right')?.side,
			'right',
		);
	}
	// Where no place is free (the knot): the words keep the place they have unless another
	// takes less than half as much; they never go there and back.
	const knot: Disc[] = [STAR, ...KNOT];
	const boxOf = (spot: { side: LabelSide; slide: number }) =>
		labelAt(STAR, spot.side, 1440, spot.slide).box;
	const same = (a: { side: LabelSide; slide: number }, b: { side: LabelSide; slide: number }) =>
		a.side === b.side && a.slide === b.slide;
	const first = placeLabel(STAR, scene([], knot));
	assert.ok(first);
	const best = took(boxOf(first), KNOT);
	let kept = 0;
	let left = 0;
	for (const spot of LABEL_SPOTS) {
		const after = placeLabel(STAR, scene([], knot), spot);
		assert.ok(after);
		const covers = KNOT.reduce((sum, s) => sum + discCover(boxOf(spot), s), 0);
		const half =
			took(boxOf(spot), KNOT) / 2 - (spot.side === 'under' && !spot.slide ? LABEL.point : 0);
		if (same(spot, first) || covers <= LABEL.point || half < best) {
			// It covers no more than a point, or the best place does not take half as little: they stay.
			assert.ok(same(after, spot), `${spot.side} ${spot.slide}: stays`);
			if (!same(spot, first)) kept++;
		} else if (half > best) {
			assert.ok(same(after, first), `${spot.side} ${spot.slide}: leaves for the best`);
			left++;
		}
		// And wherever they went, they stay there at the next frame.
		const again = placeLabel(STAR, scene([], knot), after);
		assert.ok(again && same(again, after));
	}
	assert.ok(kept > 0 && left > 0, `${kept} places kept beside the best, ${left} left`);
});
