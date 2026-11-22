// Derives every web image of the redesign from cellestial-assets/images/** into
// public/cellestial/, and writes the manifest the scenes read their geometry
// from (src/experience/assets.ts).
//
//   node scripts/build-assets.mjs            everything, then the manifest
//   node scripts/build-assets.mjs sky ui     only those groups (no manifest)
//   node scripts/build-assets.mjs modules    only the scene modules (below)
//
// Everything here is a pack file cropped, resized, keyed from
// its black or re-encoded. Nothing is generated and nothing is substituted.
// Three things go a step past a plain crop, and each says so where it is
// done: A1 unlit is resampled onto A1 lit so the two register; pictures that
// stay on black are faded to exact #000 away from their content, so a frame
// can never show; and the background stars the render left inside the glow
// of the B3 core are taken out with a median.
//
// The outputs are checked in: the Cloudflare build never runs this script.
// Running it again rewrites nothing that has not changed.
//
// Scene modules: after its own work this script imports every
// scripts/assets/*.mjs (not sub-folders) and awaits its default export,
//
//   export default async function (ctx) { … }
//
// with ctx = { sharp, src(rel), out(rel), px }. `src('b-sky/B4_….jpg')` is a
// path inside cellestial-assets/images/, `out('sky/thing.webp')` a path
// inside public/cellestial/ (its folder is created), and `px` is the pixel
// toolkit in scripts/assets/lib/px.mjs.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import * as px from './assets/lib/px.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'cellestial-assets/images');
const OUT_DIR = join(ROOT, 'public/cellestial');
const MODULE_DIR = join(ROOT, 'scripts/assets');
const MANIFEST = join(ROOT, 'src/experience/assets.ts');
const TOKENS = join(ROOT, 'src/experience/tokens.ts');
const THEME = join(ROOT, 'src/styles/tokens.css');

const src = (rel) => join(SRC_DIR, rel);
const out = (rel) => {
	const file = join(OUT_DIR, rel);
	mkdirSync(dirname(file), { recursive: true });
	return file;
};

const WEBP = { effort: 6, smartSubsample: true };
const round1 = (v) => Math.round(v * 10) / 10;

// Inside this script a position is a pixel index: (0, 0) is the middle of the
// top-left pixel. The manifest counts from the image's top-left corner, as
// CSS and canvas do, so that x / w is a fraction of the width. These three
// make that half-pixel step, and are the only way a measurement gets out.
const centre = (v) => round1(v + 0.5);
const point = (p) => ({ x: centre(p.x), y: centre(p.y) });
const circle = (c) => ({ ...point(c), r: round1(c.r) });

/** Encode and write `rel` unless the bytes on disk are already these. */
async function save(rel, pipeline) {
	const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
	const file = out(rel);
	const same = existsSync(file) && readFileSync(file).equals(data);
	if (!same) writeFileSync(file, data);
	const kb = (data.length / 1024).toFixed(1).padStart(7);
	console.log(`  ${same ? '=' : '+'} ${rel.padEnd(28)} ${info.width}×${info.height} ${kb} KB`);
	return { url: `/cellestial/${rel}`, w: info.width, h: info.height };
}

const fromImage = (img) => {
	const { data, raw } = px.toRaw(img);
	return sharp(data, { raw });
};

/** The silhouette of brass on black: red is strong in brass and weak in the blue light. */
const BRASS_LEVEL = 24;
const brassMask = (img) => {
	const m = new Float32Array(img.w * img.h);
	for (let i = 0; i < m.length; i++) m[i] = img.r[i] > BRASS_LEVEL ? 1 : 0;
	return m;
};

/** Everything that is not background noise, as a mask, without stray specks. */
const contentMask = (img, level = 10, minArea = 40) => {
	const lit = px.maxOf(img);
	for (let i = 0; i < lit.length; i++) lit[i] = lit[i] > level ? 1 : 0;
	return px.keepRegions(lit, img.w, img.h, (r) => r.n >= minArea);
};

function assertBlackBorder(img, name) {
	const { w, h } = img;
	let worst = 0;
	for (let x = 0; x < w; x++) {
		for (const i of [x, (h - 1) * w + x]) worst = Math.max(worst, img.r[i], img.g[i], img.b[i]);
	}
	for (let y = 0; y < h; y++) {
		for (const i of [y * w, y * w + w - 1]) worst = Math.max(worst, img.r[i], img.g[i], img.b[i]);
	}
	if (worst >= 0.5) throw new Error(`${name}: the frame edge is not black (${worst.toFixed(2)})`);
}

// ───────────────────────────────────────────────────────────── loader ──

// A1 lit and A1 unlit are two renders of one emblem, not one render on two
// canvases: lit is 0.155% narrower and 0.155% taller than unlit, with a
// trace of shear. This is the map between them, fitted to 1,100 points on
// the edges of the brass faces (median misfit 0.32 px, 90% under 0.85 px;
// the best pure shift leaves 0.52 px and 1.18 px). With u = (x − 1288) / 600
// and v = (y − 722) / 600 in unlit pixels:
//
//   lit.x = x − (264.8954 + 0.9312 u + 0.1413 v)
//   lit.y = y − (−303.6690 + 0.4182 u − 0.9281 v)
const REGISTRATION = {
	cx: 1288,
	cy: 722,
	s: 600,
	dx: [264.8954, 0.9312, 0.1413],
	dy: [-303.669, 0.4182, -0.9281],
};

/** The inverse of the map above: lit pixel → unlit pixel, as `[[a, b, tx], [c, d, ty]]`. */
function unlitFromLit() {
	const { cx, cy, s, dx, dy } = REGISTRATION;
	const a = 1 - dx[1] / s;
	const b = -dx[2] / s;
	const c = -dy[1] / s;
	const d = 1 - dy[2] / s;
	const tx = -dx[0] + (dx[1] * cx + dx[2] * cy) / s;
	const ty = -dy[0] + (dy[1] * cx + dy[2] * cy) / s;
	const det = a * d - b * c;
	return [
		[d / det, -b / det, (b * ty - d * tx) / det],
		[-c / det, a / det, (c * tx - a * ty) / det],
	];
}

