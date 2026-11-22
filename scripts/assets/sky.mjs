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
//   2. they are brought to the size they will be seen at. A star at its
//      station is 36 to 58 screen pixels across (the phone's two pixels to
//      the point counted), so a screen pixel is 8 to 13 pixels of this
//      frame, and the pack's traces run in bundles of four to eight, 7
//      pixels apart: two to a screen pixel. Thickened one by one, as this
//      module first did, a bundle closed up into a solid band and the star
//      read as marble, not circuit. So the traces are not thickened: they
//      are filtered to the band a star of that size can show (a blur of
//      FINE less a blur of WIDE, a difference of Gaussians). A lone trace
//      comes out a stroke about a screen pixel wide; a tight bundle comes
//      out as the strokes at its edges with the dark kept between them;
//   3. the sphere is lifted as the sky lifts it (the pack's own is nearly
//      black), the render's bright grey limb is held back so that the rim is
//      left to the thin blue halo the sky draws, and the strokes are laid
//      over it in the brass of the wordmark's lit faces (the pack's own
//      traces are a pale gold too dark to carry at this size).
//
// Nothing is generated: every stroke is where the pack's picture has a trace
// or a bundle of them; but a bundle is not drawn trace by trace.
// Writes public/cellestial/sky/b4-station.webp (256 px, keyed like
// b4-empty) and prints what it measured. Run again it writes the same file.

/** The frame of b4-empty.webp (src/experience/assets.ts, `b4Empty`). */
const FRAME = { size: 512, x: 256.1, y: 256.1, r: 236 };
/**
 * The band the traces are filtered to, as two blurs (sigma, pixels of that
 * frame): detail finer than FINE is gathered into a stroke, and what is even
 * over WIDE (the inside of a bundle) is taken away, so that strokes stay
 * apart. A screen pixel of a 46 px star is 10 pixels of the frame.
 */
const FINE = 4;
const WIDE = 11;
/** The filtered level at which a stroke is fully on. */
const LEVEL = 0.1;
/** How strongly a stroke is laid on. */
const GAIN = 0.9;
/** How much the sphere is lifted (the sky's LOOK.body did this in the shader). */
const LIFT = 1.7;
/** What a stroke is drawn in: the wordmark's lit brass, #d5ae88 (--color-brass-hi). */
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

	// 2. To the band a star at its station can show: strokes, and the dark between them.
	const gathered = px.gauss(trace, w, h, FINE);
	const even = px.gauss(trace, w, h, WIDE);
	const fat = new Float32Array(n);
	for (let i = 0; i < n; i++) fat[i] = px.clamp((gathered[i] - even[i]) / LEVEL);

	// 3. The lifted sphere, its limb held back, the strokes over it.
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
		`  sky/b4-station.webp ${info2.width}x${info2.height}, ${info2.size} bytes; strokes cover ${((100 * covered) / inside).toFixed(1)}% of the disc; brass ${brass.map((v) => Math.round(v)).join(', ')}`,
	);
}
