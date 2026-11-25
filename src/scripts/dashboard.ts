// Gabriel's onboarding dashboard. Three views in one page, picked by the hash:
//   #            the client list (Active / Archived)
//   #new         a new client
//   #c/<id>      one client: link, progress, details, checklist, notes
//
// Nothing about a client is kept in this page's code or in the browser's
// storage; it all comes from the Worker each time.

import qrcode from 'qrcode-generator';
import type { StepId } from '../onboard/steps.ts';
import {
	type AdminClient,
	ApiError,
	api,
	type Checklist,
	type ClientFields,
	type Patch,
} from './dashboard-api.ts';

const REFRESH_MS = 15_000;

type Kid = Node | string;
function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: { [k: string]: string | boolean } = {},
	...kids: Kid[]
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v === false) continue;
		node.setAttribute(k, v === true ? '' : v);
	}
	node.append(...kids);
	return node;
}

const LANE = { ms: 'Microsoft', g: 'Google' } as const;
const MODE = { person: 'In person', remote: 'Remote', test: 'Test' } as const;
const CHECKS: { key: keyof Checklist; label: string; href?: string; hint?: string }[] = [
	{
		key: 'invites',
		label: 'Accept both invites',
		href: 'https://github.com/settings/organizations',
		hint: 'GitHub orgs; Cloudflare from its email',
	},
	{
		key: 'card',
		label: 'Add the studio card in their Cloudflare account',
		href: 'https://dash.cloudflare.com/?to=/:account/billing',
		hint: 'Billing',
	},
	{
		key: 'domain',
		label: 'Buy their domain',
		href: 'https://dash.cloudflare.com/?to=/:account/registrar/register',
		hint: 'Registrar',
	},
	{ key: 'billing', label: 'Billing set up with the client' },
];

export function ago(ms: number | null, now = Date.now()): string {
	if (!ms) return 'not opened yet';
	const s = Math.max(0, Math.round((now - ms) / 1000));
	if (s < 60) return 'active just now';
	const m = Math.round(s / 60);
	if (m < 60) return `active ${m} min ago`;
	const h = Math.round(m / 60);
	if (h < 24) return `active ${h} h ago`;
	const d = Math.round(h / 24);
	return `active ${d} day${d === 1 ? '' : 's'} ago`;
}

const stepWord = (c: AdminClient) =>
	c.step >= c.steps.length ? 'Finished' : `Step ${c.step + 1} of ${c.steps.length}`;

