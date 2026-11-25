// The client's guided onboarding page. The link carries only a random code
// (after the #); the client's setup and progress live in the onboarding
// Worker, so Gabriel can edit them from the dashboard and the client can close
// the tab and come back.
//
// Every move is applied here at once (with the same rules the Worker uses)
// and then saved. A save that can't get through waits in a queue and is sent
// on the next check; the Worker has the last word.

import type { ClientConfig } from '../onboard/link.ts';
import { applyProgress, type Progress, type ProgressAction } from '../onboard/progress.ts';
import { buildSteps, newInvites, type Step } from '../onboard/steps.ts';

const POLL_MS = 5000;

type Feed = { github: string[]; cloudflare: string[] };
interface ClientRecord extends Progress {
	name: string;
	email: string;
	domain: string;
	lane: ClientConfig['l'];
	tier: ClientConfig['t'];
	mode: ClientConfig['m'];
}
interface Move {
	action: ProgressAction;
	step: number;
	via?: 'invite' | 'button';
}

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: { [k: string]: string } = {},
	...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	node.append(...kids);
	return node;
}

const configOf = (r: ClientRecord): ClientConfig => ({
	n: r.name,
	e: r.email,
	d: r.domain,
	l: r.lane,
	t: r.tier,
	m: r.mode,
});

async function fetchFeed(): Promise<Feed | null> {
	try {
		const res = await fetch('/api/onboard/invites', { headers: { accept: 'application/json' } });
		if (!res.ok) return null;
		return (await res.json()) as Feed;
	} catch {
		return null;
	}
}

