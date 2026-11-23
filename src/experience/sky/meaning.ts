// B7, the meaning written in light. Once every star of a figure is lit, the
// figure's meaning is written over it by lightning, letter by letter, and
// each letter cools into brass with a thin blue line in it, the way the
// wordmark's letters are made. After Leo's, the final line.
//
// The words are live text in #sky-ui (one element a figure, made when the
// figure completes), exactly the strings of src/content/constellations.ts.
// A screen reader gets each line once, whole; the letters that are seen are
// hidden from it.
//
// A meaning is written once: when its figure completes in front of the
// visitor, or the first time the visitor comes to a figure that is complete.
// From then on, in this visit, it is simply there, and it stays with its
// figure: it stands at a point of the figure's plane and is drawn at the
// plane's scale, so it comes up out of the distance with the figure and is
// flown through with it. Under reduced motion nothing is written: the words
// are there.
//
// Where it stands is chosen from the picture at the station. The line stands
// by its figure: in the largest free area inside or beside the figure's own
// bounds, clear of every star, every star's button and every line of the
// figure, of the logo and menu and of the exit button; large on a wide
// screen, at a size for the hand on a narrow one and on a phone held on its
// side. Where the whole line finds no room it is broken into two even rows,
// then three, at every size; then it takes the roomiest place that touches
// nothing, however little air it has. Only if the figure leaves no such place
// at any size does it stand in the free band nearest the figure's foot (and
// between the two widths, where neither is tuned).

import { CONSTELLATIONS, FINAL_LINE } from '../../content/constellations.ts';
import { bolt, flickerFrame, mix, seeded, strokeBolt } from '../loader/lightning.ts';
import { B3, FIGURES, SPACING } from './config.ts';
import type { SkyHooks } from './hooks.ts';
import { mod } from './layout.ts';

/** The figure whose completion brings the final line. */
const LAST = CONSTELLATIONS.findIndex((figure) => figure.name === 'Leo');

/** Type size at the station, CSS pixels, at or under `narrow` pixels of width and above it. */
const TYPE = { phone: 21, desktop: 34, min: 12, narrow: 720, margin: 16 } as const;
/**
 * A screen under this many pixels high is a phone held on its side, however wide it is
 * (430 is the tallest of them; a desktop window is seldom under 500): the words are set and
 * placed for the hand there (`SIDE`), not for a desktop.
 */
const SHORT = 450;
/** How the words are placed by their figure on one kind of screen. */
export interface Placing {
	/** The sizes tried, largest first. */
	sizes: readonly number[];
	step: number;
	least: number;
	air: number;
	exit: number;
	reach: number;
	/** Sideways the words' box reaches at least this far into the figure's bounds (under 0: it may stand off them). */
	into: number;
	/** The rows a line may stand in: each list is tried at every size before the next list is. */
	passes: readonly (readonly number[])[];
	/** A line is broken only if it is at least this wide whole: a share of the screen's room, or pixels. */
	breakShare: number;
	breakPx: number;
	/** With no place that has `least` of air: the roomiest place that touches nothing, before the band. */
	tight: boolean;
	far: number;
	farYields: boolean;
	farClear: number;
}
/** Three rows only for a line of this many words: never a word a row. */
const THREE_ROWS_WORDS = 5;
/**
 * Placed by its figure: the sizes tried, largest first; the grid the places are tried on;
 * the least air the words keep from a star or line, and the air beyond which more is not
 * better; and how far above the exit button's room their foot stays. From `from` pixels
 * of width up the line is set large (`WIDE`); on a narrow screen (`TALL`), where most
 * figures stand tall, at a size that suits the hand.
 */
