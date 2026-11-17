// The client's guided onboarding page. Everything it knows about the client
// comes from location.hash, which never reaches a server.

import { type ClientConfig, decodeConfig } from '../onboard/link.ts';
import { buildSteps, newInvites, type Step } from '../onboard/steps.ts';

const POLL_MS = 5000;

type Feed = { github: string[]; cloudflare: string[] };

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	node.append(...kids);
	return node;
}

async function fetchFeed(): Promise<Feed | null> {
	try {
		const res = await fetch('/api/onboard/invites', { headers: { accept: 'application/json' } });
		if (!res.ok) return null;
		return (await res.json()) as Feed;
	} catch {
		return null;
	}
}

function ping(c: ClientConfig, step: number, event: 'done' | 'invite'): void {
	if (c.m === 'person') return;
	// Fire and forget: a failed ping must never hold the client up.
	fetch('/api/onboard/ping', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ client: c.n, step, mode: c.m, event }),
		keepalive: true,
	}).catch(() => {});
}

export function startFlow(root: HTMLElement): void {
	// A new link pasted into the same tab only changes the hash; start over cleanly.
	window.addEventListener('hashchange', () => location.reload());
	const hash = location.hash.slice(1);
	const config = decodeConfig(hash);
	if (!config) {
		root.replaceChildren(
			el('h1', { class: 'display text-4xl' }, 'This link is incomplete'),
			el(
				'p',
				{ class: 'text-secondary' },
				'Ask Gabriel for a new one — it only takes him a moment.',
			),
		);
		return;
	}
	const c = config;
	const steps = buildSteps(c);
	const storeKey = `cellestial:onboard:${hash.slice(0, 64)}`;

	let index = 0;
	try {
		index = Math.min(Number(localStorage.getItem(storeKey)) || 0, steps.length);
	} catch {}

	let timer: number | undefined;
	let baseline: string[] | null = null;
	let opened = false;

	const save = () => {
		try {
			localStorage.setItem(storeKey, String(index));
		} catch {}
	};

	const stopPolling = () => {
		if (timer !== undefined) clearInterval(timer);
		timer = undefined;
	};

	const advance = (event: 'done' | 'invite') => {
		ping(c, index + 1, event);
		index++;
		save();
		render();
	};

	const startPolling = (step: Step) => {
		const source = step.detect;
		if (!source) return;
		baseline = null;
		const tick = async () => {
			if (document.visibilityState !== 'visible') return;
			const feed = await fetchFeed();
			if (!feed) {
				// Not configured or unreachable: the Done button is the whole story.
				stopPolling();
				return;
			}
			if (baseline === null) {
				baseline = feed[source];
				return;
			}
			if (newInvites(baseline, feed[source]).length > 0) {
				stopPolling();
				flash('Got it — your invite arrived.');
				setTimeout(() => advance('invite'), 1200);
			}
		};
		tick();
		timer = window.setInterval(tick, POLL_MS);
	};

	const flash = (text: string) => {
		const s = root.querySelector<HTMLElement>('[data-status]');
		if (s) s.textContent = text;
	};

	const progress = () =>
		el(
			'ol',
			{
				class: 'flex gap-2',
				'aria-label': `Step ${Math.min(index + 1, steps.length)} of ${steps.length}`,
			},
			...steps.map((_, i) =>
				el('li', {
					class: `h-1.5 flex-1 rounded-full ${i < index ? 'bg-glow' : i === index ? 'bg-glow/60' : 'bg-border'}`,
				}),
			),
		);

	function render(): void {
		stopPolling();
		opened = false;
		const banner =
			c.m === 'test'
				? el(
						'p',
						{
							class:
								'rounded-md border border-tier-companion px-3 py-2 text-xs text-tier-companion',
						},
						'TEST MODE — Gabriel gets a [TEST] email at each step.',
					)
				: '';

		if (index >= steps.length) {
			root.replaceChildren(
				banner,
				progress(),
				el('h1', { class: 'display text-5xl' }, 'All done'),
				el(
					'p',
					{ class: 'text-secondary' },
					`Thank you, ${c.n}. Gabriel takes it from here — he’ll set up ${c.d} and let you know when it’s live.`,
				),
			);
			const again = el(
				'button',
				{ type: 'button', class: 'self-start text-xs text-faint underline' },
				'Start over',
			);
			again.addEventListener('click', () => {
				index = 0;
				save();
				render();
			});
			root.append(again);
			return;
		}

		const step = steps[index];
		const open = el(
			'a',
			{
				href: step.url,
				target: '_blank',
				rel: 'noopener',
				class:
					'block rounded-full bg-glow px-6 py-4 text-center text-lg font-semibold text-night active:scale-[0.98]',
			},
			`Open ${step.url.includes('github.com') ? 'GitHub' : 'Cloudflare'}${step.copy ? ' (copies for you)' : ''}`,
		);
		open.addEventListener('click', () => {
			// Not awaited: the new tab must open inside the same tap (iOS rule).
			if (step.copy) navigator.clipboard?.writeText(step.copy.value).catch(() => {});
			opened = true;
			flash(step.copy ? `${step.copy.label} copied — just paste it.` : '');
		});

		const copyChip = step.copy
			? el(
					'button',
					{
						type: 'button',
						class: 'w-full rounded-md border border-border px-3 py-2 text-left text-sm',
						'data-copy': '',
					},
					el('span', { class: 'block text-xs text-label' }, `${step.copy.label} (tap to copy)`),
					el('span', { class: 'break-all text-body' }, step.copy.value),
				)
			: '';
		if (copyChip && step.copy) {
			const value = step.copy.value;
			copyChip.addEventListener('click', () => {
				navigator.clipboard?.writeText(value).then(
					() => flash('Copied.'),
					() => flash('Copy didn’t work — press and hold the text to copy it.'),
				);
			});
		}

		const next = el(
			'button',
			{
				type: 'button',
				class: 'rounded-full border border-border px-6 py-3 text-secondary',
				'data-next': '',
			},
			index === steps.length - 1 ? 'I sent the invite → Finish' : 'Done → Next step',
		);
		next.addEventListener('click', () => advance('done'));

		root.replaceChildren(
			banner,
			progress(),
			el(
				'p',
				{ class: 'text-xs uppercase tracking-widest text-label' },
				`Step ${index + 1} of ${steps.length}`,
			),
			el('h1', { class: 'display text-4xl leading-tight' }, step.title),
			el(
				'ul',
				{ class: 'flex flex-col gap-2 text-secondary' },
				...step.lines.map((l) => el('li', {}, l)),
			),
			copyChip,
			open,
			el('p', { class: 'min-h-6 text-sm text-glow', 'data-status': '', 'aria-live': 'polite' }),
			next,
			step.detect
				? el(
						'p',
						{ class: 'text-xs text-faint' },
						'This page moves on by itself once your invite arrives.',
					)
				: '',
		);
		startPolling(step);
	}

	// Coming back from the other tab: nudge the Next button for steps that can't be detected.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible' || !opened) return;
		const nextBtn = root.querySelector<HTMLElement>('[data-next]');
		if (!nextBtn) return;
		nextBtn.className = 'rounded-full bg-glow px-6 py-4 text-lg font-semibold text-night';
		flash('Finished there? Tap below to keep going.');
	});

	render();
}
