// What the loading scene (A1 to A5) needs besides its three pictures. Run by
// scripts/build-assets.mjs (see the module contract in its header).
//
// Everything here is measured on the derived pack pictures themselves
// (public/cellestial/loader/c-unlit.webp, c-lit.webp, wordmark.webp), so the
// numbers fit exactly what the browser draws:
//
//   1. How the C sprite sits on the emblem inside the wordmark: one scale and
//      one shift, fitted to the edges of the brass. The two are the same
//      render at two sizes, and the fit says how well.
//   2. The lit circuits of the C as lines. Every point carries the second of
//      the reference video at which the light gets there, so the scene can
//      reveal "everything before now" and put a hot head at "now".
//   3. The circuit line that runs down the middle of each of the nine letters,
//      as lines, each point with how far into the writing of that letter it
//      comes (0 to 1), and the ring nodes at the stroke ends.
//   4. wordmark-matte.webp: the brass of the wordmark as an alpha matte, so
//      the letters can stand over the sky once the black behind them goes.
//
// 1 to 3 are written to src/experience/loader/geometry.ts. With LOADER_DEBUG
// set to a folder, overlays that prove the lines against the pictures are
// written there.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const GEOMETRY = join(ROOT, 'src/experience/loader/geometry.ts');
const DEBUG = process.env.LOADER_DEBUG || '';

const round = (v, digits) => {
	const k = 10 ** digits;
	return Math.round(v * k) / k;
};

// ─────────────────────────────────────────────────── thinning and tracing ──

/** Zhang–Suen thinning of a 0/1 mask to lines one pixel wide. */
function thin(mask, w, h) {
	const m = Uint8Array.from(mask);
	const kill = [];
	let changed = true;
	while (changed) {
		changed = false;
		for (let pass = 0; pass < 2; pass++) {
			kill.length = 0;
			for (let y = 1; y < h - 1; y++) {
				for (let x = 1; x < w - 1; x++) {
					const i = y * w + x;
					if (!m[i]) continue;
					const p2 = m[i - w];
					const p3 = m[i - w + 1];
					const p4 = m[i + 1];
					const p5 = m[i + w + 1];
					const p6 = m[i + w];
					const p7 = m[i + w - 1];
					const p8 = m[i - 1];
					const p9 = m[i - w - 1];
					const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
					if (b < 2 || b > 6) continue;
					const a =
						(!p2 && p3) +
						(!p3 && p4) +
						(!p4 && p5) +
						(!p5 && p6) +
						(!p6 && p7) +
						(!p7 && p8) +
						(!p8 && p9) +
						(!p9 && p2);
					if (a !== 1) continue;
					if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
					kill.push(i);
				}
			}
			if (kill.length) changed = true;
			for (const i of kill) m[i] = 0;
		}
	}
	return m;
}

/**
 * Neighbours of a skeleton pixel. A diagonal step is dropped when either of
 * the two straight steps beside it exists, so a staircase is a path and not
 * a row of little triangles.
 */
function neighbours(skel, w, h, p) {
	const x = p % w;
	const y = (p - x) / w;
	const at = (dx, dy) => {
		const xx = x + dx;
		const yy = y + dy;
		return xx >= 0 && yy >= 0 && xx < w && yy < h && skel[yy * w + xx] ? yy * w + xx : -1;
	};
	const out = [];
	for (const [dx, dy] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
	]) {
		const q = at(dx, dy);
		if (q >= 0) out.push(q);
	}
	for (const [dx, dy] of [
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1],
	]) {
		const q = at(dx, dy);
		if (q >= 0 && at(dx, 0) < 0 && at(0, dy) < 0) out.push(q);
	}
	return out;
}

/** The skeleton as paths of pixel indices between its ends and forks (and closed loops). */
function traceSegments(skel, w, h) {
	const n = w * h;
	const nb = new Map();
	for (let p = 0; p < n; p++) if (skel[p]) nb.set(p, neighbours(skel, w, h, p));
	const isNode = (p) => nb.get(p).length !== 2;
	const used = new Set();
	const key = (a, b) => a * n + b;
	const segments = [];
	const walk = (from, first) => {
		const path = [from, first];
		used.add(key(from, first));
		let prev = from;
		let cur = first;
		while (!isNode(cur) && cur !== from) {
			const [a, b] = nb.get(cur);
			const next = a === prev ? b : a;
			used.add(key(cur, next));
			path.push(next);
			prev = cur;
			cur = next;
		}
		used.add(key(cur, prev));
		return path;
	};
	for (const [p, list] of nb) {
		if (!isNode(p)) continue;
		if (!list.length) segments.push([p]);
		for (const q of list) if (!used.has(key(p, q))) segments.push(walk(p, q));
	}
	const seen = new Set(segments.flat());
	for (const [p, list] of nb) {
		if (seen.has(p) || list.length !== 2) continue;
		const loop = walk(p, list[0]);
		for (const q of loop) seen.add(q);
		segments.push(loop);
	}
	return { segments, degree: (p) => nb.get(p).length };
}

const pathLength = (path, w) => {
	let len = 0;
	for (let i = 1; i < path.length; i++) {
		const dx = (path[i] % w) - (path[i - 1] % w);
		const dy = Math.floor(path[i] / w) - Math.floor(path[i - 1] / w);
		len += Math.hypot(dx, dy);
	}
	return len;
};

