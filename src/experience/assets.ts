// Written by scripts/build-assets.mjs. Do not edit: change the script and run it again.
//
// Every image under public/cellestial/, with its size and the measurements the
// scenes need. Coordinates are in that image's own pixels, counted from its
// top-left corner as CSS and canvas count them: x runs right from 0 to w, y
// runs down from 0 to h, and the middle of the first pixel is (0.5, 0.5).
// Divide by w and h and they are fractions of the picture, at whatever size
// it is drawn.
//
// "Keyed" below means the black is gone: straight (not premultiplied) alpha,
// with colour kept under every transparent pixel, so a WebGL texture filters
// and mip-maps cleanly with premultiplyAlpha on or off. "On black" means no
// alpha: blend it additively or with screen. Every on-black file is exactly
// #000 at its edges (but for the thread that runs off the top of the E4 node).

export interface Point {
	readonly x: number;
	readonly y: number;
}

/** A rectangle from (x, y) to (x + w, y + h). */
export interface Box extends Point {
	readonly w: number;
	readonly h: number;
}

export interface Circle extends Point {
	readonly r: number;
}

/** `rx` is the longer half-axis. `angle` turns it clockwise on screen from the +x axis, in degrees. */
export interface Ellipse extends Point {
	readonly rx: number;
	readonly ry: number;
	readonly angle: number;
}

export interface Asset {
	/** From the site root. */
	readonly url: string;
	readonly w: number;
	readonly h: number;
}

/**
 * A1, unlit and lit, on black. The two files share one frame and are
 * registered (the edges of the brass agree to 0.2 px at the median and 1 px
 * at the 90th percentile), so they share this geometry too: draw both into
 * the same rectangle and cross-fade or mask freely.
 */
export interface EmblemAsset extends Asset {
	/** The brass of the C. */
	readonly c: Box;
	/** The main node, lower right: the rim of its face. */
	readonly node: Circle;
	/** The light in the main node's lens (the white-hot spot of the lit file). */
	readonly core: Point;
}

export interface LetterBox extends Box {
	readonly ch: string;
}

/** A4, the whole frame, on black. */
export interface WordmarkAsset extends Asset {
	/** Emblem, letters and star together. */
	readonly box: Box;
	/** The C emblem. Map `EmblemAsset.c` onto this to lay A1 over it. */
	readonly emblem: Box;
	readonly node: Circle;
	/** The star above the "i": the middle of its brass, out to its tips. */
	readonly star: Circle;
	/** e, l, l, e, s, t, i, a, l. */
	readonly letters: readonly LetterBox[];
}

/** A sphere or star. Files of one sphere share a frame and a disc. */
export interface DiscAsset extends Asset {
	readonly disc: Circle;
}

export interface RingAsset extends Asset {
	/** The outline of the band. */
	readonly outer: Ellipse;
	/** Its opening. */
	readonly inner: Ellipse;
}

/** Mirror-tiled: rows `half` to h are rows 0 to `half` upside down, so it repeats down the page. */
export interface SoilAsset extends Asset {
	readonly avif: string;
	readonly half: number;
}

export interface NodeAsset extends Asset {
	readonly bulb: Circle;
	/** Where the upper thread runs off the top edge (it is cut there, at a tenth of full strength). */
	readonly threadTop: Point;
	/** Where the lower thread has faded to 3%: the last of it you can see. */
	readonly threadEnd: Point;
	/** Where the lower thread's line, carried on from there, meets the bottom edge. */
	readonly threadBottom: Point;
}

export interface LogoAsset extends Asset {
	readonly c: Box;
	readonly node: Circle;
}

export interface AssetManifest {
	readonly loader: {
		readonly cUnlit: EmblemAsset;
		readonly cLit: EmblemAsset;
		readonly wordmark: WordmarkAsset;
	};
	readonly sky: {
		/** On black, for additive blending. Its glow fills the frame; the disc is the white of it. */
		readonly b3Core: DiscAsset;
		/** Keyed. The band is solid and hides what is behind it; the light from its cracks is soft. */
		readonly b3Ring: RingAsset;
		/** Keyed. A solid disc. */
		readonly b4Empty: DiscAsset;
		/** Keyed. A solid disc, its glow soft around it. */
		readonly b5Lit: DiscAsset;
		/** B5 on black, for additive blending. Same frame as `b5Lit`. */
		readonly b5LitAdd: DiscAsset;
	};
	readonly roots: {
		readonly soilLandscape: SoilAsset;
		readonly soilPortrait: SoilAsset;
		/** On black, for screen or additive blending. */
		readonly e4Node: NodeAsset;
		/** Keyed. The bulb is solid, its threads and haze soft. Same frame as `e4Node`. */
		readonly e4NodeAlpha: NodeAsset;
	};
	/**
	 * Brass skins for CSS backgrounds. Meant at their own size, one image
	 * pixel to a CSS pixel: scaled down, the brushing blurs into a gradient.
	 */
	readonly ui: {
		readonly brassMain: Asset;
		readonly brassDark: Asset;
	};
	readonly chrome: {
		/** Keyed. C1 at rest: A1 lit at 60% over A1 unlit. */
		readonly cLogo: LogoAsset;
	};
}

