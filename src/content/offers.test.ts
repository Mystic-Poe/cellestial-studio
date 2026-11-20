import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { OFFERS, type Offer, offerText, type Segment, visibleText } from './offers.ts';

// The copy is locked in SPEC-ADDENDUM.md. It is read here, at test time, so the
// data is held against the source itself and never against a second copy.
const addendum = readFileSync(new URL('../../SPEC-ADDENDUM.md', import.meta.url), 'utf8');

interface Tile {
	/** The paragraph as the addendum has it: lead-in and ** markers included. */
	raw: string;
	title: string;
	/** The body: ** markers removed, the "N. Title:" lead-in dropped. */
	text: string;
	/** The body's bold spans, in order. */
	bold: string[];
}

function readTiles(md: string): Tile[] {
	const lines = md.split(/\r?\n/);
	const head = lines.findIndex((l) => l.startsWith('## Roots tile copy'));
	if (head < 0) throw new Error('the addendum has no "Roots tile copy" section');
	const tiles: Tile[] = [];
	for (const raw of lines.slice(head + 1)) {
		if (raw.startsWith('## ')) break; // the next section
		if (raw === '' || /^\(Note: .*\)$/.test(raw)) continue; // notes are for the builder, not copy
		const m = /^\*\*(\d+)\. (.+?):\*\* (.+)$/.exec(raw);
		if (!m) throw new Error(`not a tile paragraph: ${raw}`);
		const [, n, title, body] = m;
		assert.equal(Number(n), tiles.length + 1, 'tiles are numbered in order');
		const parts = body.split('**'); // plain, bold, plain, bold, … plain
		assert.equal(parts.length % 2, 1, `unbalanced ** in tile ${n}`);
		const text = parts.join('');
		assert.ok(!text.includes('*'), `stray * in tile ${n}`);
		tiles.push({ raw, title, text, bold: parts.filter((_, i) => i % 2 === 1) });
	}
	assert.equal(tiles.length, 5, 'the addendum has five tiles');
	return tiles;
}

const tiles = readTiles(addendum);
const [site, systems, app, addons, care] = OFFERS;

const lineText = (line: Segment[], visibleOnly = false): string =>
	line.map((s) => (visibleOnly && s.srOnly ? '' : s.text)).join('');

/** Maximal runs of brass text. The space that joins two lines is never brass. */
function brassSpans(o: Offer): string[] {
	const spans: string[] = [];
	for (const line of o.lines) {
		let run = '';
		for (const s of line) {
			if (s.brass) {
				run += s.text;
			} else if (run) {
				spans.push(run);
				run = '';
			}
		}
		if (run) spans.push(run);
	}
	return spans;
}

/** The tile written back out the way the addendum writes it. */
function asMarkdown(o: Offer, n: number): string {
	const body = o.lines.map((line) => {
		let out = '';
		let bold = false;
		for (const s of line) {
			if (Boolean(s.brass) !== bold) {
				out += '**';
				bold = !bold;
			}
			out += s.text;
		}
		return bold ? `${out}**` : out;
	});
	return `**${n}. ${o.title}:** ${body.join(' ')}`;
}

function strings(v: unknown): string[] {
	if (typeof v === 'string') return [v];
	if (v === null || typeof v !== 'object') return [];
	return Object.values(v).flatMap(strings);
}

/** Every string an offer carries, whatever field it sits in, plus its assembled text. */
const everything = (o: Offer): string => [...strings(o), offerText(o)].join('\n');

test('five offers, in order, one for each tile of the addendum', () => {
	assert.deepEqual(
		OFFERS.map((o) => o.id),
		['site', 'systems', 'app', 'addons', 'care'],
	);
	assert.equal(OFFERS.length, tiles.length);
});

test('titles are the bold lead-ins, without the list number or the colon', () => {
	const titles = OFFERS.map((o) => o.title);
	assert.deepEqual(titles, [
		'Site',
		'Site + Systems',
		'Site + App',
		'Add-ons — AI + automation',
		'Care',
	]);
	assert.deepEqual(
		titles,
		tiles.map((t) => t.title),
	);
});

test('short names are the five the breakdown panel lists', () => {
	assert.deepEqual(
		OFFERS.map((o) => o.short),
		['Site', 'Site + Systems', 'Site + App', 'Add-ons', 'Care'],
	);
});

test('offerText is the addendum tile, character for character', () => {
	for (const [i, o] of OFFERS.entries()) assert.equal(offerText(o), tiles[i].text, o.id);
});

test('the builder notes are not copy', () => {
	for (const o of OFFERS) assert.doesNotMatch(everything(o), /Note:|[()]/, o.id);
});

test('lead is the first sentence of the body, and the first line', () => {
	assert.deepEqual(
		OFFERS.map((o) => o.lead),
		[
			'A custom site built for your business.',
			'Everything in Site, plus the work behind it wired in.',
			'Everything in Site, plus a real app your customers actually use.',
			'Upgrades that take work off your plate.',
			'What keeps your site alive after launch.',
		],
	);
	for (const [i, o] of OFFERS.entries()) {
		const body = tiles[i].text;
		assert.equal(o.lead, body.slice(0, body.indexOf('. ') + 1), o.id);
		assert.equal(lineText(o.lines[0]), o.lead, o.id);
	}
});