/** Thin a mask and take off the short whiskers that thinning leaves on blobs. */
function skeleton(mask, w, h, minSpur) {
	const skel = thin(mask, w, h);
	for (let round = 0; round < 3; round++) {
		const { segments, degree } = traceSegments(skel, w, h);
		let cut = 0;
		for (const seg of segments) {
			if (seg.length < 2) continue;
			const a = degree(seg[0]);
			const b = degree(seg[seg.length - 1]);
			const whisker = (a === 1 && b >= 3) || (b === 1 && a >= 3);
			if (!whisker || pathLength(seg, w) >= minSpur) continue;
			const keep = a >= 3 ? seg[0] : seg[seg.length - 1];
			for (const p of seg) if (p !== keep) skel[p] = 0;
			cut++;
		}
		if (!cut) break;
	}
	return skel;
}

/** Indices at which a series turns round by more than `tol`, ends included. */
function pivots(t, tol) {
	const out = [0];
	let trend = 0;
	let ext = 0;
	for (let i = 1; i < t.length; i++) {
		if (trend === 0) {
			if (Math.abs(t[i] - t[0]) > tol) {
				trend = Math.sign(t[i] - t[0]);
				ext = i;
			}
		} else if ((t[i] - t[ext]) * trend >= 0) ext = i;
		else if ((t[ext] - t[i]) * trend > tol) {
			out.push(ext);
			trend = -trend;
			ext = i;
		}
	}
	out.push(t.length - 1);
	return out;
}

/** Ramer–Douglas–Peucker over points `[x, y, z]`, all three counted. */
function simplify(points, eps) {
	if (points.length <= 2) return points;
	const keep = new Uint8Array(points.length);
	keep[0] = keep[points.length - 1] = 1;
	const stack = [[0, points.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const A = points[a];
		const d = [points[b][0] - A[0], points[b][1] - A[1], points[b][2] - A[2]];
		const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
		let worst = 0;
		let at = -1;
		for (let i = a + 1; i < b; i++) {
			const v = [points[i][0] - A[0], points[i][1] - A[1], points[i][2] - A[2]];
			const k = (v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dd;
			const e = Math.hypot(v[0] - k * d[0], v[1] - k * d[1], v[2] - k * d[2]);
			if (e > worst) {
				worst = e;
				at = i;
			}
		}
		if (worst > eps) {
			keep[at] = 1;
			stack.push([a, at], [at, b]);
		}
	}
	return points.filter((_, i) => keep[i]);
}

/**
 * The skeleton as lines that only ever run forward in `value` (a time, or a
 * distance along the writing): each traced path is cut where the value turns
 * round, turned to run upward, and thinned to the points that matter.
 * `zScale` is how many pixels one unit of value counts for when thinning.
 * Returns flat `[x, y, value, x, y, value, ...]` arrays, x and y from the
 * image's top-left corner.
 */
function forwardLines(skel, w, h, value, { tol, zScale, eps = 0.7 }) {
	const { segments } = traceSegments(skel, w, h);
	const lines = [];
	for (const seg of segments) {
		const raw = seg.map((p) => [(p % w) + 0.5, Math.floor(p / w) + 0.5, value[p]]);
		// A traced path steps from pixel to pixel; the line it follows does not.
		const closed = raw.length > 8 && seg[0] === seg[seg.length - 1];
		const pts = raw.map((q, i) => {
			if (!closed && (i < 2 || i > raw.length - 3)) return q;
			let x = 0;
			let y = 0;
			for (let k = -2; k <= 2; k++) {
				const j = closed ? (i + k + 2 * (raw.length - 1)) % (raw.length - 1) : i + k;
				const weight = 3 - Math.abs(k);
				x += raw[j][0] * weight;
				y += raw[j][1] * weight;
			}
			return [x / 9, y / 9, q[2]];
		});
		const turn = pivots(
			pts.map((q) => q[2]),
			tol,
		);
		for (let k = 0; k + 1 < turn.length; k++) {
			let run = pts.slice(turn[k], turn[k + 1] + 1);
			if (run.length < 2) continue;
			if (run[run.length - 1][2] < run[0][2]) run = run.reverse();
			let high = -Infinity;
			run = run.map(([x, y, v]) => {
				high = Math.max(high, v);
				return [x, y, high * zScale];
			});
			const thinned = simplify(run, eps).map(([x, y, z]) => [x, y, z / zScale]);
			let len = 0;
			for (let i = 1; i < thinned.length; i++)
				len += Math.hypot(thinned[i][0] - thinned[i - 1][0], thinned[i][1] - thinned[i - 1][1]);
			if (len < 1.6) continue;
			lines.push(thinned);
		}
	}
	lines.sort((a, b) => a[0][2] - b[0][2]);
	return lines;
}

// ───────────────────────────────────────────────────────── shortest paths ──

class Heap {
	keys = [];
	vals = [];
	get size() {
		return this.keys.length;
	}
	push(key, val) {
		const { keys, vals } = this;
		let i = keys.length;
		keys.push(key);
		vals.push(val);
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (keys[p] <= key) break;
			keys[i] = keys[p];
			vals[i] = vals[p];
			i = p;
		}
		keys[i] = key;
		vals[i] = val;
	}
	pop() {
		const { keys, vals } = this;
		const top = [keys[0], vals[0]];
		const key = keys.pop();
		const val = vals.pop();
		const n = keys.length;
		if (n) {
			let i = 0;
			for (;;) {
				let c = 2 * i + 1;
				if (c >= n) break;
				if (c + 1 < n && keys[c + 1] < keys[c]) c++;
				if (keys[c] >= key) break;
				keys[i] = keys[c];
				vals[i] = vals[c];
				i = c;
			}
			keys[i] = key;
			vals[i] = val;
		}
		return top;
	}
}

/**
 * Distance along the skeleton from `root` to every skeleton pixel. Where the
 * skeleton is in pieces, the light jumps the smallest gap to the next piece
 * and the gap counts as distance.
 */
function flood(skel, w, h, root) {
	const n = w * h;
	const dist = new Float32Array(n).fill(Infinity);
	const done = new Uint8Array(n);
	const heap = new Heap();
	const pixels = [];
	for (let i = 0; i < n; i++) if (skel[i]) pixels.push(i);
	let reached = 0;
	const run = () => {
		while (heap.size) {
			const [d, p] = heap.pop();
			if (done[p]) continue;
			done[p] = 1;
			reached++;
			const x = p % w;
			const y = (p - x) / w;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const xx = x + dx;
					const yy = y + dy;
					if ((!dx && !dy) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
					const q = yy * w + xx;
					if (!skel[q] || done[q]) continue;
					const nd = d + (dx && dy ? Math.SQRT2 : 1);
					if (nd < dist[q]) {
						dist[q] = nd;
						heap.push(nd, q);
					}
				}
			}
		}
	};
	dist[root] = 0;
	heap.push(0, root);
	run();
	while (reached < pixels.length) {
		let best = Infinity;
		let from = -1;
		let to = -1;
		for (const q of pixels) {
			if (done[q]) continue;
			const qx = q % w;
			const qy = (q - qx) / w;
			for (const p of pixels) {
				if (!done[p]) continue;
				const px = p % w;
				const dd = (px - qx) ** 2 + ((p - px) / w - qy) ** 2;
				if (dd < best) {
					best = dd;
					from = p;
					to = q;
				}
			}
		}
		dist[to] = dist[from] + Math.sqrt(best);
		heap.push(dist[to], to);
		run();
	}
	return dist;
}

