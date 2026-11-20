// Builds src/content/constellations.ts from scripts/data/sky.json. Run when either changes:
//   node scripts/build-constellations.mjs
//
// The twelve figures of the flight (B6), each the full real stick figure, nothing simplified:
//   stars  every distinct vertex of the figure's lines, matched to its nearest catalogue star
//   x, y   gnomonic (tangent-plane) projection about the figure's own centre, north up and east
//          to the LEFT (the night sky, not its mirror image), fitted to a unit box
//   lines  index pairs into stars, de-duplicated
//   slot   slot-1 … slot-146, brightest first across all twelve; null for the epicentre (B3)

import { readFileSync, writeFileSync } from 'node:fs';

const SKY = new URL('./data/sky.json', import.meta.url);
const OUT = new URL('../src/content/constellations.ts', import.meta.url);

// Flight order (B6), and what each figure means: verbatim from BLUEPRINT section 9, item 4.
const FIGURES = [
	['Virgo', 'the virgin birth'],
	['Libra', 'the price paid'],
	['Scorpius', 'the conflict'],
	['Sagittarius', 'the victor'],
	['Capricornus', 'sacrifice and life'],
	['Aquarius', 'living water poured out'],
	['Pisces', 'His people'],
	['Aries', 'the Lamb'],
	['Taurus', 'He comes to judge'],
	['Gemini', 'His twofold nature'],
	['Cancer', 'His people held safe'],
	['Leo', 'the Lion of the tribe of Judah'],
];
const FINAL_LINE = 'Jesus is King.';
// The first figure. Its hub star is Cellestial's own (B3) and cannot be claimed.
const EPICENTRE_FIGURE = 'Virgo';
// A line vertex with no catalogue star within MATCH_DEG degrees has none in the file, which stops
// at magnitude 5.0. It is kept where the line puts it, with that magnitude.
const MATCH_DEG = 0.3;
const UNMATCHED_MAG = 5.0;
// The catalogue lists a close double as two entries at one position (Porrima, Castor, Algieba …).
// The eye sees one star, so a star's magnitude is the light of every entry this near it, added.
const PAIR_DEG = 0.02;

const RAD = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalise = (v) => {
	const length = Math.hypot(v[0], v[1], v[2]);
	return [v[0] / length, v[1] / length, v[2] / length];
};
/** Unit vector for a sky position in degrees. Working in vectors makes the 0°/360° seam vanish. */
const unit = (ra, dec) => [
	Math.cos(dec * RAD) * Math.cos(ra * RAD),
	Math.cos(dec * RAD) * Math.sin(ra * RAD),
	Math.sin(dec * RAD),
];
/** Angle between two unit vectors, degrees. The chord form stays exact for tiny angles. */
const separation = (a, b) =>
	(2 * Math.asin(Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2))) / RAD;
/** Round to 4 decimals, halves away from zero so a mirrored pair stays mirrored; never -0. */
const round4 = (v) => Math.sign(v) * (Math.round(Math.abs(v) * 1e4) / 1e4) || 0;

const sky = JSON.parse(readFileSync(SKY, 'utf8'));
// sky.json keeps degrees and magnitudes × 100, brightest first.
const catalogue = sky.stars.map(([ra, dec, mag]) => ({
	ra: ra / 100,
	dec: dec / 100,
	mag: mag / 100,
	v: unit(ra / 100, dec / 100),
}));

/** A line vertex's catalogue star: the nearest (of two equally near, the brighter), or null. */
function catalogueStar(ra, dec) {
	const v = unit(ra, dec);
	let best = null;
	let bestSep = Number.POSITIVE_INFINITY;
	for (const star of catalogue) {
		const sep = separation(v, star.v);
		if (sep < bestSep) {
			best = star;
			bestSep = sep;
		}
	}
	return bestSep <= MATCH_DEG ? best : null;
}

/** The magnitude the eye sees: a close pair's light added together, to 2 decimals. */
function seenMagnitude(star) {
	let light = 0;
	for (const other of catalogue) {
		if (separation(star.v, other.v) <= PAIR_DEG) light += 10 ** (-0.4 * other.mag);
	}
	return Math.round(-2.5 * Math.log10(light) * 100) / 100;
}

