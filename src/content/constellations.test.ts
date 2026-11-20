import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	CONSTELLATIONS,
	type Constellation,
	type ConstellationStar,
	FINAL_LINE,
	isSlotId,
	SLOT_COUNT,
	slotToStar,
	starToSlot,
} from './constellations.ts';

// Flight order (B6), the star count of each full stick figure, and its meaning, verbatim.
const FIGURES: readonly (readonly [name: string, stars: number, meaning: string])[] = [
	['Virgo', 13, 'the virgin birth'],
	['Libra', 6, 'the price paid'],
	['Scorpius', 14, 'the conflict'],
	['Sagittarius', 25, 'the victor'],
	['Capricornus', 10, 'sacrifice and life'],
	['Aquarius', 15, 'living water poured out'],
	['Pisces', 22, 'His people'],
	['Aries', 4, 'the Lamb'],
	['Taurus', 12, 'He comes to judge'],
	['Gemini', 12, 'His twofold nature'],
	['Cancer', 5, 'His people held safe'],
	['Leo', 9, 'the Lion of the tribe of Judah'],
];

const RAD = Math.PI / 180;
type Vec = readonly [number, number, number];
const unit = (ra: number, dec: number): Vec => [
	Math.cos(dec * RAD) * Math.cos(ra * RAD),
	Math.cos(dec * RAD) * Math.sin(ra * RAD),
	Math.sin(dec * RAD),
];
/** Angle between two directions, degrees. */
const angle = (a: Vec, b: Vec) => {
	const cross = Math.hypot(
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0],
	);
	return Math.atan2(cross, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / RAD;
};

const figure = (name: string): Constellation => {
	const c = CONSTELLATIONS.find((f) => f.name === name);
	assert.ok(c, `no figure named ${name}`);
	return c;
};
/** The star of a figure at a catalogue position. */
const starAt = (c: Constellation, ra: number, dec: number): ConstellationStar => {
	const s = c.stars.find((t) => Math.abs(t.ra - ra) < 0.05 && Math.abs(t.dec - dec) < 0.05);
	assert.ok(s, `${c.name}: no star at ${ra}, ${dec}`);
	return s;
};
const slotNumber = (slot: string) => Number(slot.slice('slot-'.length));
const degrees = (c: Constellation) => {
	const degree = c.stars.map(() => 0);
	for (const [a, b] of c.lines) {
		degree[a]++;
		degree[b]++;
	}
	return degree;
};
const extent = (c: Constellation) => {
	const xs = c.stars.map((s) => s.x);
	const ys = c.stars.map((s) => s.y);
	return {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minY: Math.min(...ys),
		maxY: Math.max(...ys),
	};
};

test('the twelve figures, in flight order', () => {
	assert.deepEqual(
		CONSTELLATIONS.map((c) => c.name),
		FIGURES.map(([name]) => name),
	);
});

test('each is the full stick figure: 147 stars in all', () => {
	assert.deepEqual(
		CONSTELLATIONS.map((c) => c.stars.length),
		FIGURES.map(([, stars]) => stars),
	);
	assert.equal(
		CONSTELLATIONS.reduce((n, c) => n + c.stars.length, 0),
		147,
	);
});

test('meanings are verbatim, and so is the line after Leo', () => {
	assert.deepEqual(
		CONSTELLATIONS.map((c) => c.meaning),
		FIGURES.map(([, , meaning]) => meaning),
	);
	assert.equal(FINAL_LINE, 'Jesus is King.');
});

test('slots: slot-1 … slot-146, each once; the one star without is the epicentre in Virgo', () => {
	const all = CONSTELLATIONS.flatMap((c) => c.stars);
	const slots = all.flatMap((s) => (s.slot === null ? [] : [s.slot]));
	assert.equal(SLOT_COUNT, 146);
	assert.equal(slots.length, SLOT_COUNT);
	assert.deepEqual(
		[...slots].sort((a, b) => slotNumber(a) - slotNumber(b)),
		Array.from({ length: SLOT_COUNT }, (_, i) => `slot-${i + 1}`),
	);

	assert.equal(all.filter((s) => s.slot === null).length, 1);
	const [virgo, ...rest] = CONSTELLATIONS;
	assert.equal(virgo.name, 'Virgo');
	assert.ok(virgo.epicentre !== undefined && Number.isInteger(virgo.epicentre));
	assert.equal(virgo.stars[virgo.epicentre]?.slot, null);
	for (const c of rest) assert.equal(c.epicentre, undefined, c.name);
});

