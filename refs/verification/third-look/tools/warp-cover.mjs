// Round 2, piece 5 (the close-out): why did the warp's cover read alpha 247, not 255, in the frame the
// page became the sky, in one of four software runs with the CPU slowed 4x (tools/transitions/measure.mjs)?
//
// The same scenario as that check, many times, with the page keeping three clocks for the swap's frame:
//   T      the time the browser gave that animation frame (what the effects layer draws the warp at)
//   now    performance.now() when the scene became "sky" (the director decides on performance.now())
//   t0fx   performance.now() when fx.warp() returned (the warp's own start)
// and reading the effects canvas once that frame's drawing is done, as the suite does. From these: how
// far the warp was (u = (T - t0fx) / 1500) when the director took the cover to be whole, and how late
// the director's callback ran in its frame (now - T). The cover is whole for u from 0.64 to 0.76.
//
//   node warp-cover.mjs [--url http://localhost:4615] [--runs 24] [--throttle 4] [--gpu] [--size desk] [--from 1800] [--trace] [--label x]
// --trace prints, for the first run and for every run whose cover was not whole, the last things done
// to the effects canvas before it was read (each frame's time, each black fill and its alpha, each
// change of the canvas's size), in ms from the warp's own start.
// Writes refs/verification/third-look/warp/warp-cover[-<label>].txt (appends nothing: one file a run).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { launch, outDir, PROD, SIZES } from './lib.mjs';

const { values } = parseArgs({
	options: {
		url: { type: 'string', default: PROD },
		runs: { type: 'string', default: '24' },
		throttle: { type: 'string', default: '4' },
		gpu: { type: 'boolean', default: false },
		size: { type: 'string', default: 'desk' },
		from: { type: 'string', default: '1800' },
		label: { type: 'string', default: '' },
		trace: { type: 'boolean', default: false },
	},
});
const RUNS = Number(values.runs);
const RATE = Number(values.throttle);
const FROM = Number(values.from);
const dir = outDir('warp');
const lines = [];
const say = (s) => {
	console.log(s);
	lines.push(s);
};

/** In the page, before its scripts. */
function probe() {
	sessionStorage.setItem('cellestial:round', '1');
	const rec = { T: 0, warpAt: null, skyAt: null, skyT: null, cover: null, t0fx: null, frames: [], trace: [], inFrame: false };
	window.__w = rec;
	// --trace: what was done to the effects canvas, and when (the black of the cover, a change of size).
	const note = (what) => rec.warpAt !== null && rec.cover === null && rec.trace.push({ at: performance.now(), ...what });
	const fillRect = CanvasRenderingContext2D.prototype.fillRect;
	CanvasRenderingContext2D.prototype.fillRect = function (...a) {
		if (this.canvas.id === 'fx-canvas' && this.fillStyle === '#000000') note({ black: this.globalAlpha });
		return fillRect.apply(this, a);
	};
	const width = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
	Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
		...width,
		set(v) {
			if (this.id === 'fx-canvas') note({ width: v, was: this.width });
			width.set.call(this, v);
		},
	});
	const tick = (t) => {
		rec.T = t;
		rec.inFrame = true;
		note({ frame: t });
		const end = new MessageChannel();
		end.port1.onmessage = () => {
			rec.inFrame = false;
		};
		end.port2.postMessage(0);
		if (rec.warpAt !== null && rec.skyAt === null) rec.frames.push({ T: t, at: performance.now() });
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	document.addEventListener('cellestial:scene', (e) => {
		if (e.detail.to === 'warp') rec.warpAt = performance.now();
		if (e.detail.to === 'sky' && e.detail.from === 'warp') {
			rec.skyAt = performance.now();
			rec.skyT = rec.T;
			note({ sky: rec.inFrame ? 'in a frame' : 'NOT in a frame' });
			const lowest = () => {
				const c = document.getElementById('fx-canvas');
				let min = 255;
				if (c.width && getComputedStyle(c).display !== 'none') {
					const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
					for (let k = 3; k < d.length; k += 16) if (d[k] < min) min = d[k];
				} else min = 0;
				return min;
			};
			// The suite's way: a posted message. It waits its turn behind any timer that is already due.
			const ch = new MessageChannel();
			ch.port1.onmessage = () => {
				const min = lowest();
				note({ read: min });
				rec.cover = min;
			};
			ch.port2.postMessage(0);
			// A task the browser runs before timers: the canvas as that frame left it.
			scheduler.postTask(
				() => {
					rec.first = lowest();
					note({ readFirst: rec.first });
				},
				{ priority: 'user-blocking' },
			);
		}
	});
}