const WIDE: Placing & { from: number } = {
	from: 1024,
	sizes: [54, 50, 46, 42, 38, 34],
	step: 10,
	least: 14,
	air: 90,
	exit: 48,
	/** How far outside the figure's bounds the words' box may begin or end: here it must reach into them. */
	reach: -12,
	into: 24,
	/** The line is never broken. */
	passes: [[1]],
	breakShare: 0.45,
	breakPx: Number.POSITIVE_INFINITY,
	tight: false,
	/**
	 * The stars of this many figures further on show through as points in the middle of the
	 * screen, which is where a figure's free room often is: the words keep clear of them…
	 */
	far: 4,
	/**
	 * …where there is other free room for type of the same size. Where there is none the
	 * points give way, not the type: the words stand as if the points were not there. And a
	 * point only bars a place (within `farClear` pixels of it): it is not counted in the air
	 * a place is chosen by, so a figure whose words were clear of them already stays put.
	 */
	farYields: true,
	farClear: 24,
};
const TALL: Placing = {
	sizes: [24, 22, 21, 20, 18],
	step: 6,
	least: 10,
	air: 44,
	exit: 24,
	/** A figure that is not tall has its free room just above or under it. */
	reach: 40,
	into: 24,
	/**
	 * A long line may stand in two rows: at each size the whole line is tried first.
	 * (Leo's meaning is as wide as the screen in one row, and Leo stands 73% of its height.)
	 * Only when no size has room for one row or two is it tried in three, again at every
	 * size (on a 375x667 phone Leo leaves two rows no place with air, at any size).
	 */
	passes: [[1, 2], [3]],
	breakShare: 0.45,
	breakPx: Number.POSITIVE_INFINITY,
	/**
	 * And if three rows find no air either: a place that touches nothing, in smaller type,
	 * before the band, whose one size may lie across a star.
	 */
	tight: true,
	/**
	 * The stars of this many figures further on gather in the middle of a narrow screen, where
	 * the free room often is: the words keep clear of those points too.
	 */
	far: 3,
	/** Here the type gives way to them (a size smaller), and they count as air, as any star does. */
	farYields: false,
	farClear: 0,
};
/**
 * A phone held on its side: the figures stand upright as on a desktop and fill the height, so
 * the free room is beside them. The type is the hand's, the places are scored as on the phone,
 * the points of the figures further on count as stars (the next four, as a wide screen shows
 * them), and the words may stand beside the figure's outermost star: up to `-into` pixels off
 * its bounds. A line 200 px wide or more may be broken: the room beside a figure is narrow.
 */
const SIDE: Placing = {
	...TALL,
	into: -80,
	breakShare: 1,
	breakPx: 200,
	far: 4,
};
/**
 * How the words are placed on a screen of this size: by their figure as on a phone held on
 * its side, as on a wide screen or as on a narrow one; or, between the two widths, in the band.
 */
export function placingFor(
	w: number,
	h: number,
): { kind: 'side' | 'wide' | 'tall' | 'band'; by: Readonly<Placing> | null } {
	// A phone on its side first: it is as wide as a small desktop and is not one.
	if (h < SHORT) return { kind: 'side', by: SIDE };
	if (w >= WIDE.from) return { kind: 'wide', by: WIDE };
	if (w <= TYPE.narrow) return { kind: 'tall', by: TALL };
	return { kind: 'band', by: null };
}

/** The writing, seconds. */
const WRITE = {
	/** One line is written in about this long, however many letters it has… */
	line: 1.5,
	/** …but no letter faster or slower than this. */
	stepMin: 0.05,
	stepMax: 0.11,
	/** The final line has its own beat: the meaning is written, it cools, and then. */
	pause: 1.15,
	/** How long the bolt stands on a letter, and how long the letter's outline burns. */
	bolt: 0.15,
	burn: 0.5,
	/** A letter's cooling (the stylesheet's animation), and the time allowed for it at the end. */
	cool: 1,
} as const;
/** The words are seen while their plane is between these multiples of its scale at the station. */
const SEEN = { from: 0.32, full: 0.7, near: 1.5, gone: 2.4 } as const;
/** "At the station": the plane's scale is within this of its scale there. */
const AT_STATION = 0.06;
/** Room kept clear around a star: its 44 px button, and a little air. */
const STAR_CLEAR = 28;
/** The logo and menu button, and the exit button, as the sky's layout reserves them. */
const CHROME = { w: 150, h: 92 } as const;
const EXIT = { w: 320, h: 104 } as const;
/** The bolt comes from the nearest star if one is this near, else from the dark above the line. */
const SOURCE_MAX = 420;

type State = 'fresh' | 'writing' | 'written';