/** The frame of the plane touching the sphere at `c`: unit vectors towards east and north. */
function tangentFrame(c) {
	const east = normalise([-c[1], c[0], 0]);
	const north = [
		c[1] * east[2] - c[2] * east[1],
		c[2] * east[0] - c[0] * east[2],
		c[0] * east[1] - c[1] * east[0],
	];
	return { c, east, north };
}

/**
 * Gnomonic projection onto that plane. On a globe east is to the right; looking up from inside
 * it, as we do at the sky, east is to the left. So x is minus east, and y is north.
 */
function project(v, frame) {
	const depth = dot(v, frame.c);
	if (depth <= 0) throw new Error('star behind the tangent plane');
	return [-dot(v, frame.east) / depth, dot(v, frame.north) / depth];
}

function bounds(points) {
	const xs = points.map((p) => p[0]);
	const ys = points.map((p) => p[1]);
	const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
	const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
	return {
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
		halfW: (maxX - minX) / 2,
		halfH: (maxY - minY) / 2,
	};
}

/**
 * The figure's own centre: the point of the sky whose tangent-plane picture has the figure's
 * bounding box centred on it. Start at the mean direction of the stars and walk to the middle of
 * the box until it stops moving. Unlike the plain mean, it is not pulled towards a crowded end.
 */
function centreFrame(vectors) {
	let c = normalise(vectors.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]));
	for (let i = 0; i < 100; i++) {
		const frame = tangentFrame(c);
		const box = bounds(vectors.map((v) => project(v, frame)));
		if (Math.hypot(box.cx, box.cy) < 1e-12) return frame;
		c = normalise([0, 1, 2].map((k) => c[k] - box.cx * frame.east[k] + box.cy * frame.north[k]));
	}
	throw new Error('the figure centre did not settle');
}

function buildFigure(name, meaning) {
	const figure = sky.lines.find((l) => l.n === name);
	if (!figure) throw new Error(`no lines for ${name} in sky.json`);

	// Vertices and lines, in the order the polylines draw them.
	const indexOf = new Map();
	const stars = [];
	const lines = [];
	const drawn = new Set();
	for (const poly of figure.p) {
		let prev = -1;
		for (let i = 0; i < poly.length; i += 2) {
			const key = `${poly[i]},${poly[i + 1]}`;
			let at = indexOf.get(key);
			if (at === undefined) {
				at = stars.length;
				indexOf.set(key, at);
				const ra = poly[i] / 100;
				const dec = poly[i + 1] / 100;
				const star = catalogueStar(ra, dec);
				stars.push(
					star
						? { ra: star.ra, dec: star.dec, mag: seenMagnitude(star), source: star }
						: { ra, dec, mag: UNMATCHED_MAG, source: null },
				);
			}
			if (prev !== -1 && prev !== at) {
				const edge = prev < at ? `${prev}-${at}` : `${at}-${prev}`;
				if (!drawn.has(edge)) {
					drawn.add(edge);
					lines.push([prev, at]);
				}
			}
			prev = at;
		}
	}
	const sources = stars.flatMap((s) => (s.source ? [s.source] : []));
	if (new Set(sources).size !== sources.length)
		throw new Error(`${name}: two line vertices matched the same catalogue star`);

	// Project about the figure's centre, then fit the bounding box to the unit box.
	const vectors = stars.map((s) => unit(s.ra, s.dec));
	const frame = centreFrame(vectors);
	const flat = vectors.map((v) => project(v, frame));
	const box = bounds(flat);
	const scale = 1 / Math.max(box.halfW, box.halfH);
	for (const [i, s] of stars.entries()) {
		s.x = round4((flat[i][0] - box.cx) * scale);
		s.y = round4((flat[i][1] - box.cy) * scale);
		s.slot = null;
	}
	return { name, meaning, aspect: round4(box.halfW / box.halfH), stars, lines };
}

