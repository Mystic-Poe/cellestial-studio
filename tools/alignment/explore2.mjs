import { createRequire } from 'node:module';
import { thin, flood, chains, simplify } from './net.mjs';
const require = createRequire('/home/poe/cellestial-wt/loader/package.json');
const sharp = require('sharp');
const px = await import('/home/poe/cellestial-wt/loader/scripts/assets/lib/px.mjs');
const W = '/home/poe/cellestial-wt/loader/public/cellestial/loader/';
const O = '/tmp/claude-1000/-home-poe-Work/997ecee9-30a3-4fc9-8f3c-6efca36572a4/scratchpad/loader/look/';
const lit = await px.load(sharp, W + 'c-lit.webp');
const unlit = await px.load(sharp, W + 'c-unlit.webp');
const { w, h } = lit; const n = w * h;
const diff = new Float32Array(n);
for (let i = 0; i < n; i++) diff[i] = Math.max(0, (lit.b[i] - unlit.b[i]) - (lit.r[i] - unlit.r[i]));
const sm = px.gauss(diff, w, h, 1.2);
const LEVEL = Number(process.argv[2] || 38);
let mask = new Float32Array(n);
for (let i = 0; i < n; i++) mask[i] = sm[i] > LEVEL ? 1 : 0;
mask = px.keepRegions(mask, w, h, (r) => r.n >= 40);
const { regions } = px.label(mask, w, h);
console.log('regions', regions.length, regions.map((r) => `${r.n}@${Math.round(r.cx)},${Math.round(r.cy)}`).join(' '));
const skel = thin(Uint8Array.from(mask), w, h);
console.log('skeleton px', skel.reduce((a, b) => a + b, 0));
// root: skeleton pixel nearest the node core
const core = { x: 1086.8 - 0.5, y: 1086.2 - 0.5 };
let root = -1, best = Infinity;
for (let i = 0; i < n; i++) if (skel[i]) { const x = i % w, y = (i - x) / w; const d = Math.hypot(x - core.x, y - core.y); if (d < best) { best = d; root = i; } }
console.log('root', root % w, Math.floor(root / w), 'dist to core', best.toFixed(1));
const tree = flood(skel, w, h, [root]);
let maxD = 0; for (let i = 0; i < n; i++) if (skel[i] && tree.dist[i] > maxD) maxD = tree.dist[i];
console.log('max dist', maxD.toFixed(0));
const jumps = []; for (let i = 0; i < n; i++) if (tree.jump[i] > 0) jumps.push(`${tree.jump[i].toFixed(1)}@${i % w},${Math.floor(i / w)}`);
console.log('jumps', jumps.join(' '));
const ch = chains(skel, w, h, tree);
const polys = ch.map((c) => simplify(c.map((p) => [p % w, Math.floor(p / w), tree.dist[p]]), 0.7));
console.log('chains', polys.length, 'points', polys.reduce((a, p) => a + p.length, 0));
// landmark distances: nearest skeleton px to given points
const marks = { bottom: [700, 1215], lowerLeft: [385, 1060], left: [258, 688], innerLower: [600, 965], innerUpper: [590, 420], upperLeft: [390, 300], top: [790, 175], tip: [1120, 325], rimExit: [985, 1085] };
for (const [name, [mx, my]] of Object.entries(marks)) {
	let b = Infinity, bi = -1;
	for (let i = 0; i < n; i++) if (skel[i]) { const x = i % w, y = (i - x) / w; const d = Math.hypot(x - mx, y - my); if (d < b) { b = d; bi = i; } }
	console.log(name, 'd=', tree.dist[bi].toFixed(0), 'at', bi % w, Math.floor(bi / w), 'off', b.toFixed(0));
}
// overlay: draw polylines coloured by distance over dimmed lit image
const svgParts = [];
for (const p of polys) {
	for (let i = 1; i < p.length; i++) {
		const d = (p[i][2] + p[i - 1][2]) / 2 / maxD;
		const hue = Math.round(300 * d);
		svgParts.push(`<line x1="${p[i - 1][0] + 0.5}" y1="${p[i - 1][1] + 0.5}" x2="${p[i][0] + 0.5}" y2="${p[i][1] + 0.5}" stroke="hsl(${hue} 100% 55%)" stroke-width="3" stroke-linecap="round"/>`);
	}
	svgParts.push(`<circle cx="${p[0][0] + 0.5}" cy="${p[0][1] + 0.5}" r="4" fill="none" stroke="white" stroke-width="1"/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svgParts.join('')}</svg>`;
await sharp(W + 'c-lit.webp').modulate({ brightness: 0.5 }).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 88 }).toFile(O + 'c_net.jpg');
const buf = Buffer.alloc(n); for (let i = 0; i < n; i++) buf[i] = mask[i] ? (skel[i] ? 255 : 90) : 0;
await sharp(buf, { raw: { width: w, height: h, channels: 1 } }).extract({ left: 880, top: 900, width: 400, height: 400 }).resize(1200, 1200, { kernel: 'nearest' }).png().toFile(O + 'c_skel_node.png');