export function startDashboard(view: HTMLElement, banner: HTMLElement): void {
	let timer: number | undefined;
	let tab: 'active' | 'archived' = 'active';
	let token = 0; // bumps on every view change, so a late answer can't draw over a newer view

	const showError = (e: unknown, doing: string) => {
		if (e instanceof ApiError && e.status === 401) {
			banner.replaceChildren(
				'Your sign-in has run out. ',
				el('a', { href: location.href, class: 'underline' }, 'Reload to sign in again'),
				'.',
			);
		} else if (e instanceof ApiError && e.status === 503) {
			banner.textContent = e.message;
		} else {
			banner.textContent = `Couldn’t ${doing}: ${e instanceof Error ? e.message : 'something went wrong.'}`;
		}
		banner.hidden = false;
	};
	const clearError = () => {
		banner.hidden = true;
		banner.textContent = '';
	};

	const stopRefresh = () => {
		if (timer !== undefined) clearInterval(timer);
		timer = undefined;
	};
	const every = (fn: () => void) => {
		stopRefresh();
		timer = window.setInterval(() => {
			if (document.visibilityState === 'visible') fn();
		}, REFRESH_MS);
	};

	/** A button that asks for a second tap before doing something it can't undo. */
	const confirmButton = (label: string, ask: string, cls: string, run: () => Promise<void>) => {
		const b = el('button', { type: 'button', class: cls }, label);
		let armed = false;
		let reset: number | undefined;
		b.addEventListener('click', async () => {
			if (!armed) {
				armed = true;
				b.textContent = ask;
				reset = window.setTimeout(() => {
					armed = false;
					b.textContent = label;
				}, 4000);
				return;
			}
			clearTimeout(reset);
			b.disabled = true;
			await run();
			b.disabled = false;
			armed = false;
			b.textContent = label;
		});
		return b;
	};

	// ── List ────────────────────────────────────────────────────────────────

	async function showList(): Promise<void> {
		const mine = ++token;
		const tabs = el('div', { class: 'ob-tabs', role: 'tablist' });
		for (const t of ['active', 'archived'] as const) {
			const b = el(
				'button',
				{ type: 'button', class: 'ob-tab', role: 'tab', 'aria-selected': String(t === tab) },
				t === 'active' ? 'Active' : 'Archived',
			);
			b.addEventListener('click', () => {
				tab = t;
				showList();
			});
			tabs.append(b);
		}
		const list = el('ul', { class: 'ob-list', 'aria-live': 'polite' });
		view.replaceChildren(el('h1', { class: 'display text-4xl' }, 'Onboarding'), tabs, list);

		const fill = async () => {
			try {
				const clients = await api.list(tab === 'archived');
				if (mine !== token) return;
				clearError();
				if (clients.length === 0) {
					list.replaceChildren(
						el(
							'li',
							{ class: 'text-secondary' },
							tab === 'active'
								? 'No one is being onboarded right now. Start with “New client”.'
								: 'Nothing archived.',
						),
					);
					return;
				}
				list.replaceChildren(...clients.map((c) => el('li', {}, row(c))));
			} catch (e) {
				if (mine === token) showError(e, 'load the clients');
			}
		};
		await fill();
		every(fill);
	}

	const row = (c: AdminClient) => {
		const bar = el('span', { class: 'ob-bar', 'aria-hidden': 'true' });
		for (const s of c.steps) bar.append(el('i', { 'data-on': c.done.includes(s.id) }));
		return el(
			'a',
			{ class: 'ob-row', href: `#c/${c.id}`, 'data-client': c.id },
			el(
				'span',
				{ class: 'flex flex-col gap-1' },
				el('strong', {}, c.name),
				el(
					'span',
					{ class: 'ob-meta' },
					`${LANE[c.lane]} · Tier ${c.tier === 2 ? '2/3' : '1'} · ${MODE[c.mode]} · ${stepWord(c)} · ${ago(c.last_seen_at)}`,
				),
			),
			el('span', { class: 'ob-chip', 'data-status': c.status }, c.status),
			bar,
		);
	};

	// ── The client form (new and edit) ──────────────────────────────────────

	function fieldsForm(c: Partial<ClientFields>, submitLabel: string) {
		const text = (name: string, label: string, type: string, value = '', extra = {}) =>
			el(
				'label',
				{ class: 'ob-field', 'data-field': name },
				label,
				el('input', {
					name,
					type,
					value,
					required: true,
					autocomplete: 'off',
					...extra,
				}),
			);
		const radios = (name: string, legend: string, options: [string, string][], value: string) =>
			el(
				'fieldset',
				{ class: 'ob-choices', 'data-field': name },
				el('legend', {}, legend),
				...options.map(([v, l]) =>
					el(
						'label',
						{ class: 'ob-choice' },
						el('input', { type: 'radio', name, value: v, checked: v === value }),
						l,
					),
				),
			);
		const status = el('p', { class: 'ob-status', 'aria-live': 'polite' });
		const form = el(
			'form',
			{ class: 'ob-form', novalidate: true },
			text('name', 'Business name', 'text', c.name, { maxlength: '80' }),
			text('email', 'Business email', 'email', c.email, { maxlength: '254' }),
			text('domain', 'Domain (only if they already have one)', 'text', c.domain, {
				maxlength: '253',
				placeholder: 'Leave blank if not',
				required: false,
			}),
			radios(
				'lane',
				'Does their business run on…',
				[
					['ms', 'Microsoft'],
					['g', 'Google'],
				],
				c.lane ?? 'ms',
			),
			radios(
				'tier',
				'Tier',
				[
					['2', 'Tier 2/3 — GitHub + Cloudflare'],
					['1', 'Tier 1 — Cloudflare only (repo stays in the studio org)'],
				],
				String(c.tier ?? 2),
			),
			radios(
				'mode',
				'How you’ll run it',
				[
					['person', 'In person — no emails'],
					['remote', 'Remote — email me at each step'],
					['test', 'Test — like remote, emails marked [TEST]'],
				],
				c.mode ?? 'person',
			),
			el(
				'button',
				{ type: 'submit', class: 'brass-btn brass-btn--primary self-start' },
				submitLabel,
			),
			status,
		);
		const read = (): ClientFields => {
			const f = new FormData(form);
			const g = (k: string) => String(f.get(k) ?? '').trim();
			return {
				name: g('name'),
				email: g('email'),
				domain: g('domain'),
				lane: g('lane') as ClientFields['lane'],
				tier: Number(g('tier')) as ClientFields['tier'],
				mode: g('mode') as ClientFields['mode'],
			};
		};
		const markField = (field?: string) => {
			for (const n of form.querySelectorAll('[data-invalid]')) n.removeAttribute('data-invalid');
			if (field) form.querySelector(`[data-field="${field}"]`)?.setAttribute('data-invalid', '');
		};
		return { form, read, status, markField };
	}

	async function runForm(
		f: ReturnType<typeof fieldsForm>,
		doing: string,
		send: (x: ClientFields) => Promise<void>,
	) {
		const button = f.form.querySelector<HTMLButtonElement>('button[type=submit]');
		if (button) button.disabled = true;
		f.status.textContent = 'Saving…';
		try {
			await send(f.read());
			f.markField();
			clearError();
			f.status.textContent = 'Saved.';
		} catch (e) {
			f.status.textContent = '';
			if (e instanceof ApiError && e.field) {
				f.markField(e.field);
				f.status.textContent = e.message;
			} else showError(e, doing);
		} finally {
			if (button) button.disabled = false;
		}
	}

	// ── New ─────────────────────────────────────────────────────────────────

	function showNew(): void {
		++token;
		stopRefresh();
		const f = fieldsForm({}, 'Create client');
		f.form.addEventListener('submit', (e) => {
			e.preventDefault();
			runForm(f, 'create the client', async (fields) => {
				const c = await api.create(fields);
				location.hash = `#c/${c.id}`;
			});
		});
		view.replaceChildren(
			el('a', { href: '#', class: 'ob-home' }, '← All clients'),
			el('h1', { class: 'display text-4xl' }, 'New client'),
			el('section', { class: 'panel' }, f.form),
		);
		f.form.querySelector<HTMLInputElement>('input[name=name]')?.focus();
	}

	// ── Detail ──────────────────────────────────────────────────────────────

	async function showClient(id: string): Promise<void> {
		const mine = ++token;
		stopRefresh();
		let c: AdminClient;
		try {
			c = await api.get(id);
		} catch (e) {
			if (mine !== token) return;
			if (e instanceof ApiError && e.status === 404) {
				view.replaceChildren(
					el('a', { href: '#', class: 'ob-home' }, '← All clients'),
					el('p', { class: 'text-secondary' }, 'That client isn’t here any more.'),
				);
				return;
			}
			showError(e, 'load this client');
			return;
		}
		if (mine !== token) return;
		clearError();

		const heading = el('h1', { class: 'display text-4xl' }, c.name);
		const meta = el('p', { class: 'ob-meta' });
		const chip = el('span', { class: 'ob-chip' });
		const linkBox = el('div', { class: 'flex flex-col gap-3' });
		const progressBox = el('div', { class: 'flex flex-col gap-3' });
		const manageBox = el('div', { class: 'ob-actions' });

		const save = async (p: Patch, doing: string): Promise<boolean> => {
			try {
				c = await api.patch(c.id, p);
				clearError();
				drawTop();
				drawProgress();
				drawManage();
				return true;
			} catch (e) {
				showError(e, doing);
				return false;
			}
		};

		const drawTop = () => {
			heading.textContent = c.name;
			chip.textContent = c.status;
			chip.setAttribute('data-status', c.status);
			meta.textContent = `${LANE[c.lane]} · Tier ${c.tier === 2 ? '2/3' : '1'} · ${MODE[c.mode]} · ${stepWord(c)} · ${ago(c.last_seen_at)}`;
		};

		const drawLink = (message = '') => {
			const a = el(
				'a',
				{ class: 'ob-linkbox underline', href: c.link, target: '_blank', rel: 'noopener' },
				c.link,
			);
			const note = el('p', { class: 'ob-status', 'aria-live': 'polite' }, message);
			const copy = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--small' },
				'Copy link',
			);
			copy.addEventListener('click', () => {
				navigator.clipboard?.writeText(c.link).then(
					() => {
						note.textContent = 'Link copied.';
					},
					() => {
						note.textContent = 'Copy failed — press and hold the link instead.';
					},
				);
			});
			const qr = qrcode(0, 'M');
			qr.addData(c.link);
			qr.make();
			const qrBox = el('div', { class: 'ob-qr', role: 'img', 'aria-label': 'QR code of the link' });
			qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
			const rotate = confirmButton(
				'New link',
				'The old link stops working. Tap again',
				'brass-btn brass-btn--small brass-btn--quiet',
				async () => {
					try {
						c = await api.rotate(c.id);
						clearError();
						drawLink('New link made. The old one no longer works.');
					} catch (e) {
						showError(e, 'make a new link');
					}
				},
			);
			linkBox.replaceChildren(a, el('div', { class: 'ob-actions' }, copy, rotate), note, qrBox);
		};

		const drawProgress = () => {
			const list = el('ol', { class: 'ob-steplist' });
			c.steps.forEach((s, i) => {
				const tick = el('input', { type: 'checkbox', checked: c.done.includes(s.id) });
				tick.addEventListener('change', () => {
					const done = tick.checked ? [...c.done, s.id] : c.done.filter((d) => d !== s.id);
					save({ done: done as StepId[] }, 'update the steps');
				});
				const current = i === c.step;
				const here = el(
					'button',
					{
						type: 'button',
						class: 'brass-btn brass-btn--small brass-btn--quiet',
						disabled: current,
					},
					current ? 'Client is here' : 'Put client here',
				);
				here.addEventListener('click', () => save({ step: i }, 'move the client'));
				list.append(
					el(
						'li',
						{ 'data-current': current },
						el('label', { class: 'ob-choice' }, tick, `${i + 1}. ${s.title}`),
						here,
					),
				);
			});
			const finished = c.step >= c.steps.length;
			const finish = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--small', disabled: finished },
				'Mark all done',
			);
			finish.addEventListener('click', () =>
				save({ step: c.steps.length, done: c.steps.map((s) => s.id) }, 'mark it done'),
			);
			const reset = confirmButton(
				'Reset to step 1',
				'Clears every tick. Tap again',
				'brass-btn brass-btn--small brass-btn--quiet',
				async () => {
					await save({ step: 0, done: [] }, 'reset the steps');
				},
			);
			progressBox.replaceChildren(
				el(
					'p',
					{ class: 'ob-meta' },
					`${stepWord(c)}. Changes reach the client’s open page within a few seconds.`,
				),
				list,
				el('div', { class: 'ob-actions' }, finish, reset),
			);
		};

		const drawChecklist = () => {
			const box = el('div', { class: 'flex flex-col gap-3' });
			for (const item of CHECKS) {
				const input = el('input', { type: 'checkbox', checked: c.checklist[item.key] });
				input.addEventListener('change', () =>
					save({ checklist: { [item.key]: input.checked } }, 'save the checklist'),
				);
				box.append(
					el(
						'label',
						{ class: 'ob-choice' },
						input,
						el(
							'span',
							{},
							item.label,
							item.href
								? el(
										'span',
										{ class: 'ob-meta' },
										' — ',
										el(
											'a',
											{ href: item.href, target: '_blank', rel: 'noopener', class: 'underline' },
											item.hint ?? 'open',
										),
									)
								: '',
						),
					),
				);
			}
			const notes = el('textarea', { name: 'notes', maxlength: '5000' });
			notes.value = c.notes;
			const saved = el('p', { class: 'ob-meta', 'aria-live': 'polite' });
			let wait: number | undefined;
			notes.addEventListener('input', () => {
				clearTimeout(wait);
				saved.textContent = '…';
				wait = window.setTimeout(async () => {
					saved.textContent = (await save({ notes: notes.value }, 'save your notes'))
						? 'Saved.'
						: 'Not saved.';
				}, 600);
			});
			return el(
				'div',
				{ class: 'flex flex-col gap-4' },
				box,
				el('label', { class: 'ob-field' }, 'Notes', notes),
				saved,
				el(
					'p',
					{ class: 'ob-meta' },
					'Cloudflare links open whichever account is selected — switch to the client’s first.',
				),
			);
		};

		const drawManage = () => {
			const archived = c.status === 'archived';
			const arch = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--small' },
				archived ? 'Unarchive' : 'Archive',
			);
			arch.addEventListener('click', () => {
				const status = archived ? (c.step >= c.steps.length ? 'done' : 'active') : 'archived';
				save({ status }, archived ? 'unarchive' : 'archive');
			});
			const del = confirmButton(
				'Delete',
				`Delete ${c.name} for good? Tap again`,
				'brass-btn brass-btn--small brass-btn--quiet ob-danger',
				async () => {
					try {
						await api.remove(c.id);
						location.hash = '#';
					} catch (e) {
						showError(e, 'delete the client');
					}
				},
			);
			manageBox.replaceChildren(
				arch,
				del,
				el(
					'p',
					{ class: 'ob-meta w-full' },
					archived
						? 'Archived: their link is switched off until you unarchive.'
						: 'Archiving switches their link off and moves them out of the Active list.',
				),
			);
		};

		const edit = fieldsForm(c, 'Save details');
		edit.form.addEventListener('submit', (e) => {
			e.preventDefault();
			runForm(edit, 'save the details', async (fields) => {
				c = await api.patch(c.id, fields);
				drawTop();
				drawProgress();
			});
		});

		const section = (title: string, ...kids: Kid[]) =>
			el('section', { class: 'panel ob-section' }, el('h2', {}, title), ...kids);

		drawTop();
		drawLink();
		drawProgress();
		drawManage();
		view.replaceChildren(
			el('a', { href: '#', class: 'ob-home' }, '← All clients'),
			el('div', { class: 'flex flex-wrap items-center gap-3' }, heading, chip),
			meta,
			section('Their link', linkBox),
			section('Progress', progressBox),
			section('Your side', drawChecklist()),
			section('Details', edit.form),
			section('Manage', manageBox),
		);

		// Keep progress and "last active" fresh without touching anything being typed.
		every(async () => {
			try {
				const fresh = await api.get(c.id);
				if (mine !== token) return;
				const moved =
					fresh.step !== c.step || fresh.done.join() !== c.done.join() || fresh.status !== c.status;
				c = { ...fresh, notes: c.notes };
				drawTop();
				if (moved) {
					drawProgress();
					drawManage();
				}
			} catch {
				/* the next tick tries again */
			}
		});
	}

	// ── Routing ─────────────────────────────────────────────────────────────

	const route = () => {
		window.scrollTo(0, 0);
		const h = location.hash.slice(1);
		if (h === 'new') return showNew();
		if (h.startsWith('c/')) return showClient(decodeURIComponent(h.slice(2)));
		return showList();
	};
	window.addEventListener('hashchange', route);
	route();
}
