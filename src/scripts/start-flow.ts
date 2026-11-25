// The client's page. The link carries only a random code (after the #);
// everything else comes from the onboarding Worker.
//
//   Not sent yet  → the intake form (saved as they type) and photos
//   Sent          → where their site is up to; "Change my answers" while allowed
//   Review        → see the site; Looks good / Request changes
//   Live          → their address
//
// No accounts, no outside sites.

import { type Intake, readyToSend, STAGE_TEXT, STAGES, type Stage } from '../onboard/intake.ts';
import { type IntakeForm, intakeForm } from './intake-form.ts';
import { preparePhoto, sendPhoto } from './photo-prep.ts';
import { debounce, el } from './ui.ts';

const POLL_MS = 10_000;
const CLIENT_SIDE = 2560;

interface View {
	name: string;
	stage: Stage;
	intake: Intake;
	sent: boolean;
	editable: boolean;
	preview_url: string;
	live_url: string;
	answered: 'ok' | 'changes' | null;
	photos: { id: string; name: string }[];
}

export function startFlow(root: HTMLElement): void {
	const code = location.hash.slice(1);
	const base = `/api/onboard/client/${encodeURIComponent(code)}`;
	let view: View | null = null;
	let editing = false;
	let form: IntakeForm | null = null;
	let poll: number | undefined;

	const dead = () => {
		clearInterval(poll);
		root.replaceChildren(
			el('h1', { class: 'display text-4xl' }, 'This link isn’t active'),
			el(
				'p',
				{ class: 'text-secondary' },
				'It may have been replaced with a new one. Contact Gabriel and he’ll send you the right link.',
			),
		);
	};

	async function load(): Promise<View | 'dead' | null> {
		try {
			const res = await fetch(base, { headers: { accept: 'application/json' } });
			if (res.status === 404) return 'dead';
			if (!res.ok) return null;
			return (await res.json()) as View;
		} catch {
			return null;
		}
	}

	// ── Saving the intake ───────────────────────────────────────────────────

	const saveLine = el('p', { class: 'ob-status', 'aria-live': 'polite' });
	let saving: Promise<unknown> = Promise.resolve();
	let retry: number | undefined;

	async function put(send: boolean): Promise<{ ok: boolean; field?: string; error?: string }> {
		if (!form) return { ok: false };
		const intake = form.read();
		try {
			const res = await fetch(`${base}/intake`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ intake, send }),
			});
			const data = (await res.json().catch(() => null)) as
				| (View & { field?: string; error?: string })
				| null;
			if (res.status === 404) {
				dead();
				return { ok: false };
			}
			if (!res.ok) return { ok: false, field: data?.field, error: data?.error ?? 'Couldn’t save.' };
			if (data) view = data;
			return { ok: true };
		} catch {
			return { ok: false, error: 'No connection.' };
		}
	}

	const autosave = debounce(() => {
		saving = saving.then(async () => {
			clearTimeout(retry);
			const r = await put(false);
			if (r.ok) {
				form?.mark(null);
				saveLine.textContent = 'Saved.';
			} else if (r.field) {
				form?.mark(r.field, r.error);
				saveLine.textContent = '';
			} else {
				saveLine.textContent = 'Not saved yet — retrying…';
				retry = window.setTimeout(() => autosave.poke(), 5000);
			}
		});
	}, 800);

	// ── Photos ──────────────────────────────────────────────────────────────

	function photosBlock(): HTMLElement {
		const grid = el('ul', { class: 'ob-photos', 'aria-live': 'polite' });
		const tile = (id: string, src: string, name: string) => {
			const remove = el(
				'button',
				{ type: 'button', class: 'ob-photo-x', 'aria-label': `Remove ${name}` },
				'×',
			);
			const li = el(
				'li',
				{ class: 'ob-photo' },
				el('img', { src, alt: name, loading: 'lazy' }),
				remove,
			);
			remove.addEventListener('click', async () => {
				remove.disabled = true;
				const res = await fetch(`${base}/photos/${encodeURIComponent(id)}`, {
					method: 'DELETE',
				}).catch(() => null);
				if (res?.ok) li.remove();
				else remove.disabled = false;
			});
			return li;
		};
		for (const p of view?.photos ?? [])
			grid.append(tile(p.id, `${base}/photos/${encodeURIComponent(p.id)}`, p.name));

		const input = el('input', {
			type: 'file',
			accept: 'image/*',
			multiple: true,
			class: 'sr-only',
			id: 'ob-add-photos',
		});
		const add = el(
			'label',
			{ for: 'ob-add-photos', class: 'brass-btn brass-btn--quiet brass-btn--small' },
			'Add photos',
		);

		const upload = async (file: File, li: HTMLElement) => {
			li.replaceChildren(el('span', { class: 'ob-photo-msg' }, 'Uploading…'));
			li.removeAttribute('data-failed');
			const p = await preparePhoto(file, CLIENT_SIDE);
			const r = await sendPhoto(`${base}/photos`, p);
			if (r.ok && r.data) {
				const src = p.thumb
					? URL.createObjectURL(p.thumb)
					: `${base}/photos/${encodeURIComponent(String(r.data.id))}`;
				li.replaceWith(tile(String(r.data.id), src, String(r.data.name)));
				return;
			}
			const why =
				r.status === 409 || r.status === 413 || r.status === 415
					? String(r.data?.error)
					: 'Didn’t upload — tap to retry';
			li.setAttribute('data-failed', '');
			const again = el('button', { type: 'button', class: 'ob-photo-msg' }, why);
			if (r.status !== 409 && r.status !== 413 && r.status !== 415)
				again.addEventListener('click', () => upload(file, li));
			li.replaceChildren(again);
		};

		input.addEventListener('change', async () => {
			const files = [...(input.files ?? [])];
			input.value = '';
			for (const f of files) {
				const li = el('li', { class: 'ob-photo' });
				grid.append(li);
				await upload(f, li);
			}
		});

		return el(
			'section',
			{ class: 'ob-section' },
			el('h2', {}, 'Photos and logo'),
			el(
				'p',
				{ class: 'ob-note' },
				'Optional — Gabriel will take photos too. Add any you already love, and your logo if you have one.',
			),
			grid,
			el('div', { class: 'ob-actions' }, add, input),
		);
	}

	// ── Views ───────────────────────────────────────────────────────────────

	function showIntake(v: View): void {
		form = intakeForm(v.intake, { voice: 'client', onChange: () => autosave.poke() });
		const sendBtn = el(
			'button',
			{ type: 'button', class: 'brass-btn brass-btn--primary' },
			v.sent ? 'Save changes' : 'Send it to Gabriel →',
		);
		const note = el('p', { class: 'ob-status', 'aria-live': 'polite' });
		sendBtn.addEventListener('click', async () => {
			if (!form) return;
			const missing = readyToSend(form.read());
			if (missing) {
				form.mark('about', missing);
				return;
			}
			sendBtn.disabled = true;
			autosave.flush();
			await saving;
			const r = await put(true);
			sendBtn.disabled = false;
			if (r.ok) {
				editing = false;
				draw();
				window.scrollTo({ top: 0 });
			} else if (r.field) form.mark(r.field, r.error);
			else note.textContent = r.error ?? 'Couldn’t send. Try again in a moment.';
		});
		root.replaceChildren(
			el(
				'h1',
				{ class: 'display text-4xl' },
				v.sent ? 'Change your answers' : `Hi ${v.name}, let’s get your site started`,
			),
			el(
				'p',
				{ class: 'text-secondary' },
				v.sent
					? 'Everything saves as you go.'
					: 'About 5 minutes. Everything saves as you go, so you can stop and come back to this link.',
			),
			form.form,
			photosBlock(),
			el('div', { class: 'flex flex-col gap-2' }, sendBtn, note, saveLine),
		);
	}

	function track(stage: Stage): HTMLElement {
		const at = STAGES.indexOf(stage);
		return el(
			'ol',
			{ class: 'ob-steps', 'aria-label': 'Where your site is up to' },
			...STAGES.map((s, i) =>
				el(
					'li',
					{},
					el(
						'span',
						{
							class: 'ob-stage',
							'data-state': i < at ? 'done' : i === at ? 'current' : 'todo',
							...(i === at ? { 'aria-current': 'step' } : {}),
						},
						STAGE_TEXT[s].title,
					),
				),
			),
		);
	}

	function reviewBlock(v: View): HTMLElement[] {
		const out: HTMLElement[] = [];
		if (v.preview_url)
			out.push(
				el(
					'a',
					{
						class: 'brass-btn brass-btn--primary',
						href: v.preview_url,
						target: '_blank',
						rel: 'noopener noreferrer',
					},
					'See your site',
				),
			);
		if (v.answered) {
			out.push(
				el('p', { class: 'ob-ok' }, 'Thanks — Gabriel has it.'),
				el(
					'p',
					{ class: 'text-secondary' },
					v.answered === 'ok'
						? 'He’ll put your site live and let you know.'
						: 'He’ll make your changes and let you know when they’re ready to see.',
				),
			);
			return out;
		}
		const status = el('p', { class: 'ob-status', 'aria-live': 'polite' });
		const box = el(
			'label',
			{ class: 'ob-field', hidden: true },
			'What would you like changed?',
			el('textarea', { name: 'changes', maxlength: '2000', rows: '5' }),
		);
		const ok = el('button', { type: 'button', class: 'brass-btn' }, 'Looks good');
		const changes = el(
			'button',
			{ type: 'button', class: 'brass-btn brass-btn--quiet' },
			'Request changes',
		);
		const send = async (verdict: 'ok' | 'changes') => {
			const text = box.querySelector('textarea')?.value.trim() ?? '';
			if (verdict === 'changes' && box.hidden) {
				box.hidden = false;
				changes.textContent = 'Send my changes';
				box.querySelector('textarea')?.focus();
				return;
			}
			if (verdict === 'changes' && !text) {
				status.textContent = 'Tell Gabriel what to change first.';
				return;
			}
			ok.disabled = changes.disabled = true;
			try {
				const res = await fetch(`${base}/review`, {
					method: 'POST',
					headers: { 'content-type': 'application/json', accept: 'application/json' },
					body: JSON.stringify({ verdict, text }),
				});
				const data = await res.json().catch(() => null);
				if (res.ok && data) {
					view = data as View;
					draw();
					return;
				}
				status.textContent =
					(data as { error?: string } | null)?.error ?? 'Couldn’t send. Try again.';
			} catch {
				status.textContent = 'No connection. Try again.';
			}
			ok.disabled = changes.disabled = false;
		};
		ok.addEventListener('click', () => send('ok'));
		changes.addEventListener('click', () => send('changes'));
		out.push(box, el('div', { class: 'ob-actions' }, ok, changes), status);
		return out;
	}

	function showStatus(v: View): void {
		form = null;
		const parts: (HTMLElement | string)[] = [
			el(
				'h1',
				{ class: 'display text-4xl' },
				v.stage === 'live' ? 'Your site is live' : STAGE_TEXT[v.stage].title,
			),
			track(v.stage),
			el('p', { class: 'text-secondary' }, STAGE_TEXT[v.stage].client),
		];
		if (v.stage === 'review') parts.push(...reviewBlock(v));
		if (v.stage === 'live' && v.live_url)
			parts.push(
				el(
					'a',
					{
						class: 'brass-btn brass-btn--primary',
						href: v.live_url,
						target: '_blank',
						rel: 'noopener noreferrer',
					},
					v.live_url.replace(/^https:\/\//, '').replace(/\/$/, ''),
				),
			);
		if (v.editable) {
			const change = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--quiet brass-btn--small' },
				'Change my answers or add photos',
			);
			change.addEventListener('click', () => {
				editing = true;
				draw();
			});
			parts.push(change);
		}
		parts.push(el('p', { class: 'ob-note' }, 'Questions? Just message Gabriel.'));
		root.replaceChildren(...parts);
	}

	function draw(): void {
		if (!view) return;
		if (!view.sent || (editing && view.editable)) showIntake(view);
		else showStatus(view);
	}

	// ── Start ───────────────────────────────────────────────────────────────

	const refresh = async () => {
		if (document.visibilityState !== 'visible' || form) return; // never redraw under someone typing
		const v = await load();
		if (v === 'dead') return dead();
		if (!v) return;
		const before = JSON.stringify(view);
		view = v;
		if (JSON.stringify(v) !== before) draw();
	};

	(async () => {
		if (!/^[A-Za-z0-9_-]{20,64}$/.test(code)) return dead();
		const v = await load();
		if (v === 'dead') return dead();
		if (!v) {
			const again = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--small' },
				'Try again',
			);
			again.addEventListener('click', () => location.reload());
			root.replaceChildren(
				el(
					'p',
					{ class: 'text-secondary' },
					'We’re having trouble loading your page. Try again in a minute.',
				),
				again,
			);
			return;
		}
		view = v;
		draw();
		poll = window.setInterval(refresh, POLL_MS);
		document.addEventListener('visibilitychange', refresh);
		window.addEventListener('pagehide', () => autosave.flush());
	})();
}