// The shared frame, in lit pixels: 1400 square, centred on the emblem. That
// leaves 96 px above and below it and 178 px beside it, and 310 px from the
// centre of the main node to the right and bottom edges, which is as far as
// its glow reaches (it is down to the background level by 310 px).
const PAIR_FRAME = { x: 323, y: 325, size: 1400 };
const MAIN_NODE_SEED = { x: 1412.4 - PAIR_FRAME.x, y: 1410.3 - PAIR_FRAME.y, r: 130 };

/** Circle of the main node's brass face: the rim, away from where the strut joins it. */
const mainNode = (img, seed) =>
	px.fitRim(img.r, img.w, img.h, seed, { level: 64, from: -140, to: 140 });

let pairCache = null;
/** A1 unlit and lit in one frame, registered, on pure black. Also feeds the C logo. */
async function emblemPair() {
	if (pairCache) return pairCache;
	const { x, y, size } = PAIR_FRAME;
	const litFull = await px.load(sharp, src('a-loading/A1_c-emblem_lit.jpg'));
	const unlitFull = await px.load(sharp, src('a-loading/A1_c-emblem_unlit.jpg'));
	const lit = px.crop(litFull, x, y, size, size);
	const m = unlitFromLit();
	const unlit = px.warp(unlitFull, size, size, [
		[m[0][0], m[0][1], m[0][0] * x + m[0][1] * y + m[0][2]],
		[m[1][0], m[1][1], m[1][0] * x + m[1][1] * y + m[1][2]],
	]);

	const node = mainNode(lit, MAIN_NODE_SEED);
	const c = px.bounds(px.keepLargest(brassMask(lit), size, size), size, size);

	// Past the emblem (and past the node's glow, in the lit one) the frame is #000.
	const litContent = contentMask(lit);
	for (let j = 0; j < size; j++) {
		for (let i = 0; i < size; i++) {
			if (Math.hypot(i - node.x, j - node.y) <= node.r + 100) litContent[j * size + i] = 1;
		}
	}
	px.fadeToBlack(lit, litContent, 28, 44);
	px.fadeToBlack(unlit, contentMask(unlit), 28, 44);
	assertBlackBorder(lit, 'c-lit');
	assertBlackBorder(unlit, 'c-unlit');

	// The light itself: the white-hot spot in the lens of the lit node.
	let sx = 0;
	let sy = 0;
	let n = 0;
	for (let j = 0; j < size; j++) {
		for (let i = 0; i < size; i++) {
			const p = j * size + i;
			if (Math.hypot(i - node.x, j - node.y) > node.r) continue;
			if (Math.min(lit.r[p], lit.g[p], lit.b[p]) < 235) continue;
			sx += i;
			sy += j;
			n++;
		}
	}
	pairCache = { lit, unlit, c, node, core: { x: sx / n, y: sy / n } };
	return pairCache;
}

async function loader() {
	const pair = await emblemPair();
	const geometry = { c: pair.c, node: circle(pair.node), core: point(pair.core) };
	const cUnlit = await save(
		'loader/c-unlit.webp',
		fromImage(pair.unlit).webp({ ...WEBP, quality: 78 }),
	);
	const cLit = await save('loader/c-lit.webp', fromImage(pair.lit).webp({ ...WEBP, quality: 78 }));

	// A4, the whole frame, on pure black beyond the lettering and the node's glow.
	const full = await px.load(sharp, src('a-loading/A4_wordmark_cellestial.jpg'));
	const fullEmblem = px
		.label(brassMask(full), full.w, full.h)
		.regions.reduce((a, b) => (b.n > a.n ? b : a));
	const seed = {
		x: fullEmblem.x + ((pair.node.x - pair.c.x) / pair.c.w) * fullEmblem.w,
		y: fullEmblem.y + ((pair.node.y - pair.c.y) / pair.c.h) * fullEmblem.h,
		r: (pair.node.r / pair.c.w) * fullEmblem.w,
	};
	const fullNode = mainNode(full, seed);
	const content = contentMask(full);
	for (let j = 0; j < full.h; j++) {
		for (let i = 0; i < full.w; i++) {
			if (Math.hypot(i - fullNode.x, j - fullNode.y) <= fullNode.r + 170)
				content[j * full.w + i] = 1;
		}
	}
	px.fadeToBlack(full, content, 30, 60);
	assertBlackBorder(full, 'wordmark');
	const WIDTH = 2048;
	const resized = await fromImage(full)
		.resize({ width: WIDTH, kernel: 'lanczos3' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	const img = px.fromRaw(
		resized.data,
		resized.info.width,
		resized.info.height,
		resized.info.channels,
	);
	const wordmark = await save(
		'loader/wordmark.webp',
		fromImage(img).webp({ ...WEBP, quality: 80 }),
	);

	// Measured on the derived picture itself. Eleven pieces of brass: the
	// emblem, nine letters, and the star, which is the small one.
	const parts = px
		.label(brassMask(img), img.w, img.h)
		.regions.filter((r) => r.n > 400)
		.sort((a, b) => a.x - b.x);
	if (parts.length !== 11)
		throw new Error(`wordmark: expected 11 pieces of brass, found ${parts.length}`);
	const star = parts.reduce((a, b) => (b.n < a.n ? b : a));
	const emblem = parts[0];
	const letters = parts.filter((p) => p !== emblem && p !== star);
	const box = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h });
	const all = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
	for (const p of parts) {
		all.x0 = Math.min(all.x0, p.x);
		all.y0 = Math.min(all.y0, p.y);
		all.x1 = Math.max(all.x1, p.x + p.w);
		all.y1 = Math.max(all.y1, p.y + p.h);
	}
	const k = img.w / full.w;
	const node = mainNode(img, {
		x: (fullNode.x + 0.5) * k - 0.5,
		y: (fullNode.y + 0.5) * k - 0.5,
		r: fullNode.r * k,
	});
	// The star: its centre is the centroid of its brass, its radius reaches the tips.
	const { labels } = px.label(brassMask(img), img.w, img.h);
	let reach = 0;
	for (let j = star.y; j < star.y + star.h; j++) {
		for (let i = star.x; i < star.x + star.w; i++) {
			if (labels[j * img.w + i] === star.id)
				reach = Math.max(reach, Math.hypot(i - star.cx, j - star.cy));
		}
	}

	return {
		cUnlit: { ...cUnlit, ...geometry },
		cLit: { ...cLit, ...geometry },
		wordmark: {
			...wordmark,
			box: { x: all.x0, y: all.y0, w: all.x1 - all.x0, h: all.y1 - all.y0 },
			emblem: box(emblem),
			node: circle(node),
			star: circle({ x: star.cx, y: star.cy, r: reach + 0.5 }),
			letters: letters.map((r, i) => ({ ch: 'ellestial'[i], ...box(r) })),
		},
	};
}