// ────────────────────────────────────────────────────────────── the parts ──

/** A 0/1 mask from a plane: everything over `low` that belongs to a patch reaching `high`. */
function hysteresis(px, plane, w, h, low, high, minArea) {
	const m = new Float32Array(w * h);
	for (let i = 0; i < m.length; i++) m[i] = plane[i] > low ? 1 : 0;
	const { labels, regions } = px.label(m, w, h);
	const strong = new Uint8Array(regions.length + 1);
	for (let i = 0; i < m.length; i++) if (plane[i] > high) strong[labels[i]] = 1;
	for (const r of regions) if (r.n < minArea) strong[r.id] = 0;
	for (let i = 0; i < m.length; i++) m[i] = strong[labels[i]];
	return m;
}

/**
 * The C sprite on the wordmark's emblem: `X = scale * x + tx`. A pattern
 * search over one scale and one shift that brings the edge of the emblem's
 * brass in the wordmark onto the edge of the brass in the sprite.
 */
function fitEmblem(px, lit, wm, manifest) {
	const LEVEL = 40;
	const brass = (img) => {
		const m = new Float32Array(img.w * img.h);
		for (let i = 0; i < m.length; i++) m[i] = img.r[i] > LEVEL ? 1 : 0;
		return m;
	};
	const sprite = px.signedDistance(px.keepLargest(brass(lit), lit.w, lit.h), lit.w, lit.h);
	const box = manifest.wordmark.emblem;
	const emblem = px.keepRegions(
		brass(wm),
		wm.w,
		wm.h,
		(r) => r.x < box.x + box.w / 2 && r.n > 5000,
	);
	const edge = px.signedDistance(emblem, wm.w, wm.h);
	const points = [];
	for (let y = box.y - 4; y < box.y + box.h + 4; y++) {
		for (let x = box.x - 4; x < box.x + box.w + 4; x++) {
			const i = y * wm.w + x;
			if (emblem[i] && Math.abs(edge[i]) <= 0.5) points.push([x + 0.5, y + 0.5]);
		}
	}
	const misfit = ([s, tx, ty]) =>
		points.map(
			([X, Y]) =>
				Math.abs(px.sample(sprite, lit.w, lit.h, (X - tx) / s - 0.5, (Y - ty) / s - 0.5)) * s,
		);
	const cost = (p) => Math.sqrt(misfit(p).reduce((a, e) => a + Math.min(e, 6) ** 2, 0));
	const c = manifest.cLit.c;
	const s0 = (box.w / c.w + box.h / c.h) / 2;
	let p = [s0, box.x - c.x * s0, box.y - c.y * s0];
	let best = cost(p);
	let step = [0.004, 2, 2];
	while (step[1] > 0.005) {
		let better = false;
		for (let k = 0; k < 3; k++) {
			for (const dir of [-1, 1]) {
				const q = p.slice();
				q[k] += dir * step[k];
				const e = cost(q);
				if (e < best - 1e-9) {
					best = e;
					p = q;
					better = true;
				}
			}
		}
		if (!better) step = step.map((v) => v / 2);
	}
	const errs = misfit(p).sort((a, b) => a - b);
	return {
		scale: round(p[0], 5),
		x: round(p[1], 2),
		y: round(p[2], 2),
		median: round(errs[errs.length >> 1], 2),
		p90: round(errs[Math.floor(errs.length * 0.9)], 2),
	};
}

/**
 * When the light reaches each strut, read off the reference video
 * (cellestial-assets/images/a-loading/A2-A3_….mp4, frame by frame at 24 fps).
 * A strut is named by the two places its line runs between, in c-lit pixels;
 * the light is at `a` at second `t0` and at `b` at second `t1`.
 */
