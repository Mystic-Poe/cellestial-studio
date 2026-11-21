#!/usr/bin/env node
// The loading scene's rules, measured in real time against the dev server.
//
//   node tools/loader/measure.mjs [--url http://localhost:4500] [--size desk|phone] [--only full,short,...]
//
// Each line is one run: what was done, and the seconds from the loader's mount
// (the moment #loader gets .is-live) to the moment its `done` resolves. Runs:
//
//   full        a first visit                       must be 6.0 to 8.0 s
//   short       the same tab, reloaded              the short version
//   skip        a click one second in               the hand-off only: it ends 1.0 to 2.4 s after
//                                                   the click, or after the sky is ready if that is
//                                                   later (on a slow line the sky is still on its
//                                                   way at one second, and there is nothing to
//                                                   hand over to until it has come)
//   quiet-keys  Tab, Shift, Control, Alt, Meta at 1 s: must not skip (same length as full)
//   key         the "a" key one second in           skips
//   broken      one picture answers 404             must still end (one run per picture)
//   resize      the window changes size twice mid-run: must keep the time (same length as full)
//   no-storage  sessionStorage throws               must play the full version and end
//   no-sky      the sky's script fails to load      must fade out by itself after the wordmark
//   late-sky    the sky's script takes 30 s         must hold the wordmark at most 6 s, then go
//
// --throttle 4 slows the CPU four times (Chrome DevTools). --net slow4g puts
// the page on a slow line (1.6 Mbit/s down, 750 kbit/s up, 150 ms each way:
// Lighthouse's "slow 4G"). --gpu uses the real GPU. All the rules must hold
// unslowed, with --throttle 4, and with --net slow4g.
//
// The times follow the loader's plan (src/experience/loader/timeline.ts): the
// full version's 6.2 s of script are played in 5.6 s (FULL_TEMPO), then the
// 1.5 s hand-off: 7.1 s when nothing is late.
//
// Also prints the frame times of each run (average and 95th percentile, ms).
// Exits non-zero if a rule is broken.

import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		size: { type: 'string', default: 'desk' },
		only: { type: 'string' },
		throttle: { type: 'string' },
		net: { type: 'string' },
		gpu: { type: 'boolean', default: false },
	},
});
const only = values.only ? new Set(values.only.split(',')) : null;
const SIZES = {
	desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const INIT = `
	(() => {
		const m = (window.__m = { mount: null, done: null, sky: null, frames: [] });
		const seen = () => {
			const el = document.getElementById('loader');
			if (m.mount === null && el && el.classList.contains('is-live')) {
				m.mount = performance.now();
				return true;
			}
			return false;
		};
		const mo = new MutationObserver(() => { if (seen()) mo.disconnect(); });
		mo.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
		let last = 0;
		const tick = (now) => {
			if (m.mount !== null && m.done === null && last) m.frames.push(now - last);
			last = now;
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
		const wait = setInterval(() => {
			const loader = window.__cellestial && window.__cellestial.loader;
			if (!loader) return;
			clearInterval(wait);
			loader.done.then(() => { m.done = performance.now(); });
		}, 5);
		const waitSky = setInterval(() => {
			const sky = window.__cellestial && window.__cellestial.sky;
			if (!sky) return;
			clearInterval(waitSky);
			sky.ready.then(() => { m.sky = performance.now(); }, () => {});
		}, 5);
	})();
`;

const browser = await chromium.launch({
	executablePath: '/usr/bin/chromium',
	args: values.gpu ? ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'] : [],
});
let failed = 0;
const results = [];

async function open(extraInit) {
	const context = await browser.newContext(SIZES[values.size]);
	const page = await context.newPage();
	const errors = [];
	page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
	page.on('pageerror', (e) => errors.push(e.message));
	if (extraInit) await page.addInitScript(extraInit);
	await page.addInitScript(INIT);
	if (values.throttle || values.net) {
		const cdp = await context.newCDPSession(page);
		if (values.throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(values.throttle) });
		if (values.net === 'slow4g') {
			await cdp.send('Network.enable');
			await cdp.send('Network.emulateNetworkConditions', {
				offline: false,
				latency: 150,
				downloadThroughput: (1.6 * 1024 * 1024) / 8,
				uploadThroughput: (750 * 1024) / 8,
			});
		}
	}
	return { context, page, errors };
}

async function result(page, timeout = 25000) {
	await page.waitForFunction(() => window.__m.done !== null, null, { timeout });
	return page.evaluate(() => {
		const m = window.__m;
		const f = m.frames.slice().sort((a, b) => a - b);
		return {
			seconds: (m.done - m.mount) / 1000,
			sky: m.sky === null ? null : (m.sky - m.mount) / 1000,
			avg: f.reduce((a, b) => a + b, 0) / (f.length || 1),
			p95: f[Math.floor(f.length * 0.95)] ?? 0,
			frames: f.length,
			scene: document.documentElement.dataset.scene,
			overlay: getComputedStyle(document.getElementById('loader')).display,
			mode: document.getElementById('loader').dataset.mode,
		};
	});
}

