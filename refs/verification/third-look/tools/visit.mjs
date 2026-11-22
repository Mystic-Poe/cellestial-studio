#!/usr/bin/env node
// THE SECOND LOOK's copy of the first look's real-time walk (refs/verification/look-tools/visit.mjs), run
// against the PRODUCTION build, writing into refs/verification/third-look/walk/. Added at the end: a build
// request sent with /api/contact answered 200 from here, the star it lights, a reload, the star still lit and
// what it shows; and a longer return visit.
//   node refs/verification/third-look/tools/visit.mjs [--url http://localhost:4615] [--only desk,phone]
// Real input (wheel, touch, clicks, taps) on the real page on the real GPU. The screen is
// recorded with the DevTools screencast (frames as the compositor presents them, no blocking
// screenshots), strips are cut at a fixed cadence, and every animation frame's time is
// logged in the page so that long frames can be counted per part of the visit.
// Writes refs/verification/third-look/walk/<size>-NN-<part>.jpg, stills, and frames-<size>.txt.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT, SIZES, launch, sheet, sharp } from '../../../../tools/roots/lib.mjs';

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://localhost:4615' }, only: { type: 'string', default: 'desk,phone' } } });
const OUT = join(ROOT, 'refs/verification/third-look/walk');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch({ gpu: true });