// ──────────────────────────────────────────────────────────────── sky ──

/** Multiply a picture (and its alpha) down to nothing between two radii. */
function radialFade(img, cx, cy, from, to) {
	for (let y = 0; y < img.h; y++) {
		for (let x = 0; x < img.w; x++) {
			const k = 1 - px.smoothstep(from, to, Math.hypot(x - cx, y - cy));
			if (k >= 1) continue;
			const i = y * img.w + x;
			if (img.a) img.a[i] *= k;
			else {
				img.r[i] *= k;
				img.g[i] *= k;
				img.b[i] *= k;
			}
		}
	}
	return img;
}

/** Resize a picture (straight alpha or none) and hand back its planes. */
async function resize(img, options) {
	const { data, info } = await fromImage(img)
		.resize(options)
		.raw()
		.toBuffer({ resolveWithObject: true });
	return px.fromRaw(data, info.width, info.height, info.channels);
}

/**
 * Encode a keyed sprite. Alpha is stored in 96 levels, 0 and 255 among them
 * (libwebp's alpha quality 80; all 256 would cost a tenth more for nothing
 * the eye can find). Under faint and transparent pixels the colour is made
 * smooth and then kept (`exact`), all the way out, so a renderer filtering
 * or mip-mapping straight alpha never blends towards black.
 */
function saveKeyed(rel, img, quality = 80) {
	for (let i = 0; i < img.a.length; i++) if (img.a[i] < 1.5 / 255) img.a[i] = 0;
	px.bleed(px.calmFaint(img, { below: 0.14, sigma: 5 }));
	return save(rel, fromImage(img).webp({ ...WEBP, quality, alphaQuality: 80, exact: true }));
}

/** Position of a source pixel centre after a crop at (x0, y0) and a resize by k. */
const moved = (c, x0, y0, k) => ({
	x: (c.x - x0 + 0.5) * k - 0.5,
	y: (c.y - y0 + 0.5) * k - 0.5,
	r: c.r * k,
});

async function b3Core() {
	const full = await px.load(sharp, src('b-sky/B3_core_radiant-star.jpg'));
	// The disc is where red drops: the corona outside it is as bright in blue as the disc is.
	const RED = 170;
	const disc = px.fitRim(full.r, full.w, full.h, { x: 511, y: 513, r: 121 }, { level: RED });
	// The glow is down to the background's own level 395 px out; 400 is the frame.
	const HALF = 400;
	const x0 = Math.round(disc.x) - HALF;
	const y0 = Math.round(disc.y) - HALF;
	const img = px.crop(full, x0, y0, 2 * HALF, 2 * HALF);
	const cx = disc.x - x0;
	const cy = disc.y - y0;

	// The render has background stars inside the glow. Out past the corona
	// the star itself is nothing but a smooth falloff, which a 25 px median
	// leaves as it is, and a background star does not survive one.
	const calm = await px.load(sharp, fromImage(img).median(25));
	for (let y = 0; y < img.h; y++) {
		for (let x = 0; x < img.w; x++) {
			const k = px.smoothstep(180, 200, Math.hypot(x - cx, y - cy));
			if (k <= 0) continue;
			const i = y * img.w + x;
			img.r[i] += (calm.r[i] - img.r[i]) * k;
			img.g[i] += (calm.g[i] - img.g[i]) * k;
			img.b[i] += (calm.b[i] - img.b[i]) * k;
		}
	}

	radialFade(img, cx, cy, 330, 397);
	assertBlackBorder(img, 'b3-core');
	const small = await resize(img, { width: 512, kernel: 'lanczos3' });
	const file = await save('sky/b3-core.webp', fromImage(small).webp({ ...WEBP, quality: 88 }));
	const seed = moved(disc, x0, y0, small.w / img.w);
	return { ...file, disc: circle(px.fitRim(small.r, small.w, small.h, seed, { level: RED })) };
}

/**
 * B4 and B5 are one sphere (B5 is B4 at twice the size, to a quarter of a
 * pixel). Its outline is a circle to 0.3 px, so its alpha is drawn from the
 * fitted circle: solid inside, and across the edge the same 3.5 px ramp the
 * render has (measured on B4: 72% covered 0.6 px inside the fitted radius,
 * 42% and 14% at 0.4 and 1.4 px outside it).
 */
async function sphere(rel, { file, seed, half, fade, floor, additive, keyedFile = true }) {
	const full = await px.load(sharp, src(file));
	const k = full.w / 1024;
	const light = px.gauss(px.maxOf(full), full.w, full.h, k);
	const disc = px.fitRim(
		light,
		full.w,
		full.h,
		{ x: seed.x * k, y: seed.y * k, r: seed.r * k },
		{ span: 0.12 },
	);
	const x0 = Math.round(disc.x - half * k);
	const y0 = Math.round(disc.y - half * k);
	const size = Math.round(2 * half * k);
	const img = px.crop(full, x0, y0, size, size);
	const cx = disc.x - x0;
	const cy = disc.y - y0;

	const body = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			body[y * size + x] = px.clamp((disc.r + 1.9 * k - Math.hypot(x - cx, y - cy)) / (3.45 * k));
		}
	}
	const keyed = radialFade(
		px.key(img, body, { floor, soften: 4 * k }),
		cx,
		cy,
		fade[0] * k,
		fade[1] * k,
	);
	const small = await resize(keyed, { width: 512, kernel: 'lanczos3' });
	const scale = small.w / size;
	// B5 is only ever blended additively: its keyed frame is not shipped.
	const out = keyedFile ? { [rel]: { ...(await saveKeyed(`sky/${rel}.webp`, small)) } } : {};

	// The same frame left on black, for additive blending.
	if (additive) {
		radialFade(img, cx, cy, fade[0] * k, fade[1] * k);
		assertBlackBorder(img, additive);
		const plain = await resize(img, { width: 512, kernel: 'lanczos3' });
		out[additive] = {
			...(await save(`sky/${additive}.webp`, fromImage(plain).webp({ ...WEBP, quality: 86 }))),
		};
	}
	// One disc for every file of this sphere: they share a frame.
	const derived = circle(moved(disc, x0, y0, scale));
	for (const entry of Object.values(out)) entry.disc = derived;
	return out;
}

