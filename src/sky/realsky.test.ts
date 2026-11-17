import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { constellationWake, placeSky, type SkyData, viewFor } from './realsky.ts';

const data: SkyData = JSON.parse(
	readFileSync(new URL('../../public/sky/sky.json', import.meta.url), 'utf8'),
);
// 10 p.m. MST, Jan 15 2027: Orion high in the south over Denver.
const winterNight = Date.UTC(2027, 0, 16, 5);
// 10 p.m. MDT, Jul 15 2027: Scorpius low in the south.
const summerNight = Date.UTC(2027, 6, 16, 4);

test('sky data: real catalog, brightest first, all 88 IAU figures present', () => {
	assert.ok(data.stars.length > 1500);
	assert.equal(data.stars[0][2], -146, 'Sirius first');
	for (let i = 1; i < data.stars.length; i++) assert.ok(data.stars[i][2] >= data.stars[i - 1][2]);
	assert.ok(new Set(data.lines.map((l) => l.n)).size >= 88);
});

test('placeSky: a January night shows Orion; a July night shows Scorpius and not Orion', () => {
	const view = viewFor(1440, 900);
	const winter = placeSky(data, winterNight, view, 5).constellations.map((c) => c.name);
	assert.ok(winter.includes('Orion'), winter.join());
	const summer = placeSky(data, summerNight, view, 5).constellations.map((c) => c.name);
	assert.ok(summer.includes('Scorpius'), summer.join());
	assert.ok(!summer.includes('Orion'));
});

test('placeSky: only stars above the horizon and near the screen; magnitude limit thins the sky', () => {
	const view = viewFor(1440, 900);
	const full = placeSky(data, winterNight, view, 5);
	const thin = placeSky(data, winterNight, view, 4);
	assert.ok(full.stars.length > 150, `stars ${full.stars.length}`);
	assert.ok(thin.stars.length < full.stars.length);
	for (const s of full.stars) assert.ok(s.x > -41 && s.x < 1481);
});

test('constellationWake: wakes when the light reaches any of its stars', () => {
	const c = {
		name: 'Test',
		polys: [],
		verts: [
			{ x: 100, y: 100 },
			{ x: 400, y: 100 },
		],
		label: { x: 250, y: 100 },
	};
	const falloff = (d: number) => Math.max(0, 1 - d / 100);
	assert.equal(constellationWake(c, 400, 100, falloff), 1);
	assert.equal(constellationWake(c, 250, 400, falloff), 0);
	assert.ok(constellationWake(c, 100, 170, falloff) > 0);
});