function report(name, r, rule, ok, errors = []) {
	const line = `${name.padEnd(22)} ${r.seconds.toFixed(2)} s  mode=${r.mode}  frames avg ${r.avg.toFixed(1)} ms, p95 ${r.p95.toFixed(1)} ms  → scene=${r.scene}, overlay=${r.overlay}  ${ok ? 'OK' : 'FAIL'} (${rule})`;
	console.log(line);
	for (const e of errors) console.log(`    console: ${e}`);
	if (!ok) failed++;
	results.push({ name, ...r, ok });
}

/** A skip one second in: it ends 1.0 to 2.4 s after the skip, or after the sky is ready if that is later. */
const skipped = (r) => {
	const since = r.seconds - Math.max(1, r.sky ?? 0);
	return since > 1 && since < 2.4;
};
const skipRule = (r) => `the hand-off only; the sky was ready at ${r.sky === null ? '?' : r.sky.toFixed(2)} s`;

const want = (name) => !only || only.has(name);
const home = `${values.url}/?debug`;
const ended = (r) => r.scene === 'sky' && r.overlay === 'none';
let full = null;

if (want('full') || want('short')) {
	const { context, page, errors } = await open();
	await page.goto(home);
	const r = await result(page);
	full = r.seconds;
	report('full', r, '6.0 to 8.0 s', r.seconds >= 6 && r.seconds <= 8 && r.mode === 'full' && ended(r) && !errors.length, errors);
	if (want('short')) {
		await page.reload();
		const s = await result(page);
		report('short (reload)', s, 'short version, ends', s.mode === 'short' && s.seconds < r.seconds && ended(s) && !errors.length, errors);
	}
	await context.close();
}

if (want('skip')) {
	const { context, page, errors } = await open();
	await page.goto(home);
	await page.waitForFunction(() => window.__m.mount !== null);
	await page.waitForTimeout(1000);
	await (values.size === 'phone' ? page.touchscreen.tap(200, 400) : page.mouse.click(700, 400));
	// A second one, mid hand-off, must change nothing.
	await page.waitForTimeout(600);
	await page.keyboard.press('Enter');
	const r = await result(page);
	report('skip at 1 s (tap)', r, skipRule(r), skipped(r) && ended(r) && !errors.length, errors);
	await context.close();
}

if (want('key')) {
	const { context, page, errors } = await open();
	await page.goto(home);
	await page.waitForFunction(() => window.__m.mount !== null);
	await page.waitForTimeout(1000);
	await page.keyboard.press('a');
	const r = await result(page);
	report('skip at 1 s (key a)', r, skipRule(r), skipped(r) && ended(r) && !errors.length, errors);
	await context.close();
}

if (want('quiet-keys')) {
	const { context, page, errors } = await open();
	await page.goto(home);
	await page.waitForFunction(() => window.__m.mount !== null);
	await page.waitForTimeout(1000);
	for (const key of ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) await page.keyboard.press(key);
	const r = await result(page);
	report('Tab and modifiers', r, 'no skip: 6.0 to 8.0 s', r.seconds >= 6 && r.seconds <= 8 && ended(r) && !errors.length, errors);
	await context.close();
}

if (want('broken')) {
	for (const file of ['c-unlit.webp', 'c-lit.webp', 'wordmark.webp', 'wordmark-matte.webp']) {
		const { context, page } = await open();
		await page.route(`**/cellestial/loader/${file}`, (route) => route.fulfill({ status: 404, body: '' }));
		await page.goto(home);
		const r = await result(page);
		report(`404 ${file}`, r, 'still ends', ended(r));
		await context.close();
	}
}

if (want('resize')) {
	const { context, page, errors } = await open();
	await page.goto(home);
	await page.waitForFunction(() => window.__m.mount !== null);
	await page.waitForTimeout(2000);
	await page.setViewportSize({ width: 844, height: 390 });
	await page.waitForTimeout(2000);
	await page.setViewportSize({ width: 1024, height: 768 });
	const r = await result(page);
	report('resize twice mid-run', r, 'keeps the time: 6.0 to 8.0 s', r.seconds >= 6 && r.seconds <= 8 && ended(r) && !errors.length, errors);
	await context.close();
}

if (want('no-storage')) {
	const { context, page, errors } = await open(
		`Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });`,
	);
	await page.goto(home);
	const r = await result(page);
	report('sessionStorage blocked', r, 'full version, ends', r.mode === 'full' && r.seconds >= 6 && ended(r) && !errors.length, errors);
	await context.close();
}

if (want('no-sky')) {
	const { context, page } = await open();
	await page.route('**/experience/sky/index.ts*', (route) => route.abort());
	await page.goto(home);
	const r = await result(page);
	report('sky fails to load', r, 'ends by itself', r.overlay === 'none' && r.seconds >= 6 && r.seconds < 8);
	await context.close();
}

if (want('late-sky')) {
	const { context, page } = await open();
	await page.route('**/experience/sky/index.ts*', async (route) => {
		await new Promise((done) => setTimeout(done, 30000));
		await route.continue().catch(() => {});
	});
	await page.goto(home);
	const r = await result(page);
	// 5.6 s of script, 6 s of waiting, 0.4 s of fading: about 12.0 s, and more on a slow device.
	report('sky 30 s late', r, 'holds at most 6 s, then goes', r.overlay === 'none' && r.seconds > 11.6 && r.seconds < 13.5);
	await context.close();
}

await browser.close();
if (full !== null) console.log(`\nfull version, mount to done: ${full.toFixed(2)} s`);
process.exit(failed ? 1 : 0);
