// The palette, for canvas and WebGL. The same colours as src/styles/tokens.css.
//
// Each one is sampled from the pack images by scripts/build-assets.mjs, which
// names the region it came from and checks the hex strings below against its
// samples every time it runs.
//
// A `*_RGB` triple is the hex value over 255: sRGB-encoded, 0 to 1, which is
// what a canvas and an un-managed shader want. For a shader that works in
// linear light, pass it through `linear()`.

export type Rgb = readonly [number, number, number];

/** The sky's ground. */
export const BLACK = '#000000';
export const BLACK_RGB = [0, 0, 0] as const;

/** The faces of the A4 letters. On black it is 3.2:1: lines, borders and fills, never words. */
export const BRASS = '#74573f';
export const BRASS_RGB = [0.4549, 0.3412, 0.2471] as const;

/** The lit faces of the A4 letters: brass for words. On black it is 6.7:1. */
export const BRASS_TEXT = '#ae8a68';
export const BRASS_TEXT_RGB = [0.6824, 0.5412, 0.4078] as const;

/** The lit bevels of the A4 letters. On black it is 10.2:1. */
export const BRASS_HI = '#d5ae88';
export const BRASS_HI_RGB = [0.8353, 0.6824, 0.5333] as const;

/** The far sides of those bevels. */
export const BRASS_LO = '#493321';
export const BRASS_LO_RGB = [0.2863, 0.2, 0.1294] as const;

/** Honeycomb and constellation lines are brass at this opacity. */
export const BRASS_DIM_ALPHA = 0.2;

/** The lit circuit lines of A1: circuits, beads, pulses, mycelium. */
export const BLUE = '#6480ce';
export const BLUE_RGB = [0.3922, 0.502, 0.8078] as const;

/** The disc of the B3 core: star cores, flash peaks. */
export const BLUE_WHITE = '#daeff8';
export const BLUE_WHITE_RGB = [0.8549, 0.9373, 0.9725] as const;

export const WHITE = '#ffffff';
export const WHITE_RGB = [1, 1, 1] as const;
/** Body copy is white at this opacity. */
export const WHITE_ALPHA = 0.9;

/** The average of the soil: the Roots' ground behind the photo. */
export const EARTH = '#1d1817';
export const EARTH_RGB = [0.1137, 0.0941, 0.0902] as const;

/** A CSS colour from a triple, for canvas: `rgba(BLUE_RGB, 0.4)`. */
export function rgba(rgb: Rgb, alpha = 1): string {
	const [r, g, b] = rgb.map((v) => Math.round(v * 255));
	return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** An sRGB-encoded triple in linear light. */
export function linear(rgb: Rgb): [number, number, number] {
	const decode = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	return [decode(rgb[0]), decode(rgb[1]), decode(rgb[2])];
}
