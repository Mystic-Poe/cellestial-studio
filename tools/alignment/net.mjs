// Shared exploratory helpers: thinning, shortest-path tree, chains.
export function thin(mask, w, h) {
	// Zhang–Suen. mask: Uint8Array 0/1. Returns a new Uint8Array.
	const m = Uint8Array.from(mask);
	const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
	let changed = true;
	const kill = [];
	while (changed) {
		changed = false;
		for (let pass = 0; pass < 2; pass++) {
			kill.length = 0;
			for (let y = 1; y < h - 1; y++) {
				for (let x = 1; x < w - 1; x++) {
					if (!m[y * w + x]) continue;
					const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
					const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
					const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
					if (b < 2 || b > 6) continue;
					const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
					let a = 0;
					for (let i = 0; i < 8; i++) if (!seq[i] && seq[i + 1]) a++;
					if (a !== 1) continue;
					if (pass === 0) {
						if (p2 * p4 * p6) continue;
						if (p4 * p6 * p8) continue;
					} else {
						if (p2 * p4 * p8) continue;
						if (p2 * p6 * p8) continue;
					}
					kill.push(y * w + x);
				}
			}
			if (kill.length) changed = true;
			for (const i of kill) m[i] = 0;
		}
	}
	return m;
}

class Heap {
	constructor() { this.k = []; this.v = []; }
	get size() { return this.k.length; }
	push(key, val) {
		const k = this.k, v = this.v;
		let i = k.length; k.push(key); v.push(val);
		while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
		k[i] = key; v[i] = val;
	}
	pop() {
		const k = this.k, v = this.v; const topK = k[0], topV = v[0];
		const lastK = k.pop(), lastV = v.pop(); const n = k.length;
		if (n) {
			let i = 0;
			for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lastK) break; k[i] = k[c]; v[i] = v[c]; i = c; }
			k[i] = lastK; v[i] = lastV;
		}
		return [topK, topV];
	}
}

/**
 * Shortest-path tree over skeleton pixels from `root` (pixel index). Unreached
 * components are joined across the nearest gap. Returns { dist, parent, jump }.
 */
export function flood(skel, w, h, roots) {
	const n = w * h;
	const dist = new Float32Array(n).fill(Infinity);
	const parent = new Int32Array(n).fill(-1);
	const jump = new Float32Array(n); // gap length when this pixel was reached by a jump
	const heap = new Heap();
	for (const r of roots) { dist[r] = 0; heap.push(0, r); }
	const total = skel.reduce((a, b) => a + b, 0);
	let reached = 0;
	const done = new Uint8Array(n);
	const run = () => {
		while (heap.size) {
			const [d, p] = heap.pop();
			if (done[p]) continue;
			done[p] = 1; reached++;
			const x = p % w, y = (p - x) / w;
			for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
				if (!dx && !dy) continue;
				const xx = x + dx, yy = y + dy;
				if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
				const q = yy * w + xx;
				if (!skel[q] || done[q]) continue;
				const nd = d + (dx && dy ? Math.SQRT2 : 1);
				if (nd < dist[q]) { dist[q] = nd; parent[q] = p; heap.push(nd, q); }
			}
		}
	};
	run();
	while (reached < total) {
		// nearest (reached, unreached) pair
		let best = Infinity, bp = -1, bq = -1;
		const reachedList = [], unreachedList = [];
		for (let i = 0; i < n; i++) if (skel[i]) (done[i] ? reachedList : unreachedList).push(i);
		for (const q of unreachedList) {
			const qx = q % w, qy = (q - qx) / w;
			for (const p of reachedList) {
				const px = p % w, py = (p - px) / w;
				const dd = (px - qx) * (px - qx) + (py - qy) * (py - qy);
				if (dd < best) { best = dd; bp = p; bq = q; }
			}
		}
		const gap = Math.sqrt(best);
		dist[bq] = dist[bp] + gap; parent[bq] = bp; jump[bq] = gap;
		heap.push(dist[bq], bq);
		run();
	}
	return { dist, parent, jump };
}

/** Chains of the tree: arrays of pixel indices from a branch point (or root) outward. */
export function chains(skel, w, h, tree, { maxBridge = 8, minSpur = 6 } = {}) {
	const { dist, parent, jump } = tree;
	const n = w * h;
	const kids = new Map();
	for (let i = 0; i < n; i++) {
		if (!skel[i] || parent[i] < 0) continue;
		const p = parent[i];
		if (!kids.has(p)) kids.set(p, []);
		kids.get(p).push(i);
	}
	const out = [];
	const walk = (start, from) => {
		// start: first pixel of the chain; from: the pixel it hangs off (or -1)
		const stack = [[start, from]];
		while (stack.length) {
			let [p, f] = stack.pop();
			const pts = [];
			if (f >= 0 && !(jump[p] > maxBridge)) pts.push(f);
			for (;;) {
				pts.push(p);
				const k = kids.get(p) || [];
				if (k.length === 1 && !(jump[k[0]] > maxBridge)) { p = k[0]; continue; }
				for (const c of k) stack.push([c, p]);
				break;
			}
			out.push(pts);
		}
	};
	for (let i = 0; i < n; i++) if (skel[i] && parent[i] < 0) walk(i, -1);
	// prune short leaf spurs
	const hasKids = (p) => (kids.get(p) || []).length > 0;
	return out.filter((c) => {
		const last = c[c.length - 1];
		if (hasKids(last)) return true;
		let len = 0;
		for (let i = 1; i < c.length; i++) len += Math.hypot((c[i] % w) - (c[i - 1] % w), Math.floor(c[i] / w) - Math.floor(c[i - 1] / w));
		return len >= minSpur || c.length === 1;
	});
}

/** Ramer–Douglas–Peucker on [x, y, d] points; keeps endpoints. */
export function simplify(pts, eps) {
	if (pts.length <= 2) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		const [ax, ay] = pts[a], [bx, by] = pts[b];
		const dx = bx - ax, dy = by - ay; const len = Math.hypot(dx, dy) || 1;
		let worst = 0, wi = -1;
		for (let i = a + 1; i < b; i++) {
			const e = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
			if (e > worst) { worst = e; wi = i; }
		}
		if (worst > eps) { keep[wi] = 1; stack.push([a, wi], [wi, b]); }
	}
	return pts.filter((_, i) => keep[i]);
}
