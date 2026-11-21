// Reproduce the Turnstile miss seen in flows-contact.mjs (phone, a dialog, nothing stubbed),
// with evidence at every boundary: the script tag, the network, window.turnstile, render().
// Usage: node repro.mjs [rounds] [mode]   mode: seq (stub200, stub400, then unstubbed) | solo (unstubbed only)
import { chromium } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://localhost:4621';
const ROUNDS = Number(process.argv[2] ?? 3);
const MODE = process.argv[3] ?? 'seq';
const SIZE = process.env.SIZE ?? 'phone';
const GPU = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'];
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const FORMS = [
	{ label: 'F1 claim', form: '#claim-form', open: '#roots [data-open-claim]', dialog: '#claim-dialog' },
	{ label: 'F2 contact', form: '#contact-box-form', open: '#roots [data-open-contact]', dialog: '#contact-dialog' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: GPU });

// In the page: note every Turnstile script tag, its load/error, and every render()/reset() call.
const INIT = () => {
	const t0 = performance.now();
	const log = [];
	const at = () => Math.round(performance.now() - t0);
	window.__ts = log;
	const wrap = () => {
		const v = window.turnstile;
		if (!v || typeof v.render !== 'function' || v.__wrapped) return;
		const render = v.render.bind(v);
		const reset = v.reset.bind(v);
		try {
			v.render = (el, opts) => {
				const r = el.getBoundingClientRect?.();
				let out;
				let err = null;
				try {
					out = render(el, opts);
				} catch (e) {
					err = e;
				}
				log.push(`${at()} render(${el.id || el.className || el.tagName}, box ${Math.round(r?.width)}x${Math.round(r?.height)}, vis=${document.visibilityState}, focus=${document.hasFocus()}) -> ${err ? `THROW ${err.message}` : JSON.stringify(out)}; children now ${el.children.length}`);
				if (err) throw err;
				return out;
			};
			v.reset = (id) => {
				log.push(`${at()} reset(${JSON.stringify(id)})`);
				return reset(id);
			};
			v.__wrapped = true;
		} catch (e) {
			log.push(`${at()} could not wrap: ${e.message}`);
		}
	};
	// Capture phase: runs before the page's own listener on the script element.
	document.addEventListener('load', (e) => {
		const n = e.target;
		if (n?.tagName === 'SCRIPT' && /turnstile/.test(n.src)) {
			log.push(`${at()} script load event; window.turnstile is ${typeof window.turnstile}`);
			wrap();
		}
	}, true);
	document.addEventListener('error', (e) => {
		const n = e.target;
		if (n?.tagName === 'SCRIPT' && /turnstile/.test(n.src)) log.push(`${at()} script ERROR event`);
	}, true);
	new MutationObserver((muts) => {
		for (const m of muts)
			for (const n of m.addedNodes)
				if (n.tagName === 'SCRIPT' && /turnstile/.test(n.src)) log.push(`${at()} script tag added: ${n.src.slice(0, 70)}`);
	}).observe(document, { childList: true, subtree: true });
	document.addEventListener('click', (e) => {
		const o = e.target.closest?.('[data-open-claim], [data-open-contact]');
		if (o) log.push(`${at()} click on opener (trusted=${e.isTrusted})`);
	}, true);
};

async function run(f, kind, size) {
	const context = await browser.newContext({ ...size, reducedMotion: 'no-preference' });
	const page = await context.newPage();
	const net = [];
	const errors = [];
	const T0 = Date.now();
	const at = () => Date.now() - T0;
	const cf = (u) => /challenges\.cloudflare\.com/.test(u);
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 140)));
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 140)}`));
	context.on('request', (r) => cf(r.url()) && net.push(`${at()} > ${r.method()} ${r.url().replace(/^https:\/\/challenges\.cloudflare\.com/, '').slice(0, 60)}`));
	context.on('response', (r) => cf(r.url()) && net.push(`${at()} < ${r.status()} ${r.url().replace(/^https:\/\/challenges\.cloudflare\.com/, '').slice(0, 60)}`));
	context.on('requestfailed', (r) => cf(r.url()) && net.push(`${at()} X ${r.failure()?.errorText} ${r.url().replace(/^https:\/\/challenges\.cloudflare\.com/, '').slice(0, 60)}`));
	if (kind !== 'unstubbed') {
		const status = kind === 'stub200' ? 200 : 400;
		await context.route('**/api/contact', (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { ok: true } : { error: 'The spam check did not pass. Please try again.' }) }));
	}
	await page.addInitScript(INIT);
	await page.goto(`${BASE}/?scene=roots&debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.claimFlow && window.__cellestial?.roots, null, { timeout: 15000 });
	const tClick = at();
	await page.click(f.open);
	await page.waitForSelector(`${f.dialog}[open]`, { timeout: 5000 });
	if (kind !== 'unstubbed') {
		await page.fill(`${f.form} [name="name"]`, 'Test Visitor');
		await page.fill(`${f.form} [name="email"]`, 'visitor@example.com');
		await page.fill(`${f.form} [name="message"]`, 'A site for my bakery.');
	}
	const tWait = Date.now();
	const ok = await page.waitForFunction((sel) => document.querySelector(`${sel} [name="cf-turnstile-response"]`)?.value, f.form, { timeout: 20000 }).then(() => true, () => false);
	const ms = Date.now() - tWait;
	const state = await page.evaluate((sel) => {
		const slot = document.querySelector(`${sel} [data-turnstile-slot]`);
		const r = slot.getBoundingClientRect();
		return { api: typeof window.turnstile, scripts: document.querySelectorAll('script[data-turnstile-api]').length, kids: slot.children.length, box: `${Math.round(r.width)}x${Math.round(r.height)}`, log: window.__ts };
	}, f.form);
	const frames = page.frames().filter((fr) => cf(fr.url())).length;
	console.log(`${ok ? 'ok  ' : 'MISS'} ${SIZE} ${f.label} ${kind}: token ${ok ? `after ${ms} ms` : 'NEVER (20 s)'}; api=${state.api} scripts=${state.scripts} kids=${state.kids} box=${state.box} frames=${frames} click@${tClick}`);
	if (!ok || process.env.VERBOSE) {
		console.log(`     page: ${state.log.join(' | ')}`);
		console.log(`     net:  ${net.join(' | ')}`);
		console.log(`     console: ${errors.join(' | ') || 'none'}`);
	}
	if (kind !== 'unstubbed' && ok) {
		await page.click(`${f.form} button[type="submit"]`);
		await page.waitForFunction((sel) => /Sent|did not/.test(document.querySelector(`${sel} [data-status]`).textContent), f.form, { timeout: 8000 }).catch(() => {});
		await sleep(kind === 'stub200' ? 1900 : 300);
	}
	await context.close();
	return ok;
}

let miss = 0;
let n = 0;
const size = SIZE === 'phone' ? PHONE : DESK;
for (let round = 1; round <= ROUNDS; round++) {
	console.log(`\n# round ${round}`);
	for (const f of FORMS) {
		const kinds = MODE === 'seq' ? ['stub200', 'stub400', 'unstubbed'] : ['unstubbed'];
		for (const kind of kinds) {
			const ok = await run(f, kind, size);
			n++;
			if (!ok) miss++;
		}
	}
}
console.log(`\n${n - miss} of ${n} openings got a token; ${miss} missed`);
await browser.close();
