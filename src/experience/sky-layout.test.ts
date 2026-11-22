// The sky's layout (sky/layout.ts) on a portrait phone. Round 2's second look
// found Cellestial's star, the first thing a phone visitor is handed, with
// four of Virgo's stars sitting on its rings: Virgo was fitted to the phone's
// width, a band a fifth of the screen high. The wide figures are turned a
// quarter on a portrait screen now. These tests fail without that.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { B3, KNOT, LATTICE, PORTRAIT, STAR_PX } from './sky/config.ts';
import { createHoneycomb } from './sky/lattice.ts';
import { createLayout, type Layout, planFigures } from './sky/layout.ts';

const set = planFigures(createHoneycomb(LATTICE).cells);
const PHONES = [
	[390, 844],
	[360, 740],
] as const;
const WIDE = ['Virgo', 'Capricornus', 'Aquarius', 'Pisces', 'Aries', 'Leo'];

const turnedIn = (layout: Layout) => layout.plans.filter((p) => p.turned).map((p) => p.name);

/** The figure's height at its station, star centre to star centre, as a share of the screen. */
const heightOf = (layout: Layout, i: number) => {
	const ys = (layout.plans[i]?.stars ?? []).map((s) => s.y * (layout.fits[i]?.scale ?? 0));
	return (Math.max(...ys) - Math.min(...ys)) / layout.h;
};

/** The deepest overlap of two stars of a figure, as a share of the smaller one's width. */
const deepest = (layout: Layout, i: number) => {
	const plan = layout.plans[i];
	const scale = layout.fits[i]?.scale ?? 0;
	let worst = 0;
	if (!plan) return worst;
	for (const [a, p] of plan.stars.entries()) {
		for (const [b, q] of plan.stars.entries()) {
			if (b <= a || a === plan.epicentre || b === plan.epicentre) continue;
			const d = Math.hypot(p.x - q.x, p.y - q.y) * scale;
			const rp = layout.starPx * layout.sizeOf(p);
			const rq = layout.starPx * layout.sizeOf(q);
			worst = Math.max(worst, (rp + rq - d) / (2 * Math.min(rp, rq)));
		}
	}
	return worst;
};

test('a portrait phone turns exactly the six wide figures', () => {
	for (const [w, h] of PHONES) {
		assert.deepEqual(turnedIn(createLayout(w, h, set)), WIDE, `${w}x${h}`);
	}
});

test('nothing is turned on a desktop, on a phone on its side, or with the switch off', () => {
	assert.deepEqual(turnedIn(createLayout(1440, 900, set)), []);
	assert.deepEqual(turnedIn(createLayout(844, 390, set)), []);
	assert.deepEqual(turnedIn(createLayout(390, 844, set, { turn: false })), []);
});

test('a layout that turns nothing is the layout of the upright figures, number for number', () => {
	for (const [w, h] of [
		[1440, 900],
		[844, 390],
		[1024, 768],
	] as const) {
		const layout = createLayout(w, h, set);
		for (const [i, plan] of layout.plans.entries()) assert.equal(plan, set.upright[i]);
		assert.equal(layout.b3, 1);
		assert.equal(layout.b3Clear, true);
		for (const plan of layout.plans) {
			for (const star of plan.stars) assert.equal(layout.sizeOf(star), star.scale);
		}
	}
});

test('a turned figure is the same stars a quarter-turn counter-clockwise, north to the left', () => {
	for (const [i, up] of set.upright.entries()) {
		const turned = set.turned[i];
		assert.ok(turned);
		assert.equal(turned.turned, true);
		assert.equal(up.turned, false);
		assert.deepEqual(turned.lines, up.lines);
		for (const [n, s] of up.stars.entries()) {
			const t = turned.stars[n];
			assert.ok(t);
			assert.ok(Math.abs(t.x - -s.y) < 1e-12 && Math.abs(t.y - s.x) < 1e-12);
			assert.equal(t.slot, s.slot);
			assert.equal(t.seed, s.seed);
			assert.equal(t.scale, s.scale);
		}
	}
});

