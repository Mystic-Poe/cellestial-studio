// Pixel toolkit for scripts/build-assets.mjs and the scene modules next to it.
//
// Everything works on planar float images, `{ w, h, r, g, b }` with one
// Float32Array per channel holding ordinary 8-bit values (0..255). Masks and
// single planes are Float32Array(w * h) too. Nothing here invents pixels: it
// measures, crops, keys and resamples what is in the pack.

// ───────────────────────────────────────────────────────────── basics ──

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** 0 below `a`, 1 above `b`, a smooth S in between. */
export function smoothstep(a, b, x) {
	const t = clamp((x - a) / (b - a));
	return t * t * (3 - 2 * t);
}

export const median = (values) => {
	const s = Float64Array.from(values).sort();
	return s.length ? s[s.length >> 1] : Number.NaN;
};

/** Decode a file (or a sharp pipeline) into float planes, alpha dropped. */
export async function load(sharp, input) {
	const pipeline = typeof input === 'string' ? sharp(input) : input;
	const { data, info } = await pipeline.removeAlpha().raw().toBuffer({ resolveWithObject: true });
	const { width: w, height: h, channels: c } = info;
	const n = w * h;
	const r = new Float32Array(n);
	const g = new Float32Array(n);
	const b = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		r[i] = data[i * c];
		g[i] = c >= 3 ? data[i * c + 1] : data[i * c];
		b[i] = c >= 3 ? data[i * c + 2] : data[i * c];
	}
	return { w, h, r, g, b };
}

export function crop(img, x, y, w, h) {
	const out = { w, h };
	for (const k of ['r', 'g', 'b', 'a']) {
		if (!img[k]) continue;
		const p = new Float32Array(w * h);
		for (let j = 0; j < h; j++) {
			p.set(img[k].subarray((y + j) * img.w + x, (y + j) * img.w + x + w), j * w);
		}
		out[k] = p;
	}
	return out;
}

/** Brightest channel of every pixel. For a light on black this is its amount. */
export function maxOf(img) {
	const out = new Float32Array(img.w * img.h);
	for (let i = 0; i < out.length; i++) out[i] = Math.max(img.r[i], img.g[i], img.b[i]);
	return out;
}

/** 8-bit interleaved buffer (RGB, or RGBA when the image has an `a` plane in 0..1). */
export function toRaw(img) {
	const n = img.w * img.h;
	const channels = img.a ? 4 : 3;
	const out = Buffer.alloc(n * channels);
	for (let i = 0; i < n; i++) {
		out[i * channels] = clamp(Math.round(img.r[i]), 0, 255);
		out[i * channels + 1] = clamp(Math.round(img.g[i]), 0, 255);
		out[i * channels + 2] = clamp(Math.round(img.b[i]), 0, 255);
		if (img.a) out[i * channels + 3] = clamp(Math.round(img.a[i] * 255), 0, 255);
	}
	return { data: out, raw: { width: img.w, height: img.h, channels } };
}

/** Back from an interleaved 8-bit buffer (as sharp's raw output) to planes. */
export function fromRaw(data, w, h, channels) {
	const n = w * h;
	const img = { w, h, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n) };
	if (channels === 4) img.a = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		img.r[i] = data[i * channels];
		img.g[i] = data[i * channels + 1];
		img.b[i] = data[i * channels + 2];
		if (img.a) img.a[i] = data[i * channels + 3] / 255;
	}
	return img;
}

// ──────────────────────────────────────────────────────────── filters ──

/** Separable Gaussian blur of one plane, edges clamped. */
export function gauss(src, w, h, sigma) {
	const rad = Math.max(1, Math.ceil(sigma * 3));
	const k = new Float32Array(2 * rad + 1);
	let sum = 0;
	for (let i = -rad; i <= rad; i++) {
		k[i + rad] = Math.exp(-(i * i) / (2 * sigma * sigma));
		sum += k[i + rad];
	}
	for (let i = 0; i < k.length; i++) k[i] /= sum;
	const tmp = new Float32Array(w * h);
	const out = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		const o = y * w;
		for (let x = 0; x < w; x++) {
			let a = 0;
			for (let i = -rad; i <= rad; i++) a += src[o + clamp(x + i, 0, w - 1)] * k[i + rad];
			tmp[o + x] = a;
		}
	}
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let a = 0;
			for (let i = -rad; i <= rad; i++) a += tmp[clamp(y + i, 0, h - 1) * w + x] * k[i + rad];
			out[y * w + x] = a;
		}
	}
	return out;
}

