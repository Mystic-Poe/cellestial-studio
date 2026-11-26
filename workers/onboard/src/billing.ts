// Billing, behind the same Access check as the rest of admin.ts.
//
// GET  /admin/billing                      figures, plans and recent invoices
// POST /admin/clients/<id>/billing         {offer}: Stripe customer + card link
// POST /admin/clients/<id>/billing/link    a fresh card link (they expire in a day)
// POST /admin/clients/<id>/billing/start   start care now
//
// The flow: Confirm makes the client in Stripe and a link where they save a
// card (nothing charged). Care starts when their stage reaches Live, or when
// Gabriel presses Start care. Stripe charges each month from then on.

import { BILLING_OFFERS } from '../../../src/billing/offers.ts';
import { json, readJson } from './http.ts';
import type { ClientRow, D1 } from './store.ts';
import {
	cardLink,
	createCustomer,
	listInvoices,
	listSubs,
	priceFor,
	type StripeEnv,
	StripeError,
	savedCard,
	startPlan,
	stripeMode,
	subStatus,
} from './stripe.ts';

const ORIGIN = 'https://cellestialstudio.com';
const RETURN_TO = `${ORIGIN}/start/card-saved/`;

export interface BillingRow {
	client_id: string;
	offer: string;
	care: number;
	customer: string;
	setup_session: string | null;
	setup_url: string | null;
	payment_method: string | null;
	subscription: string | null;
	status: 'card_pending' | 'card_saved' | 'started';
	created_at: number;
	updated_at: number;
}

const getRow = (db: D1, id: string) =>
	db.prepare('SELECT * FROM billing WHERE client_id = ?').bind(id).first<BillingRow>();

async function setRow(db: D1, id: string, f: Partial<BillingRow>, now = Date.now()) {
	const keys = Object.keys(f);
	await db
		.prepare(
			`UPDATE billing SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE client_id = ?`,
		)
		.bind(...keys.map((k) => f[k as keyof BillingRow]), now, id)
		.run();
}

const fail = (e: unknown) =>
	e instanceof StripeError
		? json(e.status === 503 ? 503 : 502, { error: e.message })
		: json(502, { error: 'Stripe could not be reached. Try again.' });

const offerOf = (id: string) => BILLING_OFFERS.find((o) => o.id === id);

/** Checks a pending card link; marks the card saved once it is. */
async function refreshCard(env: StripeEnv, db: D1, row: BillingRow): Promise<BillingRow> {
	if (row.status !== 'card_pending' || !row.setup_session) return row;
	const card = await savedCard(env, row.setup_session);
	if (!card) return row;
	await setRow(db, row.client_id, { status: 'card_saved', payment_method: card });
	return { ...row, status: 'card_saved', payment_method: card };
}

/** Starts care if there is a card to charge. 'no_card' when there isn't. */
async function start(
	env: StripeEnv,
	db: D1,
	row: BillingRow,
): Promise<'started' | 'no_card' | 'already'> {
	if (row.status === 'started') return 'already';
	const r = await refreshCard(env, db, row);
	if (r.status !== 'card_saved' || !r.payment_method) return 'no_card';
	const offer = offerOf(r.offer);
	if (!offer?.lookup) throw new StripeError('This offer has no Stripe price yet.', 409);
	const price = await priceFor(env, offer.lookup);
	const sub = await startPlan(env, {
		clientId: r.client_id,
		customer: r.customer,
		price: price.id,
		card: r.payment_method,
		offer: r.offer,
	});
	await setRow(db, r.client_id, { status: 'started', subscription: sub });
	return 'started';
}

/**
 * Why this client can't be deleted yet, or null if they can. A started plan
 * keeps charging in Stripe, so it must be cancelled there first.
 */
export async function deleteBlocker(
	env: StripeEnv,
	db: D1,
	clientId: string,
): Promise<string | null> {
	const row = await getRow(db, clientId);
	if (!row?.subscription) return null;
	const ask = 'Their care plan is still running in Stripe. Cancel it there first, then delete.';
	if (!stripeMode(env)) return ask;
	try {
		return (await subStatus(env, row.subscription)) === 'canceled' ? null : ask;
	} catch {
		return 'Couldn’t check their care plan with Stripe. Try again.';
	}
}

/** Called when a client's stage moves to Live. Never throws: the stage change stands. */
export async function startOnLive(env: StripeEnv, db: D1, clientId: string): Promise<void> {
	if (!stripeMode(env)) return;
	try {
		const row = await getRow(db, clientId);
		if (row) await start(env, db, row);
	} catch {
		// The Billing tab shows it as not started, with a Start care button.
	}
}