async function b3Ring() {
	// Worked at twice the pack's resolution, so the matte's outline is finer than a source pixel.
	const S = 2;
	const up = sharp(src('b-sky/B3_ring_cracked-brass.jpg')).resize({
		width: 1024 * S,
		kernel: 'lanczos3',
	});
	const img = await px.load(sharp, up);
	const { w, h } = img;
	const n = w * h;

	// The band, out to the foot of its edge. Brass is warm; the light spilling
	// from the cracks is not, and the cracks themselves are white-hot, which
	// counts. Grooves, cracks and the darkest faces come back as holes, the
	// ring's own opening does not.
	let fat = new Float32Array(n);
	for (let i = 0; i < n; i++)
		fat[i] = (img.r[i] > 22 && img.r[i] >= 0.9 * img.b[i]) || img.r[i] > 80 ? 1 : 0;
	fat = px.erode(px.dilate(fat, w, h, 3 * S), w, h, 3 * S);
	fat = px.keepLargest(px.dilate(px.erode(fat, w, h, 1.5 * S), w, h, 1.5 * S), w, h);
	fat = px.fillHoles(fat, w, h, 12000 * S * S);
	// The band proper: at least 30% as bright as the brass within 8 px. That
	// drops the two warm hazes that lean on the ring (left of the left crack,
	// inside the right-hand band), which are light and not metal.
	const REACH = 8 * S;
	const local = px.maxFilter(img.r, w, h, REACH);
	let core = new Float32Array(n);
	for (let i = 0; i < n; i++) core[i] = fat[i] && img.r[i] >= 0.3 * local[i] ? 1 : 0;
	core = px.keepLargest(px.erode(px.dilate(core, w, h, 2.5 * S), w, h, 2.5 * S), w, h);
	core = px.fillHoles(core, w, h, 12000 * S * S);
	core = px.keepLargest(px.dilate(px.erode(core, w, h, 1.5 * S), w, h, 1.5 * S), w, h);
	// Its edge runs on as far as the foot, and no further than that reach.
	const beyond = px.distance(core, w, h);
	const support = new Float32Array(n);
	for (let i = 0; i < n; i++) support[i] = fat[i] && beyond[i] <= REACH ? 1 : 0;
	let body = px.solidAlpha(img.r, support, w, h, { reach: REACH, band: REACH });
	for (let i = 0; i < n; i++) body[i] *= 1 - px.smoothstep(0.6 * REACH, REACH, beyond[i]);
	// The ratio above carries the grain of the file; an edge does not need it.
	body = px.gauss(body, w, h, 1.5 * S);

	// The light that spills out of the cracks is blue and close to the ring.
	const gate = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const warmest = Math.max(img.r[i], img.g[i], 1);
		const blue = px.smoothstep(1.15, 1.5, img.b[i] / warmest);
		gate[i] = blue * (1 - px.smoothstep(70 * S, 110 * S, beyond[i]));
	}
	const keyed = px.key(img, body, {
		floor: 7,
		gate: px.gauss(gate, w, h, 3 * S),
		soften: 4 * S,
		calmSigma: 6 * S,
	});

	// Trim to what is left, plus a small margin.
	const seen = new Float32Array(n);
	for (let i = 0; i < n; i++) seen[i] = keyed.a[i] > 2 / 255 ? 1 : 0;
	const box = px.bounds(seen, w, h);
	const M = 6 * S;
	const x0 = Math.max(0, box.x - M);
	const y0 = Math.max(0, box.y - M);
	const cw = Math.min(w, box.x + box.w + M) - x0;
	const ch = Math.min(h, box.y + box.h + M) - y0;
	const trimmed = px.crop(keyed, x0, y0, cw, ch);
	const LONG = 1024;
	const small = await resize(trimmed, cw > ch ? { width: LONG } : { height: LONG });
	const file = await saveKeyed('sky/b3-ring.webp', small);

	// Its two ellipses, on the derived picture: the outline, and the opening.
	const solid = new Float32Array(small.w * small.h);
	for (let i = 0; i < solid.length; i++) solid[i] = small.a[i] >= 0.5 ? 1 : 0;
	const band = px.keepLargest(solid, small.w, small.h);
	const filled = px.fillHoles(band, small.w, small.h);
	const opening = new Float32Array(solid.length);
	for (let i = 0; i < solid.length; i++) opening[i] = filled[i] && !band[i] ? 1 : 0;
	const ellipse = (mask) => {
		const e = px.fitEllipse(outline(px.keepLargest(mask, small.w, small.h), small.w, small.h));
		return { ...point(e), rx: round1(e.rx), ry: round1(e.ry), angle: round1(e.angle) };
	};
	return { ...file, outer: ellipse(filled), inner: ellipse(opening) };
}

/** The pixels of a mask that touch something outside it, as `[x, y]`. */
function outline(mask, w, h) {
	const points = [];
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!mask[y * w + x]) continue;
			const edge =
				x === 0 ||
				y === 0 ||
				x === w - 1 ||
				y === h - 1 ||
				!mask[y * w + x - 1] ||
				!mask[y * w + x + 1] ||
				!mask[(y - 1) * w + x] ||
				!mask[(y + 1) * w + x];
			if (edge) points.push([x, y]);
		}
	}
	return points;
}

async function sky() {
	const core = await b3Core();
	const ring = await b3Ring();
	const b4 = await sphere('b4-empty', {
		file: 'b-sky/B4_star_empty-sleeping.jpg',
		seed: { x: 511.6, y: 511.7, r: 276.6 },
		half: 300,
		fade: [286, 298],
		floor: 8,
	});
	const b5 = await sphere('b5-lit', {
		file: 'b-sky/B5_star_lit-claimed.jpg',
		seed: { x: 511.8, y: 512, r: 277.5 },
		half: 480,
		fade: [440, 478],
		floor: 1,
		additive: 'b5-lit-add',
		keyedFile: false,
	});
	return {
		b3Core: core,
		b3Ring: ring,
		b4Empty: b4['b4-empty'],
		b5LitAdd: b5['b5-lit-add'],
	};
}