const JOINTS = {
	bottomRight: [758, 1207],
	bottomLeft: [697, 1219],
	innerLower: [598, 966],
	lowerLeftB: [398, 1073],
	lowerLeftL: [379, 1051],
	left: [262, 700],
	innerUpper: [590, 412],
	upperLeft: [392, 306],
	top: [787, 177],
	tip: [1088, 318],
};
const NODE_LIGHTS = [0.29, 0.42];
const TIP_RING = { x: 1120, y: 325, r: 50, t0: 1.56, t1: 1.65 };
const STRUTS = [
	{ a: 'rim', b: 'bottomRight', t0: 0.43, t1: 0.585 },
	{ a: 'rim', b: 'innerLower', t0: 0.56, t1: 0.7 },
	{ a: 'bottomRight', b: 'innerLower', t0: 0.61, t1: 0.71 },
	{ a: 'bottomLeft', b: 'lowerLeftB', t0: 0.64, t1: 0.833 },
	{ a: 'lowerLeftL', b: 'left', t0: 0.833, t1: 0.99 },
	{ a: 'innerLower', b: 'left', t0: 0.71, t1: 0.97 },
	{ a: 'innerLower', b: 'innerUpper', t0: 0.75, t1: 1.1, arc: 'x' },
	{ a: 'left', b: 'upperLeft', t0: 0.99, t1: 1.167 },
	{ a: 'left', b: 'innerUpper', t0: 0.99, t1: 1.15 },
	{ a: 'innerUpper', b: 'upperLeft', t0: 1.1, t1: 1.17 },
	{ a: 'upperLeft', b: 'top', t0: 1.167, t1: 1.333 },
	{ a: 'innerUpper', b: 'top', t0: 1.15, t1: 1.333 },
	{ a: 'innerUpper', b: 'tip', t0: 1.12, t1: 1.56, arc: 'y' },
	{ a: 'top', b: 'tip', t0: 1.333, t1: 1.56 },
];

/** The lit lines of the C, each point with the second the light arrives. */
function circuit(px, lit, unlit, manifest) {
	const { w, h } = lit;
	const n = w * h;
	const node = manifest.cLit.node;
	const core = manifest.cLit.core;

	// What the lit picture has that the unlit one does not, and is blue. The
	// lines are thin and the glow round them is wide, so the lines are what
	// is left when a wide blur of that gain is taken from a narrow one.
	const gain = new Float32Array(n);
	for (let i = 0; i < n; i++)
		gain[i] = Math.max(0, lit.b[i] - unlit.b[i] - (lit.r[i] - unlit.r[i]));
	const fine = px.gauss(gain, w, h, 1);
	const wide = px.gauss(gain, w, h, 5);
	const smooth = new Float32Array(n);
	for (let i = 0; i < n; i++) smooth[i] = Math.max(0, fine[i] - wide[i]);
	// The unlit grooves of the other nodes show a little too; a lit line is bright.
	const bright = new Float32Array(n);
	for (let i = 0; i < n; i++) bright[i] = lit.b[i] > 120 ? smooth[i] : Math.min(smooth[i], 18);
	const mask = hysteresis(px, bright, w, h, 13, 30, 40);
	// The lens itself is a pool of light, not a line: the feed stops at its edge.
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (Math.hypot(x + 0.5 - core.x, y + 0.5 - core.y) < 34) mask[y * w + x] = 0;
		}
	}
	const skel = skeleton(mask, w, h, 9);

	// The two bows are followed where nothing else runs beside them.
	const ridge = (fixed, lo, hi, along) => {
		let best = -1;
		let at = lo;
		for (let v = lo; v <= hi; v++) {
			const g = along === 'x' ? smooth[fixed * w + v] : smooth[v * w + fixed];
			if (g > best) {
				best = g;
				at = v;
			}
		}
		return at + 0.5;
	};
	const struts = STRUTS.map((s) => {
		const b = JOINTS[s.b];
		let a = JOINTS[s.a];
		if (s.a === 'rim') {
			const d = Math.hypot(b[0] - node.x, b[1] - node.y);
			a = [node.x + ((b[0] - node.x) / d) * node.r, node.y + ((b[1] - node.y) / d) * node.r];
		}
		const pts = [a];
		if (s.arc === 'x') for (let y = 860; y >= 560; y -= 50) pts.push([ridge(y, 500, 590, 'x'), y]);
		if (s.arc === 'y') for (let x = 720; x <= 1040; x += 40) pts.push([x, ridge(x, 290, 400, 'y')]);
		pts.push(b);
		const cum = [0];
		for (let i = 1; i < pts.length; i++)
			cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
		return { ...s, pts, cum };
	});

	const time = new Float32Array(n);
	for (let p = 0; p < n; p++) {
		if (!skel[p]) continue;
		const x = (p % w) + 0.5;
		const y = Math.floor(p / w) + 0.5;
		if (Math.hypot(x - node.x, y - node.y) < node.r + 4) {
			const k = Math.min(1, Math.hypot(x - core.x, y - core.y) / node.r);
			time[p] = NODE_LIGHTS[0] + (NODE_LIGHTS[1] - NODE_LIGHTS[0]) * k;
			continue;
		}
		const ring = Math.hypot(x - TIP_RING.x, y - TIP_RING.y);
		const [ex, ey] = JOINTS.tip;
		if (ring < TIP_RING.r && Math.hypot(x - ex, y - ey) > 6 && x > ex) {
			const k = Math.min(1, Math.hypot(x - ex, y - ey) / 70);
			time[p] = TIP_RING.t0 + (TIP_RING.t1 - TIP_RING.t0) * k;
			continue;
		}
		let near = Infinity;
		for (const s of struts) {
			for (let i = 1; i < s.pts.length; i++) {
				const [ax, ay] = s.pts[i - 1];
				const [bx, by] = s.pts[i];
				const dx = bx - ax;
				const dy = by - ay;
				const k = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
				const d = Math.hypot(x - ax - k * dx, y - ay - k * dy);
				if (d >= near) continue;
				near = d;
				const along = (s.cum[i - 1] + k * (s.cum[i] - s.cum[i - 1])) / s.cum[s.cum.length - 1];
				time[p] = s.t0 + (s.t1 - s.t0) * along;
			}
		}
	}

	// A groove that is not lit is traced too where it catches the light of a
	// line; told apart by how blue the picture is along it. The ring round the
	// tip is lit, and thin.
	const lines = forwardLines(skel, w, h, time, { tol: 0.012, zScale: 300 }).filter((line) => {
		let sum = 0;
		for (const [x, y] of line) {
			let b = 0;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++)
					b = Math.max(b, lit.b[(Math.floor(y) + dy) * w + Math.floor(x) + dx]);
			}
			sum += b;
		}
		const onTip = Math.hypot(line[0][0] - TIP_RING.x, line[0][1] - TIP_RING.y) < TIP_RING.r;
		return onTip || sum / line.length >= 140;
	});
	return { lines };
}

