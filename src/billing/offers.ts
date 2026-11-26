// What the studio can put a client on, for the Billing tab. One entry per
// offer: to add an offer later, add an entry here. Tonight's Stripe work reads
// the same list, so each entry becomes one Stripe product and its prices.
//
// To add an offer: make its care price in Stripe (Product catalog) with a
// lookup key, then add an entry here with that key.
//
// Prices are whole US dollars. `null` means "quoted": Gabriel types the
// number in for that client. The founding cohort's numbers must match the
// locked copy on the site (offers.test.ts checks them against src/content).

export interface BillingOffer {
	id: string;
	name: string;
	/** One line under the name. */
	blurb: string;
	/** The one-time build price, or null when it is quoted per client. */
	build: number | null;
	/** What the build price was before the offer, shown struck through. */
	buildWas?: number;
	/** The monthly care price, or null when it is quoted per client. */
	care: number | null;
	/** What care costs outside the offer, shown struck through. */
	careWas?: number;
	/** The care price never goes up for a client on this offer. */
	locked: boolean;
	/**
	 * The lookup key of this offer's monthly care price in Stripe. An offer
	 * with one can be started from the Billing tab; without one it can't yet.
	 */
	lookup?: string;
}

export const BILLING_OFFERS: readonly BillingOffer[] = [
	{
		id: 'cohort',
		name: 'Founding cohort',
		blurb: 'Site built free, care locked for life on basic.',
		build: 0,
		buildWas: 990,
		care: 39,
		careWas: 69,
		locked: true,
		lookup: 'care_cohort_monthly',
	},
	{
		id: 'quoted',
		name: 'Quoted build',
		blurb: 'Site + Systems, Site + App, or Add-ons: you set the price.',
		build: null,
		care: null,
		locked: false,
	},
];

export const usd = (n: number): string => `$${n.toLocaleString('en-US')}`;

/** A quoted price as typed: a whole number of dollars, or null if it isn't one. */
export function readPrice(raw: string): number | null {
	const t = raw.trim().replace(/^\$/, '').replace(/,/g, '');
	if (!/^\d{1,6}$/.test(t)) return null;
	return Number(t);
}

/**
 * What putting this client on this offer will do, in one line, or the reason
 * it can't be done yet. Care starts when the client's site goes live.
 */
export function planSummary(
	offer: BillingOffer,
	client: string,
	quote: { build?: number | null; care?: number | null } = {},
): { ok: true; text: string } | { ok: false; error: string } {
	if (!client.trim()) return { ok: false, error: 'Pick a client first.' };
	const build = offer.build ?? quote.build ?? null;
	const care = offer.care ?? quote.care ?? null;
	if (build === null) return { ok: false, error: 'Type in the build price.' };
	if (care === null) return { ok: false, error: 'Type in the monthly care price.' };
	const buildText = build === 0 ? 'free' : `${usd(build)}, invoiced now`;
	const careText =
		care === 0
			? 'none'
			: `${usd(care)}/mo${offer.locked ? ', locked for life' : ''}, starting when their site goes live`;
	return { ok: true, text: `${client} · ${offer.name} · Build: ${buildText} · Care: ${careText}` };
}