// ────────────────────────────────────────────────────────────── roots ──

/**
 * The mean colour of the soil as the Roots crop it, for the palette's
 * --color-earth (the ground behind the soil picture). The tiles themselves
 * are made by scripts/assets/roots.mjs (the woven pair); the mirror-stacked
 * tiles this function once wrote were never fetched and are no longer made.
 */
async function soilMean(file, crop, width) {
	const top = await sharp(src(file))
		.extract(crop)
		.resize({ width, kernel: 'mitchell' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width: w, height: h, channels } = top.info;
	const mean = [0, 0, 0];
	for (let i = 0; i < top.data.length; i += channels)
		for (let k = 0; k < 3; k++) mean[k] += top.data[i + k];
	return mean.map((v) => v / (w * h));
}

async function e4Node() {
	const full = await px.load(sharp, src('e-roots/E4_node.jpg'));
	// Trimmed at the sides and below the last of the lower thread. The top is
	// the pack's own top edge: the upper thread runs off it.
	const BOX = { x: 264, y: 0, w: 452, h: 1008 };
	const img = px.crop(full, BOX.x, BOX.y, BOX.w, BOX.h);
	px.fadeToBlack(img, contentMask(img, 6), 20, 36);
	// A soft edge on the three trimmed sides makes sure of #000 there.
	for (let y = 0; y < img.h; y++) {
		for (let x = 0; x < img.w; x++) {
			const edge = Math.min(x, img.w - 1 - x, img.h - 1 - y);
			if (edge >= 12) continue;
			const k = px.smoothstep(0, 12, edge);
			const i = y * img.w + x;
			img.r[i] *= k;
			img.g[i] *= k;
			img.b[i] *= k;
		}
	}
	const light = px.maxOf(img);

	// The bulb: the bright mass without its threads.
	let bulb = new Float32Array(light.length);
	for (let i = 0; i < light.length; i++) bulb[i] = light[i] > 60 ? 1 : 0;
	bulb = px.keepLargest(
		px.dilate(px.erode(bulb, img.w, img.h, 14), img.w, img.h, 14),
		img.w,
		img.h,
	);
	const fit = px.fitCircle(outline(bulb, img.w, img.h));

	// Keyed, the bulb is a body (the dark between its fibres stays dark, as it
	// is on black) and the threads and the haze around it are light.
	const body = px.gauss(px.fillHoles(bulb, img.w, img.h), img.w, img.h, 2.5);
	const keyed = await saveKeyed('roots/e4-node-alpha.webp', px.key(img, body, { floor: 2 }));

	// Where a main thread crosses a row: the light-weighted middle of the
	// brightest run on it.
	const smooth = px.gauss(light, img.w, img.h, 2);
	const crossing = (y, x0, x1) => {
		let peak = 0;
		for (let x = x0; x < x1; x++) peak = Math.max(peak, smooth[y * img.w + x]);
		let sum = 0;
		let weight = 0;
		for (let x = x0; x < x1; x++) {
			const v = smooth[y * img.w + x] - 0.5 * peak;
			if (v <= 0) continue;
			sum += v * x;
			weight += v;
		}
		return { x: sum / weight, peak };
	};
	// The upper thread runs off the top edge at about a tenth of full strength.
	const top = crossing(0, Math.round(fit.x - 60), Math.round(fit.x + 60));
	// The lower one fades out first. Follow it down from the bulb until it is
	// under 8 of 255; where it would meet the bottom edge is the line through
	// its last 120 px, carried on.
	const rows = [];
	let x = fit.x - 20;
	for (let y = Math.round(fit.y + fit.r * 1.3); y < img.h; y++) {
		const c = crossing(y, Math.round(x - 24), Math.round(x + 24));
		if (c.peak < 8) break;
		x = c.x;
		rows.push([y, c.x]);
	}
	const end = rows[rows.length - 1];
	const last = rows.slice(-120);
	const n = last.length;
	const sy = last.reduce((a, r) => a + r[0], 0);
	const sx = last.reduce((a, r) => a + r[1], 0);
	const syy = last.reduce((a, r) => a + r[0] * r[0], 0);
	const sxy = last.reduce((a, r) => a + r[0] * r[1], 0);
	const slope = (n * sxy - sy * sx) / (n * syy - sy * sy);
	const bottomX = (sx - slope * sy) / n + slope * (img.h - 0.5);

	const geometry = {
		bulb: circle(fit),
		threadTop: { x: centre(top.x), y: 0 },
		threadEnd: point({ x: end[1], y: end[0] }),
		threadBottom: { x: centre(bottomX), y: img.h },
	};
	// Only the keyed node is drawn (the same frame on black was never fetched and is not made).
	return { e4NodeAlpha: { ...keyed, ...geometry } };
}

async function roots() {
	earthSamples.push(
		await soilMean(
			'e-roots/E1_soil_landscape-16x9.jpg',
			{ left: 154, top: 242, width: 2268, height: 808 },
			1920,
		),
		await soilMean(
			'e-roots/E1_soil_portrait-9x16.jpg',
			{ left: 43, top: 280, width: 1352, height: 1344 },
			1080,
		),
	);
	return { ...(await e4Node()) };
}
const earthSamples = [];

// ───────────────────────────────────────────────────────────────── ui ──

/**
 * The two skins, from the same window: the middle half of the sheet
 * (x 648–1928, y 399–1039), clear of the dark band down the left, the
 * darker right edge and the bright top, taken down to 1024×512. At 100% a
 * 56 px button shows a 56 px strip of it, across which the sheet's
 * top-to-bottom falloff is under 5 levels.
 */
async function ui() {
	const WINDOW = { left: 648, top: 399, width: 1280, height: 640 };
	const skin = (rel, file) =>
		save(
			`ui/${rel}.webp`,
			sharp(src(file))
				.extract(WINDOW)
				.resize({ width: 1024, kernel: 'lanczos3' })
				// The brushing is fine grain, which is the first thing a codec drops:
				// at 80 a quarter of it is gone and a button reads as a gradient.
				.webp({ ...WEBP, quality: 88 }),
		);
	return {
		brassMain: await skin('brass-main', 'brass/BRASS_skin_main-light.jpg'),
		brassDark: await skin('brass-dark', 'brass/BRASS_skin_dark-variant.jpg'),
	};
}

// ───────────────────────────────────────────────────────────── chrome ──

/** What the brass of the C is lifted to in the two small tab icons: luminance, of 255. */
const TAB_BODY_L = 200;

/**
 * The browser-tab icon, public/favicon.png (180 px) and public/favicon.ico
 * (32 and 16 px, each stored as a PNG), square, on the site's black.
 *
 * The 180 px one is the emblem as the logo has it: idle, its lit lines
 * widened, with a margin. The two small ones are not that picture made
 * smaller: at 16 px a strut is a third of a pixel wide and takes a third of
 * its brightness, so the idle emblem came out a dim grey-mauve C on a black
 * square (its brightest pixel L 118 of 255, the widened blue lines mixed into
 * the brass). They are the pack's fully lit emblem instead, with no lines
 * widened, cropped to the C with no margin (so it is as large as the square
 * lets it be), and lifted, every channel by the same factor so the brass
 * keeps its hue, until the body of the C stands at TAB_BODY_L.
 */
async function tabIcon(emblem, lit, c) {
	const squareOf = (img, margin) => {
		const side = Math.max(c.w, c.h) + 2 * margin;
		const x0 = Math.round(c.x + c.w / 2 - side / 2);
		const y0 = Math.round(c.y + c.h / 2 - side / 2);
		return px.crop(img, x0, y0, side, side);
	};
	const encode = (pipeline) => pipeline.png({ compressionLevel: 9, palette: false }).toBuffer();
	const square = squareOf(emblem, 70);
	const png = (size) =>
		encode(fromImage(square).resize({ width: size, height: size, kernel: 'lanczos3' }));
	const tight = squareOf(lit, 0);
	const small = async (size) => {
		const { data, info } = await fromImage(tight)
			.resize({ width: size, height: size, kernel: 'lanczos3' })
			.raw()
			.toBuffer({ resolveWithObject: true });
		const ch = info.channels;
		// The body of the C: the brighter half of what is brass at this size.
		const body = [];
		for (let i = 0; i < data.length; i += ch) {
			const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
			if (data[i] > BRASS_LEVEL && data[i] >= data[i + 2]) body.push(l);
		}
		body.sort((a, b) => a - b);
		const level = body[Math.floor(body.length * 0.9)];
		const gain = TAB_BODY_L / level;
		for (let i = 0; i < data.length; i += ch) {
			// One factor for the three channels of a pixel, so that a pixel that
			// would pass white keeps its colour.
			const top = Math.max(data[i], data[i + 1], data[i + 2]) * gain;
			const k = top > 255 ? (gain * 255) / top : gain;
			for (let j = 0; j < 3; j++) data[i + j] = Math.round(data[i + j] * k);
		}
		console.log(
			`  tab icon ${size} px: the lit emblem, no margin; its body at L ${level.toFixed(0)}, lifted ${gain.toFixed(2)}x to L ${TAB_BODY_L}`,
		);
		return encode(sharp(data, { raw: info }));
	};
	const write = (name, data) => {
		const file = join(ROOT, 'public', name);
		const same = existsSync(file) && readFileSync(file).equals(data);
		if (!same) writeFileSync(file, data);
		console.log(
			`  ${same ? '=' : '+'} public/${name.padEnd(21)} ${(data.length / 1024).toFixed(1).padStart(7)} KB`,
		);
	};
	write('favicon.png', await png(180));
	// An .ico is a directory of pictures; each of these is a whole PNG.
	const entries = [
		{ size: 32, data: await small(32) },
		{ size: 16, data: await small(16) },
	];
	const head = Buffer.alloc(6 + 16 * entries.length);
	head.writeUInt16LE(0, 0);
	head.writeUInt16LE(1, 2);
	head.writeUInt16LE(entries.length, 4);
	let offset = head.length;
	for (const [i, e] of entries.entries()) {
		const at = 6 + 16 * i;
		head.writeUInt8(e.size, at);
		head.writeUInt8(e.size, at + 1);
		head.writeUInt8(0, at + 2);
		head.writeUInt8(0, at + 3);
		head.writeUInt16LE(1, at + 4);
		head.writeUInt16LE(32, at + 6);
		head.writeUInt32LE(e.data.length, at + 8);
		head.writeUInt32LE(offset, at + 12);
		offset += e.data.length;
	}
	write('favicon.ico', Buffer.concat([head, ...entries.map((e) => e.data)]));
}

/**
 * How far each lit line of the emblem is widened for the logo, to every side,
 * pixels of the pair's frame (1400). It was 2: at 60 px high on a 1x screen
 * (23 pixels of the frame to one of the screen) the lines then covered most of
 * every strut, and the emblem read dusky mauve, bluer than the pack's fully
 * lit emblem at that size. At 1 the brass shows on both sides of each line.
 */
const LOGO_LINE = 1;
/** How strongly the widened lines are laid on: "on, but calm". */
const LOGO_CALM = 0.9;

/**
 * The emblem's lit circuit lines, widened: at logo size (43 to 52 px wide,
 * a seventeenth of the pair's frame) the lines of the lit picture are a
 * fifth of a pixel and cannot be seen. They are found (where lighting the
 * emblem added blue), widened by LOGO_LINE to every side, and softened; the
 * colour they are drawn in is their own, the mean of the lit picture along
 * them. Returns the mask (0..1) and that colour.
 */
function litLines(lit, unlit) {
	const { w, h } = lit;
	const n = w * h;
	const line = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const gain = lit.b[i] - unlit.b[i];
		const blue = lit.b[i] - Math.max(lit.r[i], 0.92 * lit.g[i]);
		line[i] = px.clamp((gain - 30) / 40) * px.clamp((blue - 8) / 24);
	}
	// Lines only: a lit face (the main node's lens, a ring filled with glow) is
	// light over an area, and widening it would paint the brass over.
	const area = px.gauss(line, w, h, 7);
	let r = 0;
	let g = 0;
	let b = 0;
	let weight = 0;
	for (let i = 0; i < n; i++) {
		line[i] *= 1 - px.smoothstep(0.3, 0.5, area[i]);
		// Their colour: the ridge of each line, its brightest part.
		if (line[i] > 0.9 && lit.b[i] > 150) {
			r += lit.r[i];
			g += lit.g[i];
			b += lit.b[i];
			weight++;
		}
	}
	if (weight < 500) throw new Error('logo: found no lit lines on the emblem');
	const wide = px.gauss(px.maxFilter(line, w, h, LOGO_LINE), w, h, 1.5);
	for (let i = 0; i < n; i++) wide[i] = px.clamp(wide[i] * 1.3);
	return { wide, colour: [r / weight, g / weight, b / weight] };
}

