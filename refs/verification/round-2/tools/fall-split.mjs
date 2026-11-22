#!/usr/bin/env node
// Round 2, piece 1: which part of the fall costs the frames. The same fall with parts of it switched
// off in the page (the bursts: fx.impact does nothing; the growth: roots.growFrom does nothing), with
// the main thread's script and layout time from a DevTools trace (fall-profile.mjs has the GPU process's). Production build, real GPU.
//   node fall-split.mjs [--size desk] [--fig 0] [--url http://localhost:4615] [--tag split] [--modes all,nofx,nogrow,neither]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, frameTimes, launch, open, outDir, pnow, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, fig: { type: 'string', default: '0' }, url: { type: 'string', default: PROD }, tag: { type: 'string', default: 'split' }, modes: { type: 'string', default: 'all,nofx,nogrow,neither' }, trace: { type: 'string', default: '1' } } });
const dir = outDir('fall');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const bcdp = await browser.newBrowserCDPSession();
for (const size of values.size.split(',')) for (const fig of values.fig.split(',').map(Number)) for (const mode of values.modes.split(',')) {
	const o = await open(browser, size, { init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1200);
	await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
	await sleep(2500);
	await o.page.evaluate((m) => {
		const c = window.__cellestial;
		if (m === 'nofx' || m === 'neither') c.fx.impact = () => {};
		if (m === 'nogrow' || m === 'neither') c.roots.growFrom = () => Promise.resolve();
	}, mode);
	const events = [];
	const trace = values.trace === '1';
	if (trace) {
		bcdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
		await bcdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'gpu', 'toplevel'] } });
	}
	const p0 = await pnow(o.page);
	await o.press('[data-descend]');
	await sleep(2600);
	if (trace) {
		const done = new Promise((r) => bcdp.once('Tracing.tracingComplete', r));
		await bcdp.send('Tracing.end');
		await done;
		bcdp.removeAllListeners('Tracing.dataCollected');
	}
	const ft = await frameTimes(o.page, p0, p0 + 2600);
	const q = await o.page.evaluate(() => window.__cellestial.sky.debug.stats().quality.level).catch(() => '?');
	const names = new Map();
	for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
	const sum = (th, name) => events.filter((e) => e.ph === 'X' && e.name === name && names.get(`${e.pid}:${e.tid}`) === th).reduce((a, e) => a + e.dur / 1000, 0);
	say(`${size} fig ${fig} ${mode}: ${ft.text}; governor ${q}${trace ? `; in the page's main thread: script (FunctionCall) ${sum('CrRendererMain', 'FunctionCall').toFixed(0)} ms, layout and style ${(sum('CrRendererMain', 'Layout') + sum('CrRendererMain', 'UpdateLayoutTree')).toFixed(0)} ms` : ''}`);
	await o.context.close();
}
writeFileSync(join(dir, `${values.tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
