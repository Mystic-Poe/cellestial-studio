// B4 for a star at its station: the pack's empty star made to read at 40 px.
//
//   node scripts/build-assets.mjs modules
//
// The pack's B4 is a dark sphere with fine brass traces. The traces are a
// hair wide: at the size a star stands at its station (26 to 50 px across)
// they average away and what is left is a plain dark bead with the render's
// grey limb. This module derives a second, small picture from the same file,
// in the same frame as public/cellestial/sky/b4-empty.webp (so the sky lays
// one over the other and crossfades between them as a star comes near):
//
//   1. the traces are found: what is warm and brighter than the sphere
//      around it;
//   2. they are thickened (every trace to about 1.7% of the star's width,
//      so one is about a pixel wide on a 42 px star) and softened by a pixel;
//   3. the sphere is lifted as the sky lifts it (the pack's own is nearly
//      black), the render's bright grey limb is held back so that the rim is
//      left to the thin blue halo the sky draws, and the thickened traces
//      are laid over it in the brass of the wordmark's lit faces (the
//      pack's own traces are a pale gold too dark to carry at this size).
//
// Nothing is generated: every trace is where the pack's picture has one.
// Writes public/cellestial/sky/b4-station.webp (256 px, keyed like
// b4-empty) and prints what it measured. Run again it writes the same file.

/** The frame of b4-empty.webp (src/experience/assets.ts, `b4Empty`). */
const FRAME = { size: 512, x: 256.1, y: 256.1, r: 236 };
/** Half the width a trace is thickened to, in pixels of that frame. */
const THICKEN = 1;
/** How strongly a thickened trace is laid on. */
const GAIN = 0.85;
/** How much the sphere is lifted (the sky's LOOK.body did this in the shader). */
const LIFT = 1.7;
/** What a thickened trace is drawn in: the wordmark's lit brass, #d5ae88 (--color-brass-hi). */
const BRASS = [213, 174, 136];

export default async function sky({ sharp, out, px }) {
	const source = out('sky/b4-empty.webp');
	const { data, info } = await sharp(source)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width: w, height: h } = info;
	if (w !== FRAME.size || h !== FRAME.size) throw new Error('sky.mjs: b4-empty.webp is not 512 px');
	const n = w * h;
	const r = new Float32Array(n);
	const g = new Float32Array(n);
	const b = new Float32Array(n);
	const a = new Float32Array(n);
	const lum = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		r[i] = data[i * 4];
		g[i] = data[i * 4 + 1];
		b[i] = data[i * 4 + 2];
		a[i] = data[i * 4 + 3] / 255;
		lum[i] = Math.max(r[i], g[i], b[i]);
	}

	// 1. The traces: fine lines brighter than the sphere under them (what a
	// narrow blur takes away), against how bright the sphere is there; and not
	// blue, which is the render's sheen and not a trace.
	const fine = px.gauss(lum, w, h, 2.2);
	const around = px.gauss(lum, w, h, 7);
	const trace = new Float32Array(n);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			const d = Math.hypot(x + 0.5 - FRAME.x, y + 0.5 - FRAME.y) / FRAME.r;
			if (d > 0.955) continue; // the limb is the render's light, not a trace
			const over = px.clamp((lum[i] - fine[i] - 1.5) / (0.16 * around[i] + 3));
			const blue = px.clamp((b[i] - r[i] - 3) / 12);
			trace[i] = over * (1 - blue);
		}
	}
	// In the brass of the wordmark's lit faces (--color-brass-hi, sampled from the pack).
	const brass = BRASS;

	// 2. Thickened, and softened by a pixel.
	const fat = px.gauss(px.maxFilter(trace, w, h, THICKEN), w, h, 1.3);

	// 3. The lifted sphere, its limb held back, the traces over it.
	const rgba = Buffer.alloc(n * 4);
	let covered = 0;
	let inside = 0;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = y * w + x;
			const d = Math.hypot(x + 0.5 - FRAME.x, y + 0.5 - FRAME.y) / FRAME.r;
			// Fully lifted in the middle, not at all at the edge, where the grey limb is.
			const lift = LIFT - (LIFT - 0.55) * px.smoothstep(0.8, 0.98, d);
			const t = px.clamp(fat[i] * GAIN) * (1 - px.smoothstep(0.9, 0.99, d));
			if (d < 1) {
				inside++;
				if (t > 0.5) covered++;
			}
			const base = [r[i] * lift, g[i] * lift, b[i] * lift];
			for (let c = 0; c < 3; c++) {
				rgba[i * 4 + c] = Math.round(px.clamp(base[c] * (1 - t) + brass[c] * t, 0, 255));
			}
			rgba[i * 4 + 3] = Math.round(a[i] * 255);
		}
	}
	const file = out('sky/b4-station.webp');
	const info2 = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
		.resize({ width: 256, kernel: 'lanczos3' })
		.webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true })
		.toFile(file);
	console.log(
		`  sky/b4-station.webp ${info2.width}x${info2.height}, ${info2.size} bytes; traces cover ${((100 * covered) / inside).toFixed(1)}% of the disc; brass ${brass.map((v) => Math.round(v)).join(', ')}`,
	);
}
