#!/usr/bin/env node
// Sheets and numbers for the effects layer (C4 the teleport flash, D2 the
// impact, G2 the warp), to be LOOKED AT.
//
//   node tools/fx/compare.mjs [--url http://localhost:4500] [--only flash,peak,impact,warp,rm,measure]
//
// Needs the dev server running (see PROGRESS.md) AND the layer's own test page,
// /dev/fx, which is not in the shipped site. Bring it back for a run with
//   git checkout 8385356 -- src/pages/dev/fx.astro src/experience/fx/dev/harness.ts
// (8385356 is the last commit that had them) and remove both again afterwards:
//   git rm -r -f src/pages/dev src/experience/fx/dev
// The test page freezes an effect at a fraction of its length (t=0..1) on a
// clock moved by hand, over a choice of backgrounds.
//
// Writes into refs/fx/compare/ (JPEG, 1600 px at most):
//
//   flash-<dir>-desk.jpg, -phone.jpg   the flash at nine moments over a pale
//                                      page of dark figures: a cover that is
//                                      not opaque shows them
//   flash-peak.jpg                     the peak close up, beside the lit
//                                      circuits of A1_c-emblem_lit.jpg close up
//   impact-desk.jpg, -phone.jpg        the impact at six moments, three places
//                                      along a ground line at 62% of the height
//   warp-desk.jpg, -phone.jpg          the warp at eight moments over soil and
//                                      over the pale page
//   rm.jpg                             reduced motion: all three
//   measure.txt                        real time: the flash's length with and
//                                      without swap time, the canvas at the
//                                      moment of the swap, frame times with the
//                                      CPU slowed 4x, frames asked for at rest

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch, openPage, ROOT, sharp, sheet, shot } from '../roots/lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: 'http://localhost:4500' },
		only: { type: 'string', default: 'flash,peak,impact,warp,rm,measure' },
	},
});
const only = new Set(values.only.split(','));
const OUT = join(ROOT, 'refs/fx/compare');
mkdirSync(OUT, { recursive: true });
const PAGE = `${values.url}/dev/fx`;
const SIZES = ['desk', 'phone'];
const GRID = {
	desk: { cols: 3, cellW: 520, cellH: 325 },
	phone: { cols: 9, cellW: 170, cellH: 368 },
};

const browser = await launch();
let bad = 0;

async function frozen(size, query) {
	const opened = await openPage(browser, size, `${PAGE}?${query}`);
	await opened.page.waitForFunction(() => window.__fxDev?.log.some((e) => e.event === 'frozen'));
	const img = await shot(opened.page);
	bad += opened.errors.length;
	await opened.context.close();
	return img;
}

if (only.has('flash')) {
	const T = [0, 0.15, 0.3, 0.45, 0.5, 0.55, 0.7, 0.85, 1];
	for (const size of SIZES) {
		for (const dir of ['down', 'up', 'none']) {
			const cells = [];
			for (const t of T) {
				cells.push({
					img: await frozen(size, `fx=flash&bg=bright&dir=${dir}&seed=7&t=${t}`),
					label: `${dir} t=${t}`,
				});
			}
			await sheet(join(OUT, `flash-${dir}-${size}.jpg`), cells, GRID[size]);
		}
	}
}

if (only.has('peak')) {
	// The lit emblem close up: a strut and its ring nodes.
	const a1 = join(ROOT, 'cellestial-assets/images/a-loading/A1_c-emblem_lit.jpg');
	const meta = await sharp(a1).metadata();
	const side = Math.round(Math.min(meta.width, meta.height) * 0.3);
	const crop = (fx, fy) =>
		sharp(a1)
			.extract({
				left: Math.round(meta.width * fx),
				top: Math.round(meta.height * fy),
				width: side,
				height: side,
			})
			.png()
			.toBuffer();
	const cells = [
		{ img: await crop(0.18, 0.2), label: 'A1 lit, close up', enlarge: true },
		{ img: await crop(0.38, 0.55), label: 'A1 lit, close up', enlarge: true },
	];
	for (const dir of ['down', 'none']) {
		const opened = await openPage(browser, 'desk', `${PAGE}?fx=flash&bg=bright&dir=${dir}&seed=7&t=0.5`);
		await opened.page.waitForFunction(() => window.__fxDev?.log.some((e) => e.event === 'frozen'));
		cells.push({
			img: await shot(opened.page, { x: 420, y: 150, width: 600, height: 600 }),
			label: `flash ${dir} t=0.5, desktop, 600 px at full size`,
		});
		await opened.context.close();
	}
	const phone = await openPage(browser, 'phone', `${PAGE}?fx=flash&bg=bright&dir=up&seed=7&t=0.5`);
	await phone.page.waitForFunction(() => window.__fxDev?.log.some((e) => e.event === 'frozen'));
	cells.push({
		img: await shot(phone.page, { x: 0, y: 227, width: 390, height: 390 }),
		label: 'flash up t=0.5, phone, 390 px at scale 2',
	});
	await phone.context.close();
	await sheet(join(OUT, 'flash-peak.jpg'), cells, { cols: 3, cellW: 520, cellH: 520 });
}

