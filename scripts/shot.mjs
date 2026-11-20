#!/usr/bin/env node
// Screenshots, and a smoke test, through the system Chromium.
//
//   node scripts/shot.mjs --url <url> --out <dir> [options]
//
// For each viewport it opens the page in a fresh browser context (so storage
// starts empty every time), does what it was asked, and writes PNGs:
//
//   <name>-390x844.png     a phone: device scale factor 2, mobile, touch
//   <name>-1440x900.png    a desktop: device scale factor 1
//
// It prints every console error and page error, and exits non-zero if there
// was one, if a step could not be done, or if an `expect` was false. So a shot
// doubles as a smoke test: exit code 0 means the page ran clean.
//
// OPTIONS
//   --url <url>            the page to open (required)
//   --out <dir>            where the PNGs go; made if missing (required)
//   --name <base>          the file name base (default "shot")
//   --viewports <list>     comma-separated WxH (default 390x844,1440x900).
//                          Anything narrower than 768 is a phone.
//   --wait <ms>            pause before the shot (default 500)
//   --eval "<js>"          run in the page before the shot (see `eval` below)
//   --click "<selector>"   click this before the shot, after --eval
//   --full                 the whole page, not only the viewport
//   --gpu                  the real GPU: --use-gl=angle --use-angle=gl
//                          --ignore-gpu-blocklist --enable-gpu
//   --reduced-motion       emulate prefers-reduced-motion: reduce
//   --no-js                JavaScript off
//   --ignore "<regex>"     console and page errors matching this are printed
//                          but not counted (a stubbed 400 logs one). Repeatable.
//   --timeout <ms>         how long a click, fill or waitFor may take (default 8000)
//   --dev-toolbar          leave Astro's dev toolbar in the picture. By default it
//                          is hidden: it sits at bottom centre, where B11 is.
//   --steps <file.json>    a list of actions, for several states in one run.
//                          A value starting with "[" is read as the JSON itself.
//
// Without --steps: open --url, run --eval, do --click, wait --wait, take the shot.
//
// STEPS  A JSON array. Each item is one action, done in order:
//
//   { "route": { "url": "**/api/contact", "status": 200, "json": { "ok": true } } }
//        Answer matching requests from here on. In place of "json": "body" (a
//        string) with "contentType"; or "abort": true to make the request fail.
//        A later route for the same URL replaces an earlier one.
//   { "ignore": "<regex>" }        as --ignore, from here on
//   { "init": "<js>" }             run in every page from here on, before any of
//                                  its own scripts: seed localStorage, stub an
//                                  API. Needs JavaScript on, as the page does.
//   { "goto": "<url>" }            navigate; a relative URL is relative to --url
//   { "reload": true }
//   { "eval": "<js>" }             run as in the DevTools console: top-level
//                                  await works, a promise is awaited, and a
//                                  value other than undefined is printed
//   { "expect": "<js>" }           an expression that must be truthy
//   { "click": "<selector>" }      { "hover": "<selector>" }
//   { "fill": ["<selector>", "<text>"] }
//   { "key": "ArrowDown" }         a key press ("Shift+Tab" works)
//   { "tap": [x, y] }              a touch at a point, or { "tap": "<selector>" }
//                                  (a mouse click where there is no touch)
//   { "swipe": [x1, y1, x2, y2] }  a finger dragged between two points
//                                  (a mouse drag where there is no touch)
//   { "wheel": dy }                a wheel turn at the middle of the screen
//   { "scroll": y }                scrollTo(0, y), at once
//   { "wait": ms }                 { "waitFor": "<selector>" } (until visible)
//   { "shot": "<name>" }           writes <name>-<W>x<H>.png; add "full": true
//                                  for the whole page
//
// The page is opened (at --url) just before the first step that needs one, so
// `route`, `ignore` and `init` steps placed first are in force for the load itself.
// If no step takes a shot, one is taken at the end, named by --name. When a
// step fails, the run for that viewport stops there and <name>-FAILED-<W>x<H>.png
// shows what was on screen.
//
// EXAMPLES
//   node scripts/shot.mjs --url http://localhost:4402/ --out /tmp/shots --name home
//   node scripts/shot.mjs --url 'http://localhost:4402/?scene=roots' --out /tmp/shots \
//     --name roots --full --reduced-motion
//   node scripts/shot.mjs --url 'http://localhost:4402/?debug' --out /tmp/shots \
//     --steps '[{"wheel":400},{"click":"[data-descend]"},{"wait":800},{"shot":"roots"}]'

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

