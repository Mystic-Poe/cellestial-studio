// Builds public/sky/sky.json from the raw sources. Run once when the data changes:
//   node scripts/build-sky-data.mjs <dir-with-catalog-and-d3-celestial-files>
//
// Sources (raw files are not committed):
//   catalog                    Yale Bright Star Catalog, 5th rev. (VizieR V/50), public domain
//   constellations.lines.json  d3-celestial by Olaf Frohn, BSD 3-Clause
//   constellations.json        d3-celestial (names)
//
// Output, compact integer arrays (degrees and magnitudes × 100):
//   stars: [ra, dec, mag, bv][]   brightest first, Vmag ≤ MAG_LIMIT
//   lines: { n: name, p: number[][] }[]   each polyline is [ra, dec, ra, dec, …]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAG_LIMIT = 5.0;
const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/build-sky-data.mjs <raw-data-dir>');

const stars = [];
for (const line of readFileSync(join(dir, 'catalog'), 'latin1').split('\n')) {
	// Fixed-width columns, 1-indexed in the catalog ReadMe: RA J2000 76–83, Dec 84–90, Vmag 103–107, B−V 110–114.
	const col = (a, b) => line.slice(a - 1, b);
	const rah = col(76, 77).trim();
	const vmag = Number.parseFloat(col(103, 107));
	if (!rah || Number.isNaN(vmag) || vmag > MAG_LIMIT) continue;
	const ra = (Number(rah) + Number(col(78, 79)) / 60 + Number(col(80, 83)) / 3600) * 15;
	const sign = col(84, 84) === '-' ? -1 : 1;
	const dec = sign * (Number(col(85, 86)) + Number(col(87, 88)) / 60 + Number(col(89, 90)) / 3600);
	const bvRaw = Number.parseFloat(col(110, 114));
	const bv = Number.isNaN(bvRaw) ? 0.6 : bvRaw;
	stars.push([
		Math.round(ra * 100),
		Math.round(dec * 100),
		Math.round(vmag * 100),
		Math.round(bv * 100),
	]);
}
stars.sort((a, b) => a[2] - b[2]);

const names = new Map(
	JSON.parse(readFileSync(join(dir, 'constellations.json'), 'utf8')).features.map((f) => [
		f.id,
		f.properties.name,
	]),
);
const lines = JSON.parse(readFileSync(join(dir, 'constellations.lines.json'), 'utf8')).features.map(
	(f) => ({
		n: names.get(f.id) ?? f.id,
		// d3-celestial stores RA as longitude in −180…180; the sky math wants 0…360.
		p: f.geometry.coordinates.map((poly) =>
			poly.flatMap(([lon, lat]) => [
				Math.round((((lon % 360) + 360) % 360) * 100),
				Math.round(lat * 100),
			]),
		),
	}),
);

mkdirSync('public/sky', { recursive: true });
const out = JSON.stringify({
	credit:
		'Stars: Yale Bright Star Catalog (public domain). Constellation lines: d3-celestial © Olaf Frohn, BSD 3-Clause.',
	stars,
	lines,
});
writeFileSync('public/sky/sky.json', out);
console.log(`stars ${stars.length}, constellations ${lines.length}, ${out.length} bytes`);