if (only.has('impact')) {
	const T = [0, 0.1, 0.25, 0.5, 0.75, 1];
	for (const size of SIZES) {
		const cells = [];
		for (const x of [0.2, 0.5, 0.8]) {
			for (const t of T) {
				cells.push({
					img: await frozen(size, `fx=impact&bg=split&x=${x}&seed=7&t=${t}`),
					label: `x=${x} t=${t}`,
				});
			}
		}
		await sheet(
			join(OUT, `impact-${size}.jpg`),
			cells,
			size === 'desk' ? { cols: 6, cellW: 258, cellH: 162 } : { cols: 6, cellW: 258, cellH: 280 },
		);
	}
}

if (only.has('warp')) {
	const T = [0, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 1];
	for (const size of SIZES) {
		const cells = [];
		for (const bg of ['soil', 'bright']) {
			for (const t of T) {
				cells.push({
					img: await frozen(size, `fx=warp&bg=${bg}&seed=7&ms=1500&swap=0&t=${t}`),
					label: `${bg} t=${t}`,
				});
			}
		}
		await sheet(
			join(OUT, `warp-${size}.jpg`),
			cells,
			size === 'desk' ? { cols: 4, cellW: 390, cellH: 244 } : { cols: 8, cellW: 190, cellH: 412 },
		);
	}
}

if (only.has('rm')) {
	const cells = [];
	for (const size of SIZES) {
		for (const [fx, t] of [
			['flash', 0.25],
			['flash', 0.5],
			['flash', 0.75],
			['impact', 0.25],
			['warp', 0.4],
			['warp', 0.7],
		]) {
			cells.push({
				img: await frozen(size, `fx=${fx}&bg=${fx === 'impact' ? 'split' : 'bright'}&rm=1&swap=0&t=${t}`),
				label: `${size} ${fx} t=${t}, reduced motion`,
			});
		}
	}
	await sheet(join(OUT, 'rm.jpg'), cells, { cols: 6, cellW: 258, cellH: 280 });
}

