// What the rest of the sky's own code builds on: the beads (B8), the "claim
// yours" pulse (B9), the preview panel (B10), the lit-star panel and the exit
// button (B11). None of this is part of the cross-scene contract; it stays
// inside src/experience/sky/.
//
// Get it from the scene that mount() returned: `hooksOf(scene)` in index.ts.

import type { PerspectiveCamera, Scene } from 'three';
import type { ClaimsStore, ScreenCircle, SkyScene, SlotId } from '../contracts.ts';
import type { Answer } from './answer.ts';
import type { FlightMode } from './flight.ts';
import type { Honeycomb, LatticePath } from './lattice.ts';
import type { Camera, Layout, Projected } from './layout.ts';
import type { Meaning } from './meaning.ts';
import type { Panels } from './panels.ts';

export interface SkyEvents {
	/**
	 * A tap or click on empty sky (never one on a star). If the flight was
	 * moving, the tap has stopped it dead, and `wasMoving` says so.
	 * Viewport pixels.
	 */
	'tap-empty': { x: number; y: number; wasMoving: boolean };
	/**
	 * A star was clicked, tapped or activated from the keyboard. Fired before
	 * the sky acts on it (claims.pick or claims.place for an empty star,
	 * focusStar for a lit one). `circle` is the star's disc on screen then.
	 */
	'star-pick': { slot: SlotId; lit: boolean; circle: ScreenCircle | null };
	/**
	 * PART B OPENS THE PREVIEW PANEL (B10) HERE. An empty star was picked and
	 * no ask was waiting for a star: claims.pick(slot) has just been called.
	 * `circle` is the star's disc on screen (viewport pixels) to place the
	 * panel beside; ask starCircle(slot) again on later frames if it must follow.
	 */
	'open-empty': { slot: SlotId; circle: ScreenCircle | null };
	/**
	 * PART B OPENS THE LIT-STAR PANEL HERE. The camera has closed in on a lit
	 * star and come to rest (focusStar has resolved). `ignited` is true when
	 * the claim was just played there (the visitor's own request, a moment ago).
	 */
	'open-lit': { slot: SlotId; circle: ScreenCircle | null; ignited: boolean };
	/**
	 * Whatever part B has open should close: the visitor flew on, the scene
	 * was paused, reset or handed to the loader, or the stars began to fall.
	 * (A tap on empty sky is 'tap-empty', and letting a close-up go is
	 * 'focus' with slot null: part B decides what those close.)
	 */
	dismiss: { reason: 'flight' | 'inactive' | 'reset' | 'fall' };
	/** The flight has come to rest on a station by itself (a glide ran out). Not fired by a tap's dead stop. */
	rest: { layer: number; figure: number };
	/** The stage has handed the sky to the visitor, or taken it back (setActive). */
	active: { on: boolean };
	/** The camera is at, or has just flown through, a layer's station. */
	station: { layer: number; figure: number };
	/** All twelve figures have been at their stations. Fired once per page. */
	'round-complete': { figures: number };
	/** A star has just begun to light (B4 to B5). */
	ignite: { slot: SlotId };
	/** The camera has closed in on a star (focusStar), or let it go again (slot null). */
	focus: { slot: SlotId | null };
	/** Once per drawn frame, before it is drawn. `time` is the animation clock, seconds. */
	frame: { time: number; dt: number };
}

/** A vertex of the honeycomb plane of one layer. */
export interface LatticeNode {
	layer: number;
	vertex: number;
}

export interface LatticeHooks {
	/** The graph every plane shares: vertices, edges, neighbours, struts, path(). */
	readonly graph: Honeycomb;
	/** The layer whose plane is nearest in front of the camera. */
	layer(): number;
	/** World position of a vertex of a layer's plane. */
	vertexWorld(layer: number, vertex: number): { x: number; y: number; z: number };
	/** Where that vertex is on screen now. Null when it is behind the lens. */
	vertexScreen(layer: number, vertex: number): Projected | null;
	/** The vertex of a layer's plane nearest a viewport point. The layer in front, unless one is named. */
	nearestVertex(x: number, y: number, layer?: number): LatticeNode;
	/** The vertex nearest a star, in the nearest layer ahead that shows it. Null for an unknown slot. */
	nearestVertexToStar(slot: SlotId): LatticeNode | null;
	/** A shortest walk along the edges of a plane, from one vertex to another. */
	path(from: number, to: number): LatticePath | null;
	/**
	 * Light one edge of one layer's plane for a moment (about half a second). `strength` 0..1.
	 * `at` is the clock time the light begins (now, if left out): a caller that is told of
	 * the time late, as under a pinned clock, can still light the edge when it was passed.
	 */
	pulseEdge(layer: number, edge: number, strength?: number, at?: number): void;
	/** The same for the strut from `vertex` of `layer` to the same vertex of `layer + 1`, if it has one. */
	pulseStrut(layer: number, vertex: number, strength?: number, at?: number): void;
}