/** Largest value within a (2r+1) square. */
export function maxFilter(src, w, h, r) {
	const tmp = new Float32Array(w * h);
	const out = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let m = -Infinity;
			for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) {
				if (src[y * w + i] > m) m = src[y * w + i];
			}
			tmp[y * w + x] = m;
		}
	}
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let m = -Infinity;
			for (let i = Math.max(0, y - r); i <= Math.min(h - 1, y + r); i++) {
				if (tmp[i * w + x] > m) m = tmp[i * w + x];
			}
			out[y * w + x] = m;
		}
	}
	return out;
}

/**
 * Exact Euclidean distance from every pixel to the nearest set pixel of
 * `mask` (Felzenszwalb & Huttenlocher). With `nearest`, also the index of
 * that pixel, which is what colour bleeding needs.
 */
export function distance(mask, w, h, { nearest = false } = {}) {
	const INF = 1e20;
	const f = new Float64Array(w * h);
	for (let i = 0; i < w * h; i++) f[i] = mask[i] ? 0 : INF;
	const len = Math.max(w, h);
	const v = new Int32Array(len);
	const z = new Float64Array(len + 1);
	const g = new Float64Array(len);
	const arg = new Int32Array(len);
	// Lower envelope of parabolas along one line; `arg[q]` is the winning source.
	const pass = (n) => {
		let k = 0;
		v[0] = 0;
		z[0] = -INF;
		z[1] = INF;
		for (let q = 1; q < n; q++) {
			let s;
			do {
				const p = v[k];
				s = (g[q] + q * q - (g[p] + p * p)) / (2 * q - 2 * p);
			} while (s <= z[k] && --k >= 0);
			k++;
			v[k] = q;
			z[k] = s;
			z[k + 1] = INF;
		}
		k = 0;
		for (let q = 0; q < n; q++) {
			while (z[k + 1] < q) k++;
			arg[q] = v[k];
		}
	};
	const rowOf = nearest ? new Int32Array(w * h) : null;
	for (let x = 0; x < w; x++) {
		for (let y = 0; y < h; y++) g[y] = f[y * w + x];
		pass(h);
		for (let y = 0; y < h; y++) {
			const p = arg[y];
			f[y * w + x] = (y - p) * (y - p) + g[p];
			if (rowOf) rowOf[y * w + x] = p;
		}
	}
	const dist = new Float32Array(w * h);
	const index = nearest ? new Int32Array(w * h) : null;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) g[x] = f[y * w + x];
		pass(w);
		for (let x = 0; x < w; x++) {
			const p = arg[x];
			dist[y * w + x] = Math.sqrt((x - p) * (x - p) + g[p]);
			if (index) index[y * w + x] = rowOf[y * w + p] * w + p;
		}
	}
	return nearest ? { dist, index } : dist;
}

const invert = (mask) => {
	const out = new Float32Array(mask.length);
	for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1;
	return out;
};

/** Grow a mask by a disc of radius `r`. */
export function dilate(mask, w, h, r) {
	const d = distance(mask, w, h);
	const out = new Float32Array(w * h);
	for (let i = 0; i < out.length; i++) out[i] = d[i] <= r ? 1 : 0;
	return out;
}

/** Shrink a mask by a disc of radius `r`. */
export function erode(mask, w, h, r) {
	const d = distance(invert(mask), w, h);
	const out = new Float32Array(w * h);
	for (let i = 0; i < out.length; i++) out[i] = d[i] > r ? 1 : 0;
	return out;
}

/**
 * Signed distance to the outline of a mask, in pixels: positive inside,
 * negative outside, zero on the boundary between two pixel centres.
 */
export function signedDistance(mask, w, h) {
	const inside = distance(invert(mask), w, h);
	const outside = distance(mask, w, h);
	const out = new Float32Array(w * h);
	for (let i = 0; i < out.length; i++) out[i] = mask[i] ? inside[i] - 0.5 : 0.5 - outside[i];
	return out;
}

// ────────────────────────────────────────────────────────────── shapes ──

