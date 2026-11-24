// Where a star's panel stands (sky/panel-place.ts). The owner, 24 Nov: "See what holds up the
// sky" covered the panel of some stars, and with it the panel's "Claim your star". These tests
// fail on the placing before that, which kept the panel on the screen and nothing more.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHROME, GAP, MARGIN, placePanel, type Rect } from './sky/panel-place.ts';

const PHONE = { w: 390, h: 844 };
const DESK = { w: 1440, h: 900 };
const PANEL = { w: 336, h: 338 };
/** The exit button as the page has it: 271 x 52, centred, 32 px above the bottom. */
const exitOn = (s: { w: number; h: number }): Rect => ({
	left: s.w / 2 - 135.5,
	right: s.w / 2 + 135.5,
	top: s.h - 84,
	bottom: s.h - 32,
});
const rect = (p: { x: number; y: number }, size = PANEL): Rect => ({
	left: p.x,
	top: p.y,
	right: p.x + size.w,
	bottom: p.y + size.h,
});
const clear = (a: Rect, b: Rect) =>
	a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;

test('a star low on a phone: its panel stands above the exit button, not under it', () => {
	const exit = exitOn(PHONE);
	for (const star of [
		{ x: 200, y: 560, r: 13 },
		{ x: 60, y: 700, r: 13 },
		{ x: 330, y: 760, r: 13 },
	]) {
		const p = rect(placePanel(star, PANEL, PHONE, exit));
		assert.ok(clear(p, exit), JSON.stringify({ star, p }));
		assert.ok(p.bottom <= exit.top - GAP + 0.5, 'with a gap above the button');
		assert.ok(p.top >= MARGIN && p.right <= PHONE.w - MARGIN + 0.5, 'whole on the screen');
	}
});

test('on a desktop, a star above the button: the panel goes beside the star or above, never on the button', () => {
	const exit = exitOn(DESK);
	for (let x = 500; x <= 940; x += 40) {
		for (let y = 500; y <= 820; y += 40) {
			const p = rect(placePanel({ x, y, r: 20 }, PANEL, DESK, exit));
			assert.ok(clear(p, exit), `star at ${x},${y}: ${JSON.stringify(p)}`);
		}
	}
});

test('with the exit button hidden the panel is placed as it always was', () => {
	// Neither right nor left of a star in the middle of a phone has room: under it, down to the
	// screen's own margin, where the button would stand if it were shown.
	const star = { x: 200, y: 450, r: 13 };
	assert.deepEqual(placePanel(star, PANEL, PHONE, null), { x: 32, y: 475 });
	const shown = rect(placePanel(star, PANEL, PHONE, exitOn(PHONE)));
	assert.ok(clear(shown, exitOn(PHONE)), 'and with it shown, clear of it');
});

test('a phone on its side has no room for both: the panel covers the least of the button', () => {
	const side = { w: 844, h: 390 };
	const exit = exitOn(side);
	const p = rect(placePanel({ x: 422, y: 250, r: 10 }, PANEL, side, exit));
	// The panel stands beside the star, to its right or left, which covers less of the button
	// than standing over it.
	assert.ok(p.left >= 422 || p.right <= 422);
	assert.ok(p.top >= MARGIN && p.bottom <= side.h - MARGIN + 0.5);
});

test('never over the logo and the menu button', () => {
	const exit = exitOn(PHONE);
	for (let y = 100; y <= 700; y += 50) {
		const p = rect(placePanel({ x: 40, y, r: 13 }, PANEL, PHONE, exit));
		assert.ok(!(p.left < CHROME.w && p.top < CHROME.h), `star at 40,${y}`);
	}
});
