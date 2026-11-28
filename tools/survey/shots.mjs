// Screenshots of /survey at the owner's two sizes, the form and the closing state.
// Run: node tools/survey/shots.mjs <base url> <out dir>   (base url: a preview or the live site)
// The closing state is shown by faking only the answer from /api/survey: nothing is sent.
import { mkdir } from 'node:fs/promises';
import { launch } from '../roots/lib.mjs';

const [base = 'http://localhost:4321', out = 'refs/verification/survey'] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await launch();
for (const [w, h] of [[390, 844], [1440, 900]]) {
	const page = await browser.newPage({ viewport: { width: w, height: h } });
	const errors = [];
	page.on('pageerror', (e) => errors.push(String(e)));
	await page.route('**/api/survey', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
	await page.goto(`${base}/survey`, { waitUntil: 'load' });
	await page.waitForTimeout(2500);
	await page.screenshot({ path: `${out}/form-${w}.png`, fullPage: true });
	await page.fill('#s-business', 'TEST');
	await page.check('input[value="Mostly"]');
	for (const id of ['s-harder', 's-tell', 's-better']) await page.fill(`#${id}`, 'TEST');
	// The spam check cannot pass off the real host; let the form submit past it.
	await page.evaluate(() => document.querySelector('#survey button[type=submit]').removeAttribute('disabled'));
	await page.locator('#survey button[type=submit]').scrollIntoViewIfNeeded();
	await page.click('#survey button[type=submit]');
	await page.waitForFunction(() => !document.querySelector('[data-survey-done]').hidden);
	await page.waitForTimeout(700);
	await page.screenshot({ path: `${out}/done-${w}.png`, fullPage: true });
	console.log(w, 'errors:', errors.length ? errors : 'none');
	await page.close();
}
await browser.close();