/**
 * Connected regions of a mask. Returns the label plane and, per region, its
 * bounding box, area, centroid and whether it touches the image border.
 */
export function label(mask, w, h, { eight = true } = {}) {
	const labels = new Int32Array(w * h);
	const regions = [];
	const stack = [];
	for (let s = 0; s < w * h; s++) {
		if (!mask[s] || labels[s]) continue;
		const id = regions.length + 1;
		let x0 = w;
		let y0 = h;
		let x1 = -1;
		let y1 = -1;
		let n = 0;
		let sx = 0;
		let sy = 0;
		let border = false;
		stack.push(s);
		labels[s] = id;
		while (stack.length) {
			const p = stack.pop();
			const x = p % w;
			const y = (p - x) / w;
			n++;
			sx += x;
			sy += y;
			if (x < x0) x0 = x;
			if (x > x1) x1 = x;
			if (y < y0) y0 = y;
			if (y > y1) y1 = y;
			if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if ((!dx && !dy) || (!eight && dx && dy)) continue;
					const xx = x + dx;
					const yy = y + dy;
					if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
					const q = yy * w + xx;
					if (mask[q] && !labels[q]) {
						labels[q] = id;
						stack.push(q);
					}
				}
			}
		}
		regions.push({
			id,
			x: x0,
			y: y0,
			w: x1 - x0 + 1,
			h: y1 - y0 + 1,
			n,
			cx: sx / n,
			cy: sy / n,
			border,
		});
	}
	return { labels, regions };
}

/** Only the regions for which `keep(region)` is true. */
export function keepRegions(mask, w, h, keep, opts) {
	const { labels, regions } = label(mask, w, h, opts);
	const ok = new Uint8Array(regions.length + 1);
	for (const r of regions) ok[r.id] = keep(r) ? 1 : 0;
	const out = new Float32Array(w * h);
	for (let i = 0; i < out.length; i++) out[i] = ok[labels[i]];
	return out;
}

export function keepLargest(mask, w, h) {
	const { regions } = label(mask, w, h);
	const top = Math.max(0, ...regions.map((r) => r.n));
	return keepRegions(mask, w, h, (r) => r.n === top);
}

/** Close the holes of a mask that are no bigger than `maxArea` pixels. */
export function fillHoles(mask, w, h, maxArea = Infinity) {
	const { labels, regions } = label(invert(mask), w, h, { eight: false });
	const fill = new Uint8Array(regions.length + 1);
	for (const r of regions) fill[r.id] = !r.border && r.n <= maxArea ? 1 : 0;
	const out = new Float32Array(w * h);
	for (let i = 0; i < out.length; i++) out[i] = mask[i] || fill[labels[i]] ? 1 : 0;
	return out;
}

/** Bounding box of the set pixels of a mask, as integer pixel bounds. */
export function bounds(mask, w, h) {
	let x0 = w;
	let y0 = h;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!mask[y * w + x]) continue;
			if (x < x0) x0 = x;
			if (x > x1) x1 = x;
			if (y < y0) y0 = y;
			if (y > y1) y1 = y;
		}
	}
	return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ──────────────────────────────────────────────────────────── fitting ──

/** Solve a small dense linear system by Gaussian elimination. */
export function solve(A, b) {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let i = 0; i < n; i++) {
		let p = i;
		for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
		[M[i], M[p]] = [M[p], M[i]];
		for (let k = i + 1; k < n; k++) {
			const f = M[k][i] / M[i][i];
			for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
		}
	}
	const x = new Array(n).fill(0);
	for (let i = n - 1; i >= 0; i--) {
		let v = M[i][n];
		for (let j = i + 1; j < n; j++) v -= M[i][j] * x[j];
		x[i] = v / M[i][i];
	}
	return x;
}

/** Least-squares circle through points `[x, y]` (Kåsa). `rms` is the misfit in pixels. */
export function fitCircle(points) {
	let sx = 0;
	let sy = 0;
	let sxx = 0;
	let syy = 0;
	let sxy = 0;
	let sxz = 0;
	let syz = 0;
	let sz = 0;
	for (const [x, y] of points) {
		const z = x * x + y * y;
		sx += x;
		sy += y;
		sxx += x * x;
		syy += y * y;
		sxy += x * y;
		sxz += x * z;
		syz += y * z;
		sz += z;
	}
	const [A, B, C] = solve(
		[
			[sxx, sxy, sx],
			[sxy, syy, sy],
			[sx, sy, points.length],
		],
		[sxz, syz, sz],
	);
	const x = A / 2;
	const y = B / 2;
	const r = Math.sqrt(C + x * x + y * y);
	let e = 0;
	for (const [px, py] of points) e += (Math.hypot(px - x, py - y) - r) ** 2;
	return { x, y, r, rms: Math.sqrt(e / points.length) };
}

