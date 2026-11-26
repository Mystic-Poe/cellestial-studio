// The Billing tab. Offers come from src/billing/offers.ts, clients from the
// onboarding records, and plans, invoices and figures from Stripe through the
// Worker. Until Stripe is connected the money sections show sample rows,
// marked so. No card details ever pass through this page: clients save cards
// on Stripe's own page, from a link made here.

import {
	BILLING_OFFERS,
	type BillingOffer,
	planSummary,
	readPrice,
	usd,
} from '../billing/offers.ts';
import {
	type AdminClient,
	ApiError,
	api,
	type BillingPlan,
	type BillingView,
} from './dashboard-api.ts';
import { el, type Kid } from './ui.ts';

const SAMPLE = {
	figures: { monthly: 117, owed: 0, paid_this_month: 78 },
	plans: [
		['Sample Bakery', 'active', 'Dec 1'],
		['Sample Florist', 'card_pending', ''],
		['Sample Barber', 'past_due', 'Nov 20'],
	],
	invoices: [
		['Nov 4', 'Sample Florist', 39, 'paid'],
		['Nov 1', 'Sample Bakery', 39, 'paid'],
		['Oct 20', 'Sample Barber', 39, 'open'],
	],
} as const;

const STATUS: Record<string, [string, 'done' | 'active' | 'none']> = {
	card_pending: ['Waiting for card', 'none'],
	card_saved: ['Card saved · starts at Live', 'active'],
	active: ['Active', 'done'],
	trialing: ['Active', 'done'],
	past_due: ['Past due', 'active'],
	unpaid: ['Unpaid', 'active'],
	incomplete: ['Payment failed', 'active'],
	canceled: ['Canceled', 'none'],
	paid: ['Paid', 'done'],
	open: ['Open', 'active'],
	void: ['Void', 'none'],
	draft: ['Draft', 'none'],
	uncollectible: ['Uncollectible', 'none'],
};
const chip = (status: string) => {
	const [text, kind] = STATUS[status] ?? [status, 'none'];
	return el('span', { class: 'ob-chip', 'data-status': kind }, text);
};
const day = (sec: number) =>
	new Date(sec * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function startBilling(view: HTMLElement, banner: HTMLElement): void {
	let data: BillingView = { connected: false };
	let clients: AdminClient[] = [];

	const showError = (e: unknown, doing: string) => {
		banner.textContent =
			e instanceof ApiError && e.status === 401
				? 'Your sign-in has run out. Reload to sign in again.'
				: `Couldn’t ${doing}: ${e instanceof Error ? e.message : 'something went wrong.'}`;
		banner.hidden = false;
	};
	const clearError = () => {
		banner.hidden = true;
		banner.textContent = '';
	};
	const section = (title: string, ...kids: Kid[]) =>
		el('section', { class: 'panel ob-section' }, el('h2', {}, title), ...kids);
	const sampleTag = () => (data.connected ? '' : el('span', { class: 'ob-chip' }, 'Sample'));
	const small = (label: string, run: () => Promise<void>, disabled = false) => {
		const b = el(
			'button',
			{ type: 'button', class: 'brass-btn brass-btn--small', disabled },
			label,
		);
		b.addEventListener('click', async () => {
			b.disabled = true;
			try {
				await run();
			} catch (e) {
				showError(e, label.toLowerCase());
			} finally {
				b.disabled = disabled;
			}
		});
		return b;
	};
	const copy = async (text: string, note: HTMLElement) => {
		try {
			await navigator.clipboard.writeText(text);
			note.textContent = 'Card link copied. Send it to them.';
		} catch {
			note.textContent = text;
		}
	};

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
	const hint = el('p', { class: 'ob-hint' });
	const result = el('div', { class: 'ob-linkbox flex flex-col gap-2', hidden: true });
	const confirm = el(
		'button',
		{ type: 'button', class: 'brass-btn brass-btn--small', disabled: true },
		'Confirm and make card link',
	);
	const setup = section(
		'Put a client on an offer',
		el('label', { class: 'ob-field' }, el('span', {}, 'Client'), pick),
		el('label', { class: 'ob-field' }, el('span', {}, 'Offer'), offerPick),
		quoteFields,
		summary,
		el('div', { class: 'ob-actions' }, confirm),
		hint,
		result,
	);
	setup.id = 'setup';

	const current = (): BillingOffer =>
		BILLING_OFFERS.find((o) => o.id === offerPick.value) ?? BILLING_OFFERS[0];
	const redraw = () => {
		const offer = current();
		quoteFields.hidden = offer.build !== null && offer.care !== null;
		const name = pick.value ? (pick.selectedOptions[0]?.textContent ?? '') : '';
		const s = planSummary(offer, name, {
			build: readPrice(buildIn.value),
			care: readPrice(careIn.value),
		});
		summary.textContent = s.ok ? s.text : s.error;
		summary.toggleAttribute('data-ready', s.ok);
		confirm.disabled = !(s.ok && data.connected && offer.lookup);
		hint.textContent = !data.connected
			? 'Stripe isn’t connected yet, so Confirm does nothing.'
			: !offer.lookup
				? 'Quoted builds are next: for now, set these up in Stripe by hand.'
				: 'Confirm makes them in Stripe and gives you a link where they save a card. Nothing is charged until their site goes live.';
	};
	for (const input of [pick, offerPick, buildIn, careIn]) input.addEventListener('input', redraw);

	confirm.addEventListener('click', async () => {
		const id = pick.value;
		const name = pick.selectedOptions[0]?.textContent ?? '';
		confirm.disabled = true;
		try {
			const r = await api.startBilling(id, current().id);
			clearError();
			const note = el(
				'p',
				{ class: 'ob-meta' },
				'The link works for 24 hours. Make a new one under Care plans if it runs out.',
			);
			result.replaceChildren(
				el('strong', {}, `${name} is set up. Send them this card link:`),
				el(
					'a',
					{ href: r.card_link, target: '_blank', rel: 'noopener', class: 'underline break-all' },
					r.card_link,
				),
				el(
					'div',
					{ class: 'ob-actions' },
					small('Copy card link', () => copy(r.card_link, note)),
				),
				note,
			);
			result.hidden = false;
			await load();
		} catch (e) {
			showError(e, 'set them up');
			redraw();
		}
	});

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
	const offers = section(
		'Offers',
		el(
			'div',
			{ class: 'ob-offers' },
			...BILLING_OFFERS.map(offerCard),
			el(
				'div',
				{ class: 'ob-offer', 'data-off': true },
				el('strong', {}, 'Add an offer'),
				el(
					'p',
					{ class: 'ob-meta' },
					'Make its care price in Stripe with a lookup key, then Claude adds one line here.',
				),
			),
		),
	);

	// ── Money ──────────────────────────────────────────────────────────────
	const moneySections = (): HTMLElement[] => {
		const f = data.connected ? data.figures : SAMPLE.figures;
		const figures = el(
			'div',
			{ class: 'ob-figures' },
			...(
				[
					[f.monthly, 'Coming in each month'],
					[f.owed, 'Owed to you'],
					[f.paid_this_month, 'Paid this month'],
				] as const
			).map(([n, label]) =>
				el('div', { class: 'ob-figure' }, el('b', {}, usd(n)), el('span', {}, label)),
			),
		);

		const planRow = (p: BillingPlan) => {
			const note = el('p', { class: 'ob-meta' });
			const actions = el('div', { class: 'ob-actions' });
			if (p.status === 'card_pending' && p.card_link) {
				const link = p.card_link;
				actions.append(
					small('Copy card link', () => copy(link, note)),
					small('New card link', async () => {
						const r = await api.newCardLink(p.client_id);
						await copy(r.card_link, note);
						await load();
					}),
				);
			}
			if (p.status === 'card_saved')
				actions.append(
					small('Start care now', async () => {
						await api.startCare(p.client_id);
						await load();
					}),
				);
			return el(
				'li',
				{ class: 'ob-row', 'data-plan': p.client_id },
				el('strong', {}, p.name),
				chip(p.status),
				el(
					'span',
					{ class: 'ob-meta' },
					`${p.offer} · ${usd(p.care)}/mo${p.next ? ` · next charge ${day(p.next)}` : ''}`,
				),
				actions.childElementCount ? actions : '',
				note,
			);
		};
		const plans = data.connected
			? data.plans.length
				? data.plans.map(planRow)
				: [el('li', { class: 'ob-meta' }, 'Nobody is on a plan yet.')]
			: SAMPLE.plans.map(([name, status, next]) =>
					el(
						'li',
						{ class: 'ob-row' },
						el('strong', {}, name),
						chip(status),
						el(
							'span',
							{ class: 'ob-meta' },
							`Founding cohort · $39/mo${next ? ` · next charge ${next}` : ''}`,
						),
					),
				);

		const invoiceRow = (
			date: string,
			name: string,
			amount: number,
			status: string,
			url?: string | null,
		) =>
			el(
				'li',
				{ class: 'ob-row' },
				el('strong', {}, name || 'No name'),
				el('span', { class: 'ob-money' }, usd(amount)),
				el(
					'span',
					{ class: 'ob-meta' },
					`${date} · `,
					(STATUS[status] ?? [status])[0],
					url
						? el(
								'a',
								{ href: url, target: '_blank', rel: 'noopener', class: 'underline' },
								' · view',
							)
						: '',
				),
			);
		const invoices = data.connected
			? data.invoices.length
				? data.invoices.map((i) => invoiceRow(day(i.date), i.name, i.amount, i.status, i.url))
				: [el('li', { class: 'ob-meta' }, 'No invoices yet.')]
			: SAMPLE.invoices.map(([d, n, a, s]) => invoiceRow(d, n, a, s));

		const dashboard = data.connected
			? `https://dashboard.stripe.com/${data.mode === 'test' ? 'test/' : ''}dashboard`
			: 'https://dashboard.stripe.com/';
		return [
			section('This month', sampleTag(), figures),
			section('Care plans', sampleTag(), el('ul', { class: 'ob-list' }, ...plans)),
			section(
				'Recent invoices',
				sampleTag(),
				el('ul', { class: 'ob-list' }, ...invoices),
				el(
					'div',
					{ class: 'ob-actions' },
					el(
						'a',
						{
							class: 'brass-btn brass-btn--small',
							href: dashboard,
							target: '_blank',
							rel: 'noopener',
						},
						'Open Stripe',
					),
				),
			),
		];
	};

	const modeNote = () =>
		!data.connected
			? el(
					'p',
					{ class: 'ob-sample' },
					'Stripe isn’t connected yet. The money below is sample data.',
				)
			: data.mode === 'test'
				? el('p', { class: 'ob-sample' }, 'Stripe sandbox: test cards only, no real money moves.')
				: '';

	const draw = () => {
		view.replaceChildren(
			el('h1', { class: 'display text-4xl' }, 'Billing'),
			modeNote(),
			offers,
			setup,
			...moneySections(),
		);
		const onPlan = new Set(data.connected ? data.plans.map((p) => p.client_id) : []);
		const chosen = pick.value;
		const free = clients.filter((c) => !onPlan.has(c.id));
		pick.replaceChildren(
			el('option', { value: '' }, free.length ? 'Pick a client' : 'No clients without a plan'),
			...free.map((c) => el('option', { value: c.id, selected: c.id === chosen }, c.name)),
		);
		redraw();
	};

	async function load(): Promise<void> {
		try {
			const [b, list] = await Promise.all([api.billing(), api.list(false)]);
			data = b;
			clients = list.clients;
			clearError();
		} catch (e) {
			showError(e, 'load billing');
		}
		draw();
	}

	draw();
	load();
}
