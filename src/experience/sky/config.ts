// Every number the sky is tuned with, in one place.
//
// World units are the units of the constellation data: a figure's unit box
// runs from -1 to 1 on its longer side. The camera looks down -z; layer k
// sits at z = -k * SPACING. Screen sizes are CSS pixels.

/** How many figures make one round. */
export const FIGURES = 12;

/** World distance between two constellation layers. */
export const SPACING = 6;

/**
 * The lens. The focal length in pixels is this fraction of the viewport's
 * longer side, so the field of view along that side is always 73.5 degrees
 * (50 degrees top to bottom at 1440x900, 39 degrees side to side on a phone).
 */
export const FOCAL = 0.67;

/** Room the page chrome needs: the figure at a station stays inside it. */
export const SAFE = {
	top: 96,
	bottom: 120,
	/** Sides, at or under `narrow` pixels of width, and above it. */
	sidePhone: 20,
	sideDesktop: 64,
	narrow: 720,
} as const;

/**
 * Radius of a star's disc on screen at its station: `base + slope * min(w, h)`,
 * clamped (19.5 px at 1440x900: a star of middling brightness is then about
 * 21 px, large enough for B4's traces to be seen). On a portrait screen the
 * stars are sized for the hand and not for the figure's fit: `portrait` is
 * the base radius there, and no star, however faint, is drawn smaller than
 * `floor` at its station.
 */
export const STAR_PX = {
	slope: 0.0187,
	base: 2.66,
	min: 8,
	max: 19.5,
	portrait: 12,
	floor: 13,
} as const;

/**
 * B4 for a star at its station: the pack's empty star with its brass traces
 * thickened and lifted so they survive at 26 to 50 px, in the same frame as
 * `ASSETS.sky.b4Empty`. Derived by scripts/assets/sky.mjs
 * (`node scripts/build-assets.mjs modules`), which is why it is named here
 * and not in the manifest.
 */
export const B4_STATION_URL = '/cellestial/sky/b4-station.webp';
/** A star's radius on screen, pixels: below `from` it is the station picture, above `to` the pack's own. */
export const B4_CLOSE = { from: 34, to: 86 } as const;

/** Cellestial's star on a portrait screen: at least this many pixels across at Virgo's station. */
export const B3_PORTRAIT_PX = 130;

/** Size follows magnitude gently: the brightest and the faintest star, as multiples of the base. */
export const MAG = { bright: 0.85, faint: 5, brightScale: 1.35, faintScale: 0.8 } as const;

/** The honeycomb. */
export const LATTICE = {
	/** Edge length of a hexagon, world units. */
	edge: 0.3,
	/** The plane under each layer is a disc of cells this wide (radius), fading over its outer part. */
	radius: 4.6,
	fadeFrom: 1.4,
	/**
	 * Planes per layer spacing: one under each constellation and the rest evenly between it
	 * and the next, so the honeycomb is seen to recede. Only a layer's own plane carries beads.
	 */
	between: 3,
	/** Squared distances from the axis, in edges, of the vertices that carry a strut. */
	strutRings: [4, 13, 28, 49, 76],
} as const;

/** Cellestial's star, in world units. `ring` is the outer ring's longer half-axis. */
export const B3 = {
	ring: 0.215,
	/** The three bands, outermost first: size, squash across the short axis, turn rate (rad/s), rest angle (rad). */
	rings: [
		{ scale: 1, squash: 1, rate: 0.21, rest: 0.35 },
		{ scale: 0.83, squash: 0.8, rate: -0.3, rest: 2.3 },
		{ scale: 0.67, squash: 1.18, rate: 0.43, rest: 4.2 },
	],
	/** Radius of the core's disc as a fraction of `ring`. */
	core: 0.27,
	/** The camera never comes nearer to its centre than this when it flies through Virgo. */
	clearance: 0.42,
} as const;

/** Everything fades in out of the black with distance and out again before it would touch the lens. */
export const FADE = {
	/** Stars and figure lines: gone at `near[0]`, whole from `near[1]`. */
	near: [0.05, 0.2],
	/** B3 is large: it lets go earlier. */
	nearB3: [0.22, 0.75],
	/** Figures: whole up to `far[0]`, then an exponential falloff with this length, gone at `far[2]`. */
	far: [5, 6, 36],
	/** The honeycomb lets go sooner than the figures. */
	farLattice: [2.5, 4.6, 27],
} as const;

/** The flight, in world units and seconds. */
export const FLIGHT = {
	/** Where the first gesture takes the speed, and where continued scrolling takes it. */
	cruise: 2.4,
	max: 8,
	/** Seconds of continued input from cruise to max. */
	build: 2.6,
	/** How quickly built-up speed is forgotten once the input stops. */
	forget: 3,
	/** Time constant of the pull towards the wanted speed. */
	response: 0.3,
	/** Input counts as continuing for this long after its last event. */
	hold: 0.16,
	/**
	 * The same for a swipe. A finger leaves the screen between two swipes, and that is still
	 * continued scrolling: a swipe counts for this long after its last movement.
	 */
	touchHold: 0.5,
	/** The glide stops over at least this long, and averages at least `glideSpeed`. */
	decel: 1.6,
	glideSpeed: 1.9,
	glideMin: 1.1,
} as const;

/** Flying in on one star. */
export const FOCUS = {
	/** The star's disc radius on screen, as a fraction of the viewport's shorter side, and its cap. */
	size: 0.16,
	maxPx: 108,
	/** Seconds: the ease in on the star, and each layer flown through on the way. */
	approach: 1.15,
	perLayer: 0.42,
	maxTravel: 3,
} as const;

/** The claim: B4 to B5, seconds. */
export const IGNITE = { fire: 0.6, flash: 0.45, settle: 1.1 } as const;

/** The fall. `gravity` is in pixels per second squared at the nearest layer. */
export const FALL = {
	gravity: 2300,
	stagger: 0.28,
	/** A star's trail is as long as it falls in this many seconds, and at most `trailMax` of its radii. */
	trail: 0.14,
	trailMax: 24,
	fade: 0.55,
	timeout: 7,
} as const;

/** sessionStorage key for "one full round flown". */
export const ROUND_KEY = 'cellestial:round';