export interface SkyHooks {
	on<K extends keyof SkyEvents>(type: K, fn: (e: SkyEvents[K]) => void): () => void;
	once<K extends keyof SkyEvents>(type: K, fn: (e: SkyEvents[K]) => void): () => void;

	readonly lattice: LatticeHooks;

	/** The claims store, once the stage has one. */
	readonly claims: Promise<ClaimsStore>;
	/** The same, or null while it has not arrived. */
	claimsNow(): ClaimsStore | null;

	/** #sky-ui: where the panels, the label and the exit button go. */
	readonly ui: HTMLElement;

	/**
	 * A star's disc on screen now (centre and radius, viewport pixels), in the
	 * nearest layer ahead that shows it. Null when it is behind the lens, out
	 * of the viewport or faded out.
	 */
	starCircle(slot: SlotId): ScreenCircle | null;
	/** Whether the sky is showing the star lit. */
	isLit(slot: SlotId): boolean;
	/** The empty star of the layer in front nearest a viewport point, however far. Null if every one is lit. */
	nearestEmptyStar(x: number, y: number): SlotId | null;
	/** Extra light on one star, 0..1: its rim brightens and it swells a little. For the B9 pulse. */
	setStarGlow(slot: SlotId, level: number): void;

	/**
	 * Pick a star as a click on its button does: an empty one is remembered (or takes the
	 * waiting ask), a lit one is flown to. For the words under a pulsing star.
	 */
	pick(slot: SlotId): void;
	/** True while the visitor has the sky (setActive) and it is not falling or fallen. */
	isActive(): boolean;

	/** The star the camera has closed in on (focusStar), or null. */
	focused(): SlotId | null;
	/** Let that star go: the camera eases back to the station. */
	releaseFocus(): void;

	/** Draw a frame even if the loop is idle (reduced motion, inactive). */
	requestFrame(): void;
	/** Keep the loop running until the function returned is called. */
	keepAwake(): () => void;
	/** The animation clock, seconds. */
	time(): number;
	layout(): Layout;
	camera(): Readonly<Camera>;
	/** A world point on screen. Layer k's plane is at z = -k * SPACING. */
	project(x: number, y: number, z: number): Projected;
	/** The flight, read only. `coord` is the position as a layer number (whole at a station). */
	flight(): { pos: number; vel: number; mode: FlightMode; coord: number; figure: number };
	/** The governor's level (0 is everything on) and the pixel ratio in use. */
	quality(): { level: number; levels: number; dpr: number; frameMs: number };
	/** True when the scene is the still one (reduced motion). */
	isStill(): boolean;
	/** True once all twelve figures have been at their stations (the contract's roundComplete). */
	roundComplete(): boolean;

	/**
	 * The three.js scene, for drawing more into the same sky. It is drawn about
	 * the camera's depth: the camera stands at (camera().x, camera().y, 0) and
	 * layer k's plane is at z = `layerZ(k)`. Nothing is depth-tested: set
	 * `renderOrder` from `layerOrder(k)` (a layer's own things use +0 to +11,
	 * the struts behind it +15) and blend ONE, ONE_MINUS_SRC_ALPHA.
	 */
	readonly three: {
		readonly scene: Scene;
		readonly camera: PerspectiveCamera;
		layerZ(layer: number): number;
		layerOrder(layer: number): number;
	};
}

/** For the test page and capture scripts only. */
export interface SkyDebug {
	/** Pin the animation clock at `seconds`, simulating everything up to it; null lets it run again. */
	setClock(seconds: number | null): void;
	/** Stand at a position given as a layer number (fractions are between two stations). */
	setCoord(coord: number): void;
	/** Hold the governor at one level; null hands it back. */
	setLevel(level: number | null): void;
	/** Step and draw one frame now, synchronously. */
	drawNow(): void;
	loseContext(): void;
	restoreContext(): void;
	/** Numbers for the report. */
	stats(): Record<string, unknown>;
}

/** The scene, with its hooks. `mount` returns this, typed as SkyScene for the stage. */
export interface SkyInternals extends SkyScene {
	/** Null when the sky could not start (no WebGL). */
	readonly hooks: SkyHooks | null;
	readonly debug: SkyDebug | null;
	/** The beads, the pulse and the words (answer.ts). */
	readonly answer: Answer | null;
	/** The empty-star panel and the lit-star panel (panels.ts). */
	readonly panels: Panels | null;
	/** The meanings written over complete figures, B7 (meaning.ts). */
	readonly meaning: Meaning | null;
}
