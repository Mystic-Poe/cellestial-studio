// Checks /admin (Decap CMS) under the policy the site Worker actually sends.
// Run: node tools/security/admin-csp-check.mjs <base url>
//   <base url>  a local `wrangler dev` serving dist/ (the live /admin is behind Access)
//
// Three runs, nothing sent to GitHub (every api.github.com call is answered here;
// the browser still applies the page's policy before the fake answer is used):
//   login   the sign-in screen renders, no policy violations
//   editor  a signed-in editor (fake token, fake GitHub replies) renders its
//           collections, no policy violations
//   tamper  unpkg serves altered bytes: the browser must refuse to run them
import { launch } from '../roots/lib.mjs';

const [base = 'http://127.0.0.1:8799'] = process.argv.slice(2);
const browser = await launch();
let failed = 0;

const fakeGitHub = async (route) => {
	const { pathname } = new URL(route.request().url());
	if (process.env.DEBUG) console.log('  github:', route.request().method(), pathname);
	const json = (body, status = 200) =>
		route.fulfill({
			status,
			contentType: 'application/json',
			headers: {
				'access-control-allow-origin': '*',
				'access-control-allow-headers': '*',
				'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
				'access-control-expose-headers': '*',
			},
			body: JSON.stringify(body),
		});
	if (route.request().method() === 'OPTIONS') return json({});
	if (pathname === '/user')
		return json({ login: 'csp-check', name: 'CSP check', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' });
	if (/^\/repos\/[^/]+\/[^/]+$/.test(pathname))
		return json({ name: 'cellestial-studio', owner: { login: 'Mystic-Poe' }, permissions: { push: true, pull: true, admin: false }, default_branch: 'main' });
	return json({ message: 'Not Found' }, 404);
};

async function run(name, { signedIn = false, tamper = false } = {}) {
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	await page.route('https://api.github.com/**', fakeGitHub);
	await page.route('https://avatars.githubusercontent.com/**', (r) =>
		r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }),
	);
	if (tamper)
		await page.route('https://unpkg.com/**', async (route) => {
			const res = await route.fetch();
			return route.fulfill({ response: res, body: `${await res.text()}\n;window.__tampered=true;` });
		});
	await page.addInitScript((signedIn) => {
		window.__csp = [];
		document.addEventListener('securitypolicyviolation', (e) =>
			window.__csp.push(`${e.effectiveDirective} ${e.blockedURI || '(inline)'}`),
		);
		if (signedIn) localStorage.setItem('decap-cms-user', JSON.stringify({ token: 'fake', backendName: 'github' }));
	}, signedIn);
	const console_ = [];
	page.on('console', (m) => m.type() === 'error' && console_.push(m.text().slice(0, 200)));
	const res = await page.goto(`${base}/admin/`, { waitUntil: 'load', timeout: 60000 });
	const policy = res?.headers()['content-security-policy'] ?? '(none)';
	await page.waitForTimeout(6000);
	const v = await page.evaluate(() => window.__csp);
	const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);
	const ran = await page.evaluate(() => typeof window.CMS === 'object' || typeof window.DecapCms === 'object');
	await page.screenshot({ path: `refs/verification/admin-csp-${name}.png` });
	await page.close();
	console.log(`\n[${name}] policy sent: ${policy.slice(0, 90)}…`);
	console.log(`  violations: ${v.length ? v.join(' | ') : 'none'}`);
	console.log(`  decap ran: ${ran}   page text: ${text}`);
	if (console_.length) console.log(`  console errors: ${console_.slice(0, 4).join(' | ')}`);
	return { v, ran, text, policy };
}

const login = await run('login');
if (login.v.length || !login.ran || !/Login with GitHub/i.test(login.text)) failed++;
const editor = await run('editor', { signedIn: true });
if (editor.v.length || !editor.ran || !/Homepage/i.test(editor.text)) failed++;
const tamper = await run('tamper', { tamper: true });
if (tamper.ran) failed++;
console.log(`\ntamper refused: ${!tamper.ran}`);

await browser.close();
console.log(failed ? `\nFAIL (${failed})` : '\nPASS');
process.exit(failed ? 1 : 0);