interface Letter {
	el: HTMLElement;
	ch: string;
	/** When it is struck, seconds from the start of the writing. */
	at: number;
	on: boolean;
	/** Its box in the paragraph's own pixels, measured when the writing begins. */
	x: number;
	y: number;
	w: number;
	h: number;
}

interface Entry {
	figure: number;
	el: HTMLParagraphElement;
	letters: Letter[];
	/** Seconds from the first letter to the last. */
	length: number;
	state: State;
	/** World x, y in the figure's plane of the middle of the words' top edge. */
	anchor: { x: number; y: number } | null;
	/** The layout the anchor was chosen for. */
	key: string;
	/** How the place was come by. */
	placed: Placed | null;
	/** Where the lightning comes from, in the element's own pixels. */
	source: { x: number; y: number };
	t0: number;
	canvas: HTMLCanvasElement | null;
	/** The canvas's left and top in the element's own pixels. */
	origin: { x: number; y: number };
	release: (() => void) | null;
	shown: boolean;
}

/**
 * How a meaning's place was come by: the type, the rows its line stands in, and whether the
 * search found it by the figure with air round it (`figure`), took the roomiest place that
 * touches nothing (`tight`), or fell back to the band (`band`).
 */
export interface Placed {
	px: number;
	rows: number;
	how: 'figure' | 'tight' | 'band';
}

export interface MeaningState {
	figure: number;
	name: string;
	lines: string[];
	state: State;
	shown: boolean;
	/** For the tools: how its place was come by on this screen. */
	placed: Placed | null;
}

