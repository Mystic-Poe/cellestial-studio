// Everything three.js: the renderer, the pictures, the meshes, and the one
// function that turns the state of the sky into a drawn frame.
//
// The world is drawn about the camera's own depth ("floating origin"): the
// camera always stands at z = 0 and each layer is placed at its distance from
// it. So the flight can go on for ever without the numbers the GPU sees ever
// growing.
//
// A pool of slots shows the layers that are in range. Slot `k mod POOL`
// always shows layer k, so a layer keeps its slot for as long as it is in
// sight. Layers are drawn far to near, and inside a layer: honeycomb, figure
// lines, stars, then B3; the struts between two layers are drawn after the
// farther one.

import {
	BufferAttribute,
	BufferGeometry,
	ClampToEdgeWrapping,
	CustomBlending,
	DataTexture,
	DoubleSide,
	DynamicDrawUsage,
	InstancedBufferAttribute,
	InstancedBufferGeometry,
	LinearFilter,
	LinearMipmapLinearFilter,
	Mesh,
	NoColorSpace,
	OneFactor,
	OneMinusSrcAlphaFactor,
	PerspectiveCamera,
	Scene,
	ShaderMaterial,
	Texture,
	Vector2,
	Vector3,
	Vector4,
	WebGLRenderer,
} from 'three';
import { ASSETS } from '../../assets.ts';
import { BLUE_RGB, BLUE_WHITE_RGB, BRASS_RGB, BRASS_TEXT_RGB } from '../../tokens.ts';
import { B3, B4_CLOSE, FADE, FALL, FIGURES, IGNITE, LATTICE, SPACING } from '../config.ts';
import type { Honeycomb } from '../lattice.ts';
import type { Camera, Layout } from '../layout.ts';
import { layerAhead, mod } from '../layout.ts';
import {
	CORE_FRAGMENT,
	CORE_VERTEX,
	LINE_FRAGMENT,
	LINE_VERTEX,
	RING_FRAGMENT,
	RING_VERTEX,
	STAR_FRAGMENT,
	STAR_VERTEX,
} from './shaders.ts';

/** How many layers can be in sight at once: one behind the lens (its struts), the rest ahead. */
const POOL = 8;
/** A layer this close in front of the lens has been flown through. */
export const PLANE_GAP = 0.03;
const NEVER = -1000;

/** How the sky looks, tuned by eye against the pack images at both viewports. */
export const LOOK = {
	/** Figure lines: brass, this strong, this wide at the station (pixels). */
	lineColor: BRASS_TEXT_RGB,
	lineAlpha: 0.4,
	linePx: 1.4,
	/** The honeycomb plane. */
	latticeColor: BRASS_RGB,
	latticeAlpha: 0.21,
	latticePx: 0.95,
	/** The planes between two layers, as a share of a layer's own. */
	betweenAlpha: 0.75,
	/** The struts: strength, how faint between two planes, how soon they fade from a plane. */
	strutAlpha: 0.26,
	strutMid: 0.2,
	strutFall: 0.14,
	/**
	 * A line thinner than the least width dims instead of thinning: by this power of how much
	 * thinner it is. The figures keep more of their light than the honeycomb, so the next
	 * constellation ahead is seen as one.
	 */
	lineThin: 0.3,
	latticeThin: 0.5,
	/** The least and most a line is ever wide, pixels. */
	minPx: 0.9,
	maxPx: 3.2,
	/** B4's blue rim: "a thin blue outer glow at ~20%". */
	rim: 0.21,
	/**
	 * B4's own picture is very dark: seen close it is lifted by this much. (At station size the
	 * sky draws the station picture instead, which is lifted when it is derived.)
	 */
	body: 1.7,
	/** How much stronger the rim's light is on a star too far away to show its sphere. */
	farGain: 2.6,
	/** A far star is never drawn smaller than this radius. */
	starMinPx: 1.25,
	/** The halo round B3's core, and the core's light on its rings. */
	halo: 0.28,
	ringLight: 0.16,
	/** Where the near half of a ring takes over from the far half, pixels of the ring picture. */
	feather: 60,
} as const;

export interface Pictures {
	core: TexImageSource;
	ring: TexImageSource;
	b4: TexImageSource;
	/** B4 with its traces made to carry at station size (scripts/assets/sky.mjs). Same frame as `b4`. */
	b4Station: TexImageSource;
	b5: TexImageSource;
}