/** Ring nodes at the stroke ends of a letter: a thin groove round a disc of brass. */
function ringNodes(px, wm, box) {
	const { w, h } = wm;
	const N = 48;
	const mean = (cx, cy, r) => {
		let s = 0;
		for (let k = 0; k < N; k++) {
			const a = (k / N) * 2 * Math.PI;
			s += px.sample(wm.r, w, h, cx + Math.cos(a) * r - 0.5, cy + Math.sin(a) * r - 0.5);
		}
		return s / N;
	};
	const found = [];
	for (let cy = box.y + 10; cy < box.y + box.h - 10; cy++) {
		for (let cx = box.x + 10; cx < box.x + box.w - 10; cx++) {
			if (wm.r[cy * w + cx] < 55) continue;
			let best = 0;
			let radius = 0;
			for (let r = 12.5; r <= 16.5; r += 0.5) {
				const groove = mean(cx + 0.5, cy + 0.5, r);
				const brass = (mean(cx + 0.5, cy + 0.5, r - 4) + mean(cx + 0.5, cy + 0.5, r + 4)) / 2;
				const score = 1 - groove / (brass + 1e-6);
				if (score > best) {
					best = score;
					radius = r;
				}
			}
			if (best > 0.34) found.push({ x: cx + 0.5, y: cy + 0.5, r: radius, score: best });
		}
	}
	found.sort((a, b) => b.score - a.score);
	const rings = [];
	for (const f of found) {
		if (!rings.some((k) => Math.hypot(k.x - f.x, k.y - f.y) < 16)) rings.push(f);
	}
	return rings;
}

/** Where the writing of each letter begins: e, l, l, e, s, t, i, a, l. */
const STARTS = ['left', 'top', 'top', 'left', 'bottomLeft', 'top', 'top', 'topLeft', 'top'];

/**
 * How the reference writes an e (read off its frames from 3.625 s to 3.833 s).
 * The lightning lands on the left of the bowl, where the bar meets it. From
 * there the tube shoots up and slows as it comes over the top; a little
 * later it runs down the left side, waits, and goes round the bottom to the
 * ring; the bar comes last, from the left. Each stretch is a row of
 * `[how far along it, when]` keys, `when` as a part of the time the letter takes.
 */
const E_ORDER = {
	upper: [
		[0, 0],
		[0.55, 0.2],
		[1, 0.74],
	],
	lower: [
		[0, 0.25],
		[0.37, 0.42],
		[0.5, 0.64],
		[1, 1],
	],
	bar: [
		[0, 0.66],
		[1, 0.97],
	],
};

/**
 * An e's line and the distances along it, in E_ORDER. The bar is whatever of
 * the line lies well inside the bowl; it is cut just short of the bowl on its
 * right, so that it is written from the left only. The distances are scaled
 * like any letter's: the longest is `reach`, the longest way along the line
 * from `root`.
 */
