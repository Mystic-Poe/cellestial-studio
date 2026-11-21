// /admin still loads; /start links still resolve. Production build.
// Run: node refs/verification/business-and-code/tools/admin-start.mjs
import path from 'node:path';
import { BASE, check, DESK, launch, note, openPage, PHONE, SHOTS, sleep, tally } from './lib.mjs';

const browser = await launch();

// ── /admin ──
{
	console.log('\n# /admin');
	const { context, page, errors } = await openPage(browser, DESK);
	const scripts = [];
	const failed = [];
	page.on('response', (res) => {
		if (/decap-cms/.test(res.url())) scripts.push(`${res.status()} ${res.url()}`);
		if (/config\.yml/.test(res.url())) scripts.push(`${res.status()} ${res.url()}`);
	});
	page.on('requestfailed', (req) => failed.push(`${req.url()} ${req.failure()?.errorText}`));
	const res = await page.goto(`${BASE}/admin/`, { waitUntil: 'load', timeout: 60000 });
	check(res.status() === 200, '/admin/ answers 200', `${res.status()}`);
	await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, { timeout: 30000 }).catch(() => {});
	await sleep(1500);
	const seen = await page.evaluate(() => ({
		title: document.title,
		cms: typeof window.CMS,
		text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 200),
		buttons: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()),
	}));
	note(`responses: ${scripts.join(' ; ')}`);
	note(`on screen: ${JSON.stringify(seen)}`);
	check(scripts.some((s) => /^200 .*decap-cms/.test(s)), '/admin loads the Decap script');
	check(scripts.some((s) => /^200 .*config\.yml/.test(s)), '/admin reads its config.yml');
	check(seen.cms === 'object', 'the CMS started (window.CMS exists)');
	check(/login/i.test(seen.buttons.join(' ') + seen.text), 'it asks to log in', seen.buttons.join(', '));
	check(errors.length === 0, '/admin: no console errors', errors.join(' | '));
	check(failed.length === 0, '/admin: no failed requests', failed.join(' | '));
	await page.screenshot({ path: path.join(SHOTS, 'admin.png') });
	await context.close();
}

// ── /start ──
for (const [name, size] of [['desk', DESK], ['phone', PHONE]]) {
	console.log(`\n# /start — ${name}`);
	const { context, page, errors } = await openPage(browser, size);
	const api = [];
	page.on('request', (req) => {
		if (new URL(req.url()).pathname.startsWith('/api/')) api.push(`${req.method()} ${new URL(req.url()).pathname}`);
	});
	await page.goto(`${BASE}/start/new/`, { waitUntil: 'load' });
	await page.screenshot({ path: path.join(SHOTS, `start-new-${name}-empty.png`), fullPage: true });
	check(await page.evaluate(() => document.querySelector('[data-out]').hidden), 'no link until the form is filled');
	await page.fill('[data-builder] [name="name"]', "Rosa's Bakery");
	await page.fill('[data-builder] [name="email"]', 'rosa@rosasbakery.example');
	await page.fill('[data-builder] [name="domain"]', 'https://RosasBakery.example/menu');
	await sleep(200);
	const made = await page.evaluate(() => ({
		hidden: document.querySelector('[data-out]').hidden,
		href: document.querySelector('[data-link]').href,
		text: document.querySelector('[data-link]').textContent,
		qr: document.querySelector('[data-qr] svg') !== null,
		qrBox: (({ width, height }) => ({ width, height }))(document.querySelector('[data-qr]').getBoundingClientRect()),
		qrBg: getComputedStyle(document.querySelector('[data-qr]')).backgroundColor,
	}));
	note(`link: ${made.href}`);
	check(!made.hidden && made.href.startsWith('https://cellestialstudio.com/start/#') && made.text === made.href, 'filling the form builds a link to /start/#…');
	check(made.qr && made.qrBg === 'rgb(255, 255, 255)', 'with its QR code on a pure white card', JSON.stringify({ bg: made.qrBg, box: made.qrBox }));
	await page.screenshot({ path: path.join(SHOTS, `start-new-${name}-link.png`), fullPage: true });
	check(api.length === 0, 'the builder calls no API', api.join(','));

	// Open the generated link (same path and fragment, on the preview server).
	const link = new URL(made.href);
	const flow = await context.newPage();
	const flowErrors = [];
	flow.on('console', (m) => m.type() === 'error' && flowErrors.push(m.text()));
	flow.on('pageerror', (e) => flowErrors.push(`pageerror: ${e.message}`));
	const flowApi = [];
	flow.on('request', (req) => {
		if (new URL(req.url()).pathname.startsWith('/api/')) flowApi.push(`${req.method()} ${new URL(req.url()).pathname}`);
	});
	await flow.goto(`${BASE}${link.pathname}${link.hash}`, { waitUntil: 'load' });
	await sleep(800);
	const first = await flow.evaluate(() => ({
		h1: document.querySelector('h1')?.textContent,
		text: document.querySelector('[data-flow]').innerText.replace(/\s+/g, ' ').trim().slice(0, 420),
		progress: document.querySelector('ol[aria-label]')?.getAttribute('aria-label'),
		next: document.querySelector('[data-next]')?.textContent.trim() ?? null,
		buttons: [...document.querySelectorAll('[data-flow] button, [data-flow] a')].map((b) => b.textContent.trim()),
	}));
	note(`the flow opens with: ${JSON.stringify(first)}`);
	check(!/incomplete|Loading your setup/.test(first.text), 'the generated link resolves: the guided flow starts (not "This link is incomplete")');
	check(/Step 1 of \d+/.test(first.progress ?? ''), 'it is on step 1', first.progress ?? 'no progress bar');
	await flow.screenshot({ path: path.join(SHOTS, `start-flow-${name}-step1.png`), fullPage: true });
	if (first.next !== null) {
		await flow.click('[data-next]');
		await sleep(600);
		const second = await flow.evaluate(() => ({
			progress: document.querySelector('ol[aria-label]')?.getAttribute('aria-label'),
			text: document.querySelector('[data-flow]').innerText.replace(/\s+/g, ' ').trim().slice(0, 200),
		}));
		note(`after "next": ${JSON.stringify(second)}`);
		check(second.progress !== first.progress, 'the next button moves the flow on', `${first.progress} → ${second.progress}`);
		check(/rosas-bakery/.test(second.text), "the flow carries the client's details out of the link (step 2 names the organization rosas-bakery)");
		await flow.screenshot({ path: path.join(SHOTS, `start-flow-${name}-step2.png`), fullPage: true });
	}
	note(`API calls made by the flow (in-person mode): ${flowApi.join(', ') || 'none'}`);
	const real = flowErrors.filter((e) => !/404|Failed to load resource/.test(e));
	check(real.length === 0, 'the flow: no script errors', flowErrors.join(' | '));
	// A broken link says so.
	const broken = await context.newPage();
	await broken.goto(`${BASE}/start/#garbage`, { waitUntil: 'load' });
	await sleep(500);
	check(/incomplete/.test(await broken.evaluate(() => document.body.innerText)), 'a broken link says "This link is incomplete"');
	await broken.screenshot({ path: path.join(SHOTS, `start-flow-${name}-broken.png`) });
	check(errors.length === 0, 'the builder: no console errors', errors.join(' | '));
	await context.close();
}

await browser.close();
process.exit(tally() ? 1 : 0);
