// The honeycomb (B2) as a real graph: vertices, edges and paths. Pure data,
// no rendering. One plane of it lies under every constellation layer, and
// every plane is the same graph, so vertex i of one layer stands exactly
// behind vertex i of the next: the struts that tie the planes together run
// between those pairs.
//
// The hexagons stand on a point (a vertex straight above each centre), and
// one cell is centred on the flight axis.

const SQRT3 = Math.sqrt(3);

export interface LatticePath {
	/** The vertices passed, the first and the last included. */
	readonly vertices: number[];
	/** The edges walked: `edges[i]` joins `vertices[i]` and `vertices[i + 1]`. */
	readonly edges: number[];
}

export interface Honeycomb {
	/** Edge length, world units. */
	readonly edge: number;
	readonly vertexCount: number;
	readonly edgeCount: number;
	/** `x, y` of every vertex, in the plane of its layer. */
	readonly vertices: Float32Array;
	/** Two vertex indices per edge. */
	readonly edges: Uint16Array;
	/** Six numbers per vertex: `neighbour, edge` three times over, -1 where there is none. */
	readonly neighbours: Int32Array;
	/** The vertices that carry a strut to the same vertex of the next layer. */
	readonly struts: Uint16Array;
	/** For each vertex, its index into `struts`, or -1. */
	readonly strutOf: Int32Array;
	/** `x, y` of every cell centre. */
	readonly cells: Float32Array;
	/** The vertex nearest a point of the plane. */
	nearestVertex(x: number, y: number): number;
	/** The edge joining two vertices, or -1. */
	edgeBetween(a: number, b: number): number;
	/** A shortest walk along the edges. Null only if `to` cannot be reached. */
	path(from: number, to: number): LatticePath | null;
}

export interface HoneycombOptions {
	edge: number;
	/** Cells whose centre is within this distance of the axis. */
	radius: number;
	/** Squared distance from the axis, in edges, of the vertices that get a strut. */
	strutRings: readonly number[];
}