function orderE(skel, w, h, root) {
	const ry = Math.floor(root / w);
	let x0 = w;
	let x1 = 0;
	let y0 = h;
	let y1 = 0;
	for (let p = 0; p < w * h; p++) {
		if (!skel[p]) continue;
		x0 = Math.min(x0, p % w);
		x1 = Math.max(x1, p % w);
		y0 = Math.min(y0, Math.floor(p / w));
		y1 = Math.max(y1, Math.floor(p / w));
	}
	// The bowl is close to an ellipse through the line's own extremes.
	const inside = (p) =>
		(((p % w) - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2 +
			((Math.floor(p / w) - (y0 + y1) / 2) / ((y1 - y0) / 2)) ** 2 <
		0.72;
	let last = 0;
	for (let p = 0; p < w * h; p++) if (skel[p] && inside(p)) last = Math.max(last, p % w);
	const cut = Uint8Array.from(skel);
	for (let p = 0; p < w * h; p++) if (cut[p] && inside(p) && p % w >= last - 2) cut[p] = 0;
	const plain = flood(cut, w, h, root);
	const part = (p) => (inside(p) ? 'bar' : Math.floor(p / w) > ry + 1 ? 'lower' : 'upper');
	const span = { upper: [0, 0], lower: [Infinity, 0], bar: [Infinity, 0] };
	let reach = 0;
	for (let p = 0; p < w * h; p++) {
		if (!cut[p]) continue;
		const s = span[part(p)];
		s[0] = Math.min(s[0], plain[p]);
		s[1] = Math.max(s[1], plain[p]);
		reach = Math.max(reach, plain[p]);
	}
	const dist = new Float32Array(w * h).fill(Infinity);
	for (let p = 0; p < w * h; p++) {
		if (!cut[p]) continue;
		const k = part(p);
		const keys = E_ORDER[k];
		const along = (plain[p] - span[k][0]) / (span[k][1] - span[k][0]);
		let i = 1;
		while (i < keys.length - 1 && keys[i][0] < along) i++;
		const [a0, v0] = keys[i - 1];
		const [a1, v1] = keys[i];
		dist[p] = reach * (v0 + ((v1 - v0) * (along - a0)) / (a1 - a0));
	}
	return { skel: cut, dist, reach };
}

/** The circuit line of every letter, each point with how far into the writing it comes. */
function letters(px, wm, manifest) {
	const n = wm.w * wm.h;
	const blue = new Float32Array(n);
	for (let i = 0; i < n; i++) blue[i] = Math.max(0, wm.b[i] - Math.max(wm.r[i], wm.g[i] * 0.9));
	const smooth = px.gauss(blue, wm.w, wm.h, 0.8);
	const brass = new Float32Array(n);
	for (let i = 0; i < n; i++) brass[i] = wm.r[i] > 24 ? 1 : 0;
	const depth = px.signedDistance(brass, wm.w, wm.h);
	const node = manifest.wordmark.node;

	const out = [];
	const weights = [];
	manifest.wordmark.letters.forEach((box, index) => {
		const rings = ringNodes(px, wm, box);
		// The line inside this letter's box, on a crop of its own (`w` by `h`, at
		// `box`). The grooves of the ring nodes are taken out: two of them are
		// lit, and a ring is drawn as a ring, not traced.
		const { w, h } = box;
		const local = new Float32Array(w * h);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const X = box.x + x + 0.5;
				const Y = box.y + y + 0.5;
				// The first letter's box takes in a corner of the main node.
				if (Math.hypot(X - node.x, Y - node.y) < node.r + 6) continue;
				if (rings.some((r) => Math.abs(Math.hypot(X - r.x, Y - r.y) - r.r) < 3.5)) continue;
				local[y * w + x] = smooth[(box.y + y) * wm.w + box.x + x];
			}
		}
		let skel = skeleton(hysteresis(px, local, w, h, 20, 45, 12), w, h, 7);
		const whole = [];
		for (let i = 0; i < w * h; i++) if (skel[i]) whole.push(i);
		if (!whole.length) throw new Error(`loader: no circuit line found in letter ${index}`);
		let pixels = whole;
		const score = {
			left: (x, y) => x + Math.abs(y - h / 2) * 0.05,
			top: (_x, y) => y,
			bottomLeft: (x, y) => Math.hypot(x, y - h),
			topLeft: (x, y) => Math.hypot(x, y),
		}[STARTS[index]];
		const at = (p) => score(p % w, Math.floor(p / w));
		let root = pixels[0];
		for (const p of pixels) if (at(p) < at(root)) root = p;
		let dist;
		let reach = 0;
		if (box.ch === 'e') {
			({ skel, dist, reach } = orderE(skel, w, h, root));
			pixels = whole.filter((p) => skel[p]);
		} else {
			dist = flood(skel, w, h, root);
			for (const p of pixels) reach = Math.max(reach, dist[p]);
		}
		const lines = forwardLines(skel, w, h, dist, { tol: 3, zScale: 0.5 })
			.map((line) => line.map(([x, y, d]) => [x + box.x, y + box.y, d / reach]))
			.flatMap((line) => {
				// A stretch that begins later starts with a leap in its value over
				// next to no distance. That is a break: what comes after the leap is
				// a line of its own, and is not there before its time.
				const parts = [];
				let from = 0;
				for (let i = 0; i + 1 < line.length; i++) {
					const far = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
					if (line[i + 1][2] - line[i][2] > 0.05 && far < 3) {
						parts.push(line.slice(from, i + 1));
						from = i + 1;
					}
				}
				if (!from) return [line];
				parts.push(line.slice(from));
				return parts.filter((part) => {
					let len = 0;
					for (let i = 1; i < part.length; i++)
						len += Math.hypot(part[i][0] - part[i - 1][0], part[i][1] - part[i - 1][1]);
					return len >= 4;
				});
			})
			.sort((a, b) => a[0][2] - b[0][2]);
		for (const p of whole)
			weights.push(2 * depth[(box.y + Math.floor(p / w)) * wm.w + box.x + (p % w)]);
		// A ring lights when the writing reaches the point of the line nearest to it.
		const ringsOut = rings.map((r) => {
			let near = Infinity;
			let when = 0;
			for (const p of pixels) {
				const X = box.x + (p % w) + 0.5;
				const Y = box.y + Math.floor(p / w) + 0.5;
				const d = Math.abs(Math.hypot(X - r.x, Y - r.y) - r.r);
				if (d < near) {
					near = d;
					when = dist[p] / reach;
				}
			}
			return { x: r.x, y: r.y, r: r.r, at: round(when, 3) };
		});
		out.push({
			ch: box.ch,
			start: { x: box.x + (root % w) + 0.5, y: box.y + Math.floor(root / w) + 0.5 },
			reach: round(reach, 1),
			lines,
			rings: ringsOut,
		});
	});
	weights.sort((a, b) => a - b);
	return { letters: out, weight: round(weights[weights.length >> 1], 1) };
}

/** The brass of the wordmark as an alpha matte: emblem, letters and star, solid. */
function matte(px, wm, manifest) {
	const { w, h } = wm;
	const n = w * h;
	let fat = new Float32Array(n);
	for (let i = 0; i < n; i++) fat[i] = wm.r[i] > 24 ? 1 : 0;
	fat = px.keepRegions(fat, w, h, (r) => r.n > 400);
	// The lens of the main node is dark glass, and part of the emblem.
	const node = manifest.wordmark.node;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (Math.hypot(x + 0.5 - node.x, y + 0.5 - node.y) < node.r - 3) fat[y * w + x] = 1;
		}
	}
	return px.gauss(fat, w, h, 0.8);
}

