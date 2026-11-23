#!/usr/bin/env node
// The fourth look's own, part 3: the business pages on the production build. /contact: the form, its
// fields, its spam check (Turnstile's slot and site key) and where it posts; /start with a deep link (the
// client's details in the fragment, built with the repo's own encoder): does the flow it names open;
// /start with no link; /start/new: the builder's fields; /admin/: what it loads. No GPU needed.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeConfig } from '../../../../src/onboard/link.ts';
import { PROD, launch, outDir } from './lib.mjs';
const dir = outDir('business');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const browser = await launch({ gpu: false });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`${e}`));
for (const path of ['/', '/contact', '/start', '/start/new', '/admin/']) { const r = await page.request.get(`${PROD}${path}`); say(`${path}: ${r.status()} ${r.headers()['content-type'] ?? ''}`); }
await page.goto(`${PROD}/contact`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
say(`/contact: ${JSON.stringify(await page.evaluate(() => { const f = document.querySelector('form'); return f ? { action: f.getAttribute('action'), method: f.getAttribute('method'), fields: [...f.querySelectorAll('input, textarea, select')].map((e) => `${e.tagName.toLowerCase()}[name=${e.getAttribute('name')}${e.type ? `, type=${e.type}` : ''}${e.required ? ', required' : ''}]`), turnstileSlot: !!f.querySelector('.cf-turnstile, [data-turnstile-slot]'), siteKey: f.querySelector('[data-sitekey]')?.getAttribute('data-sitekey') ?? document.querySelector('[data-sitekey], [data-turnstile-sitekey]')?.outerHTML.slice(0, 160) ?? null, turnstileFrame: !!document.querySelector('iframe[src*="challenges.cloudflare.com"]'), send: f.querySelector('button[type=submit], button:not([type])')?.textContent.trim() } : 'NO FORM'; }))}`);
await page.screenshot({ path: join(dir, 'contact.jpg'), type: 'jpeg', quality: 80 });
const cfg = { v: 1, n: 'Maple Street Bakery', e: 'owner@maplestreetbakery.example', d: 'maplestreetbakery.example', l: 'g', t: 1, m: 'test' };
await page.goto(`${PROD}/start#${encodeConfig(cfg)}`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const flow = await page.evaluate(() => document.querySelector('[data-flow]')?.innerText ?? 'NO FLOW');
say(`/start with a deep link for "Maple Street Bakery", maplestreetbakery.example, the Google lane, tier 1, test: names the business ${flow.includes('Maple Street Bakery')}, the domain ${flow.includes('maplestreetbakery.example')}; the flow's first lines: ${JSON.stringify(flow.split('\n').filter(Boolean).slice(0, 8))}`);
await page.screenshot({ path: join(dir, 'start-link.jpg'), type: 'jpeg', quality: 80 });
const cfg2 = { ...cfg, n: 'Northside Plumbing', d: 'northsideplumbing.example', e: 'hi@northsideplumbing.example', l: 'ms', t: 2, m: 'person' };
await page.goto(`${PROD}/start#${encodeConfig(cfg2)}`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
const flow2 = await page.evaluate(() => document.querySelector('[data-flow]')?.innerText ?? 'NO FLOW');
say(`/start with another link (Northside Plumbing, the Microsoft lane, tier 2, in person): names the business ${flow2.includes('Northside Plumbing')}; first lines: ${JSON.stringify(flow2.split('\n').filter(Boolean).slice(0, 6))}`);
await page.goto(`${PROD}/start`, { waitUntil: 'load' });
await page.waitForTimeout(800);
say(`/start with no link: ${JSON.stringify((await page.evaluate(() => document.querySelector('[data-flow]')?.innerText ?? 'NO FLOW')).split('\n').filter(Boolean).slice(0, 4))}`);
await page.goto(`${PROD}/start/new`, { waitUntil: 'load' });
await page.waitForTimeout(800);
say(`/start/new: fields ${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')].map((e) => e.getAttribute('name') ?? e.id)))}`);
await page.goto(`${PROD}/admin/`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
say(`/admin/: title ${JSON.stringify(await page.title())}; scripts ${JSON.stringify(await page.evaluate(() => [...document.scripts].map((s) => s.src).filter(Boolean)))}; body text ${JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 120))}`);
say(`page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
writeFileSync(join(dir, 'business.txt'), `${log.join('\n')}\n`);
await browser.close();