test('the camera passes through a turned plane clear of its turned stars', () => {
	for (const plan of set.turned) {
		let nearest = Infinity;
		for (const s of plan.stars) {
			nearest = Math.min(nearest, Math.hypot(s.x - plan.pass.x, s.y - plan.pass.y));
		}
		assert.ok(Math.abs(nearest - plan.clearance) < 1e-9, plan.name);
		assert.ok(plan.clearance > 0.2, `${plan.name}: ${plan.clearance}`);
		const centre = plan.stars[plan.epicentre];
		if (centre) {
			const d = Math.hypot(centre.x - plan.pass.x, centre.y - plan.pass.y);
			assert.ok(d >= B3.clearance, `${plan.name}: the path keeps clear of Cellestial's star`);
		}
	}
});

test('turned, the six wide figures stand at least half the screen high', () => {
	for (const [w, h] of PHONES) {
		const layout = createLayout(w, h, set);
		const upright = createLayout(w, h, set, { turn: false });
		for (const [i, plan] of layout.plans.entries()) {
			if (!plan.turned) continue;
			assert.ok(heightOf(layout, i) >= 0.5, `${plan.name} at ${w}x${h}: ${heightOf(layout, i)}`);
			assert.ok(heightOf(upright, i) < 0.3, `${plan.name} upright was a band`);
		}
	}
});

test("Cellestial's star stands clear of every star of Virgo on a portrait phone", () => {
	for (const [w, h] of [...PHONES, [320, 568], [375, 667], [412, 915], [430, 932]] as const) {
		const layout = createLayout(w, h, set);
		const plan = layout.plans[0];
		const fit = layout.fits[0];
		assert.ok(plan && fit);
		assert.equal(layout.b3Clear, true);
		const reach = B3.ring * layout.b3 * fit.scale;
		for (const [i, star] of plan.stars.entries()) {
			if (i === plan.epicentre) continue;
			const edge = Math.hypot(star.x, star.y) * fit.scale - layout.starPx * layout.sizeOf(star);
			assert.ok(
				edge - reach >= PORTRAIT.b3Clear - 1e-6,
				`${w}x${h}: star ${i} is ${edge - reach} px from the rings`,
			);
		}
	}
});

test("Cellestial's star is its world size on the two phones, 84 px across or more", () => {
	for (const [w, h] of PHONES) {
		const layout = createLayout(w, h, set);
		assert.equal(layout.b3, 1, `${w}x${h}`);
		const across = 2 * B3.ring * layout.b3 * (layout.fits[0]?.scale ?? 0);
		assert.ok(across >= PORTRAIT.b3MinPx, `${w}x${h}: ${across} px across`);
	}
});

test('with the switch off the phone has the sky it had: upright, the star forced large', () => {
	const layout = createLayout(390, 844, set, { turn: false });
	assert.equal(layout.b3Clear, false);
	const across = 2 * B3.ring * layout.b3 * (layout.fits[0]?.scale ?? 0);
	assert.ok(Math.abs(across - 130) < 1e-6);
});

test('no two stars of a figure overlap by more than a third on a portrait phone', () => {
	for (const [w, h] of PHONES) {
		const layout = createLayout(w, h, set);
		for (const [i, plan] of layout.plans.entries()) {
			const worst = deepest(layout, i);
			assert.ok(worst <= KNOT.over, `${plan.name} at ${w}x${h}: ${(100 * worst).toFixed(0)}%`);
			for (const star of plan.stars) {
				if (!star.slot) continue;
				assert.ok(layout.starPx * layout.sizeOf(star) >= KNOT.leastPx - 1e-9);
				assert.ok(layout.starPx * layout.sizeOf(star) <= STAR_PX.portrait * 1.35 + 1e-9);
			}
		}
	}
});

test('a phone turned on its side and back has the layout it had', () => {
	const a = createLayout(390, 844, set);
	const side = createLayout(844, 390, set);
	const b = createLayout(390, 844, set);
	assert.deepEqual(turnedIn(side), []);
	assert.deepEqual(turnedIn(b), turnedIn(a));
	assert.deepEqual(b.fits, a.fits);
	assert.equal(b.b3, a.b3);
	for (const [i, plan] of a.plans.entries()) {
		assert.equal(b.plans[i], plan);
		for (const star of plan.stars) assert.equal(b.sizeOf(star), a.sizeOf(star));
	}
});
