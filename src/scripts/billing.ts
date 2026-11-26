// The Billing tab. Today it is a template: the offers and "put a client on
// an offer" are real (offers from src/billing/offers.ts, clients from the
// onboarding records), but nothing is sent to Stripe yet, and the money
// figures, client plans and invoices below them are sample rows, marked so.

import {
	BILLING_OFFERS,
	type BillingOffer,
	planSummary,
	readPrice,
	usd,
} from '../billing/offers.ts';
import { type AdminClient, ApiError, api } from './dashboard-api.ts';
import { el, type Kid } from './ui.ts';

const SAMPLE = {
	figures: [
		['$117', 'Coming in each month'],
		['$0', 'Owed to you'],
		['$78', 'Paid this month'],
	],
	plans: [
		['Sample Bakery', 'Founding cohort', '$39/mo', 'Active', 'Dec 1'],
		['Sample Florist', 'Founding cohort', '$39/mo', 'Active', 'Dec 4'],
		['Sample Barber', 'Founding cohort', '$39/mo', 'Past due', 'Nov 20'],
	],
	invoices: [
		['Nov 4', 'Sample Florist', '$39', 'Paid'],
		['Nov 1', 'Sample Bakery', '$39', 'Paid'],
		['Oct 20', 'Sample Barber', '$39', 'Open'],
	],
} as const;

