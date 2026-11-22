#!/usr/bin/env node
// Every request a first visit makes (production build, desktop): which hosts, which pictures.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROD, launch, open, outDir, sleep } from './lib.mjs';
const dir = outDir('owner-list');
const browser = await launch({ gpu: true });
const o = await open(browser, 'desk');
const reqs = [];
o.page.on('request', (r) => reqs.push({ url: r.url(), type: r.resourceType() }));
await o.page.goto(`${PROD}/`, { waitUntil: 'load' });
await o.page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
await sleep(2500);
const hosts = {};
for (const r of reqs) { const h = new URL(r.url).host; hosts[h] = (hosts[h] ?? 0) + 1; }
const out = [`A first visit to "/" made ${reqs.length} requests: ${Object.entries(hosts).map(([h, n]) => `${h} ${n}`).join(', ')}`, 'Pictures, media and fonts asked for:', ...reqs.filter((r) => ['image', 'media', 'font'].includes(r.type)).map((r) => `  ${r.type} ${r.url.replace(PROD, '')}`), 'From other hosts:', ...reqs.filter((r) => !r.url.startsWith(PROD)).map((r) => `  ${r.type} ${r.url.slice(0, 120)}`)];
console.log(out.join('\n'));
writeFileSync(join(dir, 'requests.txt'), `${out.join('\n')}\n`);
await browser.close();