test('slots are numbered brightest first; ties by figure order, then star index', () => {
	const bySlot = CONSTELLATIONS.flatMap((c, ci) =>
		c.stars.flatMap((s, si) =>
			s.slot === null ? [] : [{ n: slotNumber(s.slot), mag: s.mag, ci, si }],
		),
	).sort((a, b) => a.n - b.n);
	for (let i = 1; i < bySlot.length; i++) {
		const [a, b] = [bySlot[i - 1], bySlot[i]];
		assert.ok(a.mag <= b.mag, `slot-${a.n} (${a.mag}) is fainter than slot-${b.n} (${b.mag})`);
		if (a.mag === b.mag)
			assert.ok(a.ci < b.ci || (a.ci === b.ci && a.si < b.si), `tie order at slot-${b.n}`);
	}
});

test('the 99 slots the contact Worker can name are the 99 brightest', () => {
	const workerNames = /^slot-[1-9]\d?$/; // workers/contact: anything else is silently dropped
	const claimable = CONSTELLATIONS.flatMap((c) => c.stars).filter((s) => s.slot !== null);
	const named = claimable.filter((s) => workerNames.test(s.slot ?? ''));
	const unnamed = claimable.filter((s) => !workerNames.test(s.slot ?? ''));
	assert.equal(named.length, 99);
	assert.equal(unnamed.length, SLOT_COUNT - 99);
	assert.ok(Math.max(...named.map((s) => s.mag)) <= Math.min(...unnamed.map((s) => s.mag)));
});

test('lines: valid indices, each line once, every star on a line', () => {
	for (const c of CONSTELLATIONS) {
		const seen = new Set<string>();
		for (const [a, b] of c.lines) {
			for (const i of [a, b])
				assert.ok(Number.isInteger(i) && i >= 0 && i < c.stars.length, `${c.name} index ${i}`);
			assert.notEqual(a, b, `${c.name}: a line from star ${a} to itself`);
			const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
			assert.ok(!seen.has(key), `${c.name}: line ${key} twice`);
			seen.add(key);
		}
		for (const [i, d] of degrees(c).entries())
			assert.ok(d > 0, `${c.name}: star ${i} is on no line`);
	}
});

test('every figure is one connected piece', () => {
	for (const c of CONSTELLATIONS) {
		const reached = new Set([0]);
		const queue = [0];
		for (let at = queue.pop(); at !== undefined; at = queue.pop()) {
			for (const [a, b] of c.lines) {
				const next = a === at ? b : b === at ? a : -1;
				if (next !== -1 && !reached.has(next)) {
					reached.add(next);
					queue.push(next);
				}
			}
		}
		assert.equal(reached.size, c.stars.length, `${c.name} is drawn in more than one piece`);
	}
});

test('unit box: 4 decimals, centred on (0, 0), larger half-extent exactly 1, aspect kept', () => {
	for (const c of CONSTELLATIONS) {
		for (const s of c.stars) {
			for (const v of [s.x, s.y]) {
				assert.ok(v >= -1 && v <= 1, `${c.name}: ${v} is outside the box`);
				assert.equal(v, Math.round(v * 1e4) / 1e4, `${c.name}: ${v} has more than 4 decimals`);
			}
		}
		const { minX, maxX, minY, maxY } = extent(c);
		assert.equal(minX, -maxX, `${c.name}: not centred in x`);
		assert.equal(minY, -maxY, `${c.name}: not centred in y`);
		assert.equal(Math.max(maxX, maxY), 1, `${c.name}: larger half-extent`);
		assert.ok(Math.abs(c.aspect - maxX / maxY) < 5e-4, `${c.name}: aspect ${c.aspect}`);
	}
});

test('no two stars of a figure share a position', () => {
	for (const c of CONSTELLATIONS) {
		assert.equal(new Set(c.stars.map((s) => `${s.x},${s.y}`)).size, c.stars.length, c.name);
		assert.equal(new Set(c.stars.map((s) => `${s.ra},${s.dec}`)).size, c.stars.length, c.name);
	}
});

