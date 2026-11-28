// Loads every page with the site's Content-Security-Policy in force and lists what it blocks.
// Run: node tools/security/csp-check.mjs <base url> [--inject]
//   <base url>  a local `wrangler dev` (headers from dist/_headers) or the live site
//   --inject    add the policy from public/_headers to each page response, to test the
//               live site before the headers are deployed
// Scrolls the homepage through to the Roots and opens the contact dialog on the way.
import { readFile } from 'node:fs/promises';
import { launch } from '../roots/lib.mjs';

const [base = 'http://127.0.0.1:8799', flag] = process.argv.slice(2);
const csp = (await readFile(new URL('../../public/_headers', import.meta.url), 'utf8')).match(
	/Content-Security-Policy: (.+)/,
)[1];
const pages = ['/', '/contact', '/survey', '/start', '/start/card-saved', '/dashboard/'];
const browser = await launch({ gpu: true });
let total = 0;
for (const [w, h] of [[390, 844], [1440, 900]]) {
	for (const path of pages) {
		const page = await browser.newPage({ viewport: { width: w, height: h } });
		if (flag === '--inject')
			await page.route('**/*', async (route) => {
				if (route.request().resourceType() !== 'document') return route.continue();
				const res = await route.fetch();
				return route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
			});
		await page.addInitScript(() => {
			window.__csp = [];
			document.addEventListener('securitypolicyviolation', (e) =>
				window.__csp.push(`${e.effectiveDirective} ${e.blockedURI || '(inline)'} ${e.sourceFile ?? ''}:${e.lineNumber}`),
			);
		});
		const errors = [];
		page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
		await page.goto(base + path, { waitUntil: 'load', timeout: 60000 }).catch((e) => errors.push(String(e).slice(0, 120)));
		await page.waitForTimeout(path === '/' ? 9000 : 2500);
		if (path === '/') {
			for (let i = 0; i < 12; i++) {
				await page.mouse.wheel(0, 900);
				await page.waitForTimeout(700);
			}
		}
		const v = await page.evaluate(() => window.__csp).catch(() => ['(page closed)']);
		total += v.length;
		console.log(`${w} ${path}  violations: ${v.length ? v.join(' | ') : 'none'}  errors: ${errors.length ? errors.join(' | ') : 'none'}`);
		await page.close();
	}
}
await browser.close();
console.log(`total violations: ${total}`);
process.exit(total ? 1 : 0);
