// A local stand-in for cellestialstudio.com, for browser checks of /start and
// /dashboard: serves dist/ and runs the real onboarding Worker on a fresh
// in-memory database. It plays Cloudflare Access too, signing every admin
// request, unless DEV_NO_ACCESS=1 (to see the "Sign in again" banner).
//
// Run: pnpm build && node workers/onboard/test/dev-server.mjs [port]
// Emails are never sent; each one is printed and kept at GET /__mails.
// Stripe is a pretend one (fake-stripe.mjs), on unless DEV_NO_STRIPE=1;
// POST /__save-card?client=<id> acts as the client saving a card.
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUD, accessToken, certs, TEAM } from './access-token.mjs';
import { fakeD1 } from './fake-d1.mjs';
import { fakeR2 } from './fake-r2.mjs';
import { fakeStripe } from './fake-stripe.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../../../dist');
const worker = (await import(resolve(here, '../src/index.ts'))).default;
const port = Number(process.argv[2] ?? 4410);
const ORIGIN = 'https://cellestialstudio.com';

const mails = [];
const stripe = fakeStripe();
globalThis.fetch = async (url, init = {}) => {
	const u = String(url);
	if (u.startsWith('https://api.stripe.com/')) return stripe.handle(u, init);
	if (u.endsWith('/cdn-cgi/access/certs')) return Response.json(certs);
	if (u.includes('api.resend.com')) {
		const m = JSON.parse(init.body);
		mails.push(m);
		console.log('  [mail]', m.subject);
		return new Response('{}', { status: 200 });
	}
	return new Response('{}', { status: 500 });
};

const env = {
	DB: fakeD1(),
	PHOTOS: fakeR2(),
	ACCESS_TEAM: TEAM,
	ACCESS_AUD: AUD,
	RESEND_API_KEY: 'dev',
	NOTIFY_TO: 'studio@example.com',
	NOTIFY_FROM: 'site@example.com',
	STRIPE_SECRET_KEY: process.env.DEV_NO_STRIPE === '1' ? undefined : 'rk_test_dev',
};

const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.woff2': 'font/woff2',
	'.ico': 'image/x-icon',
	'.json': 'application/json',
};

async function serveFile(path, res) {
	let file = join(dist, decodeURIComponent(path));
	if (!file.startsWith(dist)) return res.writeHead(403).end();
	try {
		if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
		const body = await readFile(file);
		res
			.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
			.end(body);
	} catch {
		if (!extname(path) && !path.endsWith('/'))
			return res.writeHead(301, { location: `${path}/` }).end();
		res.writeHead(404).end('Not found');
	}
}

createServer(async (req, res) => {
	const url = new URL(req.url, `http://localhost:${port}`);
	if (url.pathname === '/__mails')
		return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(mails));
	// Fills photo storage to its cap, so the "storage is full" answer can be seen.
	if (url.pathname === '/__fill-storage' && req.method === 'POST') {
		const { STORAGE_CAP } = await import('../src/quota.ts');
		await env.DB.prepare(
			`INSERT INTO photos (id, client_id, kind, source, name, type, size, has_thumb, created_at)
			 VALUES (?, ?, 'original', 'studio', 'filler.jpg', 'image/jpeg', ?, 0, 0)`,
		)
			.bind(`filler-${Date.now()}`, url.searchParams.get('client') ?? '', STORAGE_CAP)
			.run();
		return res.writeHead(204).end();
	}
	if (url.pathname === '/__save-card' && req.method === 'POST') {
		const row = await env.DB.prepare('SELECT setup_session FROM billing WHERE client_id = ?')
			.bind(url.searchParams.get('client') ?? '')
			.first();
		if (!row) return res.writeHead(404).end();
		stripe.saveCard(row.setup_session);
		return res.writeHead(204).end();
	}
	if (!url.pathname.startsWith('/api/onboard')) return serveFile(url.pathname, res);

	const chunks = [];
	for await (const c of req) chunks.push(c);
	const headers = new Headers();
	for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
	// The browser is on localhost; the Worker expects its own origin.
	if (headers.get('origin') === `http://localhost:${port}`) headers.set('origin', ORIGIN);
	if (url.pathname.startsWith('/api/onboard/admin') && process.env.DEV_NO_ACCESS !== '1')
		headers.set('cf-access-jwt-assertion', await accessToken());
	const request = new Request(`${ORIGIN}${url.pathname}${url.search}`, {
		method: req.method,
		headers,
		body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
	});
	const r = await worker.fetch(request, env, { waitUntil() {} });
	res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`onboard dev server on http://localhost:${port}`));