for (const size of values.only.split(',')) {
	const phone = size === 'phone';
	const { width: W, height: H } = SIZES[size].viewport;
	const context = await browser.newContext({ ...SIZES[size] });
	const page = await context.newPage();
	const errors = [];
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	page.on('pageerror', (e) => errors.push(`PAGEERROR ${e}`));
	await page.addInitScript(() => {
		const hide = () => {
			const s = document.createElement('style');
			s.textContent = 'astro-dev-toolbar{display:none!important}';
			document.documentElement.append(s);
		};
		if (document.documentElement) hide();
		else addEventListener('DOMContentLoaded', hide);
		window.__raf = [];
		const tick = (t) => {
			window.__raf.push(t);
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	const cdp = await context.newCDPSession(page);
	const frames = [];
	cdp.on('Page.screencastFrame', (f) => {
		frames.push({ ts: f.metadata.timestamp * 1000, img: Buffer.from(f.data, 'base64') });
		cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
	});
	await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 74, everyNthFrame: 2, maxWidth: 1440, maxHeight: 900 });

	const report = [];
	let n = 0;
	const GRID = phone ? { cols: 12, cellW: 125, cellH: 270 } : { cols: 6, cellW: 258, cellH: 161 };
	const pnow = () => page.evaluate(() => performance.now()).catch(() => 0);
	/** Cut a strip from the recording: [t0, t1] every `step` ms; and count long animation frames. */
	async function strip(part, t0, t1, step, p0, p1, grid = GRID) {
		const cells = [];
		for (let t = t0; t <= t1; t += step) {
			let pick = null;
			for (const f of frames) {
				if (f.ts <= t + 20) pick = f;
				else break;
			}
			if (pick) cells.push({ img: pick.img, label: `${part} +${Math.round(t - t0)}` });
		}
		const name = `${size}-${String(++n).padStart(2, '0')}-${part}.jpg`;
		if (cells.length) await sheet(join(OUT, name), cells, grid);
		const raf = await page.evaluate(([a, b]) => window.__raf.filter((t) => t >= a && t <= b), [p0, p1]).catch(() => []);
		const d = [];
		for (let i = 1; i < raf.length; i++) d.push(raf[i] - raf[i - 1]);
		const over = (ms) => d.filter((x) => x > ms).length;
		const worst = d.length ? Math.max(...d) : 0;
		const at = d.length ? Math.round(raf[d.indexOf(worst) + 1] - p0) : 0;
		const avg = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
		const line = `${size} ${part}: ${d.length} frames, avg ${avg.toFixed(1)} ms, >34 ms ${over(34)}, >50 ms ${over(50)}, >100 ms ${over(100)}, worst ${worst.toFixed(0)} ms at +${at} ms  [${name}]`;
		console.log(line);
		report.push(line);
	}
	const still = async (name) => {
		const img = await page.screenshot({ type: 'jpeg', quality: 90 });
		writeFileSync(join(OUT, `still-${size}-${name}.jpg`), img);
	};
	const centre = async (sel) => {
		const b = await page.locator(sel).first().boundingBox();
		return b ? [b.x + b.width / 2, b.y + b.height / 2] : null;
	};
	const pressAt = (x, y) => (phone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
	const press = async (sel) => {
		const c = await centre(sel);
		if (!c) throw new Error(`nothing to press: ${sel}`);
		await pressAt(...c);
	};
	const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
	const swipe = async (y0, y1, ms = 240, x = 200) => {
		await touch('touchStart', x, y0);
		for (let i = 1; i <= 12; i++) {
			await touch('touchMove', x, y0 + ((y1 - y0) * i) / 12);
			await sleep(ms / 12);
		}
		await touch('touchEnd', x, y1);
	};
	/** Fly forward for `ms` with the device's own gesture. */
	const fly = async (ms, back = false) => {
		const end = Date.now() + ms;
		if (!phone) await page.mouse.move(W / 2, H / 2);
		while (Date.now() < end) {
			if (phone) {
				await (back ? swipe(300, 640) : swipe(640, 300));
				await sleep(120);
			} else {
				await page.mouse.wheel(0, back ? -100 : 100);
				await sleep(50);
			}
		}
	};
	const scene = () => page.evaluate(() => document.documentElement.dataset.scene);
	const part = async (name, step, fn, grid) => {
		const t0 = Date.now();
		const p0 = await pnow();
		try {
			await fn();
		} catch (e) {
			report.push(`${size} ${name}: STEP FAILED ${String(e).slice(0, 300)}`);
			console.log(`${size} ${name}: STEP FAILED ${e}`);
		}
		await sleep(120);
		await strip(name, t0, Date.now(), step, p0, await pnow(), grid);
	};

	// 1. FIRST VISIT: the loader, whole, and the hand-off.
	let t0 = Date.now();
	await page.goto(`${values.url}/?debug`, { waitUntil: 'commit' });
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
	const tSky = Date.now();
	await sleep(2200);
	report.push(`${size} first visit: scene became "sky" ${tSky - t0} ms after navigation`);
	await strip('loader', t0, tSky - 1400, 250, 0, await pnow());
	await strip('handoff', tSky - 1900, tSky + 1500, 100, 0, await pnow());
	await still('sky-open');

	// 2. Flight through four constellations, forward, then one back.
	await part('flight-a', 300, async () => {
		for (let i = 0; i < 2; i++) {
			await fly(1500);
			await sleep(3400);
		}
	});
	await part('flight-b', 300, async () => {
		for (let i = 0; i < 2; i++) {
			await fly(1500);
			await sleep(3400);
		}
		await fly(900, true);
		await sleep(3400);
	});
	await still('station');
	report.push(`${size} after flight: ${JSON.stringify(await page.evaluate(() => { const s = window.__cellestial?.sky?.debug?.stats?.(); return s ? { pos: s.flight.pos, level: s.quality.level } : null; }))}`);

	// 3. A tap on empty sky: the beads, the pulse and the words.
	await part('tap-beads', 100, async () => {
		const pt = await page.evaluate(([w, h]) => {
			for (const [fx, fy] of [[0.22, 0.7], [0.8, 0.3], [0.25, 0.3], [0.75, 0.7], [0.5, 0.75]]) {
				const el = document.elementFromPoint(w * fx, h * fy);
				if (!el || !el.closest('button, a, [role=dialog]')) return [w * fx, h * fy];
			}
			return [w * 0.5, h * 0.8];
		}, [W, H]);
		await pressAt(...pt);
		await sleep(2600);
	});
	await still('claim-yours');

	// 4. An empty star and its panel.
	await part('empty-panel', 100, async () => {
		const pt = await page.evaluate(([w, h]) => {
			const list = [...document.querySelectorAll('button.sky-star:not([hidden])')].map((b) => {
				const r = b.getBoundingClientRect();
				return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute('aria-label') };
			}).filter((p) => p.x > 40 && p.x < w - 40 && p.y > 110 && p.y < h - 140 && /Empty/.test(p.label));
			list.sort((a, b) => Math.hypot(a.x - w / 2, a.y - h / 2) - Math.hypot(b.x - w / 2, b.y - h / 2));
			return list[0] ? [list[0].x, list[0].y] : null;
		}, [W, H]);
		if (!pt) throw new Error('no empty star on screen');
		await pressAt(...pt);
		await sleep(1500);
	});
	await still('empty-panel');
	await page.keyboard.press('Escape');
	await sleep(500);

	// 5. The rest of the round, and the exit button arriving.
	await part('round', 600, async () => {
		const end = Date.now() + 45000;
		while (Date.now() < end) {
			await fly(700);
			if (await page.evaluate(() => { const b = document.querySelector('[data-descend]'); return b && !b.hidden; })) break;
		}
		await sleep(3600);
	});
	await still('b11');
	report.push(`${size} exit button: ${JSON.stringify(await page.evaluate(() => { const b = document.querySelector('[data-descend]'); const r = b.getBoundingClientRect(); return { hidden: b.hidden, x: r.x, y: r.y, w: r.width, h: r.height, text: b.textContent.trim() }; }))}`);

	// 6. The fall and the crash.
	await part('fall', 100, async () => {
		await press('[data-descend]');
		await sleep(3400);
	});
	await still('roots-arrived');
	report.push(`${size} after the fall: scene ${await scene()}, scrollY ${await page.evaluate(() => Math.round(scrollY))}`);

	// 7. The five tiles in turn, with the guided light between them.
	const lightCells = [];
	const tp0 = await pnow();
	const tt0 = Date.now();
	for (let i = 0; i < 5; i++) {
		const sel = `.roots-stop:nth-of-type(${i + 1}) button`;
		try {
			const node = page.locator('.roots-stop').nth(i).locator('button').first();
			// The light that leads here, with the node it leaves near the top of the screen.
			const from = i === 0 ? page.locator('[data-ascend]') : page.locator('.roots-stop').nth(i - 1).locator('button').first();
			await from.evaluate((el, h) => scrollTo({ top: scrollY + el.getBoundingClientRect().top - h * 0.12, behavior: 'smooth' }), H);
			await sleep(900);
			const a = Date.now();
			await sleep(2400);
			for (let t = a + 300; t <= a + 2400; t += 420) {
				let pick = null;
				for (const f of frames) { if (f.ts <= t) pick = f; else break; }
				if (pick) lightCells.push({ img: pick.img, label: `light to node ${i + 1} +${t - a}` });
			}
			await node.evaluate((el, h) => scrollTo({ top: scrollY + el.getBoundingClientRect().top - h * 0.3, behavior: 'smooth' }), H);
			await sleep(800);
			const b = await node.boundingBox();
			await pressAt(b.x + b.width / 2, b.y + b.height / 2);
			await sleep(900);
			lightCells.push({ img: await page.screenshot({ type: 'jpeg', quality: 88 }), label: `tile ${i + 1} open` });
			await still(`tile-${i + 1}`);
			await page.keyboard.press('Escape');
			await sleep(350);
		} catch (e) {
			report.push(`${size} tile ${i + 1}: STEP FAILED ${String(e).slice(0, 200)} (${sel})`);
		}
	}
	await sheet(join(OUT, `${size}-${String(++n).padStart(2, '0')}-tiles-and-light.jpg`), lightCells, phone ? { cols: 12, cellW: 125, cellH: 270 } : { cols: 7, cellW: 222, cellH: 139 });
	{
		const raf = await page.evaluate(([a, b]) => window.__raf.filter((t) => t >= a && t <= b), [tp0, await pnow()]);
		const d = raf.slice(1).map((t, i) => t - raf[i]);
		report.push(`${size} tiles-and-light: ${d.length} frames, >34 ms ${d.filter((x) => x > 34).length}, >50 ms ${d.filter((x) => x > 50).length}, >100 ms ${d.filter((x) => x > 100).length}, worst ${Math.max(...d).toFixed(0)} ms, ${Date.now() - tt0} ms in all`);
	}

	// 8. The Close: the light to F1, the two buttons, their dialogs.
	const closeCells = [];
	try {
		await page.locator('[data-open-claim]').evaluate((el, h) => scrollTo({ top: scrollY + el.getBoundingClientRect().top - h * 0.55, behavior: 'smooth' }), H);
		await sleep(2600);
		closeCells.push({ img: await page.screenshot({ type: 'jpeg', quality: 90 }), label: 'the Close' });
		await still('close');
		await press('[data-open-claim]');
		await sleep(900);
		closeCells.push({ img: await page.screenshot({ type: 'jpeg', quality: 90 }), label: 'F1 pressed: the build request' });
		await page.keyboard.press('Escape');
		await sleep(500);
		await press('[data-open-contact]');
		await sleep(900);
		closeCells.push({ img: await page.screenshot({ type: 'jpeg', quality: 90 }), label: 'F2 pressed: the message box' });
		await page.keyboard.press('Escape');
		await sleep(500);
	} catch (e) {
		report.push(`${size} close: STEP FAILED ${String(e).slice(0, 200)}`);
	}
	if (closeCells.length) await sheet(join(OUT, `${size}-${String(++n).padStart(2, '0')}-close.jpg`), closeCells, phone ? { cols: 3, cellW: 390, cellH: 844 } : { cols: 3, cellW: 528, cellH: 330 });

	// 9. Back up: scroll to the top, E6, the warp.
	await page.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' }));
	await sleep(1600);
	await still('roots-top');
	await part('warp', 100, async () => {
		await press('[data-ascend]');
		await sleep(2500);
	});
	report.push(`${size} after the warp: scene ${await scene()}`);

	// 10. The four menu teleports.
	const menuBtn = '#chrome button[popovertarget]';
	let menuShot = null;
	for (const [dest, label] of [['build', 'What we build'], ['claim', 'Claim your star'], ['contact', 'Contact me'], ['sky', 'The Sky']]) {
		await part(`teleport-${dest}`, 60, async () => {
			await press(menuBtn);
			await sleep(450);
			if (!menuShot) {
				menuShot = true;
				await still('menu-open');
			}
			await press(`#chrome-menu [data-dest="${dest}"]`);
			await sleep(1250);
		}, phone ? { cols: 15, cellW: 100, cellH: 216 } : { cols: 7, cellW: 222, cellH: 139 });
		report.push(`${size} teleport "${label}": scene ${await scene()}, scrollY ${await page.evaluate(() => Math.round(scrollY))}, dialog open ${await page.evaluate(() => !!document.querySelector('dialog[open]'))}`);
		if (dest === 'contact') {
			await page.keyboard.press('Escape');
			await sleep(500);
		}
	}

	// 10b. A BUILD REQUEST, /api/contact answered 200 from here: the star it lights, and after a reload.
	await context.route('**/api/contact', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
	let claimed = null;
	await part('claim-send', 150, async () => {
		const pt = await page.evaluate(([w, h]) => {
			const list = [...document.querySelectorAll('button.sky-star:not([hidden])')].map((b) => {
				const r = b.getBoundingClientRect();
				return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.getAttribute('aria-label'), slot: b.dataset.slot };
			}).filter((p) => p.x > 40 && p.x < w - 40 && p.y > 110 && p.y < h - 140 && /Empty/.test(p.label));
			list.sort((a, b) => a.x - b.x);
			return list[0] ?? null;
		}, [W, H]);
		if (!pt) throw new Error('no empty star on screen');
		claimed = pt.slot;
		await pressAt(pt.x, pt.y);
		await sleep(900);
		await still('claim-1-panel');
		await press('#sky-ui [data-sky-claim]');
		await sleep(900);
		await page.fill('#claim-form-name', 'Test Visitor');
		await page.fill('#claim-form-email', 'visitor@example.com');
		await page.fill('#claim-form-message', "A site for my bakery, with the week's bread on the first page.");
		await sleep(1800); // the spam check
		await still('claim-2-form');
		report.push(`${size} build request: star field ${await page.evaluate(() => document.querySelector('#claim-form [data-star-input]')?.value)}, spam-check token present ${await page.evaluate(() => !!document.querySelector('#claim-form [name="cf-turnstile-response"]')?.value)}`);
		await press('#claim-form button[type="submit"]');
		await sleep(5200);
	});
	await still('claim-3-lit');
	report.push(`${size} after sending: star ${claimed} lit in the store ${await page.evaluate((s) => window.__cellestial?.claims?.isLit?.(s), claimed)}, lit in the sky ${await page.evaluate((s) => window.__cellestial?.sky?.hooks?.isLit?.(s), claimed)}; the lit star's panel says: ${JSON.stringify(await page.evaluate(() => document.querySelector('#sky-ui [data-sky-ask]')?.textContent ?? null))}; whole panel text: ${JSON.stringify(await page.evaluate(() => { const a = document.querySelector('#sky-ui [data-sky-ask]'); const p = a?.closest('[role=dialog], .sky-panel, section, div'); return p ? p.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; }))}`);
	await page.keyboard.press('Escape');
	await sleep(600);

	// 11. THE RETURN in the same session: reload. The short loader, B11 from the start, the fall, the warp.
	t0 = Date.now();
	await page.reload({ waitUntil: 'commit' });
	await page.waitForFunction(() => document.documentElement.dataset.scene === 'sky', null, { timeout: 30000 });
	const tSky2 = Date.now();
	await sleep(1800);
	report.push(`${size} return visit: scene became "sky" ${tSky2 - t0} ms after the reload; exit button hidden: ${await page.evaluate(() => document.querySelector('[data-descend]').hidden)}`);
	await strip('return-loader', t0, tSky2 + 1500, 150, 0, await pnow());
	report.push(`${size} after the reload: star ${claimed} lit in the store ${await page.evaluate((s) => window.__cellestial?.claims?.isLit?.(s), claimed)}, lit in the sky ${await page.evaluate((s) => window.__cellestial?.sky?.hooks?.isLit?.(s), claimed)}; localStorage claims ${await page.evaluate(() => localStorage.getItem('cellestial:claims'))}`);
	await still('return-sky');
	await part('return-lit-star', 150, async () => {
		const c = await page.evaluate((s) => window.__cellestial?.sky?.hooks?.starCircle?.(s), claimed);
		if (!c) throw new Error('the lit star is not on screen');
		await pressAt(c.x, c.y);
		await sleep(3200);
	});
	await still('return-lit-panel');
	report.push(`${size} the lit star clicked on the return: ${JSON.stringify(await page.evaluate(() => { const a = document.querySelector('#sky-ui [data-sky-ask]'); const p = a?.closest('[role=dialog], .sky-panel, section, div'); return p ? p.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; }))}`);
	await page.keyboard.press('Escape');
	await sleep(1500);
	await part('return-flight', 300, async () => {
		for (let i = 0; i < 2; i++) {
			await fly(1500);
			await sleep(3200);
		}
	});
	await part('return-fall', 150, async () => {
		await press('[data-descend]');
		await sleep(3000);
	});
	await part('return-warp', 150, async () => {
		await press('[data-ascend]');
		await sleep(2300);
	});
	report.push(`${size} at the end: scene ${await scene()}`);
	report.push(`${size} console errors: ${errors.length ? errors.map((e) => e.slice(0, 160)).join(' | ') : 'none'}`);
	report.push(`${size} screencast frames recorded: ${frames.length}`);
	writeFileSync(join(OUT, `frames-${size}.txt`), `${report.join('\n')}\n`);
	await cdp.send('Page.stopScreencast').catch(() => {});
	await context.close();
}
await browser.close();
