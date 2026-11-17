// Real-sky math: where each catalog star sits above Denver right now, and how
// it lands on the screen. Pure functions, unit-tested with node --test.

export const DENVER = { lat: 39.7392, lon: -104.9903 } as const;

const RAD = Math.PI / 180;

/** Julian date for a Unix time in milliseconds. */
export function julianDate(ms: number): number {
	return ms / 86400000 + 2440587.5;
}

/** Local sidereal time in degrees (0–360) at an east-positive longitude. */
export function localSiderealDeg(ms: number, lonDeg: number): number {
	const d = julianDate(ms) - 2451545.0;
	const gmst = 280.46061837 + 360.98564736629 * d;
	return (((gmst + lonDeg) % 360) + 360) % 360;
}

export interface Horizontal {
	/** Altitude above the horizon, degrees. */
	alt: number;
	/** Azimuth from north through east, degrees (0–360). */
	az: number;
}

/** Equatorial (RA/Dec, degrees) to horizontal coordinates for an observer. */
export function toHorizontal(
	raDeg: number,
	decDeg: number,
	latDeg: number,
	lstDeg: number,
): Horizontal {
	const H = (lstDeg - raDeg) * RAD;
	const dec = decDeg * RAD;
	const lat = latDeg * RAD;
	const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
	const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
	const az = Math.atan2(
		-Math.cos(dec) * Math.sin(H),
		Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H),
	);
	return { alt: alt / RAD, az: (((az / RAD) % 360) + 360) % 360 };
}

export interface View {
	/** Altitude of the screen centre, degrees. The view always faces south. */
	centreAlt: number;
	/** Horizontal field of view across the screen width, degrees. */
	fov: number;
	width: number;
	height: number;
}

/**
 * Stereographic projection facing south, tilted up to `centreAlt`. East is on
 * the left, as when you stand facing south and look up. Returns screen pixels
 * with (0,0) at the top-left, or null for points behind the viewer.
 */
export function project(h: Horizontal, v: View): { x: number; y: number } | null {
	const alt = h.alt * RAD;
	const az = h.az * RAD;
	const n = Math.cos(alt) * Math.cos(az);
	const e = Math.cos(alt) * Math.sin(az);
	const u = Math.sin(alt);
	const a = v.centreAlt * RAD;
	// forward = south tilted up; right = west; up = toward the zenith.
	const Z = -n * Math.cos(a) + u * Math.sin(a);
	if (Z <= -0.2) return null;
	const X = -e;
	const Y = n * Math.sin(a) + u * Math.cos(a);
	const scale = v.width / 2 / (2 * Math.tan((v.fov * RAD) / 4));
	return {
		x: v.width / 2 + ((2 * X) / (1 + Z)) * scale,
		y: v.height / 2 - ((2 * Y) / (1 + Z)) * scale,
	};
}

/** Star colour from the B–V colour index, as an "r,g,b" string. */
export function bvToRgb(bv: number): string {
	const stops: [number, number, number, number][] = [
		[-0.4, 155, 176, 255],
		[0.0, 202, 215, 255],
		[0.4, 248, 247, 255],
		[0.6, 255, 244, 234],
		[1.0, 255, 214, 170],
		[1.5, 255, 186, 120],
		[2.0, 255, 166, 96],
	];
	const x = Math.max(-0.4, Math.min(2.0, bv));
	let i = 0;
	while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
	const [x0, r0, g0, b0] = stops[i];
	const [x1, r1, g1, b1] = stops[i + 1];
	const t = (x - x0) / (x1 - x0);
	const m = (p: number, q: number) => Math.round(p + (q - p) * t);
	return `${m(r0, r1)},${m(g0, g1)},${m(b0, b1)}`;
}

/** Dot radius in CSS px from apparent magnitude: brighter = bigger. */
export function magToRadius(mag: number): number {
	return Math.max(0.45, 0.5 + (4.8 - mag) * 0.42);
}

/** Base opacity from magnitude, dimmed near the horizon (atmospheric extinction). */
export function magToAlpha(mag: number, altDeg: number): number {
	const base = Math.max(0.25, Math.min(1, 0.35 + (4.8 - mag) * 0.16));
	const ext = altDeg >= 12 ? 1 : Math.max(0, altDeg / 12);
	return base * (0.35 + 0.65 * ext);
}