const CHROMIUM = process.env.CHROMIUM ?? '/usr/bin/chromium';
const GPU_ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'];
/** Narrower than this, a viewport is a phone. */
const PHONE_BELOW = 768;

function usage(problem) {
	if (problem) console.error(`shot: ${problem}\n`);
	console.error(
		'usage: node scripts/shot.mjs --url <url> --out <dir> [--name <base>]\n' +
			'         [--viewports 390x844,1440x900] [--wait <ms>] [--eval "<js>"] [--click "<selector>"]\n' +
			'         [--full] [--gpu] [--reduced-motion] [--no-js] [--ignore "<regex>"] [--timeout <ms>]\n' +
			'         [--dev-toolbar] [--steps <file.json>]\n' +
			'Every flag and step is described at the top of scripts/shot.mjs.',
	);
	process.exit(2);
}

let values;
try {
	({ values } = parseArgs({
		options: {
			url: { type: 'string' },
			out: { type: 'string' },
			name: { type: 'string', default: 'shot' },
			viewports: { type: 'string', default: '390x844,1440x900' },
			wait: { type: 'string', default: '500' },
			eval: { type: 'string' },
			click: { type: 'string' },
			full: { type: 'boolean', default: false },
			gpu: { type: 'boolean', default: false },
			'reduced-motion': { type: 'boolean', default: false },
			'no-js': { type: 'boolean', default: false },
			ignore: { type: 'string', multiple: true, default: [] },
			timeout: { type: 'string', default: '8000' },
			'dev-toolbar': { type: 'boolean', default: false },
			steps: { type: 'string' },
			help: { type: 'boolean', short: 'h', default: false },
		},
	}));
} catch (err) {
	usage(err.message);
}
if (values.help) usage();
if (!values.url) usage('--url is required');
if (!values.out) usage('--out is required');

const viewports = values.viewports.split(',').map((text) => {
	const match = /^(\d+)x(\d+)$/.exec(text.trim());
	if (!match) usage(`"${text}" is not a viewport: write it as 390x844`);
	return { width: Number(match[1]), height: Number(match[2]) };
});

const pause = Number(values.wait);
const timeout = Number(values.timeout);
if (!Number.isFinite(pause) || pause < 0) usage('--wait takes milliseconds');
if (!Number.isFinite(timeout) || timeout <= 0) usage('--timeout takes milliseconds');

/** The steps to run: the file's, or the one-shot form built from the flags. */
async function readSteps() {
	if (values.steps === undefined) {
		return [
			...(values.eval ? [{ eval: values.eval }] : []),
			...(values.click ? [{ click: values.click }] : []),
			{ wait: pause },
			{ shot: values.name, full: values.full },
		];
	}
	const inline = values.steps.trimStart().startsWith('[');
	const text = inline ? values.steps : await readFile(values.steps, 'utf8');
	const steps = JSON.parse(text);
	if (!Array.isArray(steps)) throw new Error('--steps must be a JSON array of actions');
	// With steps but no shot among them, take one at the end.
	if (!steps.some((step) => step && 'shot' in step)) {
		steps.push({ wait: pause }, { shot: values.name, full: values.full });
	}
	return steps;
}

const label = (viewport) => `${viewport.width}x${viewport.height}`;