/** The state of B3 for one frame. */
export interface B3Frame {
	/** Layer whose Virgo it stands in, or null to hide it. */
	layer: number | null;
	/** While the loader hands it over, the core is placed by hand: world x, y, depth in front of the lens, radius. */
	free: { x: number; y: number; depth: number; radius: number } | null;
	coreAlpha: number;
	ringAlpha: number;
	/** The rings' size as a multiple of their rest size. */
	ringScale: number;
	/** Extra light on the core, 0..1 (the first light's three pulses). */
	pulse: number;
	/** Turn of each ring, radians. */
	angles: readonly [number, number, number];
	/** Extra squash of each ring: its tilt breathing. */
	tilts: readonly [number, number, number];
}

export interface Frame {
	cam: Camera;
	/** Animation clock, seconds. */
	time: number;
	/** 1 with the idle animation on, 0 with it off. */
	idle: number;
	/** Strength of each kind of thing, 0..1. */
	lattice: number;
	lines: number;
	stars: number;
	/** Seconds since the fall began, or negative; and its gravity in world units. */
	fallT: number;
	gravity: number;
	b3: B3Frame;
	/** Quality: honeycomb planes drawn ahead, how much of each plane's disc (0..1), struts on or off, trail length 0..1. */
	planes: number;
	radius: number;
	struts: boolean;
	/** The honeycomb planes between two layers, on or off. */
	between: boolean;
	trail: number;
}

export interface World {
	readonly canvas: HTMLCanvasElement;
	/** For more to be drawn into the same sky (see hooks.ts). */
	readonly scene: Scene;
	readonly camera: PerspectiveCamera;
	/** The draw order of layer `k`'s own things, seen from a camera at depth `camZ`. */
	orderOf(layer: number, camZ: number): number;
	/** Device pixels per CSS pixel in use. */
	readonly dpr: number;
	setPictures(p: Pictures): void;
	resize(layout: Layout, dpr: number): void;
	/** Upload and compile everything ahead of the first frame. */
	warm(frame: Frame): void;
	draw(frame: Frame): void;
	/** A star's state: lit 0/1, the clock time its claim began (negative: none), extra glow 0..1. */
	setStar(
		figure: number,
		star: number,
		state: { lit?: number; ignite?: number; glow?: number },
	): void;
	/** Brighten an edge of a layer's plane, or the strut leaving one of its vertices, from `time`. */
	pulseEdge(layer: number, edge: number, strength: number, time: number): void;
	pulseStrut(layer: number, strut: number, strength: number, time: number): void;
	readonly contextLost: boolean;
	forceContextLoss(): void;
	forceContextRestore(): void;
	dispose(): void;
}

const v3 = (rgb: readonly [number, number, number]) => new Vector3(rgb[0], rgb[1], rgb[2]);

function quad(corners: number[]): BufferGeometry {
	const g = new BufferGeometry();
	g.setAttribute('position', new BufferAttribute(new Float32Array(corners), 3));
	g.setIndex([0, 1, 2, 0, 2, 3]);
	return g;
}

function instanced(base: BufferGeometry, count: number): InstancedBufferGeometry {
	const g = new InstancedBufferGeometry();
	g.setIndex(base.getIndex());
	g.setAttribute('position', base.getAttribute('position'));
	g.instanceCount = count;
	return g;
}

function shader(
	vertexShader: string,
	fragmentShader: string,
	uniforms: ShaderMaterial['uniforms'],
): ShaderMaterial {
	return new ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms,
		transparent: true,
		// Nothing here has a back: the ring's quad is laid out with y down, which turns its winding.
		side: DoubleSide,
		depthTest: false,
		depthWrite: false,
		toneMapped: false,
		blending: CustomBlending,
		blendSrc: OneFactor,
		blendDst: OneMinusSrcAlphaFactor,
		blendSrcAlpha: OneFactor,
		blendDstAlpha: OneMinusSrcAlphaFactor,
	});
}

function picture(image: TexImageSource): Texture {
	const t = new Texture(image as unknown as HTMLImageElement);
	t.flipY = false;
	t.premultiplyAlpha = false;
	t.colorSpace = NoColorSpace;
	t.generateMipmaps = true;
	t.minFilter = LinearMipmapLinearFilter;
	t.magFilter = LinearFilter;
	t.wrapS = ClampToEdgeWrapping;
	t.wrapT = ClampToEdgeWrapping;
	t.needsUpdate = true;
	return t;
}

interface Slot {
	layer: number;
	plane: Mesh<InstancedBufferGeometry, ShaderMaterial>;
	planePulse: InstancedBufferAttribute;
	planeDirty: boolean;
	/** The honeycomb planes between this layer and the next one. */
	between: Mesh<InstancedBufferGeometry, ShaderMaterial>[];
	struts: Mesh<InstancedBufferGeometry, ShaderMaterial>;
	strutPulse: InstancedBufferAttribute;
	strutDirty: boolean;
	lines: Mesh<InstancedBufferGeometry, ShaderMaterial>;
	stars: Mesh<InstancedBufferGeometry, ShaderMaterial>;
}