/**
 * C1's idle emblem: 60% lit over unlit, from the registered pair, with the lit
 * lines widened so that they are still lines at logo size, keyed and trimmed.
 */
async function chrome() {
	const { lit, unlit, c, node } = await emblemPair();
	const size = lit.w;
	const n = size * size;
	const blend = {
		w: size,
		h: size,
		r: new Float32Array(n),
		g: new Float32Array(n),
		b: new Float32Array(n),
	};
	for (const key of ['r', 'g', 'b'])
		for (let i = 0; i < n; i++) blend[key][i] = 0.6 * lit[key][i] + 0.4 * unlit[key][i];
	// The brass is one piece with clean edges on a clean black; its openings
	// are far bigger than anything that needs filling inside a strut.
	let fat = px.keepLargest(brassMask(blend), size, size);
	fat = px.fillHoles(fat, size, size, 4000);
	const body = px.gauss(fat, size, size, 1);
	// The lit lines, widened, laid on the brass (and only on it).
	const { wide, colour } = litLines(lit, unlit);
	console.log(`  logo: lit lines in ${hex(colour)}, widened by ${LOGO_LINE} px`);
	for (const [k, key] of ['r', 'g', 'b'].entries()) {
		for (let i = 0; i < n; i++) {
			const t = LOGO_CALM * wide[i] * body[i];
			blend[key][i] = blend[key][i] * (1 - t) + colour[k] * t;
		}
	}
	await tabIcon(blend, lit, c);
	const keyed = px.key(blend, body, { floor: 6 });
	const M = 12;
	const x0 = c.x - M;
	const y0 = c.y - M;
	const trimmed = px.crop(keyed, x0, y0, c.w + 2 * M, c.h + 2 * M);
	const small = await resize(trimmed, { height: 192, kernel: 'lanczos3' });
	const k = small.h / trimmed.h;
	const file = await saveKeyed('chrome/c-logo.webp', small, 88);
	// Pixel index in the pair → distance from this picture's corner.
	const at = (v, o) => round1((v - o + 0.5) * k);
	return {
		cLogo: {
			...file,
			c: {
				x: round1((c.x - x0) * k),
				y: round1((c.y - y0) * k),
				w: round1(c.w * k),
				h: round1(c.h * k),
			},
			node: { x: at(node.x, x0), y: at(node.y, y0), r: round1(node.r * k) },
		},
	};
}

