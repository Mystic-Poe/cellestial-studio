#!/usr/bin/env node
// The fourth look's own: static.mjs with the text files compressed (gzip), as `astro preview` sends them,
// so that two builds can be timed beside each other on a slowed line as a visitor would get them.
//   node static-gz.mjs <folder> <port>
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';
const root = process.argv[2];
const port = Number(process.argv[3] ?? 4618);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain' };
const TEXT = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt']);
const cache = new Map();
createServer((req, res) => {
	const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
	let file = join(root, p);
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
	if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
	if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
	const ext = extname(file);
	const head = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' };
	let body = cache.get(file);
	const gz = TEXT.has(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '');
	if (!body) { body = { raw: readFileSync(file) }; if (TEXT.has(ext)) body.gz = gzipSync(body.raw); cache.set(file, body); }
	if (gz) head['Content-Encoding'] = 'gzip';
	const out = gz ? body.gz : body.raw;
	head['Content-Length'] = out.length;
	res.writeHead(200, head);
	res.end(out);
}).listen(port, () => console.log(`serving ${root} (gzip) on http://localhost:${port}`));
