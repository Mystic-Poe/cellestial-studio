// The contact form on the production build: /contact and both dialogs on the home page.
// Stubbed 200, stubbed 400 (what is posted, what the visitor sees), and unstubbed (the
// real Turnstile widget). Run: node refs/verification/business-and-code/tools/flows-contact.mjs
import path from 'node:path';
import { BASE, check, DESK, launch, note, openPage, PHONE, SHOTS, sleep, tally } from './lib.mjs';

const ALLOWED = new Set(['name', 'email', 'message', 'star', 'cf-turnstile-response']);
const ERR400 = 'The spam check did not pass. Please try again.';
const MSG = 'A site for my bakery.\nTwo lines, "quotes" & <b>tags</b>.';

const browser = await launch();

const FORMS = [
	{ label: '/contact', url: '/contact', form: '#contact-form', open: null, star: false },
	{ label: 'home: build request (F1)', url: '/?scene=roots&debug', form: '#claim-form', open: '#roots [data-open-claim]', dialog: '#claim-dialog', star: true },
	{ label: 'home: message box (F2)', url: '/?scene=roots&debug', form: '#contact-box-form', open: '#roots [data-open-contact]', dialog: '#contact-dialog', star: false },
];

async function fill(page, f) {
	await page.fill(`${f.form} [name="name"]`, 'Test Visitor');
	await page.fill(`${f.form} [name="email"]`, 'visitor@example.com');
	await page.fill(`${f.form} [name="message"]`, MSG);
}
async function openForm(page, f) {
	await page.goto(BASE + f.url, { waitUntil: 'load' });
	if (f.open) {
		await page.waitForFunction(() => window.__cellestial?.claimFlow && window.__cellestial?.roots, null, { timeout: 15000 });
		await page.click(f.open);
		await page.waitForSelector(`${f.dialog}[open]`, { timeout: 5000 });
	}
}
// Turnstile puts its iframe in a closed shadow root, so it is counted among the page's frames
// and measured by the box of the slot it was rendered into.
const turnstileState = async (page, f) => {
	const frames = page.frames().filter((fr) => /challenges\.cloudflare\.com/.test(fr.url()));
	const inDom = await page.evaluate((sel) => {
		const form = document.querySelector(sel);
		const slot = form.querySelector('.cf-turnstile, [data-turnstile-slot]');
		const input = form.querySelector('[name="cf-turnstile-response"]');
		const r = slot?.getBoundingClientRect();
		return {
			slot: r ? { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) } : null,
			widgets: slot ? slot.children.length : 0,
			inputs: form.querySelectorAll('[name="cf-turnstile-response"]').length,
			token: input ? input.value.slice(0, 24) : null,
			innerWidth,
		};
	}, f.form);
	return { iframes: frames.length, src: frames[0]?.url().slice(0, 70) ?? null, ...inDom, box: inDom.slot };
};