export function startBilling(view: HTMLElement, banner: HTMLElement): void {
	const section = (title: string, ...kids: Kid[]) =>
		el('section', { class: 'panel ob-section' }, el('h2', {}, title), ...kids);
	const sampleTag = () => el('span', { class: 'ob-chip' }, 'Sample');

	// ── Put a client on an offer ───────────────────────────────────────────
	const pick = el('select', { name: 'client' }, el('option', { value: '' }, 'Loading clients…'));
	const offerPick = el(
		'select',
		{ name: 'offer' },
		...BILLING_OFFERS.map((o) => el('option', { value: o.id }, o.name)),
	);
	const buildIn = el('input', { name: 'build', inputmode: 'numeric', placeholder: '2,500' });
	const careIn = el('input', { name: 'care', inputmode: 'numeric', placeholder: '89' });
	const quoteFields = el(
		'div',
		{ class: 'flex flex-col gap-3', hidden: true },
		el('label', { class: 'ob-field' }, el('span', {}, 'Build price ($)'), buildIn),
		el('label', { class: 'ob-field' }, el('span', {}, 'Care each month ($)'), careIn),
	);
	const summary = el('p', { class: 'ob-plan', 'aria-live': 'polite' });
	const confirm = el(
		'button',
		{ type: 'button', class: 'brass-btn brass-btn--small', disabled: true },
		'Confirm and start billing',
	);
	const setup = section(
		'Put a client on an offer',
		el('label', { class: 'ob-field' }, el('span', {}, 'Client'), pick),
		el('label', { class: 'ob-field' }, el('span', {}, 'Offer'), offerPick),
		quoteFields,
		summary,
		el('div', { class: 'ob-actions' }, confirm),
		el(
			'p',
			{ class: 'ob-hint' },
			'Confirm connects to Stripe tonight. Until then it does nothing.',
		),
	);
	setup.id = 'setup';

	const current = (): BillingOffer =>
		BILLING_OFFERS.find((o) => o.id === offerPick.value) ?? BILLING_OFFERS[0];
	const redraw = () => {
		const offer = current();
		quoteFields.hidden = offer.build !== null && offer.care !== null;
		const name = pick.selectedOptions[0]?.value ? (pick.selectedOptions[0].textContent ?? '') : '';
		const s = planSummary(offer, name, {
			build: readPrice(buildIn.value),
			care: readPrice(careIn.value),
		});
		summary.textContent = s.ok ? s.text : s.error;
		summary.toggleAttribute('data-ready', s.ok);
	};
	for (const input of [pick, offerPick, buildIn, careIn]) input.addEventListener('input', redraw);

	const choose = (offer: BillingOffer) => {
		offerPick.value = offer.id;
		redraw();
		setup.scrollIntoView({ behavior: 'smooth', block: 'start' });
		pick.focus({ preventScroll: true });
	};

	// ── Offers ─────────────────────────────────────────────────────────────
	const price = (now: number | null, was: number | undefined, unit = '') =>
		now === null
			? el('span', {}, 'Quoted')
			: el(
					'span',
					{},
					was !== undefined ? el('s', {}, `${usd(was)}${unit}`) : '',
					now === 0 ? 'Free' : `${usd(now)}${unit}`,
				);
	const offerCard = (o: BillingOffer) => {
		const go = el(
			'button',
			{ type: 'button', class: 'brass-btn brass-btn--small' },
			'Put a client on this',
		);
		go.addEventListener('click', () => choose(o));
		return el(
			'div',
			{ class: 'ob-offer', 'data-offer': o.id },
			el('strong', {}, o.name),
			el('p', { class: 'ob-meta' }, o.blurb),
			el('p', { class: 'ob-price' }, 'Build: ', price(o.build, o.buildWas)),
			el(
				'p',
				{ class: 'ob-price' },
				'Care: ',
				price(o.care, o.careWas, '/mo'),
				o.locked ? el('span', { class: 'ob-meta' }, ' · locked for life') : '',
			),
			go,
		);
	};
	const addCard = el(
		'div',
		{ class: 'ob-offer', 'data-off': true },
		el('strong', {}, 'Add an offer'),
		el('p', { class: 'ob-meta' }, 'New offers get added with Claude for now, one line each.'),
	);

	// ── Sample money ───────────────────────────────────────────────────────
	const figures = el(
		'div',
		{ class: 'ob-figures' },
		...SAMPLE.figures.map(([n, label]) =>
			el('div', { class: 'ob-figure' }, el('b', {}, n), el('span', {}, label)),
		),
	);
	const plans = el(
		'ul',
		{ class: 'ob-list' },
		...SAMPLE.plans.map(([name, offer, amount, status, next]) =>
			el(
				'li',
				{ class: 'ob-row' },
				el('strong', {}, name),
				el(
					'span',
					{ class: 'ob-chip', 'data-status': status === 'Active' ? 'done' : 'active' },
					status,
				),
				el('span', { class: 'ob-meta' }, `${offer} · ${amount} · next charge ${next}`),
			),
		),
	);
	const invoices = el(
		'ul',
		{ class: 'ob-list' },
		...SAMPLE.invoices.map(([date, name, amount, status]) =>
			el(
				'li',
				{ class: 'ob-row' },
				el('strong', {}, name),
				el('span', { class: 'ob-money' }, amount),
				el('span', { class: 'ob-meta' }, `${date} · ${status}`),
			),
		),
	);
	const later = (label: string) =>
		el('button', { type: 'button', class: 'brass-btn brass-btn--small', disabled: true }, label);

	view.replaceChildren(
		el('h1', { class: 'display text-4xl' }, 'Billing'),
		el(
			'p',
			{ class: 'ob-sample' },
			'Template. Stripe connects tonight; nothing on this page charges anyone yet.',
		),
		section('Offers', el('div', { class: 'ob-offers' }, ...BILLING_OFFERS.map(offerCard), addCard)),
		setup,
		section('This month', sampleTag(), figures),
		section('Care plans', sampleTag(), plans),
		section(
			'Recent invoices',
			sampleTag(),
			invoices,
			el('div', { class: 'ob-actions' }, later('New invoice'), later('Open Stripe')),
		),
	);
	redraw();

	// Real clients, from the onboarding records.
	api
		.list(false)
		.then(({ clients }: { clients: AdminClient[] }) => {
			pick.replaceChildren(
				el('option', { value: '' }, clients.length ? 'Pick a client' : 'No clients yet'),
				...clients.map((c) => el('option', { value: c.id }, c.name)),
			);
			redraw();
		})
		.catch((e: unknown) => {
			pick.replaceChildren(el('option', { value: '' }, 'Couldn’t load clients'));
			banner.textContent =
				e instanceof ApiError && e.status === 401
					? 'Your sign-in has run out. Reload to sign in again.'
					: `Couldn’t load clients: ${e instanceof Error ? e.message : 'something went wrong.'}`;
			banner.hidden = false;
		});
}