/** The hubs of a figure: the stars with the most lines, the one nearest the centre first. */
function hubsOf(figure) {
	const degree = figure.stars.map(() => 0);
	for (const [a, b] of figure.lines) {
		degree[a]++;
		degree[b]++;
	}
	const most = Math.max(...degree);
	const fromCentre = (i) => Math.hypot(figure.stars[i].x, figure.stars[i].y);
	return degree
		.flatMap((d, i) => (d === most ? [{ index: i, lines: d, fromCentre: fromCentre(i) }] : []))
		.sort((a, b) => a.fromCentre - b.fromCentre || a.index - b.index);
}

const figures = FIGURES.map(([name, meaning]) => buildFigure(name, meaning));

// Virgo has two hubs, three lines each: θ Virginis (ra 197.49) and γ Virginis, Porrima
// (ra 190.42). θ is the nearer to the centre of the figure, so it is the epicentre.
const first = figures.find((f) => f.name === EPICENTRE_FIGURE);
const hubs = hubsOf(first);
first.epicentre = hubs[0].index;

// Slots: every star but the epicentre, brightest first; ties by figure order, then star index.
const claimable = figures.flatMap((f, fi) =>
	f.stars.flatMap((star, si) => (f.epicentre === si ? [] : [{ star, fi, si }])),
);
claimable.sort((a, b) => a.star.mag - b.star.mag || a.fi - b.fi || a.si - b.si);
for (const [i, entry] of claimable.entries()) entry.star.slot = `slot-${i + 1}`;
const slotCount = claimable.length;

// The line vertices with no catalogue star, by figure and star index.
const uncatalogued = figures
	.map((figure) => ({ figure, at: figure.stars.flatMap((s, i) => (s.source ? [] : [i])) }))
	.filter((entry) => entry.at.length > 0);

// ───────────────────────────────────────────────────────────── output ──
// Written the way Biome formats it, so the checked-in file never needs a formatting pass.

const quote = (s) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const starRow = (s) => {
	const slot = s.slot ? quote(s.slot) : 'null';
	return `{ x: ${s.x}, y: ${s.y}, mag: ${s.mag}, ra: ${s.ra}, dec: ${s.dec}, slot: ${slot} },`;
};
const figureBlock = (f) =>
	[
		'\t{',
		`\t\tname: ${quote(f.name)},`,
		`\t\tmeaning: ${quote(f.meaning)},`,
		`\t\taspect: ${f.aspect},`,
		...(f.epicentre === undefined ? [] : [`\t\tepicentre: ${f.epicentre},`]),
		'\t\tstars: [',
		...f.stars.map((s) => `\t\t\t${starRow(s)}`),
		'\t\t],',
		'\t\tlines: [',
		...f.lines.map(([a, b]) => `\t\t\t[${a}, ${b}],`),
		'\t\t],',
		'\t},',
	].join('\n');
const credit = sky.credit
	.split(/(?<=\.) /)
	.map((sentence) => ` * ${sentence}`)
	.join('\n');
const lastFigure = FIGURES[FIGURES.length - 1][0];
const faintest = UNMATCHED_MAG.toFixed(1);
const uncataloguedList = uncatalogued
	.map((entry) => `${entry.figure.name} ${entry.at.join(', ')}`)
	.join('; ');
const uncataloguedNote = uncatalogued.length
	? [
			' *',
			` * The catalogue file stops at magnitude ${faintest}, so a few line vertices have no star in it.`,
			` * They are kept where the line puts them, with magnitude ${faintest}: ${uncataloguedList}.`,
			'',
		].join('\n')
	: '';

