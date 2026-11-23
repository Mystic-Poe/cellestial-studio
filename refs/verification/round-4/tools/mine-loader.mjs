#!/usr/bin/env node
// The fourth look's own: THE LOADER'S FIRST SECONDS AND ITS CLOCK, FROM THE RECORDING. Every first visit is
// recorded with the DevTools screencast (frames as the compositor presents them) from the navigation on,
// and every recorded frame's light is measured (the mean of the frame, and of its upper and lower halves).
// From the frames alone, ms after navigation:
//   black      the first recorded frame of the site (the blank page before it is white)
//   seen       the first frame in which anything of the C shows (mean light over 0.4 of 255)
//   whole      the first frame whose light is within 5% of the still C's (the light the frame holds
//              just before the loader's canvas begins the power-up)
//   partly     the frames between "seen" and "whole" whose light is under 90% of the still C's, or whose
//              share of light in the lower half is more than 0.08 off the still C's (a C drawn top first)
//   without    once the C has been seen, the frames up to a second after the canvas has taken the picture
//              over with under 60% of the still C's light
// From the page (a MutationObserver, performance.now()): the browser's first-contentful-paint, the frame the
// page says it showed the C in (window.__loaderEarly.seenAt, if the build has it), .has-poster, .is-drawn
// and .is-live on #loader, and the scene becoming "sky". THE CLOCK counted here is FIRST SEEN IN THE
// RECORDING to the sky.
//   node mine-loader.mjs --line fast|slow4g|1mbit [--cpu 4] [--sizes desk,phone] [--runs 5]
//        [--case nothing|mount|at:<ms after navigation>|seen:<ms after the C is shown>|quiet:<ms>|return|link|linkkey]
//        [--hold 1500]            the page's own script held back so many ms more
//        [--block <substring of a picture's address>:never|404]
//        [--probe]                the second look's in-page probe of the sky canvas's middle, for the hand-off
//        [--strip 1000]           a strip of the visit, a cell every so many ms from the navigation to the sky
//        [--tag name]             names the report loader/mine-<tag>.txt and the strips
// R3_BASE measures another build.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, launch, open, outDir, recorder, sharp, sheet, sleep } from './lib.mjs';
const { values } = parseArgs({ options: {
	line: { type: 'string', default: 'fast' }, cpu: { type: 'string', default: '1' }, sizes: { type: 'string', default: 'desk,phone' },
	runs: { type: 'string', default: '3' }, case: { type: 'string', default: 'nothing' }, hold: { type: 'string', default: '0' },
	block: { type: 'string', default: '' }, probe: { type: 'boolean', default: false }, strip: { type: 'string', default: '0' },
	tag: { type: 'string', default: '' }, wait: { type: 'string', default: '90000' }, norec: { type: 'boolean', default: false },
} });
const dir = outDir('loader');
const tag = values.tag || `${values.line}-${values.case.replace(/[:]/g, '')}`;
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const LINES = { slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }, '1mbit': { latency: 200, downloadThroughput: (1.0 * 1024 * 1024) / 8, uploadThroughput: (500 * 1024) / 8 } };
const browser = await launch({ gpu: true });
const init = { fn: (probe) => {
	window.__t = { scenes: [] };
	const mark = () => {
		const s = document.documentElement.dataset.scene;
		const now = performance.now();
		if (s && window.__t.scenes.at(-1)?.[0] !== s) window.__t.scenes.push([s, now]);
		if (s === 'sky' && !window.__t.sky) window.__t.sky = now;
		const l = document.getElementById('loader');
		if (!l) return;
		for (const c of ['has-poster', 'is-drawn', 'is-live', 'is-return']) if (l.classList.contains(c) && !window.__t[c]) window.__t[c] = now;
	};
	new MutationObserver(mark).observe(document, { attributes: true, subtree: true, childList: true, attributeFilter: ['data-scene', 'class'] });
	window.__keys = [];
	if (!probe) return;
	window.__probe = [];
	const pad = document.createElement('canvas');
	pad.width = pad.height = 96;
	const g = pad.getContext('2d', { willReadFrequently: true });
	const tick = (t) => {
		const row = { t, scene: document.documentElement.dataset.scene, L: -1 };
		const cv = document.getElementById('sky-canvas') ?? [...document.querySelectorAll('canvas')].find((c) => (c.id || c.className || c.parentElement?.id) === 'sky-canvas');
		if (cv) {
			try {
				const r = cv.getBoundingClientRect();
				g.clearRect(0, 0, 96, 96);
				const sx = cv.width / (r.width || 1), sy = cv.height / (r.height || 1);
				const cx = (innerWidth / 2 - r.left) * sx, cy = (innerHeight / 2 - r.top) * sy;
				g.drawImage(cv, cx - 48 * sx, cy - 48 * sy, 96 * sx, 96 * sy, 0, 0, 96, 96);
				const d = g.getImageData(0, 0, 96, 96).data;
				let s = 0;
				for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * (d[i + 3] / 255);
				row.L = Math.round((s / (96 * 96)) * 10) / 10;
			} catch { row.L = -2; }
		}
		window.__probe.push(row);
		setTimeout(() => requestAnimationFrame(tick), 0);
	};
	addEventListener('DOMContentLoaded', () => requestAnimationFrame(tick));
}, arg: values.probe };
const read = (o) => o.page.evaluate(() => ({ ...window.__t, now: performance.now(), origin: performance.timeOrigin, fcp: performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? null, pageSeen: window.__loaderEarly?.seenAt ?? null, mode: document.getElementById('loader')?.dataset.mode ?? null, scene: document.documentElement.dataset.scene ?? null })).catch(() => null);
const r0 = (x) => (x === null || x === undefined || Number.isNaN(x) ? '?' : Math.round(x));
const [kind, kindArg] = values.case.split(':');
const clocks = {};
for (const size of values.sizes.split(',')) {
	for (let run = 1; run <= Number(values.runs); run++) {
		const o = await open(browser, size, { init, throttle: Number(values.cpu) });
		const all = [];
		o.cdp.on('Runtime.consoleAPICalled', (e) => all.push(`console.${e.type}: ${e.args.map((a) => a.value ?? a.description ?? '').join(' ')}`));
		o.cdp.on('Log.entryAdded', (e) => all.push(`log.${e.entry.level}: ${e.entry.text} ${e.entry.url ?? ''}`));
		o.cdp.on('Runtime.exceptionThrown', (e) => all.push(`exception: ${e.exceptionDetails.text} ${e.exceptionDetails.exception?.description ?? ''}`));
		await o.cdp.send('Runtime.enable');
		await o.cdp.send('Log.enable');
		if (LINES[values.line]) { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, ...LINES[values.line] }); }
		if (Number(values.hold) > 0) await o.page.route(/index\.astro[^/]*\.js$/, async (route) => { await sleep(Number(values.hold)); await route.continue().catch(() => {}); });
		if (values.block) {
			const [what, how] = values.block.split(':');
			await o.page.route((u) => u.pathname.includes(what), async (route) => { if (how === '404') await route.fulfill({ status: 404, body: '' }); /* never: left hanging */ });
		}
		const press = () => (o.phone ? o.page.touchscreen.tap(Math.round(o.W / 2), Math.round(o.H * 0.6)) : o.page.keyboard.press('a'));
		const rec = values.norec ? null : await recorder(o, { quality: 80 });
		let at = null;
		let note = '';
		if (kind === 'link' || kind === 'linkkey') {
			// A press BEFORE the navigation: the click (or Enter) on a link to the page.
			await o.page.goto(`data:text/html,<body style="margin:0;background:white"><a id="a" href="${PROD}/" style="position:fixed;inset:0;display:block">go</a>`);
			await sleep(300);
			if (kind === 'link') { if (o.phone) await o.page.touchscreen.tap(Math.round(o.W / 2), Math.round(o.H * 0.6)); else { await o.page.mouse.move(o.W / 2, o.H * 0.6); await o.page.mouse.down(); await sleep(60); await o.page.mouse.up(); } }
			else { await o.page.focus('#a'); await o.page.keyboard.down('Enter'); await sleep(350); await o.page.keyboard.up('Enter'); }
			await o.page.waitForFunction(() => location.protocol.startsWith('http') && window.__t, null, { timeout: 60000, polling: 'raf' });
			note = kind === 'link' ? 'the press was the click on a link to the page' : 'the press was Enter on a link to the page, held 350 ms';
		} else {
			await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		}
		if (kind === 'mount') { await o.page.waitForFunction(() => window.__t?.['is-live'], null, { timeout: 60000, polling: 'raf' }); at = (await read(o)).now; await press(); }
		if (kind === 'at') { await o.page.waitForFunction((ms) => performance.now() >= ms, Number.parseFloat(kindArg), { timeout: 60000, polling: 'raf' }); at = (await read(o)).now; await press(); }
		if (kind === 'seen') { await o.page.waitForFunction(() => window.__t?.['has-poster'] || window.__t?.['is-drawn'], null, { timeout: 60000, polling: 'raf' }); await sleep(Number(kindArg ?? 300)); at = (await read(o)).now; await press(); }
		if (kind === 'quiet') { await o.page.waitForFunction((ms) => performance.now() >= ms, Number(kindArg), { timeout: 60000, polling: 'raf' }); at = (await read(o)).now; for (const key of ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) await o.page.keyboard.press(key); }
		let reached = true;
		await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: Number(values.wait) }).catch(() => { reached = false; });
		await sleep(values.probe ? 700 : 300);
		const t = await read(o);
		let second = '';
		if (kind === 'return' || values.case.includes('+reload')) {
			// the same tab, loaded again: the short version
			await o.page.reload({ waitUntil: 'commit' });
			await o.page.waitForFunction(() => window.__t?.sky, null, { timeout: 60000 }).catch(() => {});
			const t2 = await read(o);
			second = `; THEN A RELOAD in the same tab: mode ${t2?.mode}, is-return ${r0(t2?.['is-return'])}, live ${r0(t2?.['is-live'])}, the sky at ${r0(t2?.sky)} ms`;
		}
		if (rec) await rec.stop();
		// the frames
		let seen = null, whole = null, black = null, partly = [], without = [], still = 0;
		const rows = [];
		if (rec && t) {
			const end = t.sky ? t.origin + t.sky : Date.now();
			// every frame up to a second and a half after the canvas has taken the picture over (the first seconds are
			// the question; the clock needs only "seen" and the page's own time of the sky); each frame decoded once, small
			const upto = t.origin + Math.max(t['is-drawn'] ?? 0, t['is-live'] ?? 0, 2500) + 1500;
			for (const f of rec.frames.filter((x) => x.ts >= t.origin - 50 && x.ts <= Math.min(end, upto))) {
				const w = 160, h = 100;
				const raw = await sharp(f.img).resize(w, h, { fit: 'fill', kernel: 'cubic' }).removeAlpha().raw().toBuffer();
				let a = 0, b = 0;
				const half = (h / 2) * w * 3;
				for (let i = 0; i < raw.length; i++) { if (i < half) a += raw[i]; else b += raw[i]; }
				a /= half; b /= raw.length - half;
				rows.push({ t: f.ts - t.origin, L: (a + b) / 2, low: a + b > 0 ? b / (a + b) : 0.5, f });
			}
			let start = 0;
			rows.forEach((r, i) => { if (r.L > 150) start = i + 1; });
			const site = rows.slice(start);
			black = site[0] ?? null;
			seen = site.find((r) => r.L > 0.4) ?? null;
			const live = t['is-live'] ?? null;
			// the still C: the last frame before the canvas begins to change the picture (live + 120 ms), or 900 ms after it is seen
			// (on a fast line the canvas draws within a tenth of a second and the power-up has begun 0.9 s after: there the still C is the frame a tenth of a second after the canvas's first drawing)
			const stillBy = t['is-drawn'] ? Math.max(seen?.t ?? 0, t['is-drawn'] + 100) : Math.max((live ?? 0) + 120, (seen?.t ?? 0) + 900);
			const before = site.filter((r) => seen && r.t >= seen.t && r.t <= stillBy);
			const ref = before.at(-1) ?? null;
			still = ref?.L ?? 0;
			whole = seen ? site.find((r) => r.t >= seen.t && r.L >= 0.95 * still) : null;
			if (seen && whole && ref) partly = site.filter((r) => r.t >= seen.t && r.t < whole.t && (r.L < 0.9 * still || Math.abs(r.low - ref.low) > 0.08));
			// only up to a second after the canvas has taken the picture over: the loader's own end (the wordmark cooling into the one star) is darker than the still C and is not this question
			if (seen) without = site.filter((r) => r.t > seen.t && r.t < Math.max(t['is-drawn'] ?? 0, live ?? 0, seen.t) + 1000 && r.L < 0.6 * still);
		}
		// the hand-off's probe
		let probe = '';
		if (values.probe && t) {
			const p = await o.page.evaluate(() => window.__probe);
			const k = p.findIndex((r) => r.scene === 'sky');
			if (k >= 0) {
				const usual = p[Math.min(p.length - 1, k + 6)].L;
				const round = p.slice(Math.max(0, k - 12), k + 12).filter((r) => r.L >= 0);
				const low = round.reduce((a, b) => (b.L < a.L ? b : a), round[0]);
				const dips = round.filter((r) => r.L < usual * 0.5);
				probe = `; THE HAND-OFF: ${dips.length ? `DIP ${dips.map((r) => `(${Math.round(r.t - p[k].t)} ms, ${r.L})`).join(' ')}` : 'no dip'}, the middle's light ${usual}, lowest of the 24 frames round the change ${low.L} (${((100 * low.L) / usual).toFixed(0)}%)`;
				(clocks[`${size} dips`] ??= []).push(dips.length ? 1 : 0);
				(clocks[`${size} lowest%`] ??= []).push((100 * low.L) / usual);
			} else probe = '; THE HAND-OFF: the scene never became sky in the probe';
		}
		const pressed = at === null ? (note || 'nothing pressed') : `${kind === 'quiet' ? 'Tab and five modifiers' : o.phone ? 'a tap' : 'the key "a"'} at ${r0(at)}${t?.['is-live'] ? (at < t['is-live'] ? ` (${r0(t['is-live'] - at)} ms BEFORE the loader is live)` : ` (${r0(at - t['is-live'])} ms after the loader is live)`) : ' (the loader never live)'}`;
		const clock = seen && t?.sky ? (t.sky - seen.t) / 1000 : null;
		say(`${size} ${values.line}${Number(values.cpu) > 1 ? ` cpu x${values.cpu}` : ''}${Number(values.hold) ? ` script held ${values.hold} ms` : ''}${values.block ? ` [${values.block}]` : ''} ${values.case} run ${run}: ` +
			`RECORDING: black ${r0(black?.t)}, C first seen ${r0(seen?.t)}, whole ${r0(whole?.t)} (still light ${still.toFixed(2)}), partly drawn frames ${partly.length}${partly.length ? ` [${partly.slice(0, 6).map((r) => `${r0(r.t)}: ${(100 * r.L / still).toFixed(0)}% low ${r.low.toFixed(2)}`).join(', ')}]` : ''}, frames without the C after it was seen ${without.length}${without.length ? ` [${without.slice(0, 6).map((r) => `${r0(r.t)}: ${(100 * r.L / still).toFixed(0)}%`).join(', ')}]` : ''}. ` +
			`PAGE: first paint ${r0(t?.fcp)}, the page's own "seen" ${r0(t?.pageSeen)}, has-poster ${r0(t?.['has-poster'])}, canvas drew ${r0(t?.['is-drawn'])}, live ${r0(t?.['is-live'])}, mode ${t?.mode}; ${pressed}; ` +
			`${reached ? `THE SKY AT ${r0(t?.sky)} ms` : `NO SKY within ${values.wait} ms (scene ${t?.scene})`}${at !== null && t?.sky ? `, ${((t.sky - at) / 1000).toFixed(2)} s after the press` : ''}${t?.sky && t?.['is-live'] ? `, ${((t.sky - t['is-live']) / 1000).toFixed(2)} s after live` : ''}; ` +
			`CLOCK first seen (recording) to the sky ${clock === null ? '?' : clock.toFixed(2)} s; first paint to the sky ${t?.sky && t?.fcp ? ((t.sky - t.fcp) / 1000).toFixed(2) : '?'} s${probe}${second}; console: ${all.length ? all.join(' | ') : 'nothing'}${o.errors.length ? `  ERRORS: ${o.errors.join(' | ')}` : ''}`);
		if (clock !== null) (clocks[`${size} clock`] ??= []).push(clock);
		if (t?.sky) (clocks[`${size} sky`] ??= []).push(t.sky / 1000);
		if (t?.sky && t?.['is-live']) (clocks[`${size} sky-after-live`] ??= []).push((t.sky - t['is-live']) / 1000);
		if (seen) (clocks[`${size} seen`] ??= []).push(seen.t / 1000);
		if (Number(values.strip) > 0 && run === 1 && rec && t) {
			const step = Number(values.strip);
			const cells = [];
			const end = (t.sky ?? t.now) + 400;
			for (let ms = 0; ms <= end; ms += step) {
				let pick = null;
				for (const f of rec.frames) { if (f.ts <= t.origin + ms + 8) pick = f; else break; }
				if (pick) cells.push({ img: pick.img, label: `+${(ms / 1000).toFixed(1)} s` });
			}
			const cols = o.phone ? 12 : 6;
			const cellW = o.phone ? 125 : 258;
			await sheet(join(dir, `mine-${tag}-${size}.jpg`), cells, { cols, cellW, cellH: Math.round(cellW * o.H / o.W) });
		}
		await o.context.close();
	}
}
const span = (a) => (a?.length ? `${Math.min(...a).toFixed(2)} to ${Math.max(...a).toFixed(2)} (${a.length})` : 'none');
say(`SUMMARY ${tag}: ${Object.entries(clocks).map(([k, a]) => `${k} ${span(a)}`).join('; ')}`);
writeFileSync(join(dir, `mine-${tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