export const ASSETS = {
	loader: {
		cUnlit: {
			url: '/cellestial/loader/c-unlit.webp',
			w: 1400,
			h: 1400,
			c: { x: 176, y: 95, w: 1047, h: 1211 },
			node: { x: 1089.9, y: 1086.2, r: 130.8 },
			core: { x: 1086.8, y: 1086.2 },
		},
		cLit: {
			url: '/cellestial/loader/c-lit.webp',
			w: 1400,
			h: 1400,
			c: { x: 176, y: 95, w: 1047, h: 1211 },
			node: { x: 1089.9, y: 1086.2, r: 130.8 },
			core: { x: 1086.8, y: 1086.2 },
		},
		wordmark: {
			url: '/cellestial/loader/wordmark.webp',
			w: 2048,
			h: 1143,
			box: { x: 111, y: 275, w: 1791, h: 594 },
			emblem: { x: 111, y: 275, w: 512, h: 594 },
			node: { x: 556.4, y: 762.7, r: 63.6 },
			star: { x: 1572.2, y: 446.5, r: 40 },
			letters: [
				{ ch: 'e', x: 593, y: 497, w: 197, h: 225 },
				{ ch: 'l', x: 814, y: 389, w: 58, h: 335 },
				{ ch: 'l', x: 901, y: 389, w: 57, h: 335 },
				{ ch: 'e', x: 984, y: 497, w: 194, h: 225 },
				{ ch: 's', x: 1196, y: 497, w: 166, h: 225 },
				{ ch: 't', x: 1377, y: 442, w: 145, h: 281 },
				{ ch: 'i', x: 1543, y: 497, w: 58, h: 226 },
				{ ch: 'a', x: 1625, y: 496, w: 194, h: 226 },
				{ ch: 'l', x: 1836, y: 389, w: 66, h: 334 },
			],
		},
	},
	sky: {
		b3Core: {
			url: '/cellestial/sky/b3-core.webp',
			w: 512,
			h: 512,
			disc: { x: 256.2, y: 256.4, r: 80 },
		},
		b3Ring: {
			url: '/cellestial/sky/b3-ring.webp',
			w: 887,
			h: 1024,
			outer: { x: 443.1, y: 529.6, rx: 543.5, ry: 307.9, angle: -50.9 },
			inner: { x: 442.7, y: 534.6, rx: 449.9, ry: 186.2, angle: -50.9 },
		},
		b4Empty: {
			url: '/cellestial/sky/b4-empty.webp',
			w: 512,
			h: 512,
			disc: { x: 256.1, y: 256.1, r: 236 },
		},
		b5Lit: {
			url: '/cellestial/sky/b5-lit.webp',
			w: 512,
			h: 512,
			disc: { x: 256, y: 256.1, r: 148 },
		},
		b5LitAdd: {
			url: '/cellestial/sky/b5-lit-add.webp',
			w: 512,
			h: 512,
			disc: { x: 256, y: 256.1, r: 148 },
		},
	},
	roots: {
		soilLandscape: {
			url: '/cellestial/roots/soil-landscape.webp',
			w: 1920,
			h: 1368,
			avif: '/cellestial/roots/soil-landscape.avif',
			half: 684,
		},
		soilPortrait: {
			url: '/cellestial/roots/soil-portrait.webp',
			w: 1080,
			h: 2148,
			avif: '/cellestial/roots/soil-portrait.avif',
			half: 1074,
		},
		e4Node: {
			url: '/cellestial/roots/e4-node.webp',
			w: 452,
			h: 1008,
			bulb: { x: 249, y: 514.8, r: 157.8 },
			threadTop: { x: 235.2, y: 0 },
			threadEnd: { x: 195.5, y: 864.5 },
			threadBottom: { x: 169.1, y: 1008 },
		},
		e4NodeAlpha: {
			url: '/cellestial/roots/e4-node-alpha.webp',
			w: 452,
			h: 1008,
			bulb: { x: 249, y: 514.8, r: 157.8 },
			threadTop: { x: 235.2, y: 0 },
			threadEnd: { x: 195.5, y: 864.5 },
			threadBottom: { x: 169.1, y: 1008 },
		},
	},
	ui: {
		brassMain: { url: '/cellestial/ui/brass-main.webp', w: 1024, h: 512 },
		brassDark: { url: '/cellestial/ui/brass-dark.webp', w: 1024, h: 512 },
	},
	chrome: {
		cLogo: {
			url: '/cellestial/chrome/c-logo.webp',
			w: 167,
			h: 192,
			c: { x: 1.9, y: 1.9, w: 162.8, h: 188.3 },
			node: { x: 143.9, y: 156, r: 20.3 },
		},
	},
} as const satisfies AssetManifest;
