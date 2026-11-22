// The sky's layout (sky/layout.ts) on a portrait phone. Round 2's second look
// found Cellestial's star, the first thing a phone visitor is handed, with
// four of Virgo's stars sitting on its rings: Virgo was fitted to the phone's
// width, a band a fifth of the screen high. The wide figures are turned a
// quarter on a portrait screen now. These tests fail without that.

//
// Round 3, after the third look: on a phone held on its side the stars ran under
// the exit button (the room under the figures was a share of the screen's height,
// and the button is not), and the knots' rule and the rings' clear space held on
// the upright phone only. The tests from "the exit button" down fail without that.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { B3, B11, KNOT, LATTICE, MAG, PORTRAIT, STAR_PX } from './sky/config.ts';
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
	// Round 3 changed this check. It said that off the portrait phone every star is drawn
	// at its own size; the knots' rule and the rings' clear space now hold on every screen,
	// so it says instead WHICH stars are drawn smaller there, and that no other is.
	const SMALLER: Record<string, string[]> = {
		'1440x900': ['slot-64', 'slot-77'],
		'1024x768': ['slot-64', 'slot-77'],
		'844x390': ['slot-1', 'slot-3', 'slot-33', 'slot-54', 'slot-64', 'slot-77', 'slot-80'],
	};
	for (const [w, h] of [
		[1440, 900],
		[844, 390],
		[1024, 768],
	] as const) {
		const layout = createLayout(w, h, set);
		for (const [i, plan] of layout.plans.entries()) assert.equal(plan, set.upright[i]);
		assert.equal(layout.b3, 1);
		assert.equal(layout.b3Clear, true);
		const smaller: string[] = [];
		for (const plan of layout.plans) {
			for (const star of plan.stars) {
				if (layout.sizeOf(star) === star.scale) continue;
				assert.ok(layout.sizeOf(star) < star.scale, 'a star is only ever drawn smaller');
				smaller.push(star.slot ?? 'Cellestial');
			}
		}
		assert.deepEqual(smaller.sort(), SMALLER[`${w}x${h}`], `${w}x${h}`);
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

// ── Round 3: the exit button, the knots and the rings on every screen ──

/** Phones held on their side, and the shortest of them. */
const SIDES = [
	[844, 390],
	[667, 375],
	[740, 360],
	[932, 430],
	[896, 414],
	[568, 320],
] as const;
/** The logo and the menu button together, as the page has them at their largest: 16,12 to 118.2,90. */
const CHROME = { x: 16, y: 12, w: 102.2, h: 78 } as const;
/** The exit button, as the page has it on every screen: 271.4 px wide in the middle, its top 84 px above the bottom. */
const exitOf = (w: number, h: number) => ({ x: w / 2 - 135.7, y: h - 84, w: 271.4, h: 52 });

interface Disc {
	name: string;
	slot: string | null;
	x: number;
	y: number;
	r: number;
}
/** Every star's disc at its figure's station, viewport pixels (Cellestial's star: its rings' full reach). */
const discsOf = (layout: Layout): Disc[] =>
	layout.plans.flatMap((plan, i) => {
		const fit = layout.fits[i];
		if (!fit) return [];
		return plan.stars.map((star, n) => ({
			name: plan.name,
			slot: star.slot,
			x: layout.w / 2 + (star.x - fit.sx) * fit.scale,
			y: layout.h / 2 - (star.y - fit.sy) * fit.scale,
			r:
				n === plan.epicentre
					? B3.ring * layout.b3 * fit.scale
					: layout.starPx * layout.sizeOf(star),
		}));
	});
const gapTo = (d: Disc, box: { x: number; y: number; w: number; h: number }) =>
	Math.hypot(
		Math.max(box.x - d.x, 0, d.x - (box.x + box.w)),
		Math.max(box.y - d.y, 0, d.y - (box.y + box.h)),
	) - d.r;

test('the exit button is the button the stylesheet makes: 52 px high, 32 px above the bottom', () => {
	const sky = readFileSync(new URL('../components/scenes/Sky.astro', import.meta.url), 'utf8');
	const button = readFileSync(
		new URL('../components/ui/BrassButton.astro', import.meta.url),
		'utf8',
	);
	assert.match(
		sky,
		/\.sky-exit \{[^}]*padding: 0 1rem max\(2rem,/,
		'its foot is 2rem above the bottom',
	);
	assert.match(button, /--bb-h: 52px;/, 'it is 52 px high');
	assert.equal(B11.above, 32);
	assert.equal(B11.height, 52);
	assert.equal(B11.clear, 12);
});

test('on a phone on its side no star comes within 12 px of the exit button, at any station', () => {
	for (const [w, h] of SIDES) {
		const layout = createLayout(w, h, set);
		const exit = exitOf(w, h);
		for (const d of discsOf(layout)) {
			const what = `${d.name} ${d.slot ?? "Cellestial's star"} at ${w}x${h}`;
			assert.ok(d.y + d.r <= h - 84 - 12 + 1e-6, `${what}: its foot is at ${d.y + d.r}`);
			assert.ok(gapTo(d, exit) >= 12 - 1e-6, `${what}: ${gapTo(d, exit)} px from the button`);
		}
	}
});

test('on a phone on its side every star is on screen, clear of the logo, the menu button and the sides', () => {
	for (const [w, h] of SIDES) {
		const layout = createLayout(w, h, set);
		for (const d of discsOf(layout)) {
			const what = `${d.name} ${d.slot ?? "Cellestial's star"} at ${w}x${h}`;
			assert.ok(d.y - d.r >= B11.head - 1e-6, `${what}: its head is at ${d.y - d.r}`);
			assert.ok(d.x - d.r >= 20 && d.x + d.r <= w - 20, `${what}: 20 px inside the sides`);
			assert.ok(gapTo(d, CHROME) >= 12, `${what}: ${gapTo(d, CHROME)} px from the logo and menu`);
		}
	}
});

test("the room under the figures is the button's own from 480 px of height down, and a fifth of the height above", () => {
	for (const [w, h, bottom] of [
		[844, 390, 96],
		[667, 375, 96],
		[740, 360, 96],
		[932, 430, 96],
		[1024, 479, 96],
		[1024, 480, 96],
		[1024, 500, 100],
		[1280, 560, 112],
		[1280, 600, 120],
		[1440, 900, 120],
		[390, 844, 120],
		[360, 740, 120],
		[375, 667, 120],
		[320, 568, 113.6],
	] as const) {
		assert.ok(Math.abs(createLayout(w, h, set).safe.bottom - bottom) < 1e-9, `${w}x${h}`);
	}
});

test('a figure that fits its safe area is centred in it; only one too tall for a short screen is moved up', () => {
	// The figures held at their furthest stand on a phone on its side: taller than the safe area.
	const side = createLayout(844, 390, set);
	for (const [i, plan] of side.plans.entries()) {
		const fit = side.fits[i];
		assert.ok(fit);
		if (plan.epicentre >= 0) continue;
		const ys = discsOf(side).filter((d) => d.name === plan.name);
		const foot = Math.max(...ys.map((d) => d.y + d.r));
		const head = Math.min(...ys.map((d) => d.y - d.r));
		if (fit.dist > 4.8 - 1e-9) {
			assert.ok(head < side.safe.top, `${plan.name} is taller than the safe area`);
			assert.ok(head >= 20, `${plan.name}: its head stays on screen (${head})`);
		} else {
			assert.ok(head >= side.safe.top && foot <= 390 - 96, `${plan.name} stands in the safe area`);
		}
	}
	// A desktop window 560 px high holds five figures at their furthest stand too, 13 px clear
	// of the button as they are: they are not moved.
	const short = createLayout(1280, 560, set);
	const foot = Math.max(...discsOf(short).map((d) => d.y + d.r));
	assert.ok(Math.abs(foot - 462.7) < 0.1, `1280x560: the lowest disc is where it was (${foot})`);
});

// The owner's two sizes and the other two upright phones, as the third look ruled them done:
// each figure's scale and the camera's height at its station. Round 3 must not move them.
const DONE: Record<string, readonly (readonly [number, number])[]> = {
	'1440x900': [
		[465.6165, 0.0],
		[315.4679, -0.032451],
		[312.2779, -0.041815],
		[319.4134, -0.040723],
		[491.464, -0.024861],
		[603.3102, -0.022673],
		[516.5974, -0.021831],
		[514.0198, -0.022006],
		[349.8467, -0.021679],
		[332.6095, -0.027144],
		[317.6002, -0.040427],
		[627.5371, -0.025891],
	],
	'390x844': [
		[225.4081, 0.0],
		[296.8394, -0.039548],
		[163.7285, -0.07727],
		[188.1695, -0.063772],
		[243.6055, -0.04926],
		[297.1, -0.04039],
		[254.5894, -0.047135],
		[255.7011, -0.04693],
		[158.1, -0.067976],
		[156.3198, -0.068353],
		[297.1, -0.04039],
		[296.3535, -0.043011],
	],
	'360x740': [
		[204.0131, 0.0],
		[244.8394, -0.047947],
		[148.1393, -0.085401],
		[170.3166, -0.070457],
		[220.4931, -0.054423],
		[245.1, -0.04896],
		[230.4348, -0.052075],
		[231.441, -0.051849],
		[143.1, -0.075101],
		[141.3198, -0.075608],
		[245.1, -0.04896],
		[244.3535, -0.052164],
	],
	'375x667': [
		[184.7744, 0.0],
		[208.3394, -0.056347],
		[155.9339, -0.081132],
		[179.243, -0.066948],
		[208.6, -0.057526],
		[208.6, -0.057526],
		[208.6, -0.057526],
		[208.6, -0.057526],
		[150.6, -0.071361],
		[148.8198, -0.071798],
		[208.6, -0.057526],
		[207.8535, -0.061324],
	],
};

test('the sizes that are done stand where they stood: every figure, at 1440x900 and on the upright phones', () => {
	for (const [size, pins] of Object.entries(DONE)) {
		const [w, h] = size.split('x').map(Number) as [number, number];
		const layout = createLayout(w, h, set);
		for (const [i, [scale, sy]] of pins.entries()) {
			const fit = layout.fits[i];
			assert.ok(fit);
			assert.ok(
				Math.abs(fit.scale - scale) < 1e-3,
				`${size} ${layout.plans[i]?.name}: scale ${fit.scale}`,
			);
			assert.ok(Math.abs(fit.sy - sy) < 1e-5, `${size} ${layout.plans[i]?.name}: sy ${fit.sy}`);
		}
	}
});

test("at 1440x900 Taurus's closest pair is drawn smaller, and nothing else is", () => {
	const layout = createLayout(1440, 900, set);
	const smaller = layout.plans.flatMap((plan) =>
		plan.stars
			.filter((star) => layout.sizeOf(star) !== star.scale)
			.map((star) => `${plan.name} ${star.slot}`),
	);
	assert.deepEqual(smaller.sort(), ['Taurus slot-64', 'Taurus slot-77']);
	for (const [i, plan] of layout.plans.entries()) {
		const worst = deepest(layout, i);
		assert.ok(worst <= KNOT.over + 1e-9, `${plan.name}: ${(100 * worst).toFixed(0)}%`);
	}
	const taurus = layout.plans[8];
	for (const star of taurus?.stars ?? []) {
		if (star.slot !== 'slot-64' && star.slot !== 'slot-77') continue;
		const r = layout.starPx * layout.sizeOf(star);
		assert.ok(Math.abs(r - 12.5) < 0.1, `${star.slot}: ${r} px`);
	}
});

test('on every screen: no two stars more than a third into each other unless both are at the least size', () => {
	for (const [w, h] of [
		...SIDES,
		...PHONES,
		[375, 667],
		[320, 568],
		[1440, 900],
		[1920, 1080],
		[1280, 720],
		[1366, 650],
		[1280, 560],
		[1024, 500],
		[768, 1024],
		[1024, 768],
	] as const) {
		const layout = createLayout(w, h, set);
		for (const [i, plan] of layout.plans.entries()) {
			const scale = layout.fits[i]?.scale ?? 0;
			for (const [a, p] of plan.stars.entries()) {
				for (const [b, q] of plan.stars.entries()) {
					if (b <= a || a === plan.epicentre || b === plan.epicentre) continue;
					const d = Math.hypot(p.x - q.x, p.y - q.y) * scale;
					const rp = layout.starPx * layout.sizeOf(p);
					const rq = layout.starPx * layout.sizeOf(q);
					const over = (rp + rq - d) / (2 * Math.min(rp, rq));
					assert.ok(
						rp >= KNOT.leastPx - 1e-9 && rq >= KNOT.leastPx - 1e-9,
						`${w}x${h}: under the least size`,
					);
					if (over <= KNOT.over + 1e-9) continue;
					// Only where the two stand under 8 px apart: both are at the rule's own floor.
					const what = `${plan.name} ${p.slot}/${q.slot} at ${w}x${h}: ${(100 * over).toFixed(0)}%, ${d.toFixed(1)} px apart`;
					assert.ok(d < 8, what);
					assert.ok(Math.abs(rp - KNOT.leastPx) < 1e-9 && Math.abs(rq - KNOT.leastPx) < 1e-9, what);
				}
			}
		}
	}
});

test('on a phone on its side the knots of Taurus and Sagittarius are drawn smaller', () => {
	for (const [w, h] of SIDES) {
		const layout = createLayout(w, h, set);
		for (const slot of ['slot-64', 'slot-77', 'slot-33', 'slot-80']) {
			const star = layout.plans.flatMap((plan) => plan.stars).find((s) => s.slot === slot);
			assert.ok(star);
			assert.ok(layout.sizeOf(star) < star.scale, `${slot} at ${w}x${h}`);
		}
	}
});

test("Cellestial's rings end 2 px short of every star of Virgo on every screen", () => {
	for (const [w, h] of [
		...SIDES,
		[1440, 900],
		[1920, 1080],
		[1280, 720],
		[1366, 650],
		[1280, 600],
		[1280, 560],
		[1024, 500],
		[768, 1024],
		[1024, 768],
		[820, 1180],
	] as const) {
		const layout = createLayout(w, h, set);
		const plan = layout.plans[0];
		const fit = layout.fits[0];
		assert.ok(plan && fit);
		// The star is its world size: no neighbour is so near that the rings give way.
		assert.equal(layout.b3, 1, `${w}x${h}`);
		const reach = B3.ring * fit.scale;
		for (const [i, star] of plan.stars.entries()) {
			if (i === plan.epicentre) continue;
			const r = layout.starPx * layout.sizeOf(star);
			const edge = Math.hypot(star.x, star.y) * fit.scale - r;
			assert.ok(
				edge - reach >= PORTRAIT.b3Clear - 1e-6,
				`${w}x${h}: star ${i} is ${edge - reach} px from the rings`,
			);
			assert.ok(
				layout.sizeOf(star) >= MAG.faintScale - 1e-9,
				`${w}x${h}: star ${i} under the faintest size`,
			);
		}
	}
});