if (only.has('measure')) {
	const lines = [];
	const say = (s) => {
		console.log(s);
		lines.push(s);
	};
	const frames = () => {
		window.__ft = [];
		let last = performance.now();
		const tick = (now) => {
			window.__ft.push(now - last);
			last = now;
			if (!window.__ftStop) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	};
	const stats = (ft) => {
		const a = ft.slice(1).sort((x, y) => x - y);
		if (!a.length) return 'no frames';
		const avg = a.reduce((s, v) => s + v, 0) / a.length;
		return `avg ${avg.toFixed(1)} ms, p95 ${a[Math.floor(a.length * 0.95)].toFixed(1)} ms, worst ${a[a.length - 1].toFixed(1)} ms (${a.length} frames)`;
	};
	for (const size of SIZES) {
		say(`── ${size} ──`);
		// The flash in real time, three times each way.
		for (const dir of ['down', 'up', 'none']) {
			const o = await openPage(browser, size, `${PAGE}?bg=bright`);
			const runs = [];
			for (let i = 0; i < 3; i++) {
				runs.push(
					await o.page.evaluate(async (d) => {
						const fx = window.__fx;
						const canvas = document.getElementById('fx-canvas');
						const t0 = performance.now();
						let at = 0;
						let alpha = null;
						await fx.teleportFlash(() => {
							at = performance.now() - t0;
							const g = canvas.getContext('2d');
							const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
							let min = 255;
							for (let k = 3; k < data.length; k += 4) if (data[k] < min) min = data[k];
							alpha = min;
						}, d);
						return { total: performance.now() - t0, at, alpha };
					}, dir),
				);
				await o.page.waitForTimeout(150);
			}
			say(
				`flash ${dir}: ${runs.map((r) => `${r.total.toFixed(0)} ms (swap at ${r.at.toFixed(0)}, lowest alpha on the canvas then ${r.alpha})`).join('; ')}`,
			);
			bad += o.errors.length;
			await o.context.close();
		}
		// A swap that takes time, one that takes too long, one that throws.
		{
			const o = await openPage(browser, size, `${PAGE}?bg=bright`);
			const r = await o.page.evaluate(async () => {
				const fx = window.__fx;
				const canvas = document.getElementById('fx-canvas');
				const out = {};
				const time = async (swap) => {
					const t0 = performance.now();
					let err = null;
					try {
						await fx.teleportFlash(swap, 'down');
					} catch (e) {
						err = String(e);
					}
					return { ms: Math.round(performance.now() - t0), err, on: getComputedStyle(canvas).display };
				};
				out.slow400 = await time(() => new Promise((r) => setTimeout(r, 400)));
				out.slow2000 = await time(() => new Promise((r) => setTimeout(r, 2000)));
				out.throws = await time(() => {
					throw new Error('swap failed');
				});
				const a = fx.teleportFlash(() => {}, 'up');
				const b = fx.teleportFlash(() => {}, 'down');
				const t0 = performance.now();
				await a;
				const first = Math.round(performance.now() - t0);
				await b;
				out.two = { first, both: Math.round(performance.now() - t0) };
				return out;
			});
			say(`flash with a 400 ms swap: ${r.slow400.ms} ms; with a 2 s swap: ${r.slow2000.ms} ms; with a swap that throws: ${r.throws.ms} ms, rejected with "${r.throws.err}", canvas then display:${r.throws.on}`);
			say(`two flashes asked for at once: first done at ${r.two.first} ms, both at ${r.two.both} ms`);
			bad += o.errors.length;
			await o.context.close();
		}
		// The warp in real time.
		for (const ms of [1200, 1800]) {
			const o = await openPage(browser, size, `${PAGE}?bg=bright`);
			const r = await o.page.evaluate(async (len) => {
				const canvas = document.getElementById('fx-canvas');
				const g = canvas.getContext('2d');
				const t0 = performance.now();
				const solid = [];
				let stop = false;
				const watch = () => {
					if (stop) return;
					const data = g.getImageData(0, 0, canvas.width, canvas.height).data;
					let min = 255;
					for (let k = 3; k < data.length; k += 16) if (data[k] < min) min = data[k];
					if (min === 255) solid.push(performance.now() - t0);
					requestAnimationFrame(watch);
				};
				requestAnimationFrame(watch);
				await window.__fx.warp(len);
				stop = true;
				return { total: performance.now() - t0, from: solid[0], to: solid[solid.length - 1] };
			}, ms);
			say(
				`warp ${ms}: took ${r.total.toFixed(0)} ms; fully opaque from ${r.from?.toFixed(0)} to ${r.to?.toFixed(0)} ms (the swap is at ${(ms * 0.7).toFixed(0)})`,
			);
			bad += o.errors.length;
			await o.context.close();
		}
		// At rest: frames asked for in two seconds, and what is on the canvas.
		{
			const o = await openPage(browser, size, null);
			await o.page.addInitScript(() => {
				window.__raf = 0;
				const real = window.requestAnimationFrame.bind(window);
				window.requestAnimationFrame = (fn) => {
					window.__raf++;
					return real(fn);
				};
			});
			await o.page.goto(`${PAGE}?bg=bright`, { waitUntil: 'load' });
			await o.page.waitForTimeout(1500);
			const before = await o.page.evaluate(() => window.__raf);
			await o.page.waitForTimeout(2000);
			const rest = await o.page.evaluate(() => window.__raf);
			await o.page.evaluate(async () => {
				await window.__fx.teleportFlash(() => {}, 'down');
				window.__fx.impact(200, 400);
				await window.__fx.warp(900);
				await new Promise((r) => setTimeout(r, 1200));
			});
			const mid = await o.page.evaluate(() => window.__raf);
			await o.page.waitForTimeout(2000);
			const after = await o.page.evaluate(() => {
				const r = window.__fxDev.alpha();
				return { raf: window.__raf, ...r };
			});
			say(
				`at rest: ${rest - before} frames asked for in 2 s before any effect; ${after.raf - mid} in 2 s after all three had played; canvas then on:${after.on}, highest alpha ${after.max}`,
			);
			bad += o.errors.length;
			await o.context.close();
		}
		// Frame times, and with the CPU slowed 4x.
		for (const rate of [1, 4]) {
			const o = await openPage(browser, size, `${PAGE}?bg=soil`);
			const cdp = await o.context.newCDPSession(o.page);
			await cdp.send('Emulation.setCPUThrottlingRate', { rate });
			const out = [];
			for (const [name, play] of [
				['flash', "await window.__fx.teleportFlash(() => {}, 'down')"],
				['impact', 'window.__fx.impact(innerWidth / 2, innerHeight * 0.62); await new Promise((r) => setTimeout(r, 900))'],
				['warp', 'await window.__fx.warp(1500)'],
			]) {
				await o.page.evaluate(frames);
				await o.page.evaluate(`(async () => { ${play}; window.__ftStop = true; })()`);
				out.push(`${name} ${stats(await o.page.evaluate(() => window.__ft))}`);
				await o.page.evaluate(() => {
					window.__ftStop = false;
				});
				await o.page.waitForTimeout(200);
			}
			say(`frame times, CPU x${rate}: ${out.join(' | ')}`);
			bad += o.errors.length;
			await o.context.close();
		}
	}
	writeFileSync(join(OUT, 'measure.txt'), `${lines.join('\n')}\n`);
}

await browser.close();
if (bad) {
	console.error(`${bad} page error(s)`);
	process.exit(1);
}
