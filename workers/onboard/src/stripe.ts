// The few Stripe calls billing needs, over plain fetch (no SDK in a Worker).
// The key is a restricted one: customers, checkout sessions and subscriptions
// write; setup intents, prices, products and invoices read. Nothing here can
// refund, pay out, or change the account.

export interface StripeEnv {
	STRIPE_SECRET_KEY?: string;
}

export class StripeError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

type Params = Record<string, unknown>;

/** Stripe's form encoding: a[b]=1, a[0][c]=2. */
export function encode(params: Params, prefix = ''): string[] {
	const out: string[] = [];
	for (const [k, v] of Object.entries(params)) {
		if (v === undefined || v === null) continue;
		const key = prefix ? `${prefix}[${k}]` : k;
		if (Array.isArray(v)) {
			v.forEach((item, i) => {
				if (item !== null && typeof item === 'object')
					out.push(...encode(item as Params, `${key}[${i}]`));
				else out.push(`${encodeURIComponent(`${key}[]`)}=${encodeURIComponent(String(item))}`);
			});
		} else if (typeof v === 'object') out.push(...encode(v as Params, key));
		else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
	}
	return out;
}

export const stripeMode = (env: StripeEnv): 'test' | 'live' | null => {
	const k = env.STRIPE_SECRET_KEY?.trim();
	if (!k) return null;
	return /^(sk|rk)_live_/.test(k) ? 'live' : 'test';
};

async function call<T>(
	env: StripeEnv,
	method: 'GET' | 'POST',
	path: string,
	params: Params = {},
	idempotency?: string,
): Promise<T> {
	const key = env.STRIPE_SECRET_KEY?.trim();
	if (!key) throw new StripeError('Stripe is not connected yet.', 503);
	const body = encode(params).join('&');
	const url = `https://api.stripe.com/v1/${path}${method === 'GET' && body ? `?${body}` : ''}`;
	const headers: Record<string, string> = { authorization: `Bearer ${key}` };
	if (method === 'POST') headers['content-type'] = 'application/x-www-form-urlencoded';
	if (idempotency) headers['idempotency-key'] = idempotency;
	const res = await fetch(url, { method, headers, body: method === 'POST' ? body : undefined });
	const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
	if (!res.ok)
		throw new StripeError(data.error?.message ?? `Stripe said ${res.status}.`, res.status);
	return data;
}

export interface Price {
	id: string;
	unit_amount: number | null;
}
export async function priceFor(env: StripeEnv, lookup: string): Promise<Price> {
	const r = await call<{ data: Price[] }>(env, 'GET', 'prices', {
		lookup_keys: [lookup],
		active: true,
	});
	const p = r.data[0];
	if (!p) throw new StripeError(`No active price in Stripe has the lookup key ${lookup}.`, 404);
	return p;
}

export async function createCustomer(
	env: StripeEnv,
	c: { id: string; name: string; email: string },
): Promise<string> {
	const r = await call<{ id: string }>(
		env,
		'POST',
		'customers',
		{ name: c.name, email: c.email, metadata: { client_id: c.id } },
		`customer-${c.id}`,
	);
	return r.id;
}

/** A Stripe-hosted page where the client saves a card. Nothing is charged. */
export async function cardLink(
	env: StripeEnv,
	customer: string,
	returnTo: string,
): Promise<{ id: string; url: string }> {
	return call(env, 'POST', 'checkout/sessions', {
		mode: 'setup',
		currency: 'usd',
		// Cards only: Klarna, Cash App and bank debits don't suit a monthly plan.
		payment_method_types: ['card'],
		customer,
		success_url: returnTo,
		cancel_url: returnTo,
	});
}

/** The card saved through a card link, or null if they haven't yet. */
export async function savedCard(env: StripeEnv, session: string): Promise<string | null> {
	const s = await call<{
		status: string;
		setup_intent: { payment_method: string | { id: string } | null } | null;
	}>(env, 'GET', `checkout/sessions/${session}`, { expand: ['setup_intent'] });
	if (s.status !== 'complete') return null;
	const pm = s.setup_intent?.payment_method;
	return typeof pm === 'string' ? pm : (pm?.id ?? null);
}

export async function startPlan(
	env: StripeEnv,
	p: { clientId: string; customer: string; price: string; card: string; offer: string },
): Promise<string> {
	const r = await call<{ id: string }>(
		env,
		'POST',
		'subscriptions',
		{
			customer: p.customer,
			items: [{ price: p.price }],
			default_payment_method: p.card,
			metadata: { client_id: p.clientId, offer: p.offer },
		},
		`plan-${p.clientId}`,
	);
	return r.id;
}

export interface Sub {
	id: string;
	status: string;
	customer: string;
	current_period_end?: number;
	items: { data: { price: { unit_amount: number | null }; current_period_end?: number }[] };
}
export interface Invoice {
	id: string;
	created: number;
	status: string;
	customer: string;
	customer_name: string | null;
	amount_due: number;
	amount_paid: number;
	amount_remaining: number;
	hosted_invoice_url: string | null;
}

export const subStatus = async (env: StripeEnv, id: string) =>
	(await call<{ status: string }>(env, 'GET', `subscriptions/${id}`)).status;

export const listSubs = async (env: StripeEnv) =>
	(await call<{ data: Sub[] }>(env, 'GET', 'subscriptions', { status: 'all', limit: 100 })).data;

export const listInvoices = async (env: StripeEnv, params: Params) =>
	(await call<{ data: Invoice[] }>(env, 'GET', 'invoices', { limit: 100, ...params })).data;
