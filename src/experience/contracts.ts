// The cross-scene contract for the redesign.
//
// Every scene (loader, sky, roots, chrome, fx) is built against these
// interfaces and nothing else, so scenes can be developed apart and still
// meet. If a scene needs something that is not here, the contract changes
// first, in this file, and only then the scene.

/** The page is always in exactly one of these. Mirrored on <html data-scene>. */
export type SceneId = 'loading' | 'sky' | 'fall' | 'roots' | 'warp';

/** The four menu destinations (C3), in menu order. */
export type Destination = 'sky' | 'build' | 'claim' | 'contact';

/**
 * A claimable star. `slot-1` … `slot-146`, numbered across the twelve
 * constellations. It is the same string the hidden `star` field posts to
 * /api/contact; the contact Worker only names slot-1…slot-99 in its email
 * and silently ignores the rest, which is fine: the request still sends.
 */
export type SlotId = `slot-${number}`;

/** A circle on screen, in CSS pixels, viewport coordinates. */
export interface ScreenCircle {
	x: number;
	y: number;
	r: number;
}

// ───────────────────────────────────────────────────────────── claims ──

/** A lit star. `ask` is exactly what was asked: no name, no added fields. */
export interface Claim {
	slot: SlotId;
	ask: string;
}

export type ClaimsEvent =
	| { type: 'picked'; slot: SlotId | null }
	| { type: 'claimed'; slot: SlotId }
	| { type: 'unplaced' };

export interface ClaimsStore {
	/** Lit stars: the published registry plus requests sent from this device. */
	all(): ReadonlyMap<SlotId, Claim>;
	isLit(slot: SlotId): boolean;
	/** The empty star this visitor chose but has not sent for yet. */
	picked(): SlotId | null;
	pick(slot: SlotId | null): void;
	/** A request was sent with no star chosen; its ask waits to be placed. */
	unplaced(): string | null;
	/** The claim flow calls this when /api/contact answered OK. Never before. */
	recordSent(ask: string, slot: SlotId | null): void;
	/** Put the waiting ask on an empty star the visitor just chose. */
	place(slot: SlotId): void;
	subscribe(fn: (e: ClaimsEvent) => void): () => void;
}

/** The two existing flows, opened from anywhere. Plumbing is untouched. */
export interface ClaimFlow {
	/** F1 and the B10 button. Opens the build-request dialog. */
	openClaim(slot?: SlotId | null): void;
	/** F2. Opens the message box (the existing contact form). */
	openContact(): void;
}

// ───────────────────────────────────────────────────────────── scenes ──

export interface LoaderScene {
	/** Resolves once the loader has handed over to the sky, or never ran. */
	readonly done: Promise<void>;
	/** Tap, click or any key: jump straight to the A5 star hand-off. Idempotent. */
	skip(): void;
	/** Debug only: freeze the timeline at `t` seconds. */
	seek(t: number): void;
}

export interface SkyScene {
	/** Textures decoded and a first frame drawn. */
	readonly ready: Promise<void>;
	/** Run or pause the render loop and flight input. */
	setActive(on: boolean): void;
	/** Opening pose: Virgo's layer, B3 centred, no velocity. */
	reset(): void;
	/** Reduced motion: opening pose, rings static, no flight, one frame. */
	setStill(on: boolean): void;

	/**
	 * A5, step 1. The loader's little star is at `at` on screen. Show B3's core
	 * alone, exactly there and exactly that size (`r` is the radius of the
	 * core's bright disc, not of its corona), on black: no rings, no lattice,
	 * no constellation. The render loop runs from here on.
	 */
	introPrime(at: ScreenCircle): void;
	/**
	 * A5, step 2, driven by the loader's clock. A pure function of `t`, so the
	 * loader may jump or replay it: 0 is the primed pose, 1 is exactly the
	 * opening pose of reset(). The core travels and grows the whole way. The
	 * rings fade in and settle over t 0.4 → 0.85 (the loader's shards arrive
	 * in that window) and are spinning by 1. The lattice and Virgo fade in
	 * over t 0.3 → 1.
	 */
	introProgress(t: number): void;
	/** Where B3's core disc is on screen right now. The loader's shards home in on it. */
	coreCircle(): ScreenCircle;

