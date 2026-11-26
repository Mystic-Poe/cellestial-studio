// A pretend Stripe API: just the calls stripe.ts makes, with state, so tests
// and the dev server can walk the billing flow. No network.
export function fakeStripe({ care = 3900 } = {}) {
	const s = {
		calls: [],
		prices: [
			{ id: 'price_cohort', lookup_key: 'care_cohort_monthly', unit_amount: care, active: true },
		],
		customers: [],
		sessions: [],
		subs: [],
		invoices: [],
		/** As if the client saved a card on the link's page. */
		saveCard(sessionId) {
			const x = s.sessions.find((v) => v.id === sessionId);
			x.status = 'complete';
			x.setup_intent = { id: `seti_${x.id}`, payment_method: `pm_${x.id}` };
		},
	};
	let n = 0;
	const id = (p) => `${p}_${++n}`;
	const out = (status, body) => Response.json(body, { status });

	s.handle = async (url, init = {}) => {
		const u = new URL(url);
		const method = init.method ?? 'GET';
		const form = new URLSearchParams(method === 'POST' ? String(init.body ?? '') : u.search);
		const auth = new Headers(init.headers).get('authorization') ?? '';
		s.calls.push({
			method,
			path: u.pathname,
			form,
			idem: new Headers(init.headers).get('idempotency-key'),
		});
		if (!/^Bearer (sk|rk)_test_/.test(auth))
			return out(401, { error: { message: 'Invalid API key.' } });
		const path = u.pathname.replace('/v1/', '');

		if (path === 'prices' && method === 'GET') {
			const keys = form.getAll('lookup_keys[]');
			return out(200, { data: s.prices.filter((p) => p.active && keys.includes(p.lookup_key)) });
		}
		if (path === 'customers' && method === 'POST') {
			const idem = s.calls.at(-1).idem;
			const old = s.customers.find((c) => c.idem === idem);
			if (old) return out(200, old);
			const c = { id: id('cus'), name: form.get('name'), email: form.get('email'), idem };
			s.customers.push(c);
			return out(200, c);
		}
		if (path === 'checkout/sessions' && method === 'POST') {
			if (form.get('mode') !== 'setup') return out(400, { error: { message: 'mode' } });
			const x = {
				id: id('cs_test'),
				customer: form.get('customer'),
				status: 'open',
				success_url: form.get('success_url'),
				setup_intent: null,
			};
			x.url = `https://checkout.stripe.com/c/pay/${x.id}`;
			s.sessions.push(x);
			return out(200, x);
		}
		if (path.startsWith('checkout/sessions/') && method === 'GET') {
			const x = s.sessions.find((v) => v.id === path.split('/')[2]);
			return x ? out(200, x) : out(404, { error: { message: 'No such session.' } });
		}
		if (path === 'subscriptions' && method === 'POST') {
			const idem = s.calls.at(-1).idem;
			const old = s.subs.find((v) => v.idem === idem);
			if (old) return out(200, old);
			const price = s.prices.find((p) => p.id === form.get('items[0][price]'));
			const sub = {
				id: id('sub'),
				idem,
				status: 'active',
				customer: form.get('customer'),
				default_payment_method: form.get('default_payment_method'),
				items: {
					data: [{ price, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }],
				},
			};
			s.subs.push(sub);
			const cus = s.customers.find((c) => c.id === sub.customer);
			s.invoices.unshift({
				id: id('in'),
				created: Math.floor(Date.now() / 1000),
				status: 'paid',
				customer: sub.customer,
				customer_name: cus?.name ?? null,
				amount_due: price.unit_amount,
				amount_paid: price.unit_amount,
				amount_remaining: 0,
				hosted_invoice_url: 'https://invoice.stripe.com/i/test',
			});
			return out(200, sub);
		}
		if (path === 'subscriptions' && method === 'GET') return out(200, { data: s.subs });
		if (path.startsWith('subscriptions/') && method === 'GET') {
			const sub = s.subs.find((v) => v.id === path.split('/')[1]);
			return sub ? out(200, sub) : out(404, { error: { message: 'No such subscription.' } });
		}
		if (path === 'invoices' && method === 'GET') {
			const status = form.get('status');
			const gte = Number(form.get('created[gte]') ?? 0);
			return out(200, {
				data: s.invoices.filter((i) => (!status || i.status === status) && i.created >= gte),
			});
		}
		return out(404, { error: { message: `fake stripe: no ${method} ${path}` } });
	};
	return s;
}