test('brass is exactly what the addendum sets in bold, in order and in place', () => {
	// The parser sees the bold a reader sees: 3, 2, 2, 1 and 2 spans.
	assert.deepEqual(
		tiles.map((t) => t.bold.length),
		[3, 2, 2, 1, 2],
	);
	for (const [i, o] of OFFERS.entries()) {
		assert.deepEqual(brassSpans(o), tiles[i].bold, o.id);
		// In place too: written back out with **, it is the addendum's own paragraph.
		assert.equal(asMarkdown(o, i + 1), tiles[i].raw, o.id);
	}
});

test('slashed prices: old price struck, "slashed" kept but hidden, arrow and new price shown', () => {
	const slashed = site.lines.flatMap((line) =>
		line.flatMap((s, i) => (s.strike ? [line.slice(i, i + 3)] : [])),
	);
	assert.deepEqual(slashed, [
		[
			{ text: '$990', brass: true, strike: true },
			{ text: ' slashed', brass: true, srOnly: true },
			{ text: ' → FREE', brass: true },
		],
		[
			{ text: '$69/mo', brass: true, strike: true },
			{ text: ' slashed', brass: true, srOnly: true },
			{ text: ' → $39/mo', brass: true },
		],
	]);
	for (const [full, seen] of [
		['$990 slashed → FREE', '$990 → FREE'],
		['$69/mo slashed → $39/mo', '$69/mo → $39/mo'],
	]) {
		assert.ok(offerText(site).includes(full), full);
		assert.ok(visibleText(site).includes(seen), seen);
		assert.ok(!visibleText(site).includes(full), `"slashed" still shows in ${full}`);
	}
	// Nothing is struck or hidden anywhere else.
	for (const o of [systems, app, addons, care]) {
		assert.ok(!o.lines.flat().some((s) => s.strike || s.srOnly), o.id);
	}
});

test('visibleText drops the hidden words and nothing else, leaving single spaces', () => {
	for (const o of OFFERS) {
		assert.equal(visibleText(o), offerText(o).replaceAll(' slashed', ''), o.id);
		assert.ok(!visibleText(o).includes('  '), `${o.id}: double space`);
	}
	assert.notEqual(visibleText(site), offerText(site));
});

test('no line is empty, and none starts or ends with a space', () => {
	for (const o of OFFERS) {
		assert.ok(o.lines.length > 0, o.id);
		for (const [n, line] of o.lines.entries()) {
			const where = `${o.id}, line ${n + 1}`;
			assert.ok(line.length > 0, where);
			for (const s of line) assert.ok(s.text.length > 0, `${where}: empty segment`);
			for (const text of [lineText(line), lineText(line, true)]) {
				assert.ok(text.length > 0, where);
				assert.equal(text, text.trim(), where);
			}
		}
	}
});

test('a segment is text plus flags that are only ever true', () => {
	for (const o of OFFERS) {
		for (const s of o.lines.flat()) {
			const { text, ...flags } = s;
			assert.equal(typeof text, 'string', o.id);
			for (const [flag, value] of Object.entries(flags)) {
				assert.ok(['brass', 'strike', 'srOnly'].includes(flag), `${o.id}: unknown field "${flag}"`);
				assert.equal(value, true, `${o.id}: ${flag}`);
			}
		}
	}
});

test('Add-ons has no ownership wording; the three builds do', () => {
	assert.doesNotMatch(everything(addons), /own/i);
	for (const o of [site, systems, app]) assert.match(offerText(o), /You own /, o.id);
});

test('"Their care goes up" lives only in Care', () => {
	for (const o of OFFERS) {
		assert.equal(/care goes up/i.test(everything(o)), o === care, o.id);
	}
	assert.equal(offerText(care).split('Their care goes up').length, 2, 'once in Care');
});

test('"Google" appears nowhere', () => {
	for (const o of OFFERS) assert.doesNotMatch(everything(o), /google/i, o.id);
});

test('the only dollar amounts anywhere are $990, $69/mo and $39/mo', () => {
	const amounts = (s: string): string[] => s.match(/\$\d+(?:[.,]\d+)*(?:\/[a-z]+)?/gi) ?? [];
	const all = OFFERS.map(everything).join('\n');
	assert.deepEqual([...new Set(amounts(all))].sort(), ['$39/mo', '$69/mo', '$990']);
	// Take those three out and nothing is left: no other "$", no other number.
	assert.doesNotMatch(all.replace(/\$(?:990|69\/mo|39\/mo)(?![\w/])/g, ''), /[$\d]/);
	// They sit where the addendum puts them: the founding offer in Site, the care rate in Care.
	assert.deepEqual(
		OFFERS.map((o) => amounts(offerText(o))),
		[['$990', '$69/mo', '$39/mo'], [], [], [], ['$39/mo', '$69/mo']],
	);
});