// ──────────────────────────────────────────────────────────────── output ──

/** A flat list of numbers the way Biome lays one out: filled to 100 columns, a tab counting 2. */
function numbers(list, depth) {
	const flat = `[${list.join(', ')}]`;
	if (depth * 2 + flat.length + 1 <= 100) return flat;
	const pad = '\t'.repeat(depth + 1);
	const rows = [];
	let row = '';
	for (const v of list) {
		const item = `${v},`;
		if (row && (depth + 1) * 2 + row.length + 1 + item.length > 100) {
			rows.push(pad + row);
			row = item;
		} else row = row ? `${row} ${item}` : item;
	}
	if (row) rows.push(pad + row);
	return `[\n${rows.join('\n')}\n${'\t'.repeat(depth)}]`;
}

const flatLine = (line, digits) =>
	line.flatMap(([x, y, v]) => [round(x, 1), round(y, 1), round(v, digits)]);

function writeGeometry({ fit, lines, word, matteFile }) {
	const circuitRows = lines.map((l) => `\t${numbers(flatLine(l, 3), 1)},`).join('\n');
	const letterRows = word.letters
		.map((l) => {
			const strokes = l.lines.map((s) => `\t\t\t${numbers(flatLine(s, 3), 3)},`).join('\n');
			const ring = (r) => `{ x: ${r.x}, y: ${r.y}, r: ${r.r}, at: ${r.at} }`;
			const rings = l.rings.map((r) => `\t\t\t${ring(r)},`).join('\n');
			const ringRow =
				l.rings.length === 1
					? `\t\trings: [${ring(l.rings[0])}],`
					: rings
						? `\t\trings: [\n${rings}\n\t\t],`
						: '\t\trings: [],';
			return [
				'\t{',
				`\t\tch: '${l.ch}',`,
				`\t\tstart: { x: ${l.start.x}, y: ${l.start.y} },`,
				`\t\treach: ${l.reach},`,
				`\t\tlines: [\n${strokes}\n\t\t],`,
				ringRow,
				'\t},',
			].join('\n');
		})
		.join('\n');
	const body = `// Written by scripts/assets/loader.mjs. Do not edit: change the script and run
// "node scripts/build-assets.mjs modules" again.
//
// Measured on the loader's own pictures (see the script for how). Positions
// count from a picture's top-left corner, as canvas does.

// biome-ignore-all lint/suspicious/noApproximativeNumericConstant: these are measurements

/** A line as flat triples: x, y, value, x, y, value, … The value only ever rises along a line. */
export type Line = readonly number[];

export interface RingNode {
	readonly x: number;
	readonly y: number;
	readonly r: number;
	/** How far into the writing of its letter (0 to 1) the ring lights. */
	readonly at: number;
}

export interface LetterPath {
	readonly ch: string;
	/** Where the writing of this letter begins. */
	readonly start: { readonly x: number; readonly y: number };
	/** The longest way along the line from \`start\`, in wordmark pixels. */
	readonly reach: number;
	/** The value of each point is how far into the writing it comes, 0 to 1. */
	readonly lines: readonly Line[];
	readonly rings: readonly RingNode[];
}

/**
 * The C sprite (c-unlit, c-lit) laid on the emblem inside the wordmark:
 * \`X = scale * x + this.x\`, \`Y = scale * y + this.y\`. The two are one render
 * at two sizes; \`median\` and \`p90\` are how far the edges of the brass still
 * lie apart after the fit, in wordmark pixels.
 */
export const EMBLEM_ON_WORDMARK = {
	scale: ${fit.scale},
	x: ${fit.x},
	y: ${fit.y},
	median: ${fit.median},
	p90: ${fit.p90},
} as const;

/** The brass of the wordmark as alpha (emblem, letters, star), in the wordmark's own frame. */
export const WORDMARK_MATTE = {
	url: '${matteFile.url}',
	w: ${matteFile.w},
	h: ${matteFile.h},
} as const;

/** The stroke of a letter of the wordmark, edge to edge, in wordmark pixels. */
export const LETTER_WEIGHT = ${word.weight};

/**
 * The lit circuits of the C, in c-lit pixels. The value of each point is the
 * second of the reference video at which the light reaches it; the lines are
 * in the order they light.
 */
export const CIRCUIT: readonly Line[] = [
${circuitRows}
];

/** The circuit line of each letter of the wordmark, in wordmark pixels: e, l, l, e, s, t, i, a, l. */
export const LETTERS: readonly LetterPath[] = [
${letterRows}
];
`;
	const squeeze = (s) => s.replace(/\s+/g, '');
	const same = existsSync(GEOMETRY) && squeeze(readFileSync(GEOMETRY, 'utf8')) === squeeze(body);
	if (!same) {
		mkdirSync(dirname(GEOMETRY), { recursive: true });
		writeFileSync(GEOMETRY, body);
	}
	console.log(`  ${same ? '=' : '+'} ${relative(ROOT, GEOMETRY)}`);
}

