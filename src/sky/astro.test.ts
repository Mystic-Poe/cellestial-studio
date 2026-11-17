import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	bvToRgb,
	DENVER,
	galacticToEquatorial,
	julianDate,
	localSiderealDeg,
	magToAlpha,
	magToRadius,
	milkyWayBrightness,
	project,
	toHorizontal,
} from './astro.ts';

const near = (a: number, b: number, tol: number) =>
	assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b} (±${tol})`);

test('julianDate: J2000 epoch is 2451545.0', () => {
	near(julianDate(Date.UTC(2000, 0, 1, 12)), 2451545.0, 1e-9);
});

test('localSiderealDeg: Greenwich at J2000 is 280.46°', () => {
	near(localSiderealDeg(Date.UTC(2000, 0, 1, 12), 0), 280.46061837, 1e-6);
});

test('localSiderealDeg: a sidereal day is ~4 minutes shorter than a solar day', () => {
	const t = Date.UTC(2026, 10, 16, 4);
	const a = localSiderealDeg(t, DENVER.lon);
	const b = localSiderealDeg(t + 86164091, DENVER.lon); // one sidereal day later
	near(Math.min(Math.abs(a - b), 360 - Math.abs(a - b)), 0, 0.01);
});

test('toHorizontal: Polaris sits at Denver latitude, due north, at any hour', () => {
	for (const h of [0, 5, 11, 17, 23]) {
		const lst = localSiderealDeg(Date.UTC(2026, 10, 16, h), DENVER.lon);
		const p = toHorizontal(37.95, 89.26, DENVER.lat, lst);
		near(p.alt, DENVER.lat, 0.8);
		assert.ok(p.az < 2 || p.az > 358, `Polaris azimuth ${p.az}`);
	}
});

test('toHorizontal: a star on the meridian is due south at 90 − lat + dec', () => {
	const p = toHorizontal(100, 10, DENVER.lat, 100);
	near(p.alt, 90 - DENVER.lat + 10, 1e-9);
	near(p.az, 180, 1e-9);
});

test('toHorizontal: Sirius is up over Denver on a November night and down at noon', () => {
	// Sirius RA 101.29°, Dec −16.72°. 3 a.m. MST Nov 16 2026 = 10:00 UTC.
	const night = toHorizontal(
		101.29,
		-16.72,
		DENVER.lat,
		localSiderealDeg(Date.UTC(2026, 10, 16, 10), DENVER.lon),
	);
	assert.ok(night.alt > 20, `night alt ${night.alt}`);
	assert.ok(night.az > 150 && night.az < 230, `night az ${night.az}`);
	const noon = toHorizontal(
		101.29,
		-16.72,
		DENVER.lat,
		localSiderealDeg(Date.UTC(2026, 10, 16, 19), DENVER.lon),
	);
	assert.ok(noon.alt < 0, `noon alt ${noon.alt}`);
});

test('project: due south at the centre altitude lands at screen centre', () => {
	const v = { centreAlt: 45, fov: 100, width: 1000, height: 600 };
	const p = project({ alt: 45, az: 180 }, v);
	assert.ok(p);
	near(p.x, 500, 1e-6);
	near(p.y, 300, 1e-6);
});

test('project: east is left, west is right, higher is up', () => {
	const v = { centreAlt: 45, fov: 100, width: 1000, height: 600 };
	const east = project({ alt: 45, az: 150 }, v);
	const west = project({ alt: 45, az: 210 }, v);
	const high = project({ alt: 60, az: 180 }, v);
	assert.ok(east && west && high);
	assert.ok(east.x < 500 && west.x > 500);
	assert.ok(high.y < 300);
});

test('project: half the field of view reaches the screen edge', () => {
	const v = { centreAlt: 0, fov: 90, width: 1000, height: 600 };
	const p = project({ alt: 0, az: 180 + 45 }, v);
	assert.ok(p);
	near(p.x, 1000, 1e-6);
});

test('project: points behind the viewer are culled', () => {
	assert.equal(
		project({ alt: 10, az: 0 }, { centreAlt: 30, fov: 100, width: 1000, height: 600 }),
		null,
	);
});

test('bvToRgb: hot stars are blue, cool stars are orange', () => {
	const [rb, , bb] = bvToRgb(-0.3).split(',').map(Number);
	const [ro, , bo] = bvToRgb(1.8).split(',').map(Number);
	assert.ok(bb > rb, 'blue star has more blue than red');
	assert.ok(ro > bo, 'orange star has more red than blue');
	assert.equal(bvToRgb(-5), bvToRgb(-0.4));
	assert.equal(bvToRgb(9), bvToRgb(2.0));
});

test('magToRadius / magToAlpha: brighter stars are bigger and brighter; low stars dim', () => {
	assert.ok(magToRadius(-1.46) > magToRadius(1) && magToRadius(1) > magToRadius(4.5));
	assert.ok(magToRadius(6) >= 0.45);
	assert.ok(magToAlpha(0, 45) > magToAlpha(4.5, 45));
	assert.ok(magToAlpha(1, 3) < magToAlpha(1, 45));
});

test('galacticToEquatorial: the galactic centre is in Sagittarius', () => {
	const c = galacticToEquatorial(0, 0);
	near(c.ra, 266.4, 0.2);
	near(c.dec, -28.94, 0.2);
});

test('galacticToEquatorial: b = 90 is the north galactic pole in Coma Berenices', () => {
	const p = galacticToEquatorial(0, 90);
	near(p.ra, 192.86, 0.2);
	near(p.dec, 27.13, 0.2);
});

test('milkyWayBrightness: brightest at the centre, faint at the anticentre and off the plane', () => {
	assert.ok(milkyWayBrightness(0, -4) > milkyWayBrightness(180, 0));
	assert.ok(milkyWayBrightness(0, -4) > milkyWayBrightness(0, 30));
	assert.ok(milkyWayBrightness(75, 6) > milkyWayBrightness(140, 0), 'Cygnus swell');
	assert.ok(milkyWayBrightness(60, 1.5) < milkyWayBrightness(60, -5), 'Great Rift dark lane');
});
