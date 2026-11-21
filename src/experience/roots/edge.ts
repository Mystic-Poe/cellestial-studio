// The top edge of the ground: where the soil meets the black of the sky, and
// where the stars crash. A ruler-straight line there would read as a box, so
// the soil's first few pixels are cut to a low, uneven profile.
//
// One function gives the profile. Roots.astro turns it into the mask of the
// strip of soil at the very top (at build time), and the scene asks it where
// the surface is under a falling star, so the light starts on the line the
// eye sees. It is a sum of sines that repeats every `period` pixels: the mask
// tiles sideways without a seam on a screen of any width.

export const EDGE = {
	/** The height of the strip the profile is cut from, in CSS pixels. */
	height: 26,
	/** The profile repeats after this many CSS pixels. */
	period: 1600,
} as const;

/** How the profile is built: [waves per period, share of the height, phase]. */
const WAVES: readonly (readonly [number, number, number])[] = [
	[2, 0.2, 0.6],
	[5, 0.12, 2.1],
	[11, 0.075, 4.0],
	[23, 0.05, 1.3],
	[47, 0.035, 5.2],
	[97, 0.02, 0.7],
];

/**
 * How far below the top of #roots the soil begins at `x` (CSS pixels from the
 * left edge of the ground): between 1 and `height - 1`.
 */
export function edgeY(x: number): number {
	const u = (x / EDGE.period) * Math.PI * 2;
	let v = 0.5;
	for (const [n, share, phase] of WAVES) v += share * Math.sin(u * n + phase);
	return 1 + Math.min(1, Math.max(0, v)) * (EDGE.height - 2);
}

/** The middle of the profile: what the ground's top edge is, as one number. */
export const EDGE_MEAN = 1 + 0.5 * (EDGE.height - 2);

/** The profile as an SVG image for a CSS mask: opaque below the line. */
export function edgeMaskUrl(): string {
	const step = 4;
	let d = `M0 ${EDGE.height}`;
	for (let x = 0; x <= EDGE.period; x += step) d += `L${x} ${edgeY(x).toFixed(1)}`;
	d += `L${EDGE.period} ${EDGE.height}Z`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EDGE.period} ${EDGE.height}" preserveAspectRatio="none"><path d="${d}"/></svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
