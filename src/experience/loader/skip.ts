// What counts as a wish to skip the loader, and the presses made before the
// loader was there to hear them.
//
// The rule is one rule, here: index.ts asks it for every key that goes down
// while the loader plays, and for every press the page's markup remembered
// before this script had arrived (the inline script in Loader.astro, which
// only writes down what was pressed and judges nothing). On a slow line the
// unlit C stands a second or more before the script does; a visitor who taps
// it then has asked to skip as surely as one who taps a second later.

/** Keys that are not a wish to skip: moving focus, and modifiers pressed alone. */
const QUIET_KEYS = new Set([
	'Tab',
	'Shift',
	'Control',
	'Alt',
	'AltGraph',
	'Meta',
	'OS',
	'CapsLock',
	'NumLock',
	'ScrollLock',
	'Fn',
	'FnLock',
	'Hyper',
	'Super',
	'Symbol',
	'SymbolLock',
	'Dead',
	'Unidentified',
]);

/** One press: the key that went down (KeyboardEvent.key), or null for a pointer (a tap, a click). */
export type Press = string | null;

/** Is this press a wish to skip? */
export const isSkip = (press: Press): boolean => press === null || !QUIET_KEYS.has(press);

/** Was any of these a wish to skip? Tab and Shift before the script arrived are no more a skip than after. */
export const anySkip = (presses: readonly Press[]): boolean => presses.some(isSkip);

/**
 * What the inline script in Loader.astro leaves on `window.__loaderEarly`,
 * and only where the loader is going to play.
 */
export interface Early {
	/**
	 * When the page showed the server's unlit C, whole: the time of the frame
	 * it was first drawn in, ms on performance.now()'s clock. Null until then,
	 * and for good if the canvas drew first or this is a return visit.
	 */
	seenAt: number | null;
	/**
	 * The presses made on this page so far, oldest first. Taking them stops the
	 * listening and empties the list: they are read once.
	 */
	take(): Press[];
}