test('north is up and east is left: every line runs the way it does in the sky', () => {
	for (const c of CONSTELLATIONS) {
		for (const [a, b] of c.lines) {
			const [from, to] = [c.stars[a], c.stars[b]];
			// Right ascension grows eastwards, across the 0°/360° seam too. East is −x.
			const east = ((to.ra - from.ra + 540) % 360) - 180;
			const sky = [-east * Math.cos(((from.dec + to.dec) / 2) * RAD), to.dec - from.dec];
			const drawn = [to.x - from.x, to.y - from.y];
			const cos =
				(sky[0] * drawn[0] + sky[1] * drawn[1]) /
				(Math.hypot(sky[0], sky[1]) * Math.hypot(drawn[0], drawn[1]));
			// A mirrored or upturned figure sends this to −1 on its east–west or north–south lines.
			assert.ok(cos > 0.9, `${c.name} line ${a}-${b} is turned ${Math.acos(cos) / RAD}°`);
		}
	}
});

test('positions are a true tangent-plane picture of the catalogue positions', () => {
	for (const c of CONSTELLATIONS) {
		const sky = c.stars.map((s) => unit(s.ra, s.dec));
		// On a plane touching the sphere at the box centre, star i lies in the direction (x, y, f).
		// f, the distance to the plane in box units, is the only unknown: fix it from the widest
		// pair of stars, then every other pair must subtend its real angle.
		const drawn = (i: number, j: number, f: number) =>
			angle([c.stars[i].x, c.stars[i].y, f], [c.stars[j].x, c.stars[j].y, f]);
		let widest = { i: 0, j: 1, sep: 0 };
		for (let i = 0; i < sky.length; i++) {
			for (let j = i + 1; j < sky.length; j++) {
				const sep = angle(sky[i], sky[j]);
				if (sep > widest.sep) widest = { i, j, sep };
			}
		}
		let [near, far] = [0.01, 1000];
		for (let step = 0; step < 100; step++) {
			const f = (near + far) / 2;
			if (drawn(widest.i, widest.j, f) > widest.sep) near = f;
			else far = f;
		}
		for (let i = 0; i < sky.length; i++) {
			for (let j = i + 1; j < sky.length; j++) {
				const off = Math.abs(drawn(i, j, near) - angle(sky[i], sky[j]));
				assert.ok(off < 0.02, `${c.name} stars ${i} and ${j} are ${off}° off`);
			}
		}
	}
});

test('the shapes read as they do in the night sky, not mirrored', () => {
	// Leo: the Sickle on the west side (right) with Regulus at its base; Denebola far left.
	const leo = figure('Leo');
	const regulus = starAt(leo, 152.09, 11.97);
	const sickle = leo.stars.filter((s) => s.ra < 156);
	assert.equal(sickle.length, 6);
	for (const s of sickle) assert.ok(s.x > 0.4, `Sickle star at x ${s.x}`);
	assert.equal(Math.min(...sickle.map((s) => s.y)), regulus.y);
	assert.equal(starAt(leo, 177.27, 14.57).x, -1);

	// Scorpius: Antares right of centre, the head up to the right, the tail down to the lower
	// left and hooking back up at the stinger.
	const scorpius = figure('Scorpius');
	const antares = starAt(scorpius, 247.35, -26.43);
	const head = starAt(scorpius, 241.36, -19.81);
	const tail = starAt(scorpius, 264.33, -43);
	const stinger = starAt(scorpius, 263.4, -37.1);
	assert.ok(antares.x > 0 && antares.y > 0);
	assert.ok(head.x > antares.x && head.y > antares.y);
	assert.ok(tail.x < -0.5 && tail.y === -1);
	assert.ok(stinger.x < -0.5 && stinger.y > tail.y + 0.4);

	// Sagittarius: the Teapot pours to the west (right): spout, then lid, then handle.
	const sagittarius = figure('Sagittarius');
	const spout = starAt(sagittarius, 271.45, -30.42);
	const lid = starAt(sagittarius, 276.99, -25.42);
	const handle = starAt(sagittarius, 286.74, -27.67);
	assert.ok(spout.x > lid.x && lid.x > handle.x);
	assert.ok(lid.y > spout.y && lid.y > handle.y);

	// Gemini: Castor and Pollux at the upper left, Castor above and to the right of Pollux.
	const gemini = figure('Gemini');
	const castor = starAt(gemini, 113.65, 31.89);
	const pollux = starAt(gemini, 116.33, 28.03);
	for (const twin of [castor, pollux]) assert.ok(twin.x < -0.5 && twin.y > 0.5);
	assert.ok(castor.x > pollux.x && castor.y > pollux.y);
});

