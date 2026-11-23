#!/usr/bin/env node
// Round 3, the close-out: are the builders' own sheets what they were before the round? Every file of
// refs/<scene>/compare/ as it is on disk now (tools/run-all.sh has just rebuilt it) against the same file
// as it was committed at a commit (git show <commit>:<path>). For each: the same to the byte, or not; and
// if not, for a picture of the same size, how many pixels differ by more than a JPEG's own noise (any
// channel by more than 24 of 255), the box that holds them, and the boxes of their clusters (pixels joined
// when within 40 px), so that a difference can be named by where it is on the sheet. A crop of the first
// clusters, before above after, is written beside the report.
//   node sheets-same.mjs [--before 8724ef5] [--after <commit>] [--scenes sky,loading] [--out piece-4/sheets] [--tag name]
// --after takes "now" from a commit too and not from the disk: two commits of the SAME code set beside each
// other (two rebuilds by the same tool) are the control that shows which sheets differ from run to run by
// themselves (the recorded ones). --tag names the report (sheets-same-<tag>.txt) and its crops.
// --crops a,b,c keeps crops for those sheets only (names without their ending; "none" for no crops).
// Reads only; writes its report and crops under refs/verification/fifth-look/<out>/.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, outDir, sharp } from './lib.mjs';

const arg = (name, dflt) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : dflt;
};
const BEFORE = arg('before', '8724ef5');
const SCENES = arg('scenes', 'sky,loading').split(',');
const AFTER = arg('after', '');
const TAG = arg('tag', '');
const CROPS = arg('crops', '');
const cropped = (name) => CROPS === '' || CROPS.split(',').includes(name.replace(/\.\w+$/, ''));
const dir = outDir(arg('out', 'piece-4/sheets'));
const ls = (commit, rel) =>
	execFileSync('git', ['ls-tree', '--name-only', commit, `${rel}/`], { cwd: ROOT, encoding: 'utf8' })
		.split('\n')
		.filter(Boolean)
		.map((p) => p.slice(rel.length + 1));
const show = (commit, path) => execFileSync('git', ['show', `${commit}:${path}`], { cwd: ROOT, maxBuffer: 1 << 28 });
const NOISE = 24;
const JOIN = 40;
const sha = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 10);
const lines = [];
const say = (s) => {
	console.log(s);
	lines.push(s);
};

/** Boxes of the differing pixels, joined when nearer than JOIN px (a coarse grid, then a merge). */
function clusters(points) {
	const boxes = [];
	for (const [x, y] of points) {
		let hit = null;
		for (const b of boxes) {
			if (x >= b.x0 - JOIN && x <= b.x1 + JOIN && y >= b.y0 - JOIN && y <= b.y1 + JOIN) {
				hit = b;
				break;
			}
		}
		if (hit) {
			hit.x0 = Math.min(hit.x0, x);
			hit.x1 = Math.max(hit.x1, x);
			hit.y0 = Math.min(hit.y0, y);
			hit.y1 = Math.max(hit.y1, y);
			hit.n++;
		} else boxes.push({ x0: x, x1: x, y0: y, y1: y, n: 1 });
	}
	// merge boxes that came to touch
	let merged = true;
	while (merged) {
		merged = false;
		for (let i = 0; i < boxes.length && !merged; i++) {
			for (let j = i + 1; j < boxes.length && !merged; j++) {
				const a = boxes[i];
				const b = boxes[j];
				if (a.x0 - JOIN <= b.x1 && b.x0 - JOIN <= a.x1 && a.y0 - JOIN <= b.y1 && b.y0 - JOIN <= a.y1) {
					a.x0 = Math.min(a.x0, b.x0);
					a.x1 = Math.max(a.x1, b.x1);
					a.y0 = Math.min(a.y0, b.y0);
					a.y1 = Math.max(a.y1, b.y1);
					a.n += b.n;
					boxes.splice(j, 1);
					merged = true;
				}
			}
		}
	}
	return boxes.sort((a, b) => b.n - a.n);
}

