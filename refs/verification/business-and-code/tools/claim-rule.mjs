// The claim rule, end to end, on the home page of the production build.
// Run: node refs/verification/business-and-code/tools/claim-rule.mjs
import path from 'node:path';
import { BASE, check, DESK, launch, note, openPage, PHONE, SHOTS, sleep, tally } from './lib.mjs';

const STAR = 'slot-34'; // Virgo: on screen at the opening pose
const NEXT = 'slot-3';
const HTML_ASK =
	'<img src=x onerror="window.__xss=1"><script>window.__xss=2</script><b>bold</b> & "a quote"\nsecond line   with   spaces';
const star = (slot) => `#sky-ui .sky-star[data-slot="${slot}"]`;
const browser = await launch();

const state = (page) =>
	page.evaluate(() => {
		const c = window.__cellestial;
		return {
			scene: document.documentElement.dataset.scene,
			lit: [...c.claims.all().keys()],
			picked: c.claims.picked(),
			unplaced: c.claims.unplaced(),
			stored: localStorage.getItem('cellestial:claims'),
			storedUnplaced: localStorage.getItem('cellestial:unplaced'),
			skyLit: c.sky ? [...Array(146)].map((_, i) => `slot-${i + 1}`).filter((s) => c.sky.hooks.isLit(s)) : null,
		};
	});
async function ready(page, url = '/?scene=sky&debug') {
	await page.goto(BASE + url, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__cellestial?.sky && window.__cellestial?.roots && window.__cellestial?.claimFlow, null, { timeout: 20000 });
	await page.evaluate(() => window.__cellestial.sky.ready);
	await sleep(1500);
}
async function fillClaim(page, ask) {
	await page.fill('#claim-form-name', 'Test Visitor');
	await page.fill('#claim-form-email', 'visitor@example.com');
	await page.fill('#claim-form-message', ask);
}
const pick = async (page, slot, touch) => (touch ? page.tap(star(slot)) : page.click(star(slot)));