test("the epicentre is Virgo's hub: the most lines, and of those the nearest the centre", () => {
	const virgo = figure('Virgo');
	const degree = degrees(virgo);
	const most = Math.max(...degree);
	const fromCentre = (i: number) => Math.hypot(virgo.stars[i].x, virgo.stars[i].y);
	const hubs = degree.flatMap((d, i) => (d === most ? [i] : []));
	const hub = hubs.reduce((best, i) => (fromCentre(i) < fromCentre(best) ? i : best));
	assert.equal(virgo.epicentre, hub);
	// Two stars of Virgo carry three lines: θ Virginis and γ Virginis (Porrima, 190.42, −1.45).
	// θ is the nearer to the centre, so it is the one Cellestial's own star replaces.
	assert.equal(hubs.length, 2);
	assert.deepEqual([virgo.stars[hub].ra, virgo.stars[hub].dec], [197.49, -5.54]);
});

test('provenance: catalogue positions and magnitudes, to 2 decimals', () => {
	for (const c of CONSTELLATIONS) {
		for (const s of c.stars) {
			assert.ok(
				s.ra >= 0 && s.ra < 360 && s.dec >= -90 && s.dec <= 90,
				`${c.name} ${s.ra} ${s.dec}`,
			);
			for (const v of [s.ra, s.dec, s.mag])
				assert.equal(v, Math.round(v * 100) / 100, `${c.name}: ${v} has more than 2 decimals`);
		}
	}
});

test('the brightest stars take the first slots; the four with no catalogue star, the last', () => {
	// Aldebaran, Antares, Spica.
	assert.equal(starAt(figure('Taurus'), 68.98, 16.51).slot, 'slot-1');
	assert.equal(starAt(figure('Scorpius'), 247.35, -26.43).slot, 'slot-2');
	assert.equal(starAt(figure('Virgo'), 201.3, -11.16).slot, 'slot-3');
	// The catalogue file stops at magnitude 5.0. Four line vertices are fainter than that and
	// have no star in it; they are kept with magnitude 5.
	const faintest = CONSTELLATIONS.flatMap((c, ci) =>
		c.stars.flatMap((s, si) => (s.mag >= 5 ? [[c.name, si, starToSlot(ci, si)]] : [])),
	);
	assert.deepEqual(faintest, [
		['Sagittarius', 13, 'slot-143'],
		['Pisces', 10, 'slot-144'],
		['Pisces', 16, 'slot-145'],
		['Pisces', 20, 'slot-146'],
	]);
});

test('isSlotId: exactly slot-1 … slot-146, no leading zeros, nothing around it', () => {
	for (const ok of ['slot-1', 'slot-9', 'slot-10', 'slot-99', 'slot-100', 'slot-146'])
		assert.ok(isSlotId(ok), ok);
	const bad: unknown[] = [
		'slot-0',
		'slot-147',
		'slot-999',
		'slot-1460',
		'slot-01',
		'slot-001',
		'slot-1 ',
		' slot-1',
		'slot-1\n',
		'slot- 1',
		'slot-',
		'slot',
		'slot--1',
		'slot-+1',
		'slot-1.0',
		'slot-1e1',
		'slot-0x1',
		'slot-１',
		'Slot-1',
		'SLOT-1',
		'star-1',
		'slot-1;drop',
		'',
		1,
		146,
		0,
		Number.NaN,
		null,
		undefined,
		true,
		{},
		['slot-1'],
	];
	for (const v of bad) assert.ok(!isSlotId(v), JSON.stringify(v));
});

test('slotToStar and starToSlot are inverses over every star', () => {
	let slots = 0;
	for (const [ci, c] of CONSTELLATIONS.entries()) {
		for (const [si, s] of c.stars.entries()) {
			assert.equal(starToSlot(ci, si), s.slot);
			if (s.slot === null) continue;
			assert.deepEqual(slotToStar(s.slot), { constellation: ci, star: si });
			slots++;
		}
	}
	assert.equal(slots, SLOT_COUNT);

	const [virgo] = CONSTELLATIONS;
	assert.equal(starToSlot(0, virgo.epicentre ?? -1), null);
	for (const [ci, si] of [
		[-1, 0],
		[12, 0],
		[0, -1],
		[0, 13],
		[0.5, 0],
		[0, 0.5],
	])
		assert.equal(starToSlot(ci, si), null, `${ci}, ${si}`);
	for (const none of ['slot-0', 'slot-147', 'slot-01', 'slot-1 ', '', 'toString', '__proto__'])
		assert.equal(slotToStar(none), null, none);

	// A caller cannot reach into the table through what it is handed.
	const first = slotToStar('slot-1');
	assert.ok(first);
	first.star = -5;
	assert.notEqual(slotToStar('slot-1')?.star, -5);
});
