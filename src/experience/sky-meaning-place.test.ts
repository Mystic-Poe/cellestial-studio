// B7 and B9, where the words stand: which placing a screen gets (meaning.ts) and where
// "claim yours" goes when a meaning's words are near (claim-label.ts). The search itself
// measures the words in the page; its proof is refs/verification/round-3/tools/b7.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	type Box,
	boxGap,
	type Disc,
	LABEL,
	type LabelScene,
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

test('with no meaning near, the words stand under their star, where they always stood', () => {
	const star = { x: 700, y: 400, r: 10 };
	const place = placeLabel(star, scene([]));
	assert.equal(place?.side, 'under');
	assert.equal(place?.x, 700);
	assert.equal(place?.y, 400 + 10 * 1.1 + 7);
	// A meaning 40 px away or more changes nothing; nor does any star, the exit button or the chrome.
	const far: Box = { x0: 700 - 48 - 40 - 300, y0: 418, x1: 700 - 48 - 40, y1: 488 };
	const crowd = [{ x: 700, y: 430, r: 12 }];
	assert.equal(placeLabel(star, scene([far], crowd))?.side, 'under');
	// Beside a screen edge they are held in, as before.
	assert.equal(placeLabel({ x: 10, y: 400, r: 10 }, scene([]))?.x, 48);
	assert.equal(placeLabel({ x: 1435, y: 400, r: 10 }, scene([]))?.x, 1440 - 48);
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

test('the other sides in order; each inside the screen, off the chrome, the exit button and every star', () => {
	const star = { x: 700, y: 400, r: 10 };
	// A meaning just under the star: above is clear.
	const below: Box = { x0: 500, y0: 455, x1: 900, y1: 525 };
	assert.equal(placeLabel(star, scene([below]))?.side, 'above');
	// A star where the words would stand above: then to the right.
	const over = [star, { x: 700, y: 366, r: 6 }];
	assert.equal(placeLabel(star, scene([below], over))?.side, 'right');
	// And one to the right as well: to the left.
	const both = [...over, { x: 760, y: 400, r: 6 }];
	assert.equal(placeLabel(star, scene([below], both))?.side, 'left');
	// Stars on every side: no words (the star is not offered).
	assert.equal(placeLabel(star, scene([below], [...both, { x: 640, y: 400, r: 6 }])), null);
	// Meanings round every side: none.
	assert.equal(placeLabel(star, scene([{ x0: 600, y0: 300, x1: 800, y1: 500 }])), null);
	// Above would leave the screen's top; right would leave its side.
	const top = { x: 1400, y: 20, r: 10 };
	const under: Box = { x0: 1200, y0: 80, x1: 1440, y1: 150 };
	const place = placeLabel(top, scene([under]));
	assert.equal(place?.side, 'left');
	assert.ok(place && place.box.x0 >= 4 && place.box.y0 >= 4);
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

test('once on a side, the words stay there while it will do', () => {
	const star = { x: 700, y: 400, r: 10 };
	const below: Box = { x0: 500, y0: 455, x1: 900, y1: 525 };
	assert.equal(placeLabel(star, scene([below]), 'right')?.side, 'right');
	// The meaning gone: still to the right, not back and forth.
	assert.equal(placeLabel(star, scene([]), 'right')?.side, 'right');
	// The side no longer free: the first that is.
	assert.equal(
		placeLabel(star, scene([below], [star, { x: 760, y: 400, r: 6 }]), 'right')?.side,
		'above',
	);
	// Under, with a meaning come near: it moves.
	assert.equal(placeLabel(star, scene([below]), 'under')?.side, 'above');
});