	/**
	 * D1. Every star accelerates straight down with a trail, all alike; the
	 * lattice and B3 fade. `onImpact` fires once, when the first star crosses
	 * `groundY()`. Resolves when the sky is empty.
	 */
	fall(opts: { groundY: () => number; onImpact: (x: number) => void }): Promise<void>;
	/** Put every star back (after a warp return or a teleport to the sky). */
	restore(): void;

	/** Fly to a star; with `ignite`, play the B4 → B5 claim. */
	focusStar(slot: SlotId, opts?: { ignite?: boolean }): Promise<void>;
	/** True once the visitor has flown one full round of the twelve. */
	roundComplete(): boolean;
}

export interface RootsScene {
	setActive(on: boolean): void;
	/** Viewport Y of the soil's top edge right now. May be below the fold. */
	surfaceY(): number;
	/** D2. Light bursts from (x, surface) and grows into the mycelium. */
	growFrom(x: number): Promise<void>;
	/** The network fully grown, at once (teleport, reduced motion, no fall). */
	showGrown(): void;
	/** Document Y to scroll to for each landing spot. */
	anchorY(which: 'top' | 'first-node' | 'close'): number;
	/** Move keyboard focus to F1 or F2 after a teleport. */
	focusClose(which: 'claim' | 'contact'): void;
}

export interface FxLayer {
	/**
	 * C4. 300–500ms of circuit traces peaking blue-white at the centre.
	 * `swap` runs at the peak. `dir` is the felt direction of travel.
	 * With reduced motion this is a plain fade.
	 */
	teleportFlash(swap: () => void | Promise<void>, dir: 'up' | 'down' | 'none'): Promise<void>;
	/** D2. The burst where a star meets the soil. */
	impact(x: number, y: number): void;
	/** G2. Streaks and a speed ramp, launching upward. */
	warp(ms: number): Promise<void>;
}

// ─────────────────────────────────────────────────────────── director ──

export interface Director {
	readonly scene: SceneId;
	readonly reducedMotion: boolean;
	/** Menu teleport (C4) to one of the four destinations. */
	go(dest: Destination): Promise<void>;
	/** B11. D1 falling stars, D2 crash, then the Roots. */
	descend(): Promise<void>;
	/** E6. G2 warp back up to the sky. */
	ascend(): Promise<void>;
	/** After a send: get to the sky and show the star, igniting it. */
	showStar(slot: SlotId): Promise<void>;
}

export interface Stage {
	director: Director;
	claims: ClaimsStore;
	claimFlow: ClaimFlow;
	loader: LoaderScene;
	sky: SkyScene;
	roots: RootsScene;
	fx: FxLayer;
}

export type StagePart = keyof Stage;

// ─────────────────────────────────────────────────────────── mounting ──
//
// Each scene lives in src/experience/<scene>/ and its index.ts exports one
// function, `mount`. main.ts calls it once, when the scene's markup is in
// the document, and registers what it returns on the stage. A scene reaches
// the rest of the page only through the context it is handed, never by
// importing another part, so it can also be mounted alone on a test page
// with stand-ins.

export interface SceneContext {
	/** Another part of the stage, once it is mounted. Never await it while mounting. */
	when<K extends StagePart>(part: K): Promise<Stage[K]>;
	/** The visitor asked for reduced motion (<html data-motion="off">). */
	readonly reducedMotion: boolean;
}

export interface LoaderOptions {
	/**
	 * 'full' on a first visit, 'short' on a return in the same session. Left
	 * out, the loader decides for itself (sessionStorage) and remembers.
	 */
	mode?: 'full' | 'short';
	/** Debug: mount frozen at this second of the timeline (as seek does). */
	freezeAt?: number;
}

/** src/experience/loader/index.ts — `export const mount: MountLoader`. */
export type MountLoader = (ctx: SceneContext, opts?: LoaderOptions) => LoaderScene;
/** src/experience/sky/index.ts */
export type MountSky = (ctx: SceneContext) => SkyScene;
/** src/experience/roots/index.ts */
export type MountRoots = (ctx: SceneContext) => RootsScene;
/** src/experience/fx/index.ts */
export type MountFx = (ctx: SceneContext) => FxLayer;
/** src/experience/chrome/index.ts. The chrome exposes nothing; it only calls the director. */
export type MountChrome = (ctx: SceneContext) => void;

/** Fired on `document` whenever the scene changes. */
export interface SceneChangeDetail {
	from: SceneId;
	to: SceneId;
}
export const SCENE_EVENT = 'cellestial:scene';