/** Overlays that prove the lines: each drawn over its picture, coloured by its value. */
async function proofs(sharp, { litFile, wmFile, lines, word, fit, lit, wm, px }) {
	mkdirSync(DEBUG, { recursive: true });
	const stroke = (line, max, width) => {
		const parts = [];
		for (let i = 1; i < line.length; i++) {
			const hue = Math.round((300 * (line[i][2] + line[i - 1][2])) / 2 / max);
			parts.push(
				`<line x1="${line[i - 1][0]}" y1="${line[i - 1][1]}" x2="${line[i][0]}" y2="${line[i][1]}" stroke="hsl(${hue} 100% 60%)" stroke-width="${width}" stroke-linecap="round"/>`,
			);
		}
		parts.push(
			`<circle cx="${line[0][0]}" cy="${line[0][1]}" r="${width * 1.6}" fill="none" stroke="#fff" stroke-width="0.6"/>`,
		);
		return parts.join('');
	};
	const svgC = `<svg xmlns="http://www.w3.org/2000/svg" width="${lit.w}" height="${lit.h}">${lines.map((l) => stroke(l, 1.7, 2.4)).join('')}</svg>`;
	await sharp(litFile)
		.modulate({ brightness: 0.45 })
		.composite([{ input: Buffer.from(svgC) }])
		.jpeg({ quality: 90 })
		.toFile(join(DEBUG, 'proof-circuit.jpg'));
	const parts = [];
	for (const l of word.letters) {
		for (const s of l.lines) parts.push(stroke(s, 1, 2));
		for (const r of l.rings)
			parts.push(
				`<circle cx="${r.x}" cy="${r.y}" r="${r.r}" fill="none" stroke="hsl(${Math.round(300 * r.at)} 100% 60%)" stroke-width="2"/>`,
			);
		parts.push(
			`<circle cx="${l.start.x}" cy="${l.start.y}" r="7" fill="none" stroke="#0f0" stroke-width="1.5"/>`,
		);
	}
	const svgW = `<svg xmlns="http://www.w3.org/2000/svg" width="${wm.w}" height="${wm.h}">${parts.join('')}</svg>`;
	await sharp(wmFile)
		.modulate({ brightness: 0.45 })
		.composite([{ input: Buffer.from(svgW) }])
		.jpeg({ quality: 90 })
		.toFile(join(DEBUG, 'proof-letters.jpg'));
	// The sprite laid on the emblem: wordmark in red, sprite in green and blue. Grey is agreement.
	const box = { x: 90, y: 250, w: 560, h: 640 };
	const K = 2;
	const buf = Buffer.alloc(box.w * K * box.h * K * 3);
	for (let j = 0; j < box.h * K; j++) {
		for (let i = 0; i < box.w * K; i++) {
			const X = box.x + (i + 0.5) / K;
			const Y = box.y + (j + 0.5) / K;
			const c = px.sample(
				lit.r,
				lit.w,
				lit.h,
				(X - fit.x) / fit.scale - 0.5,
				(Y - fit.y) / fit.scale - 0.5,
			);
			const m = px.sample(wm.r, wm.w, wm.h, X - 0.5, Y - 0.5);
			const o = (j * box.w * K + i) * 3;
			buf[o] = Math.min(255, m * 1.6);
			buf[o + 1] = buf[o + 2] = Math.min(255, c * 1.6);
		}
	}
	await sharp(buf, { raw: { width: box.w * K, height: box.h * K, channels: 3 } })
		.jpeg({ quality: 90 })
		.toFile(join(DEBUG, 'proof-emblem-fit.jpg'));
}

export default async function loader({ sharp, out, px }) {
	const { ASSETS } = await import(pathToFileURL(join(ROOT, 'src/experience/assets.ts')).href);
	const manifest = ASSETS.loader;
	const litFile = out('loader/c-lit.webp');
	const wmFile = out('loader/wordmark.webp');
	const lit = await px.load(sharp, litFile);
	const unlit = await px.load(sharp, out('loader/c-unlit.webp'));
	const wm = await px.load(sharp, wmFile);

	const fit = fitEmblem(px, lit, wm, manifest);
	console.log(
		`  emblem on wordmark: ×${fit.scale} +(${fit.x}, ${fit.y}); edges apart ${fit.median} px median, ${fit.p90} px at 90%`,
	);

	const { lines } = circuit(px, lit, unlit, manifest);
	const points = lines.reduce((a, l) => a + l.length, 0);
	const last = Math.max(...lines.map((l) => l[l.length - 1][2]));
	console.log(`  circuit: ${lines.length} lines, ${points} points, lit by ${last.toFixed(2)} s`);

	const word = letters(px, wm, manifest);
	for (const l of word.letters) {
		const n = l.lines.reduce((a, s) => a + s.length, 0);
		console.log(
			`  letter ${l.ch}: ${l.lines.length} lines, ${n} points, reach ${l.reach} px, ${l.rings.length} ring nodes`,
		);
	}

	// The matte: black, with the brass as its alpha. 64 levels of alpha is plenty for an edge.
	const alpha = matte(px, wm, manifest);
	const rgba = Buffer.alloc(wm.w * wm.h * 4);
	for (let i = 0; i < alpha.length; i++) rgba[i * 4 + 3] = Math.round(px.clamp(alpha[i]) * 255);
	const encoded = await sharp(rgba, { raw: { width: wm.w, height: wm.h, channels: 4 } })
		.webp({ quality: 50, alphaQuality: 70, effort: 6 })
		.toBuffer();
	const matteRel = 'loader/wordmark-matte.webp';
	const matteOut = out(matteRel);
	const same = existsSync(matteOut) && readFileSync(matteOut).equals(encoded);
	if (!same) writeFileSync(matteOut, encoded);
	console.log(
		`  ${same ? '=' : '+'} ${matteRel.padEnd(28)} ${wm.w}×${wm.h} ${(encoded.length / 1024).toFixed(1).padStart(7)} KB`,
	);

	writeGeometry({
		fit,
		lines,
		word,
		matteFile: { url: `/cellestial/${matteRel}`, w: wm.w, h: wm.h },
	});
	if (DEBUG) await proofs(sharp, { litFile, wmFile, lines, word, fit, lit, wm, px });
}
