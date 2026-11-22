#!/usr/bin/env node
// The loader's length on the visitor's own clock (from navigation, not from the loader's mount), phone
// profile, production build, real GPU: unslowed, CPU 4x, slow 4G (1.6 Mbit/s down, 750 kbit/s up, 150 ms),
// and both. Three first visits each (a fresh context, nothing cached), then one same-session reload.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const dir = outDir('loader');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: true });
for (const [name, throttle, net] of [['unslowed', 1, false], ['CPU 4x', 4, false], ['slow 4G', 1, true], ['CPU 4x and slow 4G', 4, true]]) {
	const times = [];
	let reload = null, fp = null;
	for (let run = 0; run < 3; run++) {
		const o = await open(browser, 'phone', { throttle });
		if (net) { await o.cdp.send('Network.enable'); await o.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); }
		const t0 = Date.now();
		await o.page.goto(`${PROD}/`, { waitUntil: 'commit' });
		await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 90000 });
		times.push(Date.now() - t0);
		fp = await o.page.evaluate(() => Math.round(performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime ?? -1));
		if (run === 2) {
			await sleep(1500);
			const t1 = Date.now();
			await o.page.reload({ waitUntil: 'commit' });
			await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 90000 });
			reload = Date.now() - t1;
		}
		await o.context.close();
	}
	say(`phone, ${name}: navigation to the sky ${times.map((t) => (t / 1000).toFixed(2)).join(', ')} s (first paint at ${fp} ms on the last); same-session reload to the sky ${(reload / 1000).toFixed(2)} s`);
}
writeFileSync(join(dir, 'clock-from-navigation.txt'), `${log.join('\n')}\n`);
await browser.close();
