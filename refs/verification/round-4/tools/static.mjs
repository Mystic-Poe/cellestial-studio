#!/usr/bin/env node
// Round 3, piece 3: a second build served beside the one under `astro preview` (which serves one build
// per project): a plain static server over a folder, for a BEFORE picture taken in the same minutes as
// the after. No compression, so its timings on a slowed line are not the preview's: use it on a fast
// line only, or for what does not depend on the line.
//   node static.mjs <folder> [port, default 4616]       then: R3_BASE=http://localhost:4616 node <script>
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
const root = process.argv[2];
const port = Number(process.argv[3] ?? 4616);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };
createServer((req, res) => {
	let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
	let file = join(root, p);
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
	if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
	if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
	res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
	createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
