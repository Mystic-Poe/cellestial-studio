// Shared by the Roots tools: the browser at the two sizes the scene is judged
// at, and contact sheets small enough to look at (1600 px at most, JPEG).

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const CHROMIUM = process.env.CHROMIUM ?? '/usr/bin/chromium';
const GPU_ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu'];

export const SIZES = {
	desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
	phone: {
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
	},
	narrow: {
		viewport: { width: 320, height: 568 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
	},
};

export async function launch({ gpu = false } = {}) {
	return chromium.launch({ executablePath: CHROMIUM, args: gpu ? GPU_ARGS : [] });
}

/**
 * A fresh context and page at one of SIZES. Console errors and page errors
 * are collected in `errors` (and printed). `opts` goes to newContext.
 */
export async function openPage(browser, size, url, opts = {}) {
	const context = await browser.newContext({ ...SIZES[size], ...opts });
	const page = await context.newPage();
	const errors = [];
	page.on('console', (m) => {
		if (m.type() === 'error') {
			errors.push(m.text());
			console.error(`  [console ${size}] ${m.text()}`);
		}
	});
	page.on('pageerror', (e) => {
		errors.push(String(e));
		console.error(`  [pageerror ${size}] ${e}`);
	});
	// Astro's dev toolbar sits at bottom centre, where the Close is.
	await page.addInitScript(() => {
		const hide = () => {
			const s = document.createElement('style');
			s.textContent = 'astro-dev-toolbar{display:none!important}';
			document.documentElement.append(s);
		};
		if (document.documentElement) hide();
		else addEventListener('DOMContentLoaded', hide);
	});
	if (url) {
		await page.goto(url, { waitUntil: 'load' });
		await page.waitForTimeout(400);
	}
	return { context, page, errors };
}

/** Wait until the Roots scene is mounted on a ?debug page, and grown. */
export async function rootsReady(page) {
	await page.waitForFunction(() => window.__cellestial?.roots?.debug?.state().grown === true, null, {
		timeout: 10000,
	});
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(350);
}

const label = (text, width, height = 26) =>
	Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="${height - 8}" font-family="sans-serif" font-size="14" fill="#ddd">${String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`,
	);

/**
 * Lay cells out in a grid and write one JPEG, at most `max` px on its long side.
 * A cell is { img: Buffer, label?: string }. Each is fitted into cellW x cellH.
 */
export async function sheet(file, cells, { cols = 3, cellW = 520, cellH = 520, max = 1600, gap = 8 } = {}) {
	const rows = Math.ceil(cells.length / cols);
	const lh = 26;
	const W = cols * cellW + (cols + 1) * gap;
	const H = rows * (cellH + lh) + (rows + 1) * gap;
	const parts = [];
	for (let i = 0; i < cells.length; i++) {
		const left = gap + (i % cols) * (cellW + gap);
		const top = gap + Math.floor(i / cols) * (cellH + lh + gap);
		const fitted = await sharp(cells[i].img)
			.resize({ width: cellW, height: cellH, fit: 'inside', withoutEnlargement: !cells[i].enlarge })
			.toBuffer();
		parts.push({ input: label(cells[i].label ?? '', cellW, lh), left, top });
		parts.push({ input: fitted, left, top: top + lh });
	}
	let out = sharp({ create: { width: W, height: H, channels: 3, background: '#2a2a2a' } }).composite(parts);
	out = sharp(await out.png().toBuffer());
	if (Math.max(W, H) > max) out = out.resize({ width: W >= H ? max : undefined, height: H > W ? max : undefined });
	await out.jpeg({ quality: 86 }).toFile(file);
	console.log(`  wrote ${file}`);
}

/** The viewport as a PNG buffer; `clip` in CSS pixels to crop. */
export const shot = (page, clip) => page.screenshot(clip ? { clip } : {});
export { sharp };