/**
 * Least-squares ellipse through points `[x, y]`. `rx` is the longer
 * semi-axis and `angle` its direction in degrees, measured clockwise on
 * screen (y runs down) from the +x axis, in (-90, 90].
 */
export function fitEllipse(points) {
	// Centre and scale first, or the conic's normal equations are hopeless.
	let mx = 0;
	let my = 0;
	for (const [x, y] of points) {
		mx += x / points.length;
		my += y / points.length;
	}
	let s = 0;
	for (const [x, y] of points) s += Math.hypot(x - mx, y - my) / points.length;
	// a x² + b xy + c y² + d x + e y = 1
	const N = Array.from({ length: 5 }, () => new Array(5).fill(0));
	const rhs = new Array(5).fill(0);
	for (const [px, py] of points) {
		const x = (px - mx) / s;
		const y = (py - my) / s;
		const row = [x * x, x * y, y * y, x, y];
		for (let i = 0; i < 5; i++) {
			rhs[i] += row[i];
			for (let j = 0; j < 5; j++) N[i][j] += row[i] * row[j];
		}
	}
	const [a, b, c, d, e] = solve(N, rhs);
	const det = 4 * a * c - b * b;
	const x0 = (b * e - 2 * c * d) / det;
	const y0 = (b * d - 2 * a * e) / det;
	const k = 1 + a * x0 * x0 + b * x0 * y0 + c * y0 * y0;
	const root = Math.hypot(a - c, b);
	const major = Math.sqrt((2 * k) / (a + c - root));
	const minor = Math.sqrt((2 * k) / (a + c + root));
	let angle = (0.5 * Math.atan2(b, a - c) * 180) / Math.PI + 90;
	if (angle > 90) angle -= 180;
	const out = { x: mx + x0 * s, y: my + y0 * s, rx: major * s, ry: minor * s, angle };
	const t = (out.angle * Math.PI) / 180;
	let err = 0;
	for (const [px, py] of points) {
		const u = ((px - out.x) * Math.cos(t) + (py - out.y) * Math.sin(t)) / out.rx;
		const v = (-(px - out.x) * Math.sin(t) + (py - out.y) * Math.cos(t)) / out.ry;
		err += ((Math.hypot(u, v) - 1) * Math.sqrt(out.rx * out.ry)) ** 2;
	}
	return { ...out, rms: Math.sqrt(err / points.length) };
}

/** Bilinear read of one plane. Outside the image reads as 0. */
export function sample(plane, w, h, x, y) {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) return 0;
	const fx = x - x0;
	const fy = y - y0;
	const i = y0 * w + x0;
	return (
		plane[i] * (1 - fx) * (1 - fy) +
		plane[i + 1] * fx * (1 - fy) +
		plane[i + w] * (1 - fx) * fy +
		plane[i + w + 1] * fx * fy
	);
}

/**
 * The edge of a disc, found along rays from a centre. Returns `[x, y]`.
 *
 * With `level`, the edge is where the plane first rises past that value
 * walking inward from `rMax` to `rMin`, so a glow outside it has to stay
 * under `level`. Without, it is where the plane falls fastest going outward,
 * which is the choice for a disc that sits in its own glow.
 */
