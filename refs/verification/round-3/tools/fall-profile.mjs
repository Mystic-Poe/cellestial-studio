#!/usr/bin/env node
// Round 2, piece 1: where the time of the fall goes. A DevTools trace of the 2.6 s after the press
// (main thread by kind of work, the compositor and GPU threads, the JS functions by self time), with
// nothing else recording. Production build, real GPU.
//   node fall-profile.mjs [--size desk] [--figs 0,7,3] [--throttle 1] [--url http://localhost:4615] [--tag name]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { PROD, frameTimes, launch, open, outDir, pnow, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { size: { type: 'string', default: 'desk' }, figs: { type: 'string', default: '0,7,3' }, throttle: { type: 'string', default: '1' }, url: { type: 'string', default: PROD }, tag: { type: 'string', default: 'profile' } } });
const NAMES = { 0: 'virgo', 7: 'aries', 3: 'sagittarius' };
const dir = outDir('fall');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
const bcdp = await browser.newBrowserCDPSession();
for (const size of values.size.split(',')) for (const fig of values.figs.split(',').map(Number)) {
	const throttle = Number(values.throttle);
	const o = await open(browser, size, { throttle, init: { fn: () => sessionStorage.setItem('cellestial:round', '1') } });
	await o.page.goto(`${values.url}/?scene=sky&debug`, { waitUntil: 'load' });
	await o.page.waitForFunction(() => window.__cellestial?.sky?.ready && window.__cellestial?.fx);
	await o.page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1200);
	await o.page.evaluate((k) => window.__cellestial.sky.debug.setCoord(k), fig);
	await sleep(2500);
	const events = [];
	bcdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
	await bcdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'gpu', 'viz', 'cc', 'disabled-by-default-v8.cpu_profiler'] } });
	const p0 = await pnow(o.page);
	await o.press('[data-descend]');
	await sleep(2600);
	const done = new Promise((r) => bcdp.once('Tracing.tracingComplete', r));
	await bcdp.send('Tracing.end');
	await done;
	bcdp.removeAllListeners('Tracing.dataCollected');
	const ft = await frameTimes(o.page, p0, p0 + 2600);
	const names = new Map();
	for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
	// self-contained totals of complete events by thread and name
	const byThread = new Map();
	for (const e of events) {
		if (e.ph !== 'X' || !e.dur) continue;
		const th = names.get(`${e.pid}:${e.tid}`) ?? '?';
		const m = byThread.get(th) ?? byThread.set(th, new Map()).get(th);
		m.set(e.name, (m.get(e.name) ?? 0) + e.dur / 1000);
	}
	say(`${size} ${NAMES[fig]} cpu x${throttle}: ${ft.text}`);
	const top = (th, names_) => {
		const m = byThread.get(th);
		if (!m) return `${th}: none`;
		const rows = names_ ? names_.map((n) => [n, m.get(n) ?? 0]) : [...m].sort((a, b) => b[1] - a[1]).slice(0, 8);
		return `${th}: ${rows.map(([n, v]) => `${n} ${v.toFixed(0)}`).join(', ')}`;
	};
	say(`  ms in 2.6 s, ${top('CrRendererMain', ['RunTask', 'FireAnimationFrame', 'FunctionCall', 'EvaluateScript', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'MajorGC', 'MinorGC', 'V8.GC_SCAVENGER', 'DecodeImage', 'Decode Image', 'EventDispatch'])}`);
	for (const th of ['Compositor', 'CrGpuMain', 'VizCompositorThread']) say(`  ${top(th)}`);
	// JS self time from the sampling profile
	const nodes = new Map();
	const self = new Map();
	for (const e of events) {
		if (e.name !== 'ProfileChunk') continue;
		const cp = e.args.data.cpuProfile;
		for (const n of cp?.nodes ?? []) nodes.set(n.id, n);
		const ds = e.args.data.timeDeltas ?? [];
		(cp?.samples ?? []).forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (ds[i] ?? 0) / 1000));
	}
	const fn = new Map();
	for (const [id, ms] of self) {
		const n = nodes.get(id);
		if (!n) continue;
		const f = n.callFrame;
		const key = `${f.functionName || '(anon)'}${f.url ? `@${f.url.split('/').pop().slice(0, 28)}:${f.lineNumber}:${f.columnNumber}` : ''}`;
		fn.set(key, (fn.get(key) ?? 0) + ms);
	}
	say(`  JS self ms: ${[...fn].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}`);
	// long tasks: what was in each main-thread task over 30 ms
	const long = events.filter((e) => e.ph === 'X' && e.name === 'RunTask' && e.dur > 30000 && names.get(`${e.pid}:${e.tid}`) === 'CrRendererMain');
	for (const t of long.slice(0, 6)) {
		const inside = events.filter((e) => e.ph === 'X' && e.pid === t.pid && e.tid === t.tid && e.ts >= t.ts && e.ts + (e.dur ?? 0) <= t.ts + t.dur && e !== t && e.dur > 3000);
		say(`  long task ${(t.dur / 1000).toFixed(0)} ms: ${inside.map((e) => `${e.name} ${(e.dur / 1000).toFixed(0)}`).slice(0, 12).join(', ')}`);
	}
	await o.context.close();
}
writeFileSync(join(dir, `${values.tag}.txt`), `${log.join('\n')}\n`);
await browser.close();