export function startFlow(root: HTMLElement): void {
	window.addEventListener('hashchange', () => location.reload());
	const code = location.hash.slice(1);
	const base = `/api/onboard/client/${encodeURIComponent(code)}`;

	let rec: ClientRecord | null = null;
	let steps: Step[] = [];
	let p: Progress = { step: 0, done: [] };
	const queue: Move[] = [];
	let sending = false;
	let opened = false;
	let detectTimer: number | undefined;
	let baseline: string[] | null = null;
	let shownKey = '';

	const message = (title: string, text: string, retry = false) => {
		stopDetect();
		shownKey = '';
		const kids: (Node | string)[] = [
			el('h1', { class: 'display text-4xl' }, title),
			el('p', { class: 'text-secondary' }, text),
		];
		if (retry) {
			const b = el('button', { type: 'button', class: 'brass-btn self-start' }, 'Try again');
			b.addEventListener('click', () => load());
			kids.push(b);
		}
		root.replaceChildren(...kids);
	};
	const inactive = () => {
		rec = null;
		message('This link isn’t active', 'Contact Gabriel and he’ll send you a fresh one.');
	};

	const flash = (text: string) => {
		const s = root.querySelector<HTMLElement>('[data-status]');
		if (s) s.textContent = text;
	};

	// ── Saving ──────────────────────────────────────────────────────────────

	async function flush(): Promise<void> {
		if (sending) return;
		sending = true;
		try {
			while (queue.length > 0) {
				const m = queue[0];
				let res: Response;
				try {
					res = await fetch(`${base}/progress`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(m),
						keepalive: true,
					});
				} catch {
					flash('No connection — your progress is kept here and saves when you’re back online.');
					return;
				}
				if (res.status === 404) {
					queue.length = 0;
					inactive();
					return;
				}
				if (res.status === 429 || res.status >= 500) return; // sent again on the next check
				queue.shift();
				const body = (await res.json().catch(() => null)) as Progress | null;
				// 200: the saved state; 400: the move no longer fits, and this is the true state.
				if (body && Array.isArray(body.done) && queue.length === 0) adopt(body);
			}
		} finally {
			sending = false;
		}
	}

	function adopt(next: Progress): void {
		p = { step: next.step, done: [...next.done] };
		render();
	}

	function move(m: Move): void {
		const r = applyProgress(
			p,
			m.action,
			m.step,
			steps.map((s) => s.id),
		);
		if (!r.ok) return;
		p = r.progress;
		queue.push(m);
		render();
		flush();
	}

	// ── Loading and checking ────────────────────────────────────────────────

	async function fetchRecord(): Promise<ClientRecord | 'gone' | null> {
		try {
			const res = await fetch(base, { headers: { accept: 'application/json' } });
			if (res.status === 404) return 'gone';
			if (!res.ok) return null;
			return (await res.json()) as ClientRecord;
		} catch {
			return null;
		}
	}

	async function load(): Promise<void> {
		if (!/^[A-Za-z0-9_-]{20,64}$/.test(code)) return inactive();
		const r = await fetchRecord();
		if (r === 'gone') return inactive();
		if (!r) {
			if (!rec)
				message(
					'We’re having trouble',
					'Your setup didn’t load. Check your connection and try again in a minute.',
					true,
				);
			return;
		}
		rec = r;
		steps = buildSteps(configOf(r));
		if (queue.length === 0 && !sending) adopt(r);
		else render();
	}

	setInterval(async () => {
		if (document.visibilityState !== 'visible' || !rec) return;
		if (queue.length > 0) await flush();
		else await load();
	}, POLL_MS);

	// ── Invite detection (as in the first build) ────────────────────────────

	function stopDetect(): void {
		if (detectTimer !== undefined) clearInterval(detectTimer);
		detectTimer = undefined;
	}

	function startDetect(step: Step, index: number): void {
		const source = step.detect;
		if (!source) return;
		baseline = null;
		const tick = async () => {
			if (document.visibilityState !== 'visible') return;
			const feed = await fetchFeed();
			if (!feed) {
				stopDetect(); // not configured or unreachable: the Done button is the whole story
				return;
			}
			if (baseline === null) {
				baseline = feed[source];
				return;
			}
			if (newInvites(baseline, feed[source]).length > 0) {
				stopDetect();
				flash('Got it — your invite arrived.');
				setTimeout(() => {
					if (p.step === index) move({ action: 'done', step: index, via: 'invite' });
				}, 1200);
			}
		};
		tick();
		detectTimer = window.setInterval(tick, POLL_MS);
	}

	// ── Drawing ─────────────────────────────────────────────────────────────

	const stepBar = () => {
		const done = new Set(p.done);
		return el(
			'ol',
			{ class: 'ob-steps', 'aria-label': 'Your steps' },
			...steps.map((s, i) => {
				const ticked = done.has(s.id);
				const state = i === p.step ? 'current' : ticked ? 'done' : 'todo';
				const open = i <= p.step || ticked;
				const b = el(
					'button',
					{
						type: 'button',
						'data-state': state,
						'aria-label': `Step ${i + 1}: ${s.title}${ticked ? ' (done)' : ''}`,
						...(state === 'current' ? { 'aria-current': 'step' } : {}),
					},
					ticked ? `✓ ${i + 1}` : String(i + 1),
				);
				if (!open) b.disabled = true;
				else if (i !== p.step) b.addEventListener('click', () => move({ action: 'goto', step: i }));
				return el('li', {}, b);
			}),
		);
	};

	function render(): void {
		if (!rec) return;
		const c = configOf(rec);
		const key = `${p.step}|${p.done.join()}|${JSON.stringify(c)}`;
		if (key === shownKey) return; // nothing changed: leave the page (and its status line) alone
		shownKey = key;
		stopDetect();
		opened = false;

		const banner =
			c.m === 'test'
				? el('p', { class: 'ob-test' }, 'TEST MODE — Gabriel gets a [TEST] email at each step.')
				: '';

		if (p.step >= steps.length) {
			root.replaceChildren(
				banner,
				stepBar(),
				el('h1', { class: 'display text-5xl' }, 'All done'),
				el(
					'p',
					{ class: 'text-secondary' },
					`Thank you, ${c.n}. Gabriel takes it from here — he’ll set up ${c.d || 'your site'} and let you know when it’s live.`,
				),
				el(
					'p',
					{ class: 'ob-note' },
					'Need to change something? Tap any step above to go back to it.',
				),
			);
			return;
		}

		const index = p.step;
		const step = steps[index];
		const ticked = p.done.includes(step.id);
		const site = step.url.includes('github.com') ? 'GitHub' : 'Cloudflare';

		const open = el(
			'a',
			{
				href: step.url,
				target: '_blank',
				rel: 'noopener',
				class: 'brass-btn brass-btn--primary w-full',
			},
			`Open ${site}${step.copy ? ' (copies for you)' : ''}`,
		);
		open.addEventListener('click', () => {
			// Not awaited: the new tab must open inside the same tap (iOS rule).
			if (step.copy) navigator.clipboard?.writeText(step.copy.value).catch(() => {});
			opened = true;
			flash(step.copy ? `${step.copy.label} copied — just paste it.` : '');
		});

		let copyChip: Node | string = '';
		if (step.copy) {
			const value = step.copy.value;
			const chip = el(
				'button',
				{ type: 'button', class: 'ob-copy' },
				el('small', {}, `${step.copy.label} (tap to copy)`),
				el('span', {}, value),
			);
			chip.addEventListener('click', () => {
				navigator.clipboard?.writeText(value).then(
					() => flash('Copied.'),
					() => flash('Copy didn’t work — press and hold the text to copy it.'),
				);
			});
			copyChip = chip;
		}

		const controls = el('div', { class: 'flex flex-col gap-3' });
		if (ticked) {
			const next = el(
				'button',
				{ type: 'button', class: 'brass-btn w-full', 'data-next': '' },
				index === steps.length - 1 ? 'Back to the finish' : 'Next step →',
			);
			next.addEventListener('click', () => move({ action: 'goto', step: index + 1 }));
			controls.append(el('p', { class: 'ob-ok' }, '✓ You’ve done this step.'), next);
		} else {
			const next = el(
				'button',
				{ type: 'button', class: 'brass-btn w-full', 'data-next': '' },
				index === steps.length - 1 ? 'I sent the invite → Finish' : 'Done → Next step',
			);
			next.addEventListener('click', () => move({ action: 'done', step: index }));
			controls.append(next);
		}

		const small = el('div', { class: 'flex flex-wrap gap-3' });
		if (index > 0) {
			const back = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--quiet', 'data-back': '' },
				'← Back',
			);
			back.addEventListener('click', () => move({ action: 'goto', step: index - 1 }));
			small.append(back);
		}
		if (ticked) {
			const redo = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--quiet', 'data-redo': '' },
				'Redo this step',
			);
			redo.addEventListener('click', () => {
				move({ action: 'undo', step: index });
				flash('Okay — do this step again, then tap Done.');
			});
			small.append(redo);
		}

		root.replaceChildren(
			banner,
			stepBar(),
			el(
				'section',
				{ class: 'panel flex flex-col gap-4' },
				el('p', { class: 'ob-kicker' }, `Step ${index + 1} of ${steps.length}`),
				el('h1', { class: 'display text-3xl leading-tight' }, step.title),
				el(
					'ul',
					{ class: 'flex list-disc flex-col gap-2 pl-5 text-secondary' },
					...step.lines.map((l) => el('li', {}, l)),
				),
				copyChip,
				open,
				el('p', { class: 'ob-status', 'data-status': '', 'aria-live': 'polite' }),
				controls,
				step.detect && !ticked
					? el('p', { class: 'ob-note' }, 'This page moves on by itself once your invite arrives.')
					: '',
			),
			small,
		);
		if (!ticked) startDetect(step, index);
	}

	// Coming back from the other tab: light up the button for steps that can't be detected.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible' || !opened) return;
		const nextBtn = root.querySelector<HTMLElement>('[data-next]');
		if (!nextBtn) return;
		nextBtn.classList.add('brass-btn--primary');
		flash('Finished there? Tap below to keep going.');
	});

	load();
}