export function rimPoints(plane, w, h, { x, y, rMin, rMax, level, from = 0, to = 360, step = 1 }) {
	const points = [];
	const d = 0.25;
	for (let deg = from; deg < to; deg += step) {
		const ca = Math.cos((deg * Math.PI) / 180);
		const sa = Math.sin((deg * Math.PI) / 180);
		const at = (r) => sample(plane, w, h, x + ca * r, y + sa * r);
		if (level !== undefined) {
			let prev = at(rMax);
			for (let r = rMax - d; r >= rMin; r -= d) {
				const v = at(r);
				if (prev <= level && v > level) {
					const rr = r + d * (1 - (level - prev) / (v - prev));
					points.push([x + ca * rr, y + sa * rr]);
					break;
				}
				prev = v;
			}
			continue;
		}
		// Steepest fall over a 2 px baseline, refined with a parabola through its neighbours.
		const fall = (r) => at(r - 1) - at(r + 1);
		let best = rMin;
		let most = 0;
		for (let r = rMin; r <= rMax; r += d) {
			const f = fall(r);
			if (f > most) {
				most = f;
				best = r;
			}
		}
		if (most <= 0) continue;
		const a = fall(best - d);
		const b = fall(best + d);
		const bend = a - 2 * most + b;
		const rr = best + (bend < 0 ? clamp((0.5 * (a - b)) / bend, -1, 1) * d : 0);
		points.push([x + ca * rr, y + sa * rr]);
	}
	return points;
}

/** Fit a circle to a rim, re-centring on each pass and dropping stray points. */
export function fitRim(plane, w, h, seed, opts = {}) {
	let c = { ...seed };
	for (let pass = 0; pass < 6; pass++) {
		const span = opts.span ?? 0.2;
		const pts = rimPoints(plane, w, h, {
			...opts,
			x: c.x,
			y: c.y,
			rMin: c.r * (1 - span),
			rMax: c.r * (1 + span),
		});
		let fit = fitCircle(pts);
		const tol = Math.max(opts.tolerance ?? 1.5, 2 * fit.rms);
		fit = fitCircle(
			pts.filter(([px, py]) => Math.abs(Math.hypot(px - fit.x, py - fit.y) - fit.r) <= tol),
		);
		c = fit;
	}
	return c;
}

// ───────────────────────────────────────────────────────── resampling ──

const lanczos3 = (t) => {
	const a = Math.abs(t);
	if (a < 1e-7) return 1;
	if (a >= 3) return 0;
	const p = Math.PI * a;
	return (3 * Math.sin(p) * Math.sin(p / 3)) / (p * p);
};

/**
 * Resample an image through an affine map with a Lanczos-3 kernel. `m` is
 * `[[a, b, tx], [c, d, ty]]` and takes OUTPUT pixel centres to SOURCE pixel
 * centres. Meant for near 1:1 maps (registration), not for shrinking.
 */
export function warp(img, outW, outH, m) {
	const out = {
		w: outW,
		h: outH,
		r: new Float32Array(outW * outH),
		g: new Float32Array(outW * outH),
		b: new Float32Array(outW * outH),
	};
	const wx = new Float64Array(6);
	const wy = new Float64Array(6);
	for (let oy = 0; oy < outH; oy++) {
		for (let ox = 0; ox < outW; ox++) {
			const sx = m[0][0] * ox + m[0][1] * oy + m[0][2];
			const sy = m[1][0] * ox + m[1][1] * oy + m[1][2];
			const x0 = Math.floor(sx) - 2;
			const y0 = Math.floor(sy) - 2;
			let sumX = 0;
			let sumY = 0;
			for (let i = 0; i < 6; i++) {
				wx[i] = lanczos3(sx - (x0 + i));
				wy[i] = lanczos3(sy - (y0 + i));
				sumX += wx[i];
				sumY += wy[i];
			}
			let r = 0;
			let g = 0;
			let b = 0;
			for (let j = 0; j < 6; j++) {
				const yy = clamp(y0 + j, 0, img.h - 1);
				for (let i = 0; i < 6; i++) {
					const k = (wx[i] * wy[j]) / (sumX * sumY);
					const p = yy * img.w + clamp(x0 + i, 0, img.w - 1);
					r += img.r[p] * k;
					g += img.g[p] * k;
					b += img.b[p] * k;
				}
			}
			const o = oy * outW + ox;
			out.r[o] = clamp(r, 0, 255);
			out.g[o] = clamp(g, 0, 255);
			out.b[o] = clamp(b, 0, 255);
		}
	}
	return out;
}

// ───────────────────────────────────────────────────────────── keying ──

/**
 * Fade a picture on black to pure black away from its content, so the frame
 * can never show as a faint box on a #000 page. `content` marks what is kept;
 * it is kept whole out to `keep` pixels and gone `feather` pixels later.
 */
