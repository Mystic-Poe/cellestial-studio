// The Roots' soil, woven: a tile of E1 that repeats down the page without a
// mirror in it.
//
//   node scripts/build-assets.mjs modules
//
// build-assets.mjs makes soil-landscape and soil-portrait by stacking the
// picture on its own vertical flip. That tile has no seam, but it has an axis:
// whatever lies near the mirror line is doubled into a symmetric figure, and
// lit by the mycelium the eye finds it at once. This module derives a second
// pair from the same two pack pictures, with no axis:
//
//   1. the same sideways crop, and more rows than the mirrored tile could use
//      (the pack's soil darkens towards the bottom; here that is levelled:
//      every row is brought to the level of the whole, measured over a wide
//      window, so the top of the tile can follow its bottom without a band);
//   2. the picture, then the same picture flipped left to right, one under
//      the other: the second pass of the same ground does not read as a
//      repeat, and nothing is symmetric about any line;
//   3. where one runs into the next (and the last into the first, when the
//      tile repeats) they are dissolved into each other over OVERLAP rows,
//      keeping the grain's contrast (a plain cross-fade would blur it).
//
// Nothing is generated: every pixel is the pack's soil, cropped, levelled,
// flipped and dissolved. Writes public/cellestial/roots/soil-landscape-woven
// and soil-portrait-woven (.avif and .webp), and prints their sizes. Run
// again it writes the same files.

const SOURCES = [
	{
		name: 'soil-landscape-woven',
		file: 'e-roots/E1_soil_landscape-16x9.jpg',
		crop: { left: 154, top: 60, width: 2268, height: 1318 },
		width: 1920,
		overlap: 150,
	},
	{
		name: 'soil-portrait-woven',
		file: 'e-roots/E1_soil_portrait-9x16.jpg',
		crop: { left: 43, top: 120, width: 1352, height: 1900 },
		width: 1080,
		overlap: 150,
	},
];

export default async function roots({ sharp, src, out }) {
	for (const s of SOURCES) {
		const { data, info } = await sharp(src(s.file))
			.extract(s.crop)
			.resize({ width: s.width, kernel: 'mitchell' })
			.removeAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const { width: w, height: h, channels: ch } = info;

		// 1. Level the rows: each row's brightness against a wide running mean.
		const row = new Float64Array(h);
		let all = 0;
		for (let y = 0; y < h; y++) {
			let sum = 0;
			for (let i = y * w * ch, e = i + w * ch; i < e; i++) sum += data[i];
			row[y] = sum / (w * ch);
			all += row[y];
		}
		all /= h;
		const win = Math.round(h * 0.12);
		const level = new Float64Array(h);
		for (let y = 0; y < h; y++) {
			let sum = 0;
			let n = 0;
			for (let k = Math.max(0, y - win); k <= Math.min(h - 1, y + win); k++) {
				sum += row[k];
				n++;
			}
			level[y] = all / (sum / n);
		}
		const A = new Float32Array(w * h * ch);
		const mean = new Float64Array(ch);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				for (let c = 0; c < ch; c++) {
					const i = (y * w + x) * ch + c;
					A[i] = data[i] * level[y];
					mean[c] += A[i];
				}
			}
		}
		for (let c = 0; c < ch; c++) mean[c] /= w * h;

		// 2 and 3. The picture, then itself flipped left to right, each dissolved into the next.
		const B = s.overlap;
		const part = h - B;
		const H = part * 2;
		const tile = Buffer.alloc(w * H * ch);
		const at = (flip, x, y, c) => A[(y * w + (flip ? w - 1 - x : x)) * ch + c];
		for (let p = 0; p < 2; p++) {
			for (let y = 0; y < part; y++) {
				// The first B rows of a part are still the end of the part before it.
				const t = y < B ? (y + 0.5) / B : 1;
				const ca = Math.sin((t * Math.PI) / 2);
				const cb = Math.cos((t * Math.PI) / 2);
				for (let x = 0; x < w; x++) {
					for (let c = 0; c < ch; c++) {
						let v = at(p === 1, x, y, c);
						if (y < B) {
							const before = at(p === 0, x, part + y, c);
							v = mean[c] + (v - mean[c]) * ca + (before - mean[c]) * cb;
						}
						tile[((p * part + y) * w + x) * ch + c] = Math.max(0, Math.min(255, Math.round(v)));
					}
				}
			}
		}
		const image = () => sharp(tile, { raw: { width: w, height: H, channels: ch } });
		const webp = await image()
			.webp({ effort: 6, smartSubsample: true, quality: 42, smartDeblock: true })
			.toFile(out(`roots/${s.name}.webp`));
		const avif = await image()
			.avif({ quality: 36, effort: 7, chromaSubsampling: '4:2:0' })
			.toFile(out(`roots/${s.name}.avif`));
		console.log(
			`  ${s.name}: ${w}x${H} (two passes of ${part} rows, ${B} dissolved), mean ${[...mean].map((v) => v.toFixed(1)).join(' ')}; avif ${Math.round(avif.size / 1024)} kB, webp ${Math.round(webp.size / 1024)} kB`,
		);
	}
}