say(`The builders' sheets ${AFTER ? `at commit ${AFTER}` : 'now (on disk)'} against commit ${BEFORE}. "Differs" counts pixels with a channel more than ${NOISE} of 255 apart.`);
let same = 0;
let differ = 0;
for (const scene of SCENES) {
	const rel = `refs/${scene}/compare`;
	say(`\n${rel}/`);
	const now = AFTER ? ls(AFTER, rel) : readdirSync(join(ROOT, rel)).sort();
	const then = ls(BEFORE, rel);
	for (const name of [...new Set([...now, ...then])].sort()) {
		if (!then.includes(name)) {
			say(`  ${name.padEnd(26)} NEW (not in ${BEFORE})`);
			differ++;
			continue;
		}
		if (!now.includes(name)) {
			say(`  ${name.padEnd(26)} GONE (was in ${BEFORE})`);
			differ++;
			continue;
		}
		const a = show(BEFORE, `${rel}/${name}`);
		const b = AFTER ? show(AFTER, `${rel}/${name}`) : readFileSync(join(ROOT, rel, name));
		if (a.equals(b)) {
			say(`  ${name.padEnd(26)} the same to the byte (${a.length} bytes, sha1 ${sha(a)})`);
			same++;
			continue;
		}
		differ++;
		if (!/\.(jpg|png|webp)$/.test(name)) {
			const al = a.toString('utf8').split('\n');
			const bl = b.toString('utf8').split('\n');
			let changed = 0;
			for (let i = 0; i < Math.max(al.length, bl.length); i++) if (al[i] !== bl[i]) changed++;
			say(`  ${name.padEnd(26)} DIFFERS (text): ${al.length} lines then, ${bl.length} now, ${changed} lines not the same in place`);
			continue;
		}
		const A = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
		const B = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true });
		if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
			say(`  ${name.padEnd(26)} DIFFERS: ${A.info.width}x${A.info.height} then, ${B.info.width}x${B.info.height} now`);
			continue;
		}
		const { width: W, height: H } = A.info;
		const points = [];
		let any = 0;
		let worst = 0;
		for (let i = 0, p = 0; i < A.data.length; i += 3, p++) {
			const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
			if (d > 0) any++;
			if (d > worst) worst = d;
			if (d > NOISE) points.push([p % W, (p / W) | 0]);
		}
		const boxes = clusters(points);
		say(
			`  ${name.padEnd(26)} DIFFERS: ${a.length} -> ${b.length} bytes; ${W}x${H}; ${points.length} pixels over the noise (${((100 * points.length) / (W * H)).toFixed(4)}%), ${any} not identical at all, largest difference ${worst} of 255; ${boxes.length} cluster${boxes.length === 1 ? '' : 's'}`,
		);
		for (const [k, c] of boxes.slice(0, 12).entries()) {
			say(`      ${String(k + 1).padStart(2)}. x ${c.x0} to ${c.x1}, y ${c.y0} to ${c.y1} (${c.x1 - c.x0 + 1}x${c.y1 - c.y0 + 1} px, ${c.n} pixels)`);
		}
		if (boxes.length > 12) say(`      and ${boxes.length - 12} more`);
		// crops of the first six clusters: before above, after below
		const tiles = [];
		for (const c of cropped(name) ? boxes.slice(0, 6) : []) {
			const pad = 60;
			const left = Math.max(0, c.x0 - pad);
			const top = Math.max(0, c.y0 - pad);
			const width = Math.min(W - left, c.x1 - c.x0 + 1 + 2 * pad);
			const height = Math.min(H - top, c.y1 - c.y0 + 1 + 2 * pad);
			const zoom = Math.max(1, Math.min(4, Math.floor(360 / Math.max(width, height))));
			for (const src of [a, b]) {
				tiles.push({
					img: await sharp(src).extract({ left, top, width, height }).resize(width * zoom, height * zoom, { kernel: 'nearest' }).png().toBuffer(),
					w: width * zoom,
					h: height * zoom,
				});
			}
		}
		if (tiles.length) {
			const cols = tiles.length / 2;
			const cw = Math.max(...tiles.map((t) => t.w)) + 8;
			const ch = Math.max(...tiles.map((t) => t.h)) + 8;
			const out = join(dir, `${scene}-${name.replace(/\.\w+$/, '')}-diff${TAG ? `-${TAG}` : ''}.jpg`);
			await sharp({ create: { width: cols * cw, height: 2 * ch, channels: 3, background: '#303030' } })
				.composite(tiles.map((t, i) => ({ input: t.img, left: ((i / 2) | 0) * cw + 4, top: (i % 2) * ch + 4 })))
				.jpeg({ quality: 90 })
				.toFile(out);
			say(`      crops (before above, now below, one column a cluster): ${out.slice(ROOT.length + 1)}`);
		}
	}
}
say(`\n${same} files the same to the byte, ${differ} not.`);
writeFileSync(join(dir, `sheets-same${TAG ? `-${TAG}` : ''}.txt`), `${lines.join('\n')}\n`);