for (const [name, size] of [['desk', DESK], ['phone', PHONE]]) {
	const touch = name === 'phone';
	console.log(`\n# ${name}`);

	// ── 1. no send, no claim ──
	{
		console.log('\n## 1. no send, no claim');
		const { context, page, errors, posts } = await openPage(browser, size, { stub: { status: 200, json: { ok: true } } });
		await ready(page);
		let s = await state(page);
		check(s.lit.length === 0 && s.skyLit.length === 0, 'the sky starts empty: no star lit', JSON.stringify(s.lit));
		await pick(page, STAR, touch);
		await sleep(600);
		s = await state(page);
		check(s.picked === STAR && s.lit.length === 0, 'picking an empty star claims nothing', JSON.stringify(s));
		const panel = await page.evaluate(() => {
			const p = document.querySelector('[data-sky-panel="empty"]');
			return { hidden: p.hidden, text: p.innerText };
		});
		check(!panel.hidden, 'the empty-star panel is open');
		note(`empty-star panel reads: ${JSON.stringify(panel.text)}`);
		await page.screenshot({ path: path.join(SHOTS, `claim-${name}-1-panel.png`) });
		await page.click('#sky-ui [data-sky-claim]');
		await page.waitForSelector('#claim-dialog[open]');
		await fillClaim(page, 'An ask that is typed and never sent.');
		check((await page.inputValue('#claim-form [data-star-input]')) === STAR, 'the hidden star field carries the picked star', await page.inputValue('#claim-form [data-star-input]'));
		await page.keyboard.press('Escape');
		await sleep(400);
		s = await state(page);
		check(s.lit.length === 0 && s.stored === null && s.unplaced === null && posts.length === 0, 'the dialog closed without Send: nothing claimed, nothing stored, nothing posted', JSON.stringify(s));
		await page.reload({ waitUntil: 'load' });
		await page.waitForFunction(() => window.__cellestial?.sky, null, { timeout: 20000 });
		await page.evaluate(() => window.__cellestial.sky.ready);
		await sleep(1200);
		s = await state(page);
		check(s.lit.length === 0 && s.skyLit.length === 0, 'after a reload: still nothing lit');
		check(errors.length === 0, 'no console errors', errors.join(' | '));
		await context.close();
	}

	// ── 2. a 400 lights nothing; then a 200 lights the chosen star, and it survives a reload ──
	{
		console.log('\n## 2. 400 lights nothing; 200 lights the chosen star; reload');
		const { context, page, errors, posts, setStub } = await openPage(browser, size, { stub: { status: 400, json: { error: 'The spam check did not pass. Please try again.' } } });
		await ready(page);
		await pick(page, STAR, touch);
		await sleep(500);
		await page.click('#sky-ui [data-sky-claim]');
		await page.waitForSelector('#claim-dialog[open]');
		await fillClaim(page, HTML_ASK);
		await page.click('#claim-form button[type="submit"]');
		await page.waitForFunction(() => /did not/.test(document.querySelector('#claim-form [data-status]').textContent), null, { timeout: 8000 });
		await sleep(1800);
		let s = await state(page);
		check(posts.length === 1, '400: the request was posted once');
		check(s.lit.length === 0 && s.skyLit.length === 0 && s.stored === null && s.unplaced === null && s.storedUnplaced === null, '400: nothing lit, nothing waiting, nothing stored', JSON.stringify(s));
		check(await page.evaluate(() => document.querySelector('#claim-dialog').open), '400: the dialog is still open with the error');
		await page.screenshot({ path: path.join(SHOTS, `claim-${name}-2-400.png`) });

		// The same form, sent again, now answered 200.
		await setStub({ status: 200, json: { ok: true } });
		await page.click('#claim-form button[type="submit"]');
		await page.waitForFunction(() => /Sent/.test(document.querySelector('#claim-form [data-status]').textContent), null, { timeout: 8000 });
		s = await state(page);
		check(s.lit.length === 1 && s.lit[0] === STAR, '200: the chosen star, and only it, is lit', JSON.stringify(s.lit));
		const sent = Object.fromEntries(posts[1]?.fields ?? []);
		note(`posted: ${JSON.stringify(Object.keys(sent))}; star=${sent.star}`);
		check(sent.star === STAR, '200: the star field posted is the chosen star');
		check(sent.message?.replace(/\r\n/g, '\n') === HTML_ASK, '200: the message posted is exactly the ask (nothing added)', JSON.stringify(sent.message));
		check(Object.keys(sent).every((k) => ['name', 'email', 'message', 'star', 'cf-turnstile-response'].includes(k)), '200: no other field posted', Object.keys(sent).join(','));
		// The dialog closes, the camera flies to the star, the lit panel opens.
		await page.waitForFunction(() => !document.querySelector('[data-sky-panel="lit"]').hidden, null, { timeout: 12000 }).catch(() => {});
		await sleep(800);
		const lit = await page.evaluate(() => {
			const p = document.querySelector('[data-sky-panel="lit"]');
			const ask = p.querySelector('[data-sky-ask]');
			return {
				hidden: p.hidden,
				askText: ask.textContent,
				askChildren: ask.childElementCount,
				panelInnerText: p.innerText,
				panelElements: [...p.querySelectorAll('*')].map((e) => e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? `[aria-label=${e.getAttribute('aria-label')}]` : '')),
				xss: window.__xss ?? null,
				imgs: p.querySelectorAll('img, script, b').length,
			};
		});
		check(!lit.hidden, 'the lit-star panel opened by itself after the send');
		check(lit.askText === HTML_ASK, 'the lit star shows exactly the ask, character for character', JSON.stringify(lit.askText));
		check(lit.askChildren === 0 && lit.imgs === 0 && lit.xss === null, 'the HTML in the ask is shown as text: no element made, no script run', JSON.stringify({ children: lit.askChildren, xss: lit.xss }));
		check(lit.panelInnerText.trim() === HTML_ASK.trim() || lit.panelInnerText.replace(/\s+/g, ' ').trim() === HTML_ASK.replace(/\s+/g, ' ').trim(), 'the panel shows nothing else: no name, no email, no label', JSON.stringify(lit.panelInnerText));
		note(`lit panel elements: ${lit.panelElements.join(', ')}`);
		await page.screenshot({ path: path.join(SHOTS, `claim-${name}-3-lit.png`) });
		s = await state(page);
		note(`localStorage cellestial:claims = ${s.stored}`);
		check(!/Test Visitor|visitor@example/.test(JSON.stringify(await page.evaluate(() => ({ ...localStorage, ...sessionStorage })))), 'neither name nor email is stored on the device');

		// Reload, with no stub at all: the star must still be lit.
		await setStub(undefined);
		await page.reload({ waitUntil: 'load' });
		await page.waitForFunction(() => window.__cellestial?.sky, null, { timeout: 20000 });
		await page.evaluate(() => window.__cellestial.sky.ready);
		await sleep(1500);
		s = await state(page);
		check(s.lit.length === 1 && s.lit[0] === STAR && s.skyLit.includes(STAR), 'after a reload the star is still lit (store and sky)', JSON.stringify({ lit: s.lit, sky: s.skyLit }));
		const label = await page.getAttribute(star(STAR), 'aria-label');
		note(`its button is named: ${label}`);
		await pick(page, STAR, touch);
		await page.waitForFunction(() => !document.querySelector('[data-sky-panel="lit"]').hidden, null, { timeout: 8000 }).catch(() => {});
		await sleep(500);
		check((await page.evaluate(() => document.querySelector('[data-sky-ask]').textContent)) === HTML_ASK, 'after a reload, clicking the lit star shows the same ask');
		await page.screenshot({ path: path.join(SHOTS, `claim-${name}-4-reloaded.png`) });
		// A second visit in a new tab of the same browser profile.
		const tab = await context.newPage();
		await tab.goto(`${BASE}/?scene=sky&debug`, { waitUntil: 'load' });
		await tab.waitForFunction(() => window.__cellestial?.sky, null, { timeout: 20000 });
		check(await tab.evaluate((slot) => window.__cellestial.claims.isLit(slot), STAR), 'a new tab of the same browser also has it lit');
		// A lit star cannot be claimed again.
		await tab.evaluate((slot) => window.__cellestial.claimFlow.openClaim(slot), STAR);
		await sleep(300);
		check((await tab.inputValue('#claim-form [data-star-input]')) === '', 'asking to claim a lit star opens the request with no star');
		const real = errors.filter((e) => !/400/.test(e));
		check(real.length === 0, 'no console errors but the stubbed 400', errors.join(' | '));
		await context.close();
	}

	// ── 3. a send with no star chosen: the ask waits, and the next empty star clicked takes it ──
	{
		console.log('\n## 3. sent with no star: the ask waits, the next empty star takes it');
		const { context, page, errors, posts } = await openPage(browser, size, { stub: { status: 200, json: { ok: true } } });
		await ready(page, '/?scene=roots&debug');
		await page.click('#roots [data-open-claim]');
		await page.waitForSelector('#claim-dialog[open]');
		check((await page.inputValue('#claim-form [data-star-input]')) === '', 'from F1 with nothing picked, the star field is empty');
		await fillClaim(page, 'A booking system for my salon.');
		await page.click('#claim-form button[type="submit"]');
		await page.waitForFunction(() => /Sent/.test(document.querySelector('#claim-form [data-status]').textContent), null, { timeout: 8000 });
		let s = await state(page);
		check(s.lit.length === 0 && s.unplaced === 'A booking system for my salon.', 'no star lit; the ask is waiting', JSON.stringify(s));
		check(Object.fromEntries(posts[0].fields).star === '', 'the star field was posted empty');
		// The dialog closes and the visitor is taken to the sky to choose.
		await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 12000 }).catch(() => {});
		await sleep(2500);
		s = await state(page);
		check(s.scene === 'sky', 'the visitor is taken to the sky', s.scene);
		await page.screenshot({ path: path.join(SHOTS, `claim-${name}-5-waiting.png`) });
		// Survives a reload while waiting.
		await page.reload({ waitUntil: 'load' });
		await page.waitForFunction(() => window.__cellestial?.sky, null, { timeout: 20000 });
		await page.evaluate(() => window.__cellestial.sky.ready);
		await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 15000 });
		await sleep(2500);
		s = await state(page);
		check(s.unplaced === 'A booking system for my salon.' && s.lit.length === 0, 'after a reload the ask is still waiting', JSON.stringify(s));
		await pick(page, NEXT, touch);
		await sleep(1200);
		s = await state(page);
		check(s.lit.length === 1 && s.lit[0] === NEXT && s.unplaced === null && s.storedUnplaced === null, 'the next empty star clicked takes the ask', JSON.stringify(s));
		check(posts.length === 1, 'placing the ask posts nothing more', `${posts.length}`);
		await page.waitForFunction(() => !document.querySelector('[data-sky-panel="lit"]').hidden, null, { timeout: 8000 }).catch(() => {});
		const shown = await page.evaluate(() => ({ hidden: document.querySelector('[data-sky-panel="lit"]').hidden, ask: document.querySelector('[data-sky-ask]').textContent }));
		note(`after placing: lit panel hidden=${shown.hidden}, ask=${JSON.stringify(shown.ask)}`);
		await page.screenshot({ path: path.join(SHOTS, `claim-${name}-6-placed.png`) });
		check(errors.length === 0, 'no console errors', errors.join(' | '));
		await context.close();
	}
}

await browser.close();
process.exit(tally() ? 1 : 0);