// ──────────────────────────────────────────────────────────── palette ──

const hex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const medianOf = (pixels) => [0, 1, 2].map((k) => px.median(pixels.map((p) => p[k])));

/**
 * The palette, sampled. Nothing is written: the values are printed and
 * checked against the two files they live in, src/styles/tokens.css and
 * src/experience/tokens.ts. Every sample is a median over a region, or a
 * mean where the token is one.
 */
async function palette() {
	const samples = {};

	// Brass, from the nine letters of A4 (not the emblem, not the star), with
	// the circuit lines and their glow masked out: any pixel whose blue is over
	// 85% of its red, grown by 3 px.
	const a4 = await px.load(sharp, src('a-loading/A4_wordmark_cellestial.jpg'));
	const { labels, regions } = px.label(brassMask(a4), a4.w, a4.h);
	const parts = regions.filter((r) => r.n > 1000).sort((p, q) => p.x - q.x);
	const star = parts.reduce((p, q) => (q.n < p.n ? q : p));
	const letterIds = new Set(parts.filter((r) => r !== parts[0] && r !== star).map((r) => r.id));
	const n = a4.w * a4.h;
	const letters = new Float32Array(n);
	let lines = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		letters[i] = letterIds.has(labels[i]) ? 1 : 0;
		lines[i] = a4.b[i] > 0.85 * a4.r[i] ? 1 : 0;
	}
	lines = px.dilate(lines, a4.w, a4.h, 3);
	const pick = (mask) => {
		const list = [];
		for (let i = 0; i < n; i++) if (mask[i] && !lines[i]) list.push([a4.r[i], a4.g[i], a4.b[i]]);
		return list;
	};
	// The body mid-tone: the flat faces, 6 px in from every edge.
	samples.BRASS = medianOf(pick(px.erode(letters, a4.w, a4.h, 6)));
	// Highlight and shadow: the whole letter 1 px in, ordered by luminance; the
	// 95th–99th percentile band (the lit bevels) and the 5th–15th (their far sides).
	const whole = pick(px.erode(letters, a4.w, a4.h, 1)).sort(
		(p, q) => luminance(...p) - luminance(...q),
	);
	const band = (lo, hi) =>
		medianOf(whole.slice(Math.floor(whole.length * lo), Math.floor(whole.length * hi)));
	samples.BRASS_HI = band(0.95, 0.99);
	samples.BRASS_LO = band(0.05, 0.15);
	// Brass for words: the lit faces, the 85th–92nd percentile. The median face is too dark to
	// read as small type on black; this is the brass the eye takes the letters to be.
	samples.BRASS_TEXT = band(0.85, 0.92);

	// Blue, from the lit circuit lines of A1 lit along the struts (the main
	// node and its glow left out): the ridge of each line, which is the pixels
	// that are the bluest of their 5×5 block, blue over 150 and over 1.6× red.
	const lit = await px.load(sharp, src('a-loading/A1_c-emblem_lit.jpg'));
	const { node } = await emblemPair();
	const nx = node.x + PAIR_FRAME.x;
	const ny = node.y + PAIR_FRAME.y;
	const bluest = px.maxFilter(lit.b, lit.w, lit.h, 2);
	const ridge = [];
	for (let i = 0; i < lit.w * lit.h; i++) {
		if (lit.b[i] <= 150 || lit.b[i] <= 1.6 * lit.r[i] || lit.b[i] < bluest[i]) continue;
		if (Math.hypot((i % lit.w) - nx, Math.floor(i / lit.w) - ny) < node.r + 20) continue;
		ridge.push([lit.r[i], lit.g[i], lit.b[i]]);
	}
	samples.BLUE = medianOf(ridge);

	// Blue-white, from the disc of the B3 core, out to three quarters of its radius.
	const core = await px.load(sharp, src('b-sky/B3_core_radiant-star.jpg'));
	const disc = px.fitRim(core.r, core.w, core.h, { x: 511, y: 513, r: 121 }, { level: 170 });
	const centreOfCore = [];
	for (let i = 0; i < core.w * core.h; i++) {
		if (Math.hypot((i % core.w) - disc.x, Math.floor(i / core.w) - disc.y) > 0.75 * disc.r)
			continue;
		centreOfCore.push([core.r[i], core.g[i], core.b[i]]);
	}
	samples.BLUE_WHITE = medianOf(centreOfCore);

	// Earth: the average of the soil, both tiles, as cropped.
	if (earthSamples.length) {
		samples.EARTH = [0, 1, 2].map(
			(k) => earthSamples.reduce((sum, m) => sum + m[k], 0) / earthSamples.length,
		);
	}

	// Both copies of the palette have to say what was just sampled.
	const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
	const ts = read(TOKENS);
	const css = read(THEME);
	console.log('palette');
	for (const [name, rgb] of Object.entries(samples)) {
		const value = hex(rgb);
		const property = `--color-${name.toLowerCase().replaceAll('_', '-')}`;
		const said = [
			['tokens.ts', ts.match(new RegExp(`export const ${name} = '(#[0-9a-f]{6})'`))?.[1]],
			['tokens.css', css.match(new RegExp(`${property}: (#[0-9a-f]{6});`))?.[1]],
		];
		const wrong = said
			.filter(([, v]) => v !== value)
			.map(([file, v]) => `${file} says ${v ?? 'nothing'}`);
		const verdict = wrong.length
			? `MISMATCH: ${wrong.join(', ')}`
			: 'as in tokens.ts and tokens.css';
		console.log(
			`  ${name.padEnd(11)} ${value}  rgb(${rgb.map((v) => Math.round(v)).join(', ')})  ${verdict}`,
		);
	}
}