/** Run every step at one viewport. Returns what went wrong, as a list of lines. */
async function runAt(browser, viewport, steps) {
	const phone = viewport.width < PHONE_BELOW;
	const context = await browser.newContext({
		viewport,
		deviceScaleFactor: phone ? 2 : 1,
		isMobile: phone,
		hasTouch: phone,
		reducedMotion: values['reduced-motion'] ? 'reduce' : 'no-preference',
		javaScriptEnabled: !values['no-js'],
	});
	context.setDefaultTimeout(timeout);
	if (!values['dev-toolbar']) {
		// A stylesheet adopted by the document: the page's own markup is not touched.
		await context.addInitScript(() => {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync('astro-dev-toolbar { display: none !important; }');
			document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
		});
	}
	const page = await context.newPage();

	const problems = [];
	const ignores = values.ignore.map((source) => new RegExp(source));
	const report = (kind, text) => {
		const ignored = ignores.some((re) => re.test(text));
		console.log(`  ${ignored ? 'ignored ' : ''}${kind}: ${text}`);
		if (!ignored) problems.push(`${kind}: ${text}`);
	};
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		const from = message.location().url;
		report('console error', from ? `${message.text()} (${from})` : message.text());
	});
	page.on('pageerror', (err) => report('page error', err.stack || String(err)));

	let opened = false;
	/** Network quiet, or three seconds: chunks and images are in, as far as they will be. */
	const settle = () => page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
	const open = async (url) => {
		await page.goto(url, { waitUntil: 'load' });
		opened = true;
		await settle();
	};

	let cdp;
	/**
	 * As the DevTools console does it: top-level await, the promise awaited, the
	 * value back. The code is the developer's own, from the command line or the
	 * steps file, and it runs in the page under test inside the headless
	 * browser. Nothing is ever evaluated in this Node process.
	 */
	const evaluate = async (expression) => {
		cdp ??= await context.newCDPSession(page);
		const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
			expression,
			replMode: true,
			awaitPromise: true,
			returnByValue: true,
			userGesture: true,
		});
		if (exceptionDetails) {
			throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
		}
		return result.value;
	};

	const shot = async (name, full = false) => {
		const file = path.join(values.out, `${name}-${label(viewport)}.png`);
		await page.screenshot({ path: file, fullPage: full });
		console.log(`  ${file}`);
	};

	const swipe = async ([x1, y1, x2, y2]) => {
		const moves = 8;
		const at = (i) => [x1 + ((x2 - x1) * i) / moves, y1 + ((y2 - y1) * i) / moves];
		if (!phone) {
			await page.mouse.move(x1, y1);
			await page.mouse.down();
			await page.mouse.move(x2, y2, { steps: moves });
			await page.mouse.up();
			return;
		}
		cdp ??= await context.newCDPSession(page);
		const finger = ([x, y]) => [{ x, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }];
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: finger(at(0)) });
		for (let i = 1; i <= moves; i++) {
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: finger(at(i)) });
			await page.waitForTimeout(16);
		}
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	};

	const actions = {
		async route({ url, status = 200, json, body = '', contentType = 'text/plain', abort }) {
			if (typeof url !== 'string') throw new Error('route needs a "url"');
			await context.route(url, (route) => {
				if (abort) return route.abort();
				return route.fulfill(json !== undefined ? { status, json } : { status, body, contentType });
			});
		},
		ignore: (source) => {
			ignores.push(new RegExp(source));
		},
		init: (code) => context.addInitScript({ content: code }),
		goto: (url) => open(new URL(url, values.url).href),
		async reload() {
			await page.reload({ waitUntil: 'load' });
			await settle();
		},
		async eval(code) {
			const value = await evaluate(code);
			if (value !== undefined) console.log(`  eval → ${JSON.stringify(value)}`);
		},
		async expect(code) {
			if (!(await evaluate(`Boolean(${code}\n)`))) throw new Error(`expected: ${code}`);
		},
		click: (selector) => page.click(selector),
		hover: (selector) => page.hover(selector),
		fill: ([selector, text]) => page.fill(selector, text),
		key: (key) => page.keyboard.press(key),
		tap(target) {
			if (typeof target === 'string') return phone ? page.tap(target) : page.click(target);
			const [x, y] = target;
			return phone ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
		},
		swipe,
		async wheel(dy) {
			await page.mouse.move(viewport.width / 2, viewport.height / 2);
			await page.mouse.wheel(0, dy);
		},
		scroll: (y) =>
			page.evaluate((top) => window.scrollTo({ left: 0, top, behavior: 'instant' }), y),
		wait: (ms) => page.waitForTimeout(ms),
		waitFor: (selector) => page.waitForSelector(selector, { state: 'visible' }),
		shot: (name, step) => shot(name, step.full === true),
	};
	/** These are set up before there is a page; everything else needs one. */
	const beforeThePage = new Set(['route', 'ignore', 'init', 'goto']);

	for (const [i, step] of steps.entries()) {
		const name = step && Object.keys(step).find((key) => key in actions);
		try {
			if (!name) throw new Error('not an action this script knows');
			if (!opened && !beforeThePage.has(name)) await open(values.url);
			await actions[name](step[name], step);
		} catch (err) {
			const first = String(err?.message ?? err).split('\n')[0];
			report(`step ${i + 1} ${JSON.stringify(step)}`, first);
			if (opened) await shot(`${values.name}-FAILED`).catch(() => {});
			break;
		}
	}

	await context.close();
	return problems;
}

const steps = await readSteps();
await mkdir(values.out, { recursive: true });
const browser = await chromium.launch({
	executablePath: CHROMIUM,
	headless: true,
	args: values.gpu ? GPU_ARGS : [],
});

let failed = 0;
try {
	for (const viewport of viewports) {
		console.log(`${label(viewport)}`);
		const problems = await runAt(browser, viewport, steps);
		failed += problems.length;
		console.log(problems.length ? `  ${problems.length} problem(s)` : '  clean');
	}
} finally {
	await browser.close();
}
process.exit(failed ? 1 : 0);