for (const size of [['desk', DESK], ['phone', PHONE]]) {
	for (const f of FORMS) {
		console.log(`\n## ${f.label} — ${size[0]}`);

		// ── stub 200 ──
		{
			const { context, page, errors, posts } = await openPage(browser, size[1], { stub: { status: 200, json: { ok: true } } });
			await openForm(page, f);
			await fill(page, f);
			// Let Turnstile (real script, test key) put its token in the form.
			await page.waitForFunction((sel) => document.querySelector(`${sel} [name="cf-turnstile-response"]`)?.value, f.form, { timeout: 20000 }).catch(() => {});
			const ts = await turnstileState(page, f);
			note(`turnstile before send: ${JSON.stringify(ts)}`);
			await page.screenshot({ path: path.join(SHOTS, `contact-${f.form.slice(1)}-${size[0]}-filled.png`) });
			await page.click(`${f.form} button[type="submit"]`);
			await page.waitForFunction((sel) => /Sent|did not/.test(document.querySelector(`${sel} [data-status]`).textContent), f.form, { timeout: 8000 });
			const seen = await page.evaluate((sel) => {
				const form = document.querySelector(sel);
				return {
					status: form.querySelector('[data-status]').textContent,
					disabled: form.querySelector('button[type="submit"]').disabled,
					message: form.querySelector('[name="message"]').value,
				};
			}, f.form);
			check(posts.length === 1, '200: exactly one POST to /api/contact', `${posts.length}: ${posts.map((p) => new URL(p.url).pathname)}`);
			const sent = posts[0]?.fields ?? [];
			note(`posted fields: ${JSON.stringify(sent.map(([k, v]) => [k, v.length > 40 ? `${v.slice(0, 40)}…(${v.length})` : v]))}`);
			note(`accept header: ${posts[0]?.headers.accept}; content-type: ${posts[0]?.headers['content-type']?.slice(0, 30)}`);
			check(sent.every(([k]) => ALLOWED.has(k)), '200: nothing posted but name, email, message, star, cf-turnstile-response', sent.map(([k]) => k).join(','));
			const got = Object.fromEntries(sent);
			check(got.name === 'Test Visitor' && got.email === 'visitor@example.com', '200: name and email as typed');
			check(got.message?.replace(/\r\n/g, '\n') === MSG, '200: the message is exactly what was typed, nothing added', JSON.stringify(got.message));
			check(f.star ? 'star' in got : !('star' in got), f.star ? '200: the star field is posted (empty: no star chosen)' : '200: no star field on this form', JSON.stringify(got.star));
			check('cf-turnstile-response' in got && got['cf-turnstile-response'].length > 0, '200: a Turnstile token is posted', (got['cf-turnstile-response'] ?? 'absent').slice(0, 30));
			check(seen.status === 'Sent. We will reply by email.', '200: the visitor sees "Sent. We will reply by email."', seen.status);
			check(seen.disabled === true && seen.message === '', '200: the form is cleared and Send stays disabled');
			await page.screenshot({ path: path.join(SHOTS, `contact-${f.form.slice(1)}-${size[0]}-200.png`) });
			if (f.dialog) {
				await sleep(1900);
				check(await page.evaluate((d) => !document.querySelector(d).open, f.dialog), '200: the dialog closes by itself after the "Sent." beat');
			}
			check(errors.length === 0, '200: no console errors', errors.join(' | '));
			await context.close();
		}

		// ── stub 400 ──
		{
			const { context, page, errors, posts } = await openPage(browser, size[1], { stub: { status: 400, json: { error: ERR400 } } });
			await openForm(page, f);
			await fill(page, f);
			await page.waitForFunction((sel) => document.querySelector(`${sel} [name="cf-turnstile-response"]`)?.value, f.form, { timeout: 20000 }).catch(() => {});
			await page.click(`${f.form} button[type="submit"]`);
			await page.waitForFunction((sel) => /Sent|did not/.test(document.querySelector(`${sel} [data-status]`).textContent), f.form, { timeout: 8000 });
			const seen = await page.evaluate((sel) => {
				const form = document.querySelector(sel);
				return {
					status: form.querySelector('[data-status]').textContent,
					disabled: form.querySelector('button[type="submit"]').disabled,
					message: form.querySelector('[name="message"]').value,
				};
			}, f.form);
			check(posts.length === 1, '400: one POST');
			check(seen.status === ERR400, "400: the visitor sees the Worker's own error text", seen.status);
			check(seen.disabled === false && seen.message === MSG, '400: the form keeps what was typed and Send works again');
			if (f.dialog) {
				await sleep(1900);
				check(await page.evaluate((d) => document.querySelector(d).open, f.dialog), '400: the dialog stays open');
			}
			await page.screenshot({ path: path.join(SHOTS, `contact-${f.form.slice(1)}-${size[0]}-400.png`) });
			const real = errors.filter((e) => !/400/.test(e));
			check(real.length === 0, '400: no console errors but the 400 itself', errors.join(' | '));
			await context.close();
		}

		// ── unstubbed: the real Turnstile widget ──
		{
			const { context, page, errors, posts } = await openPage(browser, size[1]);
			await openForm(page, f);
						await page.waitForFunction((sel) => document.querySelector(`${sel} [name="cf-turnstile-response"]`)?.value, f.form, { timeout: 20000 }).catch(() => {});
			await sleep(1200);
			const ts = await turnstileState(page, f);
			note(`turnstile: ${JSON.stringify(ts)}`);
			check(ts.iframes === 1, 'unstubbed: exactly one real Turnstile iframe in the form', `${ts.iframes}`);
			check((ts.box?.width ?? 0) >= 250 && (ts.box?.height ?? 0) >= 50, 'unstubbed: the widget has its size', JSON.stringify(ts.box));
			check(Boolean(ts.token), 'unstubbed: the widget issued a token (test key)');
			check(ts.slot && ts.slot.left >= 0 && ts.slot.right <= ts.innerWidth, 'unstubbed: the widget is inside the screen', JSON.stringify(ts.slot));
			check(ts.inputs === 1, 'unstubbed: one token field in the form', `${ts.inputs}`);
			await page.screenshot({ path: path.join(SHOTS, `contact-${f.form.slice(1)}-${size[0]}-turnstile.png`) });
			if (f.dialog) {
				// Reopen: the same widget, reset, never a second one.
				await page.keyboard.press('Escape');
				await sleep(300);
				await page.click(f.open);
				await sleep(2500);
				const again = await turnstileState(page, f);
				check(again.iframes === 1 && again.inputs === 1 && again.widgets === ts.widgets, 'unstubbed: reopened, still one widget (reset, not rendered twice)', JSON.stringify(again));
			}
			// And a real send against the preview server, which has no Worker: it must not claim success.
			await fill(page, f);
			await page.click(`${f.form} button[type="submit"]`);
			await page.waitForFunction((sel) => /Sent|did not/.test(document.querySelector(`${sel} [data-status]`).textContent), f.form, { timeout: 8000 }).catch(() => {});
			const status = await page.evaluate((sel) => document.querySelector(`${sel} [data-status]`).textContent, f.form);
			check(/did not send/.test(status), 'unstubbed: with no Worker behind it the form says it did not send', status);
			note(`console during unstubbed run: ${errors.length ? errors.join(' | ').slice(0, 300) : 'none'}`);
			await context.close();
		}
	}
}

await browser.close();
process.exit(tally() ? 1 : 0);
