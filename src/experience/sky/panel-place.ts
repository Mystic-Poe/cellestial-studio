// Where a star's panel stands (B10, and the lit star's panel): pure geometry, so that it can be
// tested without a page. panels.ts measures the panel, the screen and the exit button and asks.

/** Room kept between a panel and the screen's edges, and between it and its star. Pixels. */
export const MARGIN = 12;
export const GAP = 12;
/** The logo and the menu button stand here: no panel is laid over them. */
export const CHROME = { w: 118, h: 88 } as const;

export interface Rect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

const overlap = (a: Rect, b: Rect) =>
	Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
	Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * Beside the star: to its right, else its left, else under it, else over it; always whole on
 * the screen, and clear of the exit button ("See what holds up the sky") while it is shown, so
 * that the button never stands over the panel's own button (the owner, 24 Nov). Where no place
 * is clear of the button (a phone on its side has no room for both), the place that covers
 * least of it; the panel is drawn above the button there (Sky.astro).
 */
export function placePanel(
	star: { x: number; y: number; r: number },
	panel: { w: number; h: number },
	screen: { w: number; h: number },
	exit: Rect | null,
): { x: number; y: number } {
	const { w, h } = screen;
	const pw = panel.w;
	const ph = panel.h;
	const clampX = (x: number) => Math.min(Math.max(x, MARGIN), Math.max(MARGIN, w - MARGIN - pw));
	/** The lowest the panel's foot may come, for a panel standing at x: above the button if it is under it. */
	const floor = (x: number) =>
		exit && x < exit.right + GAP && x + pw > exit.left - GAP ? exit.top - GAP : h - MARGIN;
	const clampY = (y: number, x: number) => {
		const top = x < CHROME.w ? Math.max(MARGIN, CHROME.h) : MARGIN;
		return Math.min(Math.max(y, top), Math.max(top, floor(x) - ph));
	};
	const reach = star.r + GAP;
	const tries: [number, number][] = [
		[star.x + reach, star.y - ph / 2],
		[star.x - reach - pw, star.y - ph / 2],
		[star.x - pw / 2, star.y + reach],
		[star.x - pw / 2, star.y - reach - ph],
	];
	let best: [number, number] | null = null;
	let bestCost = Number.POSITIVE_INFINITY;
	for (const [tx, ty] of tries) {
		const x = clampX(tx);
		const y = clampY(ty, x);
		// How far the panel, once it is kept on the screen, reaches into the star's room;
		// with the star's centre under it, how deep under.
		const dx = Math.max(x - star.x, star.x - (x + pw));
		const dy = Math.max(y - star.y, star.y - (y + ph));
		const away = dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy);
		const over = Math.max(0, reach - away);
		// Laid over the exit button counts far worse than laid over the star's own room.
		const onExit = exit ? overlap({ left: x, top: y, right: x + pw, bottom: y + ph }, exit) : 0;
		const cost = over + (onExit > 0 ? 1000 + onExit / 100 : 0);
		if (cost < bestCost - 0.5) {
			bestCost = cost;
			best = [x, y];
		}
		if (cost <= 0.5) break;
	}
	const [x, y] = best ?? [MARGIN, MARGIN];
	return { x, y };
}