// ─────────────────────────────────────────────────────────── manifest ──

const MANIFEST_HEAD = `// Written by scripts/build-assets.mjs. Do not edit: change the script and run it again.
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

/** \`rx\` is the longer half-axis. \`angle\` turns it clockwise on screen from the +x axis, in degrees. */
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
	/** The C emblem. Map \`EmblemAsset.c\` onto this to lay A1 over it. */
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
		/** B5 on black, for additive blending. The same sphere as B4, in its own frame. */
		readonly b5LitAdd: DiscAsset;
	};
	readonly roots: {
		/** Keyed. The bulb is solid, its threads and haze soft. */
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
`;

/** One value as TypeScript, the way Biome would lay it out (tabs, 100 columns). */
function literal(value, depth, lead) {
	if (typeof value === 'number') return String(value);
	if (typeof value === 'string')
		return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
	const pad = '\t'.repeat(depth + 1);
	const close = '\t'.repeat(depth);
	if (Array.isArray(value)) {
		return `[\n${value.map((v) => `${pad}${literal(v, depth + 1, 0)},`).join('\n')}\n${close}]`;
	}
	const entries = Object.entries(value);
	if (entries.every(([, v]) => typeof v !== 'object')) {
		const flat = `{ ${entries.map(([k, v]) => `${k}: ${literal(v)}`).join(', ')} }`;
		if (depth * 2 + lead + flat.length + 1 <= 100) return flat;
	}
	return `{\n${entries.map(([k, v]) => `${pad}${k}: ${literal(v, depth + 1, k.length + 2)},`).join('\n')}\n${close}}`;
}

function writeManifest(manifest) {
	const body = `${MANIFEST_HEAD}\nexport const ASSETS = ${literal(manifest, 0, 0)} as const satisfies AssetManifest;\n`;
	const same = existsSync(MANIFEST) && readFileSync(MANIFEST, 'utf8') === body;
	if (!same) writeFileSync(MANIFEST, body);
	console.log(`${same ? '=' : '+'} ${relative(ROOT, MANIFEST)}`);
}

// ─────────────────────────────────────────────────────────────── main ──

const GROUPS = { loader, sky, roots, ui, chrome };

async function main() {
	const args = process.argv.slice(2);
	const only = args.filter((g) => g !== 'modules');
	const unknown = only.filter((g) => !(g in GROUPS));
	if (unknown.length)
		throw new Error(
			`unknown group: ${unknown.join(', ')} (have ${Object.keys(GROUPS).join(', ')})`,
		);

	const manifest = {};
	for (const [name, build] of Object.entries(GROUPS)) {
		if (args.length && !only.includes(name)) continue;
		console.log(name);
		manifest[name] = await build();
	}
	if (!args.length) {
		writeManifest(manifest);
		await palette();
	}

	const modules = existsSync(MODULE_DIR)
		? readdirSync(MODULE_DIR).filter((f) => f.endsWith('.mjs'))
		: [];
	for (const file of modules.sort()) {
		console.log(`scripts/assets/${file}`);
		const mod = await import(pathToFileURL(join(MODULE_DIR, file)).href);
		if (typeof mod.default !== 'function')
			throw new Error(`scripts/assets/${file}: no default export to run`);
		await mod.default({ sharp, src, out, px });
	}

	let files = 0;
	let bytes = 0;
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const file = join(dir, name);
			const stat = statSync(file);
			if (stat.isDirectory()) walk(file);
			else {
				files++;
				bytes += stat.size;
			}
		}
	};
	walk(OUT_DIR);
	console.log(
		`${relative(ROOT, OUT_DIR)}: ${files} files, ${bytes} bytes (${(bytes / 1024).toFixed(0)} KB)`,
	);
}

await main();
