// The five Roots offers, as data. LOCKED VERBATIM: every character of the copy
// comes from SPEC-ADDENDUM.md ("Roots tile copy"). offers.test.ts reads that
// file and fails if one character differs, so to change the copy, change the
// addendum first.
//
// A tile's text is its lines joined by one space, and a line is its segments
// run together. `brass` marks what the addendum sets in bold. A slashed price
// is three brass segments: the old price (`strike`), the word " slashed"
// (`srOnly`: still in the text, hidden from the eye), then the arrow and the
// new price.
//
// Segments carry their own spaces, so set them as plain inline text. A panel
// that sets each line as its own block keeps the DOM text exact by leaving
// that one space between the blocks.

export type OfferId = 'site' | 'systems' | 'app' | 'addons' | 'care';

export interface Segment {
	text: string;
	/** Bold in the addendum: set in brass. */
	brass?: true;
	/** An old price: struck through. */
	strike?: true;
	/** Stays in the text for screen readers; visually hidden. */
	srOnly?: true;
}

export interface Offer {
	id: OfferId;
	/** The tile's heading. */
	title: string;
	/** Its name in the sky's breakdown panel (B10). */
	short: string;
	/** The first sentence of the body: this offer's single line in B10. */
	lead: string;
	/** The body (E5) in short lines: what it is, what is included, price, what you own. */
	lines: Segment[][];
}

export const OFFERS: readonly Offer[] = [
	{
		id: 'site',
		title: 'Site',
		short: 'Site',
		lead: 'A custom site built for your business.',
		lines: [
			[{ text: 'A custom site built for your business.' }],
			[{ text: 'Fast, beautiful, and made to be found.' }],
			[{ text: 'Includes: your pages, a working contact form, domain set up in your account.' }],
			[
				{ text: '$990', brass: true, strike: true },
				{ text: ' slashed', brass: true, srOnly: true },
				{ text: ' → FREE', brass: true },
				{ text: ' — founding cohort.' },
			],
			[
				{ text: 'Plus care: ' },
				{ text: '$69/mo', brass: true, strike: true },
				{ text: ' slashed', brass: true, srOnly: true },
				{ text: ' → $39/mo', brass: true },
				{ text: ', locked for life on basic.' },
			],
			[
				{ text: 'You own it. Forever.', brass: true },
				{ text: ' Site, domain, and content are yours.' },
			],
		],
	},
	{
		id: 'systems',
		title: 'Site + Systems',
		short: 'Site + Systems',
		lead: 'Everything in Site, plus the work behind it wired in.',
		lines: [
			[{ text: 'Everything in Site, plus the work behind it wired in.' }],
			[
				{
					text: 'Includes: intake or booking, follow-ups, payments, and lead capture — set up to run as one system.',
				},
			],
			[
				{ text: 'Price: by quote.', brass: true },
				{ text: ' We see the ask first, then give you an honest number.' },
			],
			[
				{ text: 'You own your site and your data.', brass: true },
				{ text: ' The systems are built for you and saved to your accounts.' },
			],
		],
	},
	{
		id: 'app',
		title: 'Site + App',
		short: 'Site + App',
		lead: 'Everything in Site, plus a real app your customers actually use.',
		lines: [
			[{ text: 'Everything in Site, plus a real app your customers actually use.' }],
			[{ text: 'Built for phones first, connected to your site.' }],
			[
				{ text: 'Price: by quote.', brass: true },
				{
					text: ' Bigger asks get a longer window — we will be honest about cost and time up front.',
				},
			],
			[
				{ text: 'You own your site and your app.', brass: true },
				{ text: ' Built in your name, from day one.' },
			],
		],
	},
	{
		id: 'addons',
		title: 'Add-ons — AI + automation',
		short: 'Add-ons',
		lead: 'Upgrades that take work off your plate.',
		lines: [
			[{ text: 'Upgrades that take work off your plate.' }],
			[{ text: 'AI that answers, sorts, and drafts.' }],
			[{ text: 'Automations that move the repetitive work for you.' }],
			[{ text: 'Price: by quote.', brass: true }],
		],
	},
	{
		id: 'care',
		title: 'Care',
		short: 'Care',
		lead: 'What keeps your site alive after launch.',
		lines: [
			[{ text: 'What keeps your site alive after launch.' }],
			[
				{
					text: 'Includes: security and patching, uptime and SSL watch, form tests, backups, domain renewal handled, email changes done for you, and a monthly report.',
				},
			],
			[{ text: 'Support by email.' }],
			[
				{ text: '$39/mo founding, locked for life on basic.', brass: true },
				{ text: ' True rate $69/mo.' },
			],
			[
				{
					text: 'Systems, apps, and AI cost more to care for. Their care goes up, and it is part of their quote.',
				},
			],
			[
				{ text: 'No new pages, redesigns, or selling built in', brass: true },
				{ text: ' — those are upgrades, priced plainly when you ask.' },
			],
		],
	},
];

function join(o: Offer, visibleOnly: boolean): string {
	return o.lines
		.map((line) => line.map((s) => (visibleOnly && s.srOnly ? '' : s.text)).join(''))
		.join(' ');
}

/** The tile's exact plain text: the addendum's, without the ** markers. */
export function offerText(o: Offer): string {
	return join(o, false);
}

/** The same text as the eye gets it: srOnly segments left out. */
export function visibleText(o: Offer): string {
	return join(o, true);
}
