// The fifth look's copy of the shared helpers: the fourth look's, as its inspector left them. Nothing here writes outside refs/verification/fifth-look/.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SIZES, launch, sheet, sharp } from '../../../../tools/roots/lib.mjs';

// Round 2, piece 3: the smaller of the two phones the phone's sky is judged at.
SIZES.small = { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// The third look: a short phone that nobody has yet looked at as a picture.
SIZES.short = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// The third look: a phone on its side.
SIZES.side = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// Round 3, piece 1: the other phones on their side that the third look's short-scope.mjs found at fault.
SIZES.side667 = { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
SIZES.side740 = { viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
SIZES.side932 = { viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

// Round 3, piece 2: the two shorter phones B7 is to be clear on (320x568 is SIZES.narrow already).
SIZES.short640 = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
SIZES.short568 = SIZES.narrow;

export { ROOT, SIZES, launch, sheet, sharp };
// R3_OUT: a folder under refs/verification/fifth-look/ to write to instead (round 3, piece 2: its before pictures).
export const OUT = join(ROOT, 'refs/verification/fifth-look', process.env.R3_OUT ?? '');
// R3_BASE: another build served somewhere else (the build as it stood, for a before picture).
export const PROD = process.env.R3_BASE ?? 'http://localhost:4615';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const outDir = (sub) => {
	const d = join(OUT, sub);
	mkdirSync(d, { recursive: true });
	return d;
};

/** A context and page at a size, with console errors collected and every animation frame's time logged. */
export async function open(browser, size, { init, throttle = 1, reducedMotion = false, js = true } = {}) {
	const context = await browser.newContext({ ...SIZES[size], reducedMotion: reducedMotion ? 'reduce' : 'no-preference', javaScriptEnabled: js });
	const page = await context.newPage();
	const errors = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`PAGEERROR ${e}`));
	if (js) {
		await page.addInitScript(() => {
			window.__raf = [];
			const tick = (t) => {
				window.__raf.push(t);
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		});
		if (init) await page.addInitScript(init.fn, init.arg);
	}
	const cdp = await context.newCDPSession(page);
	if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
	const phone = SIZES[size].hasTouch === true;
	const { width: W, height: H } = SIZES[size].viewport;
	const pressAt = (x, y) => (phone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
	const centre = async (sel) => {
		const b = await page.locator(sel).first().boundingBox();
		return b ? [b.x + b.width / 2, b.y + b.height / 2] : null;
	};
	const press = async (sel) => {
		const c = await centre(sel);
		if (!c) throw new Error(`nothing to press: ${sel}`);
		await pressAt(...c);
	};
	return { context, page, errors, cdp, phone, W, H, pressAt, press, centre, size };
}

/** Record the screen with the DevTools screencast. */
export async function recorder(o, { every = 1, quality = 78 } = {}) {
	const frames = [];
	o.cdp.on('Page.screencastFrame', (f) => {
		frames.push({ ts: f.metadata.timestamp * 1000, img: Buffer.from(f.data, 'base64') });
		o.cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
	});
	await o.cdp.send('Page.startScreencast', { format: 'jpeg', quality, everyNthFrame: every, maxWidth: 1440, maxHeight: 900 });
	const at = (t) => {
		let pick = null;
		for (const f of frames) {
			if (f.ts <= t + 12) pick = f;
			else break;
		}
		return pick;
	};
	/** Cells at a fixed cadence from t0 to t1 (wall-clock ms). */
	const cut = (label, t0, t1, step) => {
		const cells = [];
		for (let t = t0; t <= t1; t += step) {
			const f = at(t);
			if (f) cells.push({ img: f.img, label: `${label} +${Math.round(t - t0)}` });
		}
		return cells;
	};
	/** Every recorded frame between t0 and t1. */
	const all = (label, t0, t1) => frames.filter((f) => f.ts >= t0 && f.ts <= t1).map((f) => ({ img: f.img, label: `${label} +${Math.round(f.ts - t0)}` }));
	const stop = () => o.cdp.send('Page.stopScreencast').catch(() => {});
	return { frames, at, cut, all, stop };
}

export const GRID = {
	desk: { cols: 6, cellW: 258, cellH: 161 },
	phone: { cols: 12, cellW: 125, cellH: 270 },
};

/** Frame-time summary between two performance.now() marks. */
export async function frameTimes(page, p0, p1) {
	const raf = await page.evaluate(([a, b]) => window.__raf.filter((t) => t >= a && t <= b), [p0, p1]).catch(() => []);
	const d = [];
	for (let i = 1; i < raf.length; i++) d.push(raf[i] - raf[i - 1]);
	const over = (ms) => d.filter((x) => x > ms).length;
	const worst = d.length ? Math.max(...d) : 0;
	const at = d.length ? Math.round(raf[d.indexOf(worst) + 1] - p0) : 0;
	const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
	const sorted = [...d].sort((a, b) => a - b);
	const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
	return { n: d.length, avg, p95, worst, at, over17: over(17.5), over34: over(34), over50: over(50), over100: over(100), text: `${d.length} frames, avg ${avg.toFixed(1)} ms, p95 ${p95.toFixed(1)}, >34 ms ${over(34)}, >50 ms ${over(50)}, >100 ms ${over(100)}, worst ${worst.toFixed(0)} ms at +${at} ms` };
}
export const pnow = (page) => page.evaluate(() => performance.now()).catch(() => 0);
export const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