export function createHoneycomb({ edge: a, radius, strutRings }: HoneycombOptions): Honeycomb {
	const xs: number[] = [];
	const ys: number[] = [];
	const cells: number[] = [];
	const byKey = new Map<string, number>();
	const edgeKey = new Map<number, number>();
	const edges: number[] = [];

	const vertex = (x: number, y: number) => {
		const key = `${Math.round((x / a) * 1000)},${Math.round((y / a) * 1000)}`;
		let i = byKey.get(key);
		if (i === undefined) {
			i = xs.length;
			xs.push(x);
			ys.push(y);
			byKey.set(key, i);
		}
		return i;
	};

	const reach = Math.ceil(radius / (1.5 * a)) + 1;
	for (let j = -reach; j <= reach; j++) {
		for (let i = -2 * reach; i <= 2 * reach; i++) {
			const cx = SQRT3 * a * (i + j / 2);
			const cy = 1.5 * a * j;
			if (Math.hypot(cx, cy) > radius) continue;
			cells.push(cx, cy);
			const ring: number[] = [];
			for (let n = 0; n < 6; n++) {
				const t = Math.PI / 2 + (n * Math.PI) / 3;
				ring.push(vertex(cx + a * Math.cos(t), cy + a * Math.sin(t)));
			}
			for (let n = 0; n < 6; n++) {
				const p = ring[n] as number;
				const q = ring[(n + 1) % 6] as number;
				const key = Math.min(p, q) * 65536 + Math.max(p, q);
				if (edgeKey.has(key)) continue;
				edgeKey.set(key, edges.length / 2);
				edges.push(p, q);
			}
		}
	}

	const vertexCount = xs.length;
	const edgeCount = edges.length / 2;
	if (vertexCount > 65535) throw new Error('honeycomb: too many vertices for 16-bit indices');

	const vertices = new Float32Array(vertexCount * 2);
	for (let i = 0; i < vertexCount; i++) {
		vertices[i * 2] = xs[i] as number;
		vertices[i * 2 + 1] = ys[i] as number;
	}

	const neighbours = new Int32Array(vertexCount * 6).fill(-1);
	const link = (from: number, to: number, e: number) => {
		for (let s = 0; s < 3; s++) {
			if (neighbours[from * 6 + s * 2] === -1) {
				neighbours[from * 6 + s * 2] = to;
				neighbours[from * 6 + s * 2 + 1] = e;
				return;
			}
		}
	};
	for (let e = 0; e < edgeCount; e++) {
		const p = edges[e * 2] as number;
		const q = edges[e * 2 + 1] as number;
		link(p, q, e);
		link(q, p, e);
	}

	const rings = new Set(strutRings);
	const struts: number[] = [];
	const strutOf = new Int32Array(vertexCount).fill(-1);
	for (let i = 0; i < vertexCount; i++) {
		const d2 = ((xs[i] as number) ** 2 + (ys[i] as number) ** 2) / (a * a);
		const whole = Math.round(d2);
		if (Math.abs(d2 - whole) < 0.01 && rings.has(whole)) {
			strutOf[i] = struts.length;
			struts.push(i);
		}
	}

	const nearestVertex = (x: number, y: number) => {
		let best = 0;
		let bestD = Infinity;
		for (let i = 0; i < vertexCount; i++) {
			const dx = (vertices[i * 2] as number) - x;
			const dy = (vertices[i * 2 + 1] as number) - y;
			const d = dx * dx + dy * dy;
			if (d < bestD) {
				bestD = d;
				best = i;
			}
		}
		return best;
	};

	const edgeBetween = (p: number, q: number) => {
		for (let s = 0; s < 3; s++) {
			if (neighbours[p * 6 + s * 2] === q) return neighbours[p * 6 + s * 2 + 1] as number;
		}
		return -1;
	};

	// Every edge is one edge long, so a breadth-first flood from the goal
	// gives true distances. Walking back down them from the start, the tie
	// between equally short steps goes to the one that heads straightest for
	// the goal, which keeps a path from wandering.
	const hops = new Int32Array(vertexCount);
	const queue = new Int32Array(vertexCount);
	const path = (from: number, to: number): LatticePath | null => {
		if (from < 0 || to < 0 || from >= vertexCount || to >= vertexCount) return null;
		hops.fill(-1);
		hops[to] = 0;
		queue[0] = to;
		let head = 0;
		let tail = 1;
		while (head < tail && hops[from] === -1) {
			const v = queue[head++] as number;
			for (let s = 0; s < 3; s++) {
				const n = neighbours[v * 6 + s * 2] as number;
				if (n === -1 || hops[n] !== -1) continue;
				hops[n] = (hops[v] as number) + 1;
				queue[tail++] = n;
			}
		}
		if (hops[from] === -1) return null;
		const tx = vertices[to * 2] as number;
		const ty = vertices[to * 2 + 1] as number;
		const walked = [from];
		const used: number[] = [];
		let at = from;
		while (at !== to) {
			let next = -1;
			let nextEdge = -1;
			let nextD = Infinity;
			for (let s = 0; s < 3; s++) {
				const n = neighbours[at * 6 + s * 2] as number;
				if (n === -1 || hops[n] !== (hops[at] as number) - 1) continue;
				const d = Math.hypot(
					(vertices[n * 2] as number) - tx,
					(vertices[n * 2 + 1] as number) - ty,
				);
				if (d < nextD) {
					nextD = d;
					next = n;
					nextEdge = neighbours[at * 6 + s * 2 + 1] as number;
				}
			}
			if (next === -1) return null;
			walked.push(next);
			used.push(nextEdge);
			at = next;
		}
		return { vertices: walked, edges: used };
	};

	return {
		edge: a,
		vertexCount,
		edgeCount,
		vertices,
		edges: Uint16Array.from(edges),
		neighbours,
		struts: Uint16Array.from(struts),
		strutOf,
		cells: Float32Array.from(cells),
		nearestVertex,
		edgeBetween,
		path,
	};
}