export function fadeToBlack(img, content, keep, feather) {
	const d = distance(content, img.w, img.h);
	for (let i = 0; i < d.length; i++) {
		const k = 1 - smoothstep(keep, keep + feather, d[i]);
		img.r[i] *= k;
		img.g[i] *= k;
		img.b[i] *= k;
	}
	return img;
}

/**
 * Give every fully transparent pixel the colour of the nearest visible one
 * (smoothed, away from the edge, so it costs nothing to store). A renderer
 * that filters or mip-maps straight (non-premultiplied) alpha then blends
 * towards the right colour instead of towards black, at any size.
 */
export function bleed(img, visible = 1 / 255) {
	const { w, h } = img;
	const n = w * h;
	const seen = new Float32Array(n);
	for (let i = 0; i < n; i++) seen[i] = img.a[i] >= visible ? 1 : 0;
	const { dist, index } = distance(seen, w, h, { nearest: true });
	for (const k of ['r', 'g', 'b']) {
		for (let i = 0; i < n; i++) if (!seen[i]) img[k][i] = img[k][index[i]];
		const smooth = gauss(img[k], w, h, 10);
		for (let i = 0; i < n; i++) {
			if (!seen[i]) img[k][i] += (smooth[i] - img[k][i]) * smoothstep(4, 16, dist[i]);
		}
	}
	for (let i = 0; i < n; i++) if (!seen[i]) img.a[i] = 0;
	return img;
}

/**
 * How solid a body on black is at each pixel of its outline.
 *
 * `fat` is the body out to the foot of its edge. Within `band` pixels of that
 * outline the alpha is the pixel's `level` (its red, for brass) against the
 * brightest level close by, so a soft edge stays as soft as it was drawn.
 * It only ever rises going inward: behind a pixel that is covered, a dark
 * groove or crack is covered too. Deeper than the band the body is solid.
 */
export function solidAlpha(level, fat, w, h, { reach = 6, band = 8, against = 0.9 } = {}) {
	const local = maxFilter(level, w, h, reach);
	const depth = signedDistance(fat, w, h);
	const alpha = new Float32Array(w * h);
	const rim = [];
	for (let i = 0; i < w * h; i++) {
		if (!fat[i]) continue;
		if (depth[i] > band) alpha[i] = 1;
		else {
			alpha[i] = clamp(level[i] / (against * local[i] + 1e-6));
			rim.push(i);
		}
	}
	rim.sort((a, b) => depth[a] - depth[b]);
	for (const i of rim) {
		const x = i % w;
		const y = (i - x) / w;
		let a = alpha[i];
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const xx = x + dx;
				const yy = y + dy;
				if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
				const q = yy * w + xx;
				if (fat[q] && depth[q] < depth[i] - 1e-3 && alpha[q] > a) a = alpha[q];
			}
		}
		alpha[i] = a;
	}
	return alpha;
}

/**
 * Faint light has a noisy hue, which is invisible but expensive to store.
 * Where a straight-alpha picture is fainter than `below`, give it the hue of
 * the light around it (an alpha-weighted blur); alpha itself is untouched.
 */
export function calmFaint(img, { below = 0.12, sigma = 2 } = {}) {
	const n = img.w * img.h;
	const weight = gauss(img.a, img.w, img.h, sigma);
	for (const k of ['r', 'g', 'b']) {
		const pre = new Float32Array(n);
		for (let i = 0; i < n; i++) pre[i] = img[k][i] * img.a[i];
		const blurred = gauss(pre, img.w, img.h, sigma);
		for (let i = 0; i < n; i++) {
			if (img.a[i] <= 0 || img.a[i] >= below || weight[i] <= 1e-5) continue;
			const t = 1 - smoothstep(below / 2, below, img.a[i]);
			img[k][i] += (Math.min(255, blurred[i] / weight[i]) - img[k][i]) * t;
		}
	}
	return img;
}

/**
 * Key a picture on black: a solid body, and the light around it. Returns
 * planes with a straight (not premultiplied) alpha in `a`.
 *
 * A pixel photographed on black is its colour times how much of it is
 * there. Store that amount as alpha and the colour divided by it, and the
 * pixel reads exactly as before over black and without a dark fringe over
 * anything else.
 *
 * `body` is the body's alpha (0..1), or null when the picture is all light.
 * Body pixels keep their colour; where the body is under 60% there, the
 * colour comes from the nearest pixel that is, because dividing by a small
 * alpha would only amplify noise. Whatever the body does not account for is
 * light: its alpha is its brightest channel (less `floor`, the background's
 * own level, and times `gate` where one is given) and its colour is its hue
 * at full strength. `soften` blurs the light by that many pixels, for a glow
 * with no detail to lose; `calm` and `calmSigma` are passed to `calmFaint`.
 */
