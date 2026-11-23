#!/usr/bin/env node
// Round 2, piece 1: how many canvas operations each frame of the fall issues, by canvas (the effects
// canvas "fx", the Roots' band canvases on the page "band…", their scratch canvases "off…").
//   node fall-ops.mjs [figure 0..11] [url] [desk|phone]
import { PROD, frameTimes, launch, open, pnow, sleep } from './lib.mjs';
const fig = Number(process.argv[2] ?? 0);
const url = process.argv[3] ?? PROD;
const size = process.argv[4] ?? 'desk';
const browser = await launch({ gpu: true });
const o = await open(browser, size, { init: { fn: () => {
	sessionStorage.setItem('cellestial:round', '1');
	const P = CanvasRenderingContext2D.prototype;
	window.__ops = []; let cur = null; let t0 = 0;
	const kind = (c) => c.id === 'fx-canvas' ? 'fx' : (c.isConnected ? `band${c.width}x${c.height}` : `off${c.width}x${c.height}`);
	const bump = (ctx, what, n = 1) => { if (!cur) return; const k = `${kind(ctx.canvas)}.${what}`; cur[k] = (cur[k] ?? 0) + n; };
	for (const m of ['stroke', 'drawImage', 'fillRect', 'lineTo', 'fill', 'clearRect', 'createRadialGradient', 'createLinearGradient']) { const f = P[m]; P[m] = function (...a) { bump(this, m); return f.apply(this, a); }; }
	const tick = (t) => { if (cur) window.__ops.push(cur); cur = { t }; requestAnimationFrame(tick); };
	requestAnimationFrame(tick);
} } });
await o.page.goto(`${url}/?scene=sky&debug`, { waitUntil: 'load' });
await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
await o.page.evaluate(() => window.__cellestial.sky.ready);
await sleep(1200);
await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
await sleep(2500);
const p0 = await pnow(o.page);
await o.press('[data-descend]');
await sleep(3200);
const ops = await o.page.evaluate((p) => window.__ops.filter((f) => f.t >= p && f.t <= p + 3000).map((f) => ({ ...f, t: Math.round(f.t - p) })), p0);
const keys = [...new Set(ops.flatMap((f) => Object.keys(f)))].filter((k) => k !== 't').sort();
console.log('stats', JSON.stringify(await o.page.evaluate(() => window.__cellestial.roots.debug?.state?.())).slice(0, 300));
for (const k of keys) { const v = ops.map((f) => f[k] ?? 0); console.log(k.padEnd(34), 'total', String(v.reduce((a, b) => a + b, 0)).padStart(7), 'max/frame', String(Math.max(...v)).padStart(5)); }
// per 200 ms: strokes on fx, strokes elsewhere
for (let t = 0; t < 3000; t += 200) { const fr = ops.filter((f) => f.t >= t && f.t < t + 200); const s = (pred) => Math.round(fr.reduce((a, f) => a + Object.entries(f).filter(([k]) => pred(k)).reduce((x, [, v]) => x + v, 0), 0) / Math.max(1, fr.length)); console.log(`+${t}: frames ${fr.length}, per frame: fx strokes ${s((k) => k === 'fx.stroke')}, fx drawImage ${s((k) => k === 'fx.drawImage')}, roots strokes ${s((k) => k.endsWith('.stroke') && !k.startsWith('fx'))}, roots lineTo ${s((k) => k.endsWith('.lineTo') && !k.startsWith('fx'))}, roots drawImage ${s((k) => k.endsWith('.drawImage') && !k.startsWith('fx'))}, roots fillRect ${s((k) => k.endsWith('.fillRect') && !k.startsWith('fx'))}`); }
await browser.close();