const source = `/**
 * GENERATED by scripts/build-constellations.mjs from scripts/data/sky.json — do not edit by hand.
 * To change anything here, change the script and run: node scripts/build-constellations.mjs
 *
${credit}
 *
 * The twelve figures of the flight (B6), in flight order. Each is the full real stick figure:
 * every vertex of its lines is a star. Positions are a gnomonic (tangent-plane) projection about
 * the figure's own centre with north up and east to the LEFT, the way the figure looks in the
 * night sky, fitted to a unit box: the bounding box is centred on (0, 0), its larger half-extent
 * is exactly 1 and the aspect ratio is kept.
${uncataloguedNote} */

import type { SlotId } from '../experience/contracts.ts';

export interface ConstellationStar {
	/** Position in the figure's unit box, -1 … 1. +x is right (west), +y is up (north). */
	readonly x: number;
	readonly y: number;
	/** Visual magnitude as the eye sees it (a close double counts as one star). Lower is brighter. */
	readonly mag: number;
	/** Catalogue right ascension and declination in degrees (J2000). Provenance only. */
	readonly ra: number;
	readonly dec: number;
	/** The claimable slot. Null for the one star that is Cellestial's own (B3). */
	readonly slot: SlotId | null;
}

export interface Constellation {
	readonly name: string;
	/** Written over the figure once every star in it is lit (B7). */
	readonly meaning: string;
	/** Bounding-box width / height. Above 1 the box spans x = ±1, below 1 it spans y = ±1. */
	readonly aspect: number;
	readonly stars: readonly ConstellationStar[];
	/** Index pairs into \`stars\`, each line once, in drawing order. */
	readonly lines: readonly (readonly [number, number])[];
	/** ${EPICENTRE_FIGURE} only: the index of the star replaced by Cellestial's own star (B3). */
	readonly epicentre?: number;
}

/**
 * How many stars can be claimed: every star but the epicentre. Their slots run from slot-1 to
 * slot-${slotCount}, brightest first across all twelve figures (ties by figure order, then star
 * index), so the 99 the contact Worker can name in its email are the 99 brightest.
 */
export const SLOT_COUNT = ${slotCount};

/** Written after ${lastFigure} completes (B7). */
export const FINAL_LINE = ${quote(FINAL_LINE)};

export const CONSTELLATIONS: readonly Constellation[] = [
${figures.map(figureBlock).join('\n')}
];

const BY_SLOT = new Map<string, { constellation: number; star: number }>();
for (const [constellation, figure] of CONSTELLATIONS.entries()) {
	for (const [star, { slot }] of figure.stars.entries()) {
		if (slot !== null) BY_SLOT.set(slot, { constellation, star });
	}
}

/** True for exactly slot-1 … slot-${slotCount}: no leading zeros, no padding, nothing else. */
export function isSlotId(v: unknown): v is SlotId {
	return typeof v === 'string' && BY_SLOT.has(v);
}

/** Where a slot is: indices into CONSTELLATIONS and its stars. Null if there is no such slot. */
export function slotToStar(slot: string): { constellation: number; star: number } | null {
	const found = BY_SLOT.get(slot);
	return found ? { ...found } : null;
}

/** The slot of a star. Null for the epicentre and for indices that are not a star. */
export function starToSlot(constellation: number, star: number): SlotId | null {
	return CONSTELLATIONS[constellation]?.stars[star]?.slot ?? null;
}
`;

writeFileSync(OUT, source);

// ──────────────────────────────────────────────────────────── summary ──

const pad = (n) => String(n).padStart(2);
for (const f of figures) {
	const counts = `${pad(f.stars.length)} stars, ${pad(f.lines.length)} lines`;
	console.log(`${f.name.padEnd(12)} ${counts}, aspect ${f.aspect}`);
}
const total = figures.reduce((n, f) => n + f.stars.length, 0);
console.log(`${total} stars, ${slotCount} slots`);
for (const { figure, at } of uncatalogued) {
	for (const i of at) {
		const s = figure.stars[i];
		console.log(`no catalogue star: ${figure.name} ${i} at ra ${s.ra}, dec ${s.dec} (${s.slot})`);
	}
}
for (const h of hubs) {
	const s = first.stars[h.index];
	const where = `ra ${s.ra}, dec ${s.dec}, mag ${s.mag}, ${h.fromCentre.toFixed(4)} from the centre`;
	const chosen = h.index === first.epicentre ? '  <- epicentre' : '';
	console.log(`${first.name} hub ${h.index}: ${h.lines} lines, ${where}${chosen}`);
}
console.log(`wrote ${OUT.pathname}`);
