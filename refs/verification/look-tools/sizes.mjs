#!/usr/bin/env node
// Sizes of the Roots' and the Close's controls at both judged sizes (look lens). Appends to matrix/numbers.txt.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, launch, openPage } from '../../../tools/roots/lib.mjs';
const url = process.argv[2] ?? 'http://localhost:4612';
const browser = await launch({ gpu: true });
const lines = ['', 'ROOTS AND CLOSE: sizes of the controls (CSS px)'];
for (const size of ['desk', 'phone']) {
	const o = await openPage(browser, size, `${url}/?scene=roots&debug`);
	await o.page.waitForTimeout(2500);
	const r = await o.page.evaluate(() => {
		const box = (el) => { const b = el.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; };
		const f1 = document.querySelector('[data-open-claim]'), f2 = document.querySelector('[data-open-contact]');
		const a = f1.getBoundingClientRect(), b = f2.getBoundingClientRect();
		return { e6: box(document.querySelector('[data-ascend]')), bulbs: [...document.querySelectorAll('.roots-stop button')].slice(0, 5).map(box).join(' '), f1: box(f1), f2: box(f2), gap: Math.round(b.top - a.bottom), f1Font: getComputedStyle(f1).fontSize, f2Font: getComputedStyle(f2).fontSize, centred: Math.round(a.left + a.width / 2 - innerWidth / 2) };
	});
	lines.push(`${size}: E6 ${r.e6}; node buttons ${r.bulbs}; F1 ${r.f1} (${r.f1Font}), ${r.centred} px off centre; F2 ${r.f2} (${r.f2Font}), ${r.gap} px under F1`);
	await o.context.close();
}
await browser.close();
console.log(lines.join('\n'));
appendFileSync(join(ROOT, 'refs/verification/matrix/numbers.txt'), `${lines.join('\n')}\n`);
