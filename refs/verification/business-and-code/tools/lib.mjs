// Shared by the inspector's scripts. Run against the PRODUCTION build:
//   PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm build && pnpm astro preview --port 4611
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const BASE = process.env.BASE ?? 'http://localhost:4611';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.join(HERE, '..', 'shots');
mkdirSync(SHOTS, { recursive: true });
export const GPU = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'];
export const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
export const PHONE = {
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 2,
	isMobile: true,
	hasTouch: true,
};
export const launch = (args = GPU) => chromium.launch({ executablePath: '/usr/bin/chromium', args });

let pass = 0;
let fail = 0;
export function check(ok, what, detail = '') {
	if (ok) pass++;
	else fail++;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` — ${detail}` : ''}`);
	return ok;
}
export const note = (text) => console.log(`     ${text}`);
export const tally = () => {
	console.log(`\n${pass} ok, ${fail} FAIL`);
	return fail;
};

/** The fields of a multipart body, in order: [[name, value], ...]. */
export function fields(postData) {
	const out = [];
	const re = /name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g;
	let m;
	while ((m = re.exec(postData ?? ''))) out.push([m[1], m[2]]);
	return out;
}

/** A page whose console errors are collected. `stub`: undefined (no stub), or { status, json }. */
export async function openPage(browser, size, { stub, js = true, reduced = false } = {}) {
	const context = await browser.newContext({
		...size,
		javaScriptEnabled: js,
		reducedMotion: reduced ? 'reduce' : 'no-preference',
	});
	const page = await context.newPage();
	const errors = [];
	const posts = [];
	page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('request', (req) => {
		if (req.method() === 'POST' && new URL(req.url()).pathname.startsWith('/api/')) {
			posts.push({ url: req.url(), headers: req.headers(), fields: fields(req.postData()) });
		}
	});
	const setStub = async (s) => {
		await context.unroute('**/api/contact');
		if (s) {
			await context.route('**/api/contact', (route) =>
				route.fulfill({ status: s.status, contentType: 'application/json', body: JSON.stringify(s.json) }),
			);
		}
	};
	await setStub(stub);
	return { context, page, errors, posts, setStub };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