export async function billingOverview(env: StripeEnv, db: D1): Promise<Response> {
	const mode = stripeMode(env);
	if (!mode) return json(200, { connected: false });
	try {
		const { results } = await db
			.prepare(
				'SELECT b.*, c.name, c.stage FROM billing b JOIN clients c ON c.id = b.client_id ORDER BY b.created_at DESC',
			)
			.all<BillingRow & { name: string; stage: string }>();
		const now = new Date();
		const monthStart = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
		// First bring each row up to date, so the lists below include any plan
		// started just now.
		const rows = [];
		for (const raw of results) {
			let row: typeof raw = { ...raw, ...(await refreshCard(env, db, raw)) };
			// A card saved after they went Live: start now.
			if (
				row.status === 'card_saved' &&
				row.stage === 'live' &&
				(await start(env, db, row)) === 'started'
			)
				row = { ...row, ...((await getRow(db, row.client_id)) ?? {}) };
			rows.push(row);
		}
		const [subs, recent, open, paid] = await Promise.all([
			listSubs(env),
			listInvoices(env, { limit: 10 }),
			listInvoices(env, { status: 'open' }),
			listInvoices(env, { status: 'paid', created: { gte: monthStart } }),
		]);
		const plans = rows.map((row) => {
			const sub = subs.find((s) => s.id === row.subscription);
			const item = sub?.items.data[0];
			return {
				client_id: row.client_id,
				name: row.name,
				stage: row.stage,
				offer: offerOf(row.offer)?.name ?? row.offer,
				care: row.care,
				status: row.status === 'started' ? (sub?.status ?? 'started') : row.status,
				next: item?.current_period_end ?? sub?.current_period_end ?? null,
				card_link: row.status === 'card_pending' ? row.setup_url : null,
			};
		});
		const dollars = (cents: number) => Math.round(cents) / 100;
		const live = subs.filter((s) => s.status === 'active' || s.status === 'past_due');
		return json(200, {
			connected: true,
			mode,
			figures: {
				monthly: dollars(live.reduce((n, s) => n + (s.items.data[0]?.price.unit_amount ?? 0), 0)),
				owed: dollars(open.reduce((n, i) => n + i.amount_remaining, 0)),
				paid_this_month: dollars(paid.reduce((n, i) => n + i.amount_paid, 0)),
			},
			plans,
			invoices: recent.map((i) => ({
				id: i.id,
				date: i.created,
				name: i.customer_name ?? '',
				amount: dollars(i.amount_due),
				status: i.status,
				url: i.hosted_invoice_url,
			})),
		});
	} catch (e) {
		return fail(e);
	}
}

export async function clientBilling(
	request: Request,
	env: StripeEnv,
	db: D1,
	client: ClientRow,
	action: string | undefined,
): Promise<Response> {
	if (request.method !== 'POST') return json(405, { error: 'POST only.' });
	if (!stripeMode(env)) return json(503, { error: 'Stripe is not connected yet.' });
	const row = await getRow(db, client.id);
	try {
		if (action === undefined) {
			if (row) return json(409, { error: `${client.name} is already on a plan.` });
			const body = await readJson(request);
			const offer = offerOf(String(body?.offer ?? ''));
			if (!offer) return json(400, { field: 'offer', error: 'Pick an offer.' });
			if (!offer.lookup || offer.care === null)
				return json(400, { field: 'offer', error: 'This offer can’t be started from here yet.' });
			const price = await priceFor(env, offer.lookup);
			if (price.unit_amount !== offer.care * 100)
				return json(409, {
					error: `Stripe’s price for ${offer.name} is $${(price.unit_amount ?? 0) / 100}, not $${offer.care}. Make them match first.`,
				});
			const customer = await createCustomer(env, client);
			const link = await cardLink(env, customer, RETURN_TO);
			const now = Date.now();
			await db
				.prepare(
					'INSERT INTO billing (client_id, offer, care, customer, setup_session, setup_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
				)
				.bind(
					client.id,
					offer.id,
					offer.care,
					customer,
					link.id,
					link.url,
					'card_pending',
					now,
					now,
				)
				.run();
			return json(201, { status: 'card_pending', card_link: link.url });
		}
		if (!row) return json(404, { error: `${client.name} isn’t on a plan yet.` });
		if (action === 'link') {
			const fresh = await refreshCard(env, db, row);
			if (fresh.status !== 'card_pending')
				return json(409, { error: 'Their card is already saved.' });
			const link = await cardLink(env, row.customer, RETURN_TO);
			await setRow(db, row.client_id, { setup_session: link.id, setup_url: link.url });
			return json(200, { status: 'card_pending', card_link: link.url });
		}
		if (action === 'start') {
			const r = await start(env, db, row);
			if (r === 'no_card')
				return json(409, { error: 'They haven’t saved a card yet. Send them the card link.' });
			return json(200, { status: 'started' });
		}
		return json(404, { error: 'Not found.' });
	} catch (e) {
		return fail(e);
	}
}
