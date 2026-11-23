#!/usr/bin/env node
// Round 3, piece 2: the words of the NEXT figure on a phone on its side, with motion on. Every star
// lit. The visitor is stood at Libra until its words are written, then at Virgo until its are, and
// then flies on from Virgo to Libra by real swipes: Libra's words, written already, travel with their
// figure. Read every 50 ms: how strongly Libra's words are seen and at what share of their station
// size, and how far their box is from Virgo's words while both are seen. Production build, real GPU.
//   node far-words.mjs [--sizes side,side667]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONSTELLATIONS } from '../../../../src/content/constellations.ts';
import { PROD, SIZES, launch, open, outDir, recorder, sheet, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { sizes: { type: 'string', default: 'side,side667' }, tag: { type: 'string', default: '' } } });
const tag = values.tag ? `-${values.tag}` : '';
const dir = outDir('b7');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
let fails = 0;
const all = CONSTELLATIONS.flatMap((c) => c.stars.map((s) => s.slot).filter(Boolean)).map((slot) => ({ slot, ask: 'A site for my bakery' }));
for (const size of values.sizes.split(',')) {
	const { width: W, height: H } = SIZES[size].viewport;
	const o = await open(browser, size, { init: { fn: (list) => { sessionStorage.setItem('cellestial:round', '1'); localStorage.setItem('cellestial:claims', JSON.stringify(list)); }, arg: all } });
	await o.page.goto(`${PROD}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.meaning);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await o.page.evaluate(() => document.fonts.ready);
	await sleep(1200);
	for (const k of [1, 0]) { await o.page.evaluate((i) => window.__cellestial.sky.debug.setCoord(i), k); await sleep(5000); }
	const read = () => o.page.evaluate(() => {
		const one = (name) => { const e = document.querySelector(`.sky-meaning[data-meaning="${name}"]`); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, opacity: Number(getComputedStyle(e).opacity), rel: Number(/scale\(([\d.]+)\)/.exec(e.style.transform)?.[1] ?? 0) }; };
		const st = Object.fromEntries(window.__cellestial.sky.meaning.state().map((s) => [s.name, s.state]));
		return { virgo: one('Virgo'), libra: one('Libra'), state: st, coord: window.__cellestial.sky.hooks.flight().coord };
	});
	const at0 = await read();
	say(`${size} (${W}x${H}) standing at Virgo, both written (Virgo ${at0.state.Virgo}, Libra ${at0.state.Libra}): Virgo's words ${at0.virgo ? `at ${at0.virgo.opacity}` : 'NOT SHOWN'}; Libra's ${at0.libra ? `SHOWN at ${at0.libra.opacity}, ${Math.round(at0.libra.w)}x${Math.round(at0.libra.h)}, ${at0.libra.rel} of their station size` : 'not shown'}`);
	if (!at0.virgo || at0.libra) fails++;
	const rec = await recorder(o, { quality: 85 });
	const touch = (type, x, y) => o.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
	const swipe = async (y0, y1) => { await touch('touchStart', 90, y0); for (let i = 1; i <= 10; i++) { await touch('touchMove', 90, y0 + ((y1 - y0) * i) / 10); await sleep(16); } await touch('touchEnd', 90, y1); };
	const gap = (a, b) => Math.hypot(Math.max(a.x - (b.x + b.w), 0, b.x - (a.x + a.w)), Math.max(a.y - (b.y + b.h), 0, b.y - (a.y + a.h)));
	const t0 = Date.now();
	const samples = [];
	let done = false;
	const sampler = (async () => { while (!done) { samples.push({ t: Date.now() - t0, ...(await read()) }); await sleep(50); } })();
	for (let i = 0; i < 40; i++) {
		const now = samples.at(-1);
		if (now && now.coord === 1 && now.libra && Math.abs(now.libra.rel - 1) < 0.01) break;
		// Gentle swipes, so that the visitor comes to rest at Libra and is not carried past it.
		if (!now || now.coord === 0) await swipe(H - 110, H - 200);
		await sleep(260);
	}
	await sleep(1500);
	done = true;
	await sampler;
	await rec.stop();
	const seen = samples.filter((s) => s.libra);
	const first = seen[0];
	const whole = seen.find((s) => s.libra.opacity >= 0.99);
	const both = samples.filter((s) => s.libra && s.virgo && s.libra.opacity >= 0.1 && s.virgo.opacity >= 0.1);
	const nearest = both.length ? Math.min(...both.map((s) => gap(s.libra, s.virgo))) : null;
	const end = samples.at(-1);
	say(`${size} flying on to Libra (${samples.length} readings in ${(end.t / 1000).toFixed(1)} s): Libra's words first seen at +${first ? first.t : '-'} ms at ${first ? first.libra.rel.toFixed(2) : '-'} of their station size (opacity ${first ? first.libra.opacity.toFixed(2) : '-'}); whole at +${whole ? whole.t : '-'} ms at ${whole ? whole.libra.rel.toFixed(2) : '-'}; readings with both figures' words at a tenth of their strength or more: ${both.length}${both.length ? `, the two boxes ${Math.round(nearest)} px apart at the nearest` : ''}; at the end the visitor is at station ${end.coord + 1}, Libra's words ${end.libra ? `at ${end.libra.opacity} and ${end.libra.rel.toFixed(2)} of their size` : 'NOT SHOWN'}, Virgo's ${end.virgo ? `at ${end.virgo.opacity.toFixed(2)}` : 'gone'}; console errors ${o.errors.length ? o.errors.join(' | ').slice(0, 200) : 'none'}`);
	if (!end.libra || end.libra.opacity < 0.99 || (first && first.libra.rel < 0.5)) fails++;
	const cells = [];
	const n = 16;
	const T0 = rec.frames.find((f) => f.ts >= t0)?.ts ?? t0;
	for (let i = 0; i < n; i++) { const t = T0 + (end.t * i) / (n - 1); const f = rec.at(t); if (f) cells.push({ img: f.img, label: `${size}, Virgo to Libra, +${Math.round(t - T0)} ms` }); }
	await sheet(join(dir, `far-words-${size}${tag}.jpg`), cells, { cols: 4, cellW: 390, cellH: Math.round((390 * H) / W) });
	await o.context.close();
}
writeFileSync(join(dir, `far-words${tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
if (fails) { console.log(`${fails} FAILED`); process.exit(1); }