export interface Meaning {
	/** Every meaning there is so far: one for each complete figure. For the tools. */
	state(): MeaningState[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const smoothstep = (a: number, b: number, x: number): number => {
	const t = clamp((x - a) / (b - a), 0, 1);
	return t * t * (3 - 2 * t);
};

export function createMeaning(hooks: SkyHooks): Meaning {
	const entries = new Map<number, Entry>();
	let dirty = true;
	const measure = document.createElement('canvas').getContext('2d');

	const linesOf = (figure: number): string[] => {
		const meaning = CONSTELLATIONS[figure]?.meaning ?? '';
		return figure === LAST ? [meaning, FINAL_LINE] : [meaning];
	};

	const complete = (figure: number): boolean => {
		const stars = CONSTELLATIONS[figure]?.stars ?? [];
		let any = false;
		for (const star of stars) {
			if (!star.slot) continue;
			any = true;
			if (!hooks.isLit(star.slot)) return false;
		}
		return any;
	};

	// ── the element ──

	function build(figure: number): Entry {
		const el = document.createElement('p');
		el.className = 'sky-meaning';
		el.dataset.meaning = CONSTELLATIONS[figure]?.name ?? '';
		el.hidden = true;
		const letters: Letter[] = [];
		let at = 0;
		for (const [n, text] of linesOf(figure).entries()) {
			const line = document.createElement('span');
			line.className = 'sky-meaning__line';
			// What a screen reader reads: the line, whole, once.
			const say = document.createElement('span');
			say.className = 'sky-meaning__say';
			say.textContent = text;
			// What is seen: the same line, a letter at a time.
			const ink = document.createElement('span');
			ink.className = 'sky-meaning__ink';
			ink.setAttribute('aria-hidden', 'true');
			const count = text.replace(/\s/g, '').length;
			const step = clamp(WRITE.line / Math.max(1, count), WRITE.stepMin, WRITE.stepMax);
			if (n > 0) at += WRITE.pause;
			for (const [w, word] of text.split(' ').entries()) {
				if (w > 0) ink.append(' ');
				const box = document.createElement('span');
				box.className = 'sky-meaning__word';
				for (const ch of word) {
					const i = document.createElement('i');
					i.textContent = ch;
					i.dataset.ch = ch;
					box.append(i);
					letters.push({ el: i, ch, at, on: false, x: 0, y: 0, w: 0, h: 0 });
					at += step;
				}
				ink.append(box);
			}
			line.append(say, ink);
			el.append(line);
		}
		hooks.ui.append(el);
		return {
			figure,
			el,
			letters,
			length: at,
			state: 'fresh',
			anchor: null,
			key: '',
			placed: null,
			source: { x: 0, y: 0 },
			t0: 0,
			canvas: null,
			origin: { x: 0, y: 0 },
			release: null,
			shown: false,
		};
	}

	/** The thin line in a letter is the same letter in a lighter weight: fit its width to the letter's. */
	function fitLines(entry: Entry): void {
		const first = entry.letters[0]?.el;
		if (!first || !measure) return;
		const style = getComputedStyle(first);
		const font = (weight: string) => `${weight} ${style.fontSize} ${style.fontFamily}`;
		for (const letter of entry.letters) {
			measure.font = font(style.fontWeight);
			const bold = measure.measureText(letter.ch).width;
			measure.font = font('400');
			const light = measure.measureText(letter.ch).width;
			letter.el.style.setProperty('--sx', light > 0 ? (bold / light).toFixed(4) : '1');
		}
	}

	/** Choose the type size and where the words stand, for the layout as it is now. */
	function place(entry: Entry): void {
		const layout = hooks.layout();
		const { el, figure } = entry;
		const plan = layout.plans[figure];
		const fit = layout.fits[figure];
		entry.key = `${layout.w}x${layout.h}`;
		entry.placed = null;
		if (!plan || !fit) {
			entry.anchor = null;
			return;
		}
		// Measured as it will stand at the station: unscaled, laid out, not seen.
		const was = { hidden: el.hidden, transform: el.style.transform };
		el.hidden = false;
		el.style.transform = 'none';
		el.style.visibility = 'hidden';
		const room = layout.w - 2 * TYPE.margin;
		const finalInk = el.querySelector<HTMLElement>(
			'.sky-meaning__line + .sky-meaning__line .sky-meaning__ink',
		);
		/** Set the type, in one row or broken evenly into `rows`, and say how large the words then are. */
		const set = (px: number, rows = 1): { w: number; h: number } => {
			el.style.whiteSpace = '';
			el.style.maxWidth = '';
			el.style.fontSize = `${px}px`;
			if (rows > 1) {
				// A little over an even share of the whole line, so that it breaks into that many
				// rows; and never narrower than the final line, which is not broken.
				const share = Math.ceil((el.offsetWidth / rows) * 1.14) + 2;
				const tail = finalInk ? Math.ceil(finalInk.getBoundingClientRect().width) + 1 : 0;
				el.style.maxWidth = `${Math.max(share, tail)}px`;
				el.style.whiteSpace = 'normal';
			} else if (el.offsetWidth > room) {
				const size = Math.max(TYPE.min, Math.floor(((px * room) / el.offsetWidth) * 2) / 2);
				el.style.fontSize = `${size}px`;
			}
			return { w: el.offsetWidth, h: el.offsetHeight };
		};
		const { kind, by } = placingFor(layout.w, layout.h);
		const wide = kind === 'wide';
		/** Set and scored for the hand. */
		const hand = kind === 'side' || kind === 'tall';

		// The figure as it stands at its station.
		const cam = layout.cameraAt(layout.station(figure));
		const z = -figure * SPACING;
		const stars = plan.stars.map((star, i) => {
			const p = layout.project(cam, star.x, star.y, z);
			const r =
				i === plan.epicentre
					? B3.ring * layout.b3 * fit.scale + 10
					: Math.max(STAR_CLEAR, layout.starPx * layout.sizeOf(star) * 1.6 + 8);
			return { x: p.x, y: p.y, r };
		});
		// The figure's lines too: the words are not struck through.
		const blocks = [...stars];
		for (const [a, b] of plan.lines) {
			const p = stars[a];
			const q = stars[b];
			if (!p || !q) continue;
			const steps = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 14);
			for (let i = 1; i < steps; i++) {
				blocks.push({
					x: p.x + ((q.x - p.x) * i) / steps,
					y: p.y + ((q.y - p.y) * i) / steps,
					r: 9,
				});
			}
		}
		// And, where it is asked for, the stars of the figures further on, as small as they are there.
		const farBlocks: typeof blocks = [];
		for (let n = 1; n <= (by?.far ?? 0); n++) {
			const further = mod(figure + n, FIGURES);
			const planN = layout.plans[further];
			const fitN = layout.fits[further];
			if (!planN || !fitN) continue;
			for (const [i, star] of planN.stars.entries()) {
				const p = layout.project(cam, star.x, star.y, z - n * SPACING);
				if (p.scale <= 0) continue;
				const r =
					i === planN.epicentre
						? B3.ring * layout.b3 * p.scale
						: Math.max(fitN.starR * layout.sizeOf(star) * p.scale, 1.25);
				farBlocks.push({ x: p.x, y: p.y, r: r + 5 });
			}
		}
		const xs = stars.map((s) => s.x);
		const ys = stars.map((s) => s.y);
		const bounds = {
			x0: Math.min(...xs),
			x1: Math.max(...xs),
			y0: Math.min(...ys),
			y1: Math.max(...ys),
		};
		const middle = (bounds.x0 + bounds.x1) / 2;
		const foot = bounds.y1 + STAR_CLEAR + 6;
		// The final line keeps the height of a line clear above the exit button, and so
		// does any line set large: it is the figure's, not a caption to the button.
		const lines = linesOf(figure).length;
		/**
		 * What a box of the words at (cx, y) would lie on, and how much air it
		 * has: the distance from its edge to the nearest star or line. With `far`
		 * the points of the figures further on count like any star.
		 */
		const lie = (
			cx: number,
			y: number,
			w: number,
			h: number,
			far = true,
		): { hits: number; air: number } => {
			const x0 = cx - w / 2 - 4;
			const x1 = cx + w / 2 + 4;
			const y0 = y - 4;
			const y1 = y + h + 4;
			let hits = 0;
			let air = Number.POSITIVE_INFINITY;
			const gap = (s: { x: number; y: number; r: number }) =>
				Math.hypot(Math.max(x0 - s.x, 0, s.x - x1), Math.max(y0 - s.y, 0, s.y - y1)) - s.r;
			for (const s of blocks) {
				const d = gap(s);
				if (d < 0) hits++;
				if (d < air) air = d;
			}
			if (far) {
				for (const s of farBlocks) {
					const d = gap(s);
					if (by?.farYields) {
						if (d < by.farClear) hits++;
						continue;
					}
					if (d < 0) hits++;
					if (d < air) air = d;
				}
			}
			// Standing on the chrome or on the exit button is worse than crossing any star or line.
			if (x0 < CHROME.w && y0 < CHROME.h) hits += 100;
			// On a narrow screen the band keeps its distance from the button too.
			const keep = EXIT.h + Math.max(lines > 1 || wide ? h / lines : 0, hand ? TALL.exit : 0);
			if (
				y1 > layout.h - keep &&
				x1 > layout.w / 2 - EXIT.w / 2 &&
				x0 < layout.w / 2 + EXIT.w / 2
			) {
				hits += 100;
			}
			return { hits, air };
		};

		type Spot = { cx: number; y: number; w: number; h: number; px: number; rows: number };
		let best: Spot | null = null;
		let how: Placed['how'] = 'figure';
		/** The roomiest place that touches nothing and has less than `least` of air. */
		let tight: (Spot & { air: number }) | null = null;
		const words = (linesOf(figure)[0] ?? '').split(' ').length;
		/** May the line stand in this many rows, being `whole` wide in one? */
		const breaks = (rows: number, whole: number): boolean =>
			whole >= Math.min((by?.breakShare ?? 0.45) * room, by?.breakPx ?? Number.POSITIVE_INFINITY) &&
			(rows < 3 || words >= THREE_ROWS_WORDS);
		/** True if the type broke into more rows than were asked for (a word a row). */
		const overBroken = (rows: number, px: number, h: number): boolean =>
			h > (rows + lines - 0.5) * px * 1.3 + (lines - 1) * 0.42 * px;
		if (by) {
			// By the figure: the largest type that finds free room inside or beside
			// the figure's bounds, and of that room the place with the most air. One
			// row or two at every size; only then three, at every size.
			search: for (const pass of by.passes) {
				for (const px of by.sizes) {
					let whole = 0;
					for (const rows of pass) {
						if (rows > 1 && whole === 0) whole = set(px).w;
						// Breaking a line that is short already gains nothing.
						if (rows > 1 && !breaks(rows, whole)) break;
						const { w, h } = set(px, rows);
						if (rows === 1) whole = w;
						// Nor does a break into more rows than were asked for.
						else if (overBroken(rows, px, h)) continue;
						const left = w / 2 + TYPE.margin;
						const right = layout.w - w / 2 - TYPE.margin;
						if (right < left) continue;
						// "Beside": the words' box may reach out of the bounds, but it still touches them
						// (on a phone on its side it may stand off them, by the outermost star).
						const fromX = Math.max(left, bounds.x0 - w / 2 + by.into);
						const toX = Math.min(right, bounds.x1 + w / 2 - by.into);
						const fromY = Math.max(CHROME.h * 0.6, bounds.y0 - h - by.reach);
						// Well above the exit button wherever it stands across the screen.
						const toY = Math.min(layout.h - EXIT.h - h - by.exit, bounds.y1 + by.reach);
						// Clear of the far figures' points first; and, where they yield, without them
						// before the type is made any smaller.
						for (const far of by.farYields && farBlocks.length > 0 ? [true, false] : [true]) {
							let top = Number.NEGATIVE_INFINITY;
							let found: { cx: number; y: number } | null = null;
							for (let y = fromY; y <= toY; y += by.step) {
								for (let cx = fromX; cx <= toX; cx += by.step) {
									const at = lie(cx, y, w, h, far);
									if (at.hits > 0) continue;
									if (at.air < by.least) {
										if (by.tight && (!tight || at.air > tight.air)) {
											tight = { cx, y, w, h, px, rows, air: at.air };
										}
										continue;
									}
									// Air first, up to a point; then the middle of the figure.
									const off = Math.hypot(cx - middle, y + h / 2 - (bounds.y0 + bounds.y1) / 2);
									const score = Math.min(at.air, by.air) * 3 - off * 0.35;
									if (score > top) {
										top = score;
										found = { cx, y };
									}
								}
							}
							if (found) {
								best = { ...found, w, h, px, rows };
								break search;
							}
						}
					}
				}
			}
			if (!best && tight) {
				// No place with air at any size: the one that touches nothing, set again as it was measured.
				const { w, h } = set(tight.px, tight.rows);
				best = { ...tight, w, h };
				how = 'tight';
			}
		}
		if (!best) {
			// The free band nearest the figure's foot.
			how = 'band';
			const band = (px: number, rows: number): { spot: Spot; hits: number } | null => {
				const { w, h } = set(px, rows);
				if (rows > 1 && overBroken(rows, px, h)) return null;
				const half = w / 2;
				const left = half + TYPE.margin;
				const right = layout.w - half - TYPE.margin;
				let low = Number.POSITIVE_INFINITY;
				let spot: Spot = {
					cx: clamp(middle, left, Math.max(left, right)),
					y: foot,
					w,
					h,
					px,
					rows,
				};
				for (const shift of [0, -60, 60, -120, 120, -200, 200]) {
					const cx = clamp(middle + shift, left, Math.max(left, right));
					for (let y = 8; y + h <= layout.h - 8; y += 6) {
						const score = lie(cx, y, w, h).hits * 1e6 + Math.abs(y - foot) + Math.abs(shift) * 0.5;
						if (score < low) {
							low = score;
							spot = { ...spot, cx, y };
						}
					}
				}
				return { spot, hits: Math.floor(low / 1e6) };
			};
			const size = hand ? TYPE.phone : TYPE.desktop;
			let least = band(size, 1);
			if (by?.tight && least && least.hits > 0) {
				// A band that lies on a star never wins over smaller type, or more rows, that touch less.
				search: for (const px of by.sizes) {
					if (px > size) continue;
					const whole = set(px).w;
					for (const rows of [1, 2, 3]) {
						if (rows > 1 && !breaks(rows, whole)) break;
						const next = band(px, rows);
						if (!next || next.hits >= least.hits) continue;
						least = next;
						if (least.hits === 0) break search;
					}
				}
				set(least.spot.px, least.spot.rows);
			}
			best = least?.spot ?? null;
		}
		if (!best) {
			entry.anchor = null;
			return;
		}
		entry.placed = { px: Number.parseFloat(el.style.fontSize) || best.px, rows: best.rows, how };
		const { w, h } = best;
		const half = w / 2;
		fitLines(entry);
		el.style.visibility = '';
		el.style.transform = was.transform;
		el.hidden = was.hidden;
		entry.anchor = {
			x: cam.x + (best.cx - layout.w / 2) / fit.scale,
			y: cam.y - (best.y - layout.h / 2) / fit.scale,
		};

		// The lightning comes down from the nearest star.
		const mid = { x: best.cx, y: best.y + h / 2 };
		let near: { x: number; y: number } | null = null;
		let nearD = SOURCE_MAX;
		for (const s of stars) {
			const d = Math.hypot(s.x - mid.x, s.y - mid.y);
			if (d < nearD) {
				nearD = d;
				near = s;
			}
		}
		const from = near ?? { x: mid.x, y: best.y - 160 };
		entry.source = { x: from.x - (best.cx - half), y: from.y - best.y };
	}

	// ── the writing ──

	function settle(entry: Entry): void {
		entry.state = 'written';
		for (const letter of entry.letters) letter.on = true;
		entry.el.dataset.settled = '';
		entry.canvas?.remove();
		entry.canvas = null;
		entry.release?.();
		entry.release = null;
	}

	function begin(entry: Entry, time: number): void {
		entry.state = 'writing';
		entry.t0 = time;
		entry.release = hooks.keepAwake();
		const { el, source } = entry;
		// On stage from here on (its letters are still unwritten, so nothing is seen yet).
		entry.shown = true;
		el.hidden = false;
		// Where each letter is, in the paragraph's own pixels: its box on screen,
		// taken back through the paragraph's scale.
		const frame = el.getBoundingClientRect();
		const k = el.offsetWidth / Math.max(1, frame.width);
		for (const letter of entry.letters) {
			const r = letter.el.getBoundingClientRect();
			letter.x = (r.left - frame.left) * k;
			letter.y = (r.top - frame.top) * k;
			letter.w = r.width * k;
			letter.h = r.height * k;
		}
		// A canvas over the words and out to where the lightning comes from.
		const pad = 36;
		const x0 = Math.min(0, source.x) - pad;
		const y0 = Math.min(0, source.y) - pad;
		const x1 = Math.max(el.offsetWidth, source.x) + pad;
		const y1 = Math.max(el.offsetHeight, source.y) + pad;
		const canvas = document.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.ceil((x1 - x0) * ratio);
		canvas.height = Math.ceil((y1 - y0) * ratio);
		Object.assign(canvas.style, {
			left: `${x0}px`,
			top: `${y0}px`,
			width: `${x1 - x0}px`,
			height: `${y1 - y0}px`,
		});
		el.append(canvas);
		entry.canvas = canvas;
		entry.origin = { x: x0, y: y0 };
	}

	function write(entry: Entry, time: number): void {
		const u = time - entry.t0;
		for (const letter of entry.letters) {
			if (!letter.on && u >= letter.at) {
				letter.on = true;
				letter.el.dataset.on = '';
			}
		}
		const canvas = entry.canvas;
		const g = canvas?.getContext('2d');
		if (canvas && g) {
			const ratio = canvas.width / Math.max(1, Number.parseFloat(canvas.style.width));
			g.setTransform(ratio, 0, 0, ratio, -entry.origin.x * ratio, -entry.origin.y * ratio);
			g.clearRect(entry.origin.x, entry.origin.y, canvas.width / ratio, canvas.height / ratio);
			const first = entry.letters[0]?.el;
			const style = first ? getComputedStyle(first) : null;
			const px = style ? Number.parseFloat(style.fontSize) : TYPE.desktop;
			if (style) g.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
			const metrics = g.measureText('x');
			const ascent = metrics.fontBoundingBoxAscent || px * 0.8;
			const descent = metrics.fontBoundingBoxDescent || px * 0.2;
			const flick = flickerFrame(time);
			for (const [i, letter] of entry.letters.entries()) {
				const age = u - letter.at;
				if (age < 0 || age > WRITE.burn) continue;
				const { x, y } = letter;
				const baseline = y + (letter.h - (ascent + descent)) / 2 + ascent;
				const cx = x + letter.w / 2;
				const cy = baseline - px * 0.3;
				if (age < WRITE.bolt) {
					const lines = bolt(entry.source.x, entry.source.y, cx, cy, {
						seed: mix(entry.figure, i, flick),
						shape: mix(entry.figure, i),
						sway: 0.14,
						detail: 5,
						branches: 2,
						branchLength: 0.22,
					});
					strokeBolt(g, lines, {
						width: Math.max(1, px * 0.055),
						alpha: 1 - 0.4 * (age / WRITE.bolt),
					});
				}
				// The letter's own outline, burning: lightning along the glyph.
				const heat = (1 - age / WRITE.burn) ** 1.6;
				const random = seeded(mix(entry.figure, i, flick, 7));
				g.save();
				g.globalCompositeOperation = 'lighter';
				g.lineJoin = 'round';
				g.textBaseline = 'alphabetic';
				g.shadowColor = 'rgb(72 120 255)';
				for (const [width, alpha, blur, colour] of [
					[px * 0.16, 0.22 * heat, px * 0.5, 'rgb(72 120 255)'],
					[px * 0.05, heat, px * 0.25, 'rgb(238 245 255)'],
				] as const) {
					g.lineWidth = width;
					g.globalAlpha = alpha;
					g.shadowBlur = blur * ratio;
					g.strokeStyle = colour;
					g.strokeText(
						letter.ch,
						x + (random() - 0.5) * px * 0.05,
						baseline + (random() - 0.5) * px * 0.05,
					);
				}
				g.restore();
			}
		}
		if (u >= entry.length + WRITE.cool) settle(entry);
	}

	// ── every frame ──

	hooks.on('ignite', () => {
		dirty = true;
	});
	hooks.claims.then(
		(claims) => {
			claims.subscribe(() => {
				dirty = true;
				hooks.requestFrame();
			});
			dirty = true;
			hooks.requestFrame();
		},
		() => {},
	);

	hooks.on('frame', ({ time }) => {
		if (dirty) {
			dirty = false;
			for (let figure = 0; figure < FIGURES; figure++) {
				if (!entries.has(figure) && complete(figure)) entries.set(figure, build(figure));
			}
		}
		if (entries.size === 0) return;
		const layout = hooks.layout();
		const key = `${layout.w}x${layout.h}`;
		const front = hooks.lattice.layer();
		const still = hooks.isStill();
		for (const entry of entries.values()) {
			if (entry.key !== key) place(entry);
			const fit = layout.fits[entry.figure];
			if (!entry.anchor || !fit) continue;
			// The nearest layer ahead that shows this figure.
			const layer = front + mod(entry.figure - front, FIGURES);
			const p = hooks.project(entry.anchor.x, entry.anchor.y, -layer * SPACING);
			const rel = p.scale / fit.scale;
			const alpha =
				p.scale > 0
					? smoothstep(SEEN.from, SEEN.full, rel) * (1 - smoothstep(SEEN.near, SEEN.gone, rel))
					: 0;
			const seen = alpha > 0.01;
			if (seen) {
				entry.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, 0) scale(${rel.toFixed(4)})`;
				entry.el.style.opacity = alpha.toFixed(3);
			}

			if (entry.state === 'fresh' && seen) {
				if (still) settle(entry);
				else if (
					layer === front &&
					Math.abs(rel - 1) < AT_STATION &&
					hooks.isActive() &&
					hooks.focused() === null
				) {
					begin(entry, time);
				}
			}
			if (entry.state === 'writing') {
				// Left behind, or asked to be still, mid-word: the rest is simply there.
				if (!seen || still) settle(entry);
				else write(entry, time);
			}

			const show = seen && entry.state !== 'fresh';
			if (show !== entry.shown) {
				entry.shown = show;
				entry.el.hidden = !show;
			}
		}
	});

	return {
		state: () =>
			[...entries.values()].map((entry) => ({
				figure: entry.figure,
				name: CONSTELLATIONS[entry.figure]?.name ?? '',
				lines: linesOf(entry.figure),
				state: entry.state,
				shown: entry.shown,
				placed: entry.placed,
			})),
	};
}