export function createWorld(canvas: HTMLCanvasElement, comb: Honeycomb, first: Layout): World {
	const renderer = new WebGLRenderer({
		canvas,
		antialias: false,
		alpha: false,
		depth: false,
		stencil: false,
		powerPreference: 'high-performance',
	});
	renderer.setClearColor(0x000000, 1);
	renderer.sortObjects = true;

	const scene = new Scene();
	const camera = new PerspectiveCamera(50, 1, 0.01, 500);
	camera.matrixAutoUpdate = true;

	let layout = first;
	let dpr = 1;
	let lost = false;

	// Shared by every material: one object, one value.
	const uHalfRes = { value: new Vector2(1, 1) };
	const uFocal = { value: 1 };
	const uDpr = { value: 1 };
	const uTime = { value: 0 };
	const uIdle = { value: 1 };
	const uClip = { value: 0.012 };
	const blank = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
	blank.needsUpdate = true;
	const tCore = { value: blank as Texture };
	const tRing = { value: blank as Texture };
	const tB4 = { value: blank as Texture };
	const tB4Station = { value: blank as Texture };
	const tB5 = { value: blank as Texture };
	const textures: Texture[] = [];

	const lineQuad = quad([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]);
	const spriteQuad = quad([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
	const pictureQuad = quad([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);

	// ── the honeycomb plane and its struts: one set of buffers for every slot ──
	// Both are stored from the flight axis outward, so a smaller disc of
	// honeycomb is simply fewer instances.
	const reachOf = (v: number) =>
		Math.hypot(comb.vertices[v * 2] as number, comb.vertices[v * 2 + 1] as number);
	const within = (sorted: Float32Array, radius: number) => {
		let lo = 0;
		let hi = sorted.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if ((sorted[mid] as number) <= radius) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	};

	const edgeReachOf = (e: number) =>
		Math.max(reachOf(comb.edges[e * 2] as number), reachOf(comb.edges[e * 2 + 1] as number));
	const edgeOrder = Array.from({ length: comb.edgeCount }, (_, e) => e).sort(
		(p, q) => edgeReachOf(p) - edgeReachOf(q),
	);
	/** Where each edge of the graph is in the buffers. */
	const edgeRank = new Int32Array(comb.edgeCount);
	const edgeReach = new Float32Array(comb.edgeCount);
	const edgeA = new Float32Array(comb.edgeCount * 3);
	const edgeB = new Float32Array(comb.edgeCount * 3);
	for (const [i, e] of edgeOrder.entries()) {
		const p = comb.edges[e * 2] as number;
		const q = comb.edges[e * 2 + 1] as number;
		edgeRank[e] = i;
		edgeReach[i] = edgeReachOf(e);
		edgeA[i * 3] = comb.vertices[p * 2] as number;
		edgeA[i * 3 + 1] = comb.vertices[p * 2 + 1] as number;
		edgeB[i * 3] = comb.vertices[q * 2] as number;
		edgeB[i * 3 + 1] = comb.vertices[q * 2 + 1] as number;
	}
	const planeA = new InstancedBufferAttribute(edgeA, 3);
	const planeB = new InstancedBufferAttribute(edgeB, 3);

	const strutCount = comb.struts.length;
	const strutOrder = Array.from({ length: strutCount }, (_, i) => i).sort(
		(p, q) => reachOf(comb.struts[p] as number) - reachOf(comb.struts[q] as number),
	);
	const strutRank = new Int32Array(strutCount);
	const strutReach = new Float32Array(strutCount);
	const sA = new Float32Array(strutCount * 3);
	const sB = new Float32Array(strutCount * 3);
	for (const [i, s] of strutOrder.entries()) {
		const v = comb.struts[s] as number;
		strutRank[s] = i;
		strutReach[i] = reachOf(v);
		sA[i * 3] = sB[i * 3] = comb.vertices[v * 2] as number;
		sA[i * 3 + 1] = sB[i * 3 + 1] = comb.vertices[v * 2 + 1] as number;
		sB[i * 3 + 2] = -SPACING;
	}
	const strutA = new InstancedBufferAttribute(sA, 3);
	const strutB = new InstancedBufferAttribute(sB, 3);

	const lineUniforms = (
		color: readonly [number, number, number],
		thin: number = LOOK.latticeThin,
	) => ({
		uOffset: { value: new Vector3() },
		uHalfRes,
		uFocal,
		uDpr,
		uTime,
		uClip,
		uWidth: { value: new Vector3(0, LOOK.minPx, LOOK.maxPx) },
		uThin: { value: thin },
		uColor: { value: v3(color) },
		uAlpha: { value: 0 },
		uNear: { value: new Vector2(FADE.near[0], FADE.near[1]) },
		uFar: { value: new Vector3(FADE.far[0], FADE.far[1], FADE.far[2]) },
		uRadial: { value: new Vector4(0, 0, 0, 0) },
		uStrut: { value: new Vector3(0, LOOK.strutMid, LOOK.strutFall) },
		uPulseColor: { value: v3(BLUE_RGB) },
	});

	// ── the twelve figures: lines and stars, shared by whichever slots show them ──
	const lineGeo: InstancedBufferGeometry[] = [];
	const starGeo: InstancedBufferGeometry[] = [];
	const starState: InstancedBufferAttribute[] = [];
	/** For each figure, the instance index of each star (-1 for B3, which is not a star sprite). */
	const starIndex: Int32Array[] = [];
	const lineEnds: { a: InstancedBufferAttribute; b: InstancedBufferAttribute }[] = [];
	const starPlace: InstancedBufferAttribute[] = [];
	for (const plan of layout.plans) {
		const ends = {
			a: new InstancedBufferAttribute(new Float32Array(plan.lines.length * 3), 3),
			b: new InstancedBufferAttribute(new Float32Array(plan.lines.length * 3), 3),
		};
		const lg = instanced(lineQuad, plan.lines.length);
		lg.setAttribute('aA', ends.a);
		lg.setAttribute('aB', ends.b);
		lineGeo.push(lg);
		lineEnds.push(ends);

		const index = new Int32Array(plan.stars.length).fill(-1);
		let n = 0;
		for (let i = 0; i < plan.stars.length; i++) {
			if (i !== plan.epicentre) index[i] = n++;
		}
		const state = new Float32Array(n * 4);
		for (let i = 0; i < n; i++) state[i * 4 + 1] = NEVER;
		const stateAttr = new InstancedBufferAttribute(state, 4);
		stateAttr.setUsage(DynamicDrawUsage);
		const where = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
		const sg = instanced(spriteQuad, n);
		sg.setAttribute('aStar', where);
		sg.setAttribute('aState', stateAttr);
		starGeo.push(sg);
		starState.push(stateAttr);
		starPlace.push(where);
		starIndex.push(index);
	}

	/**
	 * Where the stars and lines of each figure are, and how large each star is
	 * drawn: read from the layout's plans, and read again whenever the layout
	 * changes, because a figure can stand another way in another viewport (a
	 * portrait screen turns the wide ones) and a star can have another size.
	 * A figure always has the same stars and lines, so only numbers change.
	 */
	let placed: Layout | null = null;
	const place = (from: Layout) => {
		if (placed === from) return;
		placed = from;
		for (const [f, plan] of from.plans.entries()) {
			const ends = lineEnds[f];
			const stars = starPlace[f];
			const index = starIndex[f];
			if (!ends || !stars || !index) continue;
			for (const [i, [p, q]] of plan.lines.entries()) {
				const a = plan.stars[p];
				const b = plan.stars[q];
				if (!a || !b) continue;
				ends.a.array[i * 3] = a.x;
				ends.a.array[i * 3 + 1] = a.y;
				ends.b.array[i * 3] = b.x;
				ends.b.array[i * 3 + 1] = b.y;
			}
			ends.a.needsUpdate = ends.b.needsUpdate = true;
			for (const [i, star] of plan.stars.entries()) {
				const n = index[i] ?? -1;
				if (n < 0) continue;
				stars.array[n * 4] = star.x;
				stars.array[n * 4 + 1] = star.y;
				stars.array[n * 4 + 2] = from.sizeOf(star);
				stars.array[n * 4 + 3] = star.seed;
			}
			stars.needsUpdate = true;
		}
	};
	place(layout);

	const b4 = ASSETS.sky.b4Empty;
	const b5 = ASSETS.sky.b5LitAdd;
	const starUniforms = () => ({
		uOffset: { value: new Vector3() },
		uHalfRes,
		uFocal,
		uDpr,
		uTime,
		uIdle,
		uBaseR: { value: 0.03 },
		uAlpha: { value: 0 },
		uNear: { value: new Vector2(FADE.near[0], FADE.near[1]) },
		uFar: { value: new Vector3(FADE.far[0], FADE.far[1], FADE.far[2]) },
		uFall: { value: new Vector4(-1, 0, FALL.stagger, FALL.trail) },
		uMinPx: { value: LOOK.starMinPx },
		uTrailMax: { value: FALL.trailMax },
		uTrailStar: { value: FALL.trailStar },
		tB4,
		tB4Station,
		uB4Close: { value: new Vector2(B4_CLOSE.from, B4_CLOSE.to) },
		tB5,
		uB4: { value: new Vector3(b4.disc.x / b4.w, b4.disc.y / b4.h, b4.disc.r / b4.w) },
		uB5: { value: new Vector3(b5.disc.x / b5.w, b5.disc.y / b5.h, b5.disc.r / b5.w) },
		uBlue: { value: v3(BLUE_RGB) },
		uBlueWhite: { value: v3(BLUE_WHITE_RGB) },
		uIgnite: { value: new Vector3(IGNITE.fire, IGNITE.flash, IGNITE.settle) },
		uRim: { value: LOOK.rim },
		uBody: { value: LOOK.body },
		uFarGain: { value: LOOK.farGain },
	});

	// The planes between two layers carry no light of their own: one buffer says so for all of them.
	const noPulse = new InstancedBufferAttribute(new Float32Array(comb.edgeCount * 2), 2);
	for (let e = 0; e < comb.edgeCount; e++) noPulse.array[e * 2] = NEVER;

	// ── the slots ──
	const slots: Slot[] = [];
	for (let i = 0; i < POOL; i++) {
		const planeGeo = instanced(lineQuad, comb.edgeCount);
		planeGeo.setAttribute('aA', planeA);
		planeGeo.setAttribute('aB', planeB);
		const planePulse = new InstancedBufferAttribute(new Float32Array(comb.edgeCount * 2), 2);
		planePulse.setUsage(DynamicDrawUsage);
		for (let e = 0; e < comb.edgeCount; e++) planePulse.array[e * 2] = NEVER;
		planeGeo.setAttribute('aPulse', planePulse);
		const plane = new Mesh(
			planeGeo,
			shader(LINE_VERTEX, LINE_FRAGMENT, lineUniforms(LOOK.latticeColor)),
		);
		plane.material.uniforms.uRadial?.value.set(0, 0, LATTICE.fadeFrom, LATTICE.radius);
		plane.material.uniforms.uFar?.value.set(...FADE.farLattice);

		const between: Slot['between'] = [];
		for (let j = 1; j < LATTICE.between; j++) {
			const geo = instanced(lineQuad, comb.edgeCount);
			geo.setAttribute('aA', planeA);
			geo.setAttribute('aB', planeB);
			geo.setAttribute('aPulse', noPulse);
			const mesh = new Mesh(
				geo,
				shader(LINE_VERTEX, LINE_FRAGMENT, lineUniforms(LOOK.latticeColor)),
			);
			mesh.material.uniforms.uFar?.value.set(...FADE.farLattice);
			between.push(mesh);
		}

		const strutGeo = instanced(lineQuad, strutCount);
		strutGeo.setAttribute('aA', strutA);
		strutGeo.setAttribute('aB', strutB);
		const strutPulse = new InstancedBufferAttribute(new Float32Array(strutCount * 2), 2);
		strutPulse.setUsage(DynamicDrawUsage);
		for (let s = 0; s < strutCount; s++) strutPulse.array[s * 2] = NEVER;
		strutGeo.setAttribute('aPulse', strutPulse);
		const struts = new Mesh(
			strutGeo,
			shader(LINE_VERTEX, LINE_FRAGMENT, lineUniforms(LOOK.latticeColor)),
		);
		struts.material.uniforms.uRadial?.value.set(0, 0, LATTICE.fadeFrom, LATTICE.radius);
		struts.material.uniforms.uFar?.value.set(...FADE.farLattice);
		struts.material.uniforms.uStrut?.value.setX(1);

		const lines = new Mesh(
			lineGeo[0] as InstancedBufferGeometry,
			shader(LINE_VERTEX, LINE_FRAGMENT, lineUniforms(LOOK.lineColor, LOOK.lineThin)),
		);
		const stars = new Mesh(
			starGeo[0] as InstancedBufferGeometry,
			shader(STAR_VERTEX, STAR_FRAGMENT, starUniforms()),
		);
		for (const m of [plane, ...between, struts, lines, stars]) {
			m.frustumCulled = false;
			m.matrixAutoUpdate = false;
			m.visible = false;
			scene.add(m);
		}
		slots.push({
			layer: Number.NaN,
			plane,
			planePulse,
			planeDirty: false,
			between,
			struts,
			strutPulse,
			strutDirty: false,
			lines,
			stars,
		});
	}

	// ── B3: the far side of each ring, the core, the near side of each ring ──
	const ringAsset = ASSETS.sky.b3Ring;
	const coreAsset = ASSETS.sky.b3Core;
	const shortAxis = ((ringAsset.outer.angle + 90) * Math.PI) / 180;
	// The picture's y runs down and the angle is clockwise on screen; in x right,
	// y up that is the same number turned the other way. The short axis, towards
	// the upper left: the half of the band whose outer face is seen, the near half.
	const axis = new Vector2(-Math.abs(Math.cos(shortAxis)), Math.abs(Math.sin(shortAxis)));
	const b3Fade = () => ({
		uNear: { value: new Vector2(FADE.nearB3[0], FADE.nearB3[1]) },
		uFar: { value: new Vector3(FADE.far[0] * 1.6, FADE.far[1] * 1.8, FADE.far[2] * 1.5) },
	});
	const ringMesh = (front: boolean) => {
		const m = new Mesh(
			pictureQuad,
			shader(RING_VERTEX, RING_FRAGMENT, {
				uCentre: { value: new Vector3() },
				uSize: { value: new Vector2(ringAsset.w, ringAsset.h) },
				uRing: { value: new Vector3(ringAsset.outer.x, ringAsset.outer.y, ringAsset.outer.rx) },
				uAxis: { value: axis },
				uSquash: { value: 1 },
				uAngle: { value: 0 },
				uScale: { value: B3.ring },
				tRing,
				uBlueWhite: { value: v3(BLUE_WHITE_RGB) },
				uAlpha: { value: 0 },
				uFront: { value: front ? 1 : 0 },
				uFeather: { value: LOOK.feather },
				uLight: { value: LOOK.ringLight },
				uCoreR: { value: B3.ring * B3.core },
				...b3Fade(),
			}),
		);
		m.frustumCulled = false;
		m.matrixAutoUpdate = false;
		m.visible = false;
		scene.add(m);
		return m;
	};
	const ringsBack = B3.rings.map(() => ringMesh(false));
	const ringsFront = B3.rings.map(() => ringMesh(true));
	const core = new Mesh(
		spriteQuad,
		shader(CORE_VERTEX, CORE_FRAGMENT, {
			uCentre: { value: new Vector3() },
			uRadius: { value: B3.ring * B3.core },
			uExtent: { value: 9 },
			tCore,
			uDisc: {
				value: new Vector3(
					coreAsset.disc.x / coreAsset.w,
					coreAsset.disc.y / coreAsset.h,
					coreAsset.disc.r / coreAsset.w,
				),
			},
			uBlue: { value: v3(BLUE_RGB) },
			uAlpha: { value: 0 },
			uPulse: { value: 0 },
			uHalo: { value: LOOK.halo },
			uTime,
			uIdle,
			...b3Fade(),
		}),
	);
	core.frustumCulled = false;
	core.matrixAutoUpdate = false;
	core.visible = false;
	scene.add(core);

	const setPictures = (p: Pictures) => {
		for (const t of textures) t.dispose();
		textures.length = 0;
		const make = (image: TexImageSource) => {
			const t = picture(image);
			textures.push(t);
			return t;
		};
		tCore.value = make(p.core);
		tRing.value = make(p.ring);
		tB4.value = make(p.b4);
		tB4Station.value = make(p.b4Station);
		tB5.value = make(p.b5);
	};

	const resize = (next: Layout, ratio: number) => {
		layout = next;
		place(next);
		dpr = ratio;
		renderer.setPixelRatio(ratio);
		renderer.setSize(next.w, next.h, false);
		camera.aspect = next.w / next.h;
		camera.fov = (2 * Math.atan(next.h / 2 / next.focal) * 180) / Math.PI;
		camera.updateProjectionMatrix();
		uHalfRes.value.set(next.w / 2, next.h / 2);
		uFocal.value = next.focal;
		uDpr.value = ratio;
	};

	const assign = (slot: Slot, layer: number) => {
		if (slot.layer === layer) return;
		slot.layer = layer;
		const figure = mod(layer, FIGURES);
		slot.lines.geometry = lineGeo[figure] as InstancedBufferGeometry;
		slot.stars.geometry = starGeo[figure] as InstancedBufferGeometry;
		// A slot taken over by a new layer forgets the light its edges carried.
		if (slot.planeDirty) {
			for (let e = 0; e < comb.edgeCount; e++) slot.planePulse.array[e * 2] = NEVER;
			slot.planePulse.needsUpdate = true;
			slot.planeDirty = false;
		}
		if (slot.strutDirty) {
			for (let s = 0; s < strutCount; s++) slot.strutPulse.array[s * 2] = NEVER;
			slot.strutPulse.needsUpdate = true;
			slot.strutDirty = false;
		}
	};

	const slotOf = (layer: number) => {
		const slot = slots[mod(layer, POOL)] as Slot;
		return slot.layer === layer ? slot : null;
	};

	const prepare = (f: Frame) => {
		const { cam } = f;
		camera.position.set(cam.x, cam.y, 0);
		camera.updateMatrixWorld();
		uTime.value = f.time;
		uIdle.value = f.idle;

		const near = layerAhead(cam.z, PLANE_GAP);
		const farEnd = FADE.far[2];
		const radius = LATTICE.radius * f.radius;
		const planeCount = within(edgeReach, radius);
		const strutsShown = within(strutReach, radius);
		for (const slot of slots) {
			slot.plane.visible = slot.struts.visible = slot.lines.visible = slot.stars.visible = false;
			for (const m of slot.between) m.visible = false;
		}
		for (let k = near - 1; k < near - 1 + POOL; k++) {
			const depth = cam.z + k * SPACING;
			if (depth > farEnd) break;
			const slot = slots[mod(k, POOL)] as Slot;
			assign(slot, k);
			const figure = mod(k, FIGURES);
			const fit = layout.fits[figure];
			if (!fit) continue;
			const ahead = k - near;
			const z = -depth;
			const order = -ahead * 20;
			const inFront = depth > PLANE_GAP;

			if (inFront && f.lattice > 0.001 && ahead < f.planes) {
				const u = slot.plane.material.uniforms;
				u.uOffset?.value.set(0, 0, z);
				u.uWidth?.value.setX(LOOK.latticePx / fit.scale);
				u.uRadial?.value.set(0, 0, LATTICE.fadeFrom * f.radius, radius);
				if (u.uAlpha) u.uAlpha.value = LOOK.latticeAlpha * f.lattice;
				slot.plane.geometry.instanceCount = planeCount;
				slot.plane.renderOrder = order;
				slot.plane.visible = true;
			}
			// The planes between this layer and the next: the same honeycomb, further on.
			if (f.between && f.lattice > 0.001 && ahead < f.planes) {
				for (const [j, mesh] of slot.between.entries()) {
					const d = depth + ((j + 1) * SPACING) / LATTICE.between;
					if (d <= PLANE_GAP) continue;
					const u = mesh.material.uniforms;
					u.uOffset?.value.set(0, 0, -d);
					u.uWidth?.value.setX(LOOK.latticePx / fit.scale);
					u.uRadial?.value.set(0, 0, LATTICE.fadeFrom * f.radius, radius);
					if (u.uAlpha) u.uAlpha.value = LOOK.latticeAlpha * LOOK.betweenAlpha * f.lattice;
					mesh.geometry.instanceCount = planeCount;
					mesh.renderOrder = order - 20 + 16;
					mesh.visible = true;
				}
			}
			if (f.struts && f.lattice > 0.001 && ahead < f.planes) {
				const u = slot.struts.material.uniforms;
				u.uOffset?.value.set(0, 0, z);
				u.uWidth?.value.setX(LOOK.latticePx / fit.scale);
				u.uRadial?.value.set(0, 0, LATTICE.fadeFrom * f.radius, radius);
				slot.struts.geometry.instanceCount = strutsShown;
				if (u.uAlpha) u.uAlpha.value = LOOK.strutAlpha * f.lattice;
				// In front of everything in the farther of its two layers.
				slot.struts.renderOrder = order - 20 + 15;
				slot.struts.visible = true;
			}
			if (inFront && f.lines > 0.001) {
				const u = slot.lines.material.uniforms;
				u.uOffset?.value.set(0, 0, z);
				u.uWidth?.value.setX(LOOK.linePx / fit.scale);
				if (u.uAlpha) u.uAlpha.value = LOOK.lineAlpha * f.lines;
				slot.lines.renderOrder = order + 1;
				slot.lines.visible = true;
			}
			if (inFront && f.stars > 0.001) {
				const u = slot.stars.material.uniforms;
				u.uOffset?.value.set(0, 0, z);
				if (u.uBaseR) u.uBaseR.value = fit.starR;
				if (u.uAlpha) u.uAlpha.value = f.stars;
				u.uFall?.value.set(f.fallT, f.gravity, FALL.stagger, FALL.trail * f.trail);
				// Cellestial's rings end short of Virgo's stars and are drawn over the figure. Only
				// where they do not (`b3Clear`) are the stars drawn over the rings, so that none is hidden.
				slot.stars.renderOrder = order + (layout.b3Clear ? 2 : 12);
				slot.stars.visible = true;
			}
		}

		// B3.
		const b = f.b3;
		const shown = b.layer !== null || b.free !== null;
		core.visible = shown && b.coreAlpha > 0.001;
		for (const m of [...ringsBack, ...ringsFront]) m.visible = shown && b.ringAlpha > 0.001;
		if (!shown) return;
		let cx = 0;
		let cy = 0;
		let cz = 0;
		let size = layout.b3;
		let order = 0;
		if (b.free) {
			cx = b.free.x;
			cy = b.free.y;
			cz = -b.free.depth;
			size = b.free.radius / (B3.ring * B3.core);
			order = 3;
		} else if (b.layer !== null) {
			cz = -(cam.z + b.layer * SPACING);
			order = -(b.layer - near) * 20 + 3;
			if (-cz <= PLANE_GAP) {
				core.visible = false;
				for (const m of [...ringsBack, ...ringsFront]) m.visible = false;
				return;
			}
		}
		const cu = core.material.uniforms;
		cu.uCentre?.value.set(cx, cy, cz);
		// A pulse swells the core a little; its light is the shader's (uPulse).
		if (cu.uRadius) cu.uRadius.value = B3.ring * B3.core * size * (1 + 0.1 * b.pulse);
		if (cu.uAlpha) cu.uAlpha.value = b.coreAlpha;
		if (cu.uPulse) cu.uPulse.value = b.pulse;
		core.renderOrder = order + 4;
		for (const [i, ring] of B3.rings.entries()) {
			for (const [mesh, at] of [
				[ringsBack[i], order + i],
				[ringsFront[i], order + 8 - i],
			] as const) {
				if (!mesh) continue;
				const u = mesh.material.uniforms;
				u.uCentre?.value.set(cx, cy, cz);
				if (u.uScale) u.uScale.value = B3.ring * ring.scale * size * b.ringScale;
				if (u.uSquash) u.uSquash.value = ring.squash * (b.tilts[i] ?? 1);
				if (u.uAngle) u.uAngle.value = b.angles[i] ?? 0;
				if (u.uAlpha) u.uAlpha.value = b.ringAlpha;
				if (u.uCoreR) u.uCoreR.value = B3.ring * B3.core * size;
				mesh.renderOrder = at;
			}
		}
	};

	const draw = (f: Frame) => {
		if (lost) return;
		prepare(f);
		renderer.render(scene, camera);
	};

	const onLost = (e: Event) => {
		e.preventDefault();
		lost = true;
	};
	const onRestored = () => {
		lost = false;
	};
	canvas.addEventListener('webglcontextlost', onLost);
	canvas.addEventListener('webglcontextrestored', onRestored);

	resize(first, 1);

	return {
		canvas,
		scene,
		camera,
		orderOf(layer, camZ) {
			return -(layer - layerAhead(camZ, PLANE_GAP)) * 20;
		},
		get dpr() {
			return dpr;
		},
		get contextLost() {
			return lost;
		},
		setPictures,
		resize,
		warm(f) {
			if (lost) return;
			prepare(f);
			// Everything visible once, so every program is compiled and every buffer is up.
			const hidden: Mesh[] = [];
			scene.traverse((o) => {
				if (o instanceof Mesh && !o.visible) {
					hidden.push(o);
					o.visible = true;
				}
			});
			renderer.compile(scene, camera);
			for (const t of textures) renderer.initTexture(t);
			for (const o of hidden) o.visible = false;
		},
		draw,
		setStar(figure, star, state) {
			const attr = starState[figure];
			const i = starIndex[figure]?.[star] ?? -1;
			if (!attr || i < 0) return;
			const a = attr.array;
			if (state.lit !== undefined) a[i * 4] = state.lit;
			if (state.ignite !== undefined) a[i * 4 + 1] = state.ignite < 0 ? NEVER : state.ignite;
			if (state.glow !== undefined) a[i * 4 + 2] = state.glow;
			attr.needsUpdate = true;
		},
		pulseEdge(layer, edge, strength, time) {
			const slot = slotOf(layer);
			if (!slot || edge < 0 || edge >= comb.edgeCount) return;
			const i = edgeRank[edge] as number;
			slot.planePulse.array[i * 2] = time;
			slot.planePulse.array[i * 2 + 1] = strength;
			slot.planePulse.needsUpdate = true;
			slot.planeDirty = true;
		},
		pulseStrut(layer, strut, strength, time) {
			const slot = slotOf(layer);
			if (!slot || strut < 0 || strut >= strutCount) return;
			const i = strutRank[strut] as number;
			slot.strutPulse.array[i * 2] = time;
			slot.strutPulse.array[i * 2 + 1] = strength;
			slot.strutPulse.needsUpdate = true;
			slot.strutDirty = true;
		},
		forceContextLoss() {
			renderer.forceContextLoss();
		},
		forceContextRestore() {
			renderer.forceContextRestore();
		},
		dispose() {
			canvas.removeEventListener('webglcontextlost', onLost);
			canvas.removeEventListener('webglcontextrestored', onRestored);
			for (const t of textures) t.dispose();
			renderer.dispose();
		},
	};
}