export function key(
	img,
	body,
	{ floor = 0, gate = null, calm = 0.12, calmSigma = 2, soften = 0 } = {},
) {
	const { w, h } = img;
	const n = w * h;
	const out = {
		w,
		h,
		r: new Float32Array(n),
		g: new Float32Array(n),
		b: new Float32Array(n),
		a: new Float32Array(n),
	};
	// The body layer, unpremultiplied.
	const br = new Float32Array(n);
	const bg = new Float32Array(n);
	const bb = new Float32Array(n);
	if (body) {
		const firm = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			if (body[i] < 0.6) continue;
			firm[i] = 1;
			br[i] = Math.min(255, img.r[i] / body[i]);
			bg[i] = Math.min(255, img.g[i] / body[i]);
			bb[i] = Math.min(255, img.b[i] / body[i]);
		}
		const { index } = distance(firm, w, h, { nearest: true });
		for (let i = 0; i < n; i++) {
			if (firm[i] || body[i] <= 0) continue;
			br[i] = br[index[i]];
			bg[i] = bg[index[i]];
			bb[i] = bb[index[i]];
		}
	}
	// The light: what is left of the picture once the body is taken out.
	const lr = new Float32Array(n);
	const lg = new Float32Array(n);
	const lb = new Float32Array(n);
	const la = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		const ba = body ? body[i] : 0;
		if (ba > 0.98) continue;
		const r = Math.max(0, img.r[i] - ba * br[i]) / (1 - ba);
		const g = Math.max(0, img.g[i] - ba * bg[i]) / (1 - ba);
		const b = Math.max(0, img.b[i] - ba * bb[i]) / (1 - ba);
		const m = Math.max(r, g, b);
		const a = clamp((m - floor) / (255 - floor)) * (gate ? gate[i] : 1);
		if (a <= 0) continue;
		la[i] = a;
		lr[i] = Math.min(255, (r * 255) / m);
		lg[i] = Math.min(255, (g * 255) / m);
		lb[i] = Math.min(255, (b * 255) / m);
	}
	// A glow has no detail of its own, only the noise of the file it came
	// from; `soften` takes that out. The blur is weighted by where there is
	// light to speak of at all, so it does not dim next to the body.
	let light = { w, h, r: lr, g: lg, b: lb, a: la };
	if (soften > 0) {
		const open = new Float32Array(n);
		for (let i = 0; i < n; i++) open[i] = body && body[i] > 0.98 ? 0 : 1;
		const reach = gauss(open, w, h, soften);
		const sum = gauss(la, w, h, soften);
		const pre = [lr, lg, lb].map((p) => {
			const m = new Float32Array(n);
			for (let i = 0; i < n; i++) m[i] = p[i] * la[i];
			return gauss(m, w, h, soften);
		});
		const a = new Float32Array(n);
		for (let i = 0; i < n; i++) {
			if (!open[i] || sum[i] <= 1e-5) continue;
			a[i] = clamp(sum[i] / reach[i]);
			lr[i] = Math.min(255, pre[0][i] / sum[i]);
			lg[i] = Math.min(255, pre[1][i] / sum[i]);
			lb[i] = Math.min(255, pre[2][i] / sum[i]);
		}
		light = { w, h, r: lr, g: lg, b: lb, a };
	}
	if (calm > 0) calmFaint(light, { below: calm, sigma: calmSigma });
	// Body over light.
	for (let i = 0; i < n; i++) {
		const ba = body ? body[i] : 0;
		const ua = light.a[i] * (1 - ba);
		const a = ba + ua;
		out.a[i] = a;
		if (a <= 0) continue;
		out.r[i] = (br[i] * ba + lr[i] * ua) / a;
		out.g[i] = (bg[i] * ba + lg[i] * ua) / a;
		out.b[i] = (bb[i] * ba + lb[i] * ua) / a;
	}
	return out;
}