say(`${values.url}, ${values.size}, from scrollY ${FROM}, ${values.gpu ? 'real GPU' : 'software'}, CPU slowed ${RATE}x, ${RUNS} runs`);
say('run  cover  u at the swap  director late in its frame  fx started after the scene  frame before the swap');
const browser = await launch({ gpu: values.gpu });
let bad = 0;
let badFirst = 0;
const rows = [];
for (let k = 0; k < RUNS; k++) {
	const context = await browser.newContext({ ...SIZES[values.size] });
	const page = await context.newPage();
	await page.addInitScript(probe);
	await page.goto(`${values.url}/?scene=roots&debug`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.fx);
	await page.evaluate(async () => {
		await window.__cellestial.sky.ready;
		await document.fonts.ready;
		const { fx } = window.__cellestial;
		const warp = fx.warp.bind(fx);
		fx.warp = (ms) => {
			const p = warp(ms);
			window.__w.t0fx = performance.now();
			return p;
		};
	});
	if (RATE > 1) {
		const cdp = await context.newCDPSession(page);
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
	}
	await page.evaluate((y) => window.scrollTo(0, y), FROM);
	await page.waitForTimeout(200);
	await page.evaluate(
		() =>
			new Promise((resolve) => {
				const d = window.__cellestial.director;
				const press = () => document.querySelector('[data-ascend]').click();
				press();
				setTimeout(press, 300);
				setTimeout(() => d.go('build'), 500);
				setTimeout(() => d.descend(), 1200);
				const poll = () => (d.scene === 'sky' && document.activeElement?.id === 'sky-ui' ? resolve() : setTimeout(poll, 16));
				setTimeout(poll, 100);
			}),
	);
	await page.waitForTimeout(300);
	const r = await page.evaluate(() => window.__w);
	const u = (r.skyT - r.t0fx) / 1500;
	const late = r.skyAt - r.skyT;
	const lastGap = r.frames.length > 1 ? r.frames.at(-1).T - r.frames.at(-2).T : 0;
	const row = { cover: r.cover, u, late, fxAfter: r.t0fx - r.warpAt, lastGap, swapAt: r.skyAt - r.warpAt };
	rows.push(row);
	if (r.cover !== 255) bad++;
	if (r.first !== 255) badFirst++;
	say(
		`${String(k + 1).padStart(3)}  ${String(r.cover).padStart(5)}  ${u.toFixed(3).padStart(13)}  ${late.toFixed(1).padStart(23)} ms  ${row.fxAfter.toFixed(1).padStart(23)} ms  ${lastGap.toFixed(0).padStart(18)} ms   read before any timer: ${r.first}${r.cover !== 255 ? '   <-- not whole' : ''}`,
	);
	if (values.trace && (r.cover !== 255 || k === 0)) {
		// The last things done to the effects canvas before it was read, times from the warp's own start.
		for (const e of r.trace.slice(-14)) {
			const { at, ...what } = e;
			say(`       ${(at - r.t0fx).toFixed(1).padStart(7)} ms  ${JSON.stringify(what)}`);
		}
	}
	await context.close();
}
await browser.close();
const whole = rows.filter((r) => r.cover === 255);
const holed = rows.filter((r) => r.cover !== 255);
const range = (list, f) => (list.length ? `${Math.min(...list.map(f)).toFixed(3)} to ${Math.max(...list.map(f)).toFixed(3)}` : 'none');
say('');
say(`cover not whole in ${bad} of ${RUNS} runs, read by a posted message (the suite's way until 22 Nov)`);
say(`cover not whole in ${badFirst} of ${RUNS} runs, read by a task that runs before any timer (the canvas as the swap's frame left it)`);
say(`u at the swap where the cover was whole: ${range(whole, (r) => r.u)}; where it was not: ${range(holed, (r) => r.u)} (the cover is whole from 0.640)`);
say(`the director's callback ran this long after its frame's own time: whole ${range(whole, (r) => r.late)} ms; not whole ${range(holed, (r) => r.late)} ms`);
say(`the scene became the sky this long after it became the warp: ${range(rows, (r) => r.swapAt)} ms (the director swaps from 990 ms on its own clock)`);
const name = `warp-cover${values.label ? `-${values.label}` : ''}.txt`;
writeFileSync(join(dir, name), `${lines.join('\n')}\n`);
console.log(`written to ${join(dir, name)}`);
