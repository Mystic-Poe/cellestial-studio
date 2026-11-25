// Gabriel's onboarding dashboard. Three views in one page, picked by the hash:
//   #            the client list (Active / Archived)
//   #new         a new client
//   #c/<id>      one client: stage, intake, photos, review answers, checklist,
//                link, details
//
// Nothing about a client is kept in this page's code or in the browser's
// storage; it all comes from the Worker each time.

import qrcode from 'qrcode-generator';
import { STAGE_TEXT, STAGES, type Stage } from '../onboard/intake.ts';
import {
	type AdminClient,
	ApiError,
	api,
	CHECKLIST,
	type Patch,
	type Photo,
	photoUrl,
	type Usage,
	zipUrl,
} from './dashboard-api.ts';
import { intakeForm } from './intake-form.ts';
import { preparePhoto } from './photo-prep.ts';
import { confirmButton, debounce, el, type Kid, shortDate } from './ui.ts';

const REFRESH_MS = 15_000;

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

	const section = (title: string, ...kids: Kid[]) =>
		el('section', { class: 'panel ob-section' }, el('h2', {}, title), ...kids);
	const back = () => el('a', { href: '#', class: 'ob-home' }, '← All clients');

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
		const usage = el('p', { class: 'ob-meta ob-usage' });
		view.replaceChildren(el('h1', { class: 'display text-4xl' }, 'Onboarding'), tabs, list, usage);

		const fill = async () => {
			try {
				const { clients, usage: u } = await api.list(tab === 'archived');
				if (mine !== token) return;
				clearError();
				usage.textContent = u ? usageLine(u) : '';
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

	const gb = (n: number) => `${(n / 1024 ** 3).toFixed(n < 1024 ** 3 ? 2 : 1)} GB`;
	const usageLine = (u: Usage) =>
		`Photo storage: ${gb(u.bytes)} of ${gb(u.cap)} · ${u.uploads_today.toLocaleString()} of ${u.upload_cap.toLocaleString()} uploads today`;

	const row = (c: AdminClient) => {
		const at = STAGES.indexOf(c.stage);
		const bar = el('span', { class: 'ob-bar', 'aria-hidden': 'true' });
		for (let i = 0; i < STAGES.length; i++) bar.append(el('i', { 'data-on': i <= at }));
		const bits = [
			c.mode === 'test' ? 'Test' : '',
			c.intake_at ? '' : 'answers not in',
			c.photo_count ? `${c.photo_count} photo${c.photo_count === 1 ? '' : 's'}` : '',
			c.to_finish ? `${c.to_finish} to edit` : '',
			ago(c.last_seen_at),
		].filter(Boolean);
		return el(
			'a',
			{ class: 'ob-row', href: `#c/${c.id}`, 'data-client': c.id },
			el(
				'span',
				{ class: 'flex flex-col gap-1' },
				el('strong', {}, c.name),
				el('span', { class: 'ob-meta' }, bits.join(' · ')),
			),
			el(
				'span',
				{ class: 'ob-chip', 'data-status': c.stage === 'live' ? 'done' : 'active' },
				STAGE_TEXT[c.stage].title,
			),
			bar,
		);
	};

	// ── New ─────────────────────────────────────────────────────────────────

	function showNew(): void {
		++token;
		stopRefresh();
		const status = el('p', { class: 'ob-status', 'aria-live': 'polite' });
		const field = (name: string, label: string, type: string, max: string) =>
			el(
				'label',
				{ class: 'ob-field', 'data-field': name },
				label,
				el('input', { name, type, maxlength: max, required: true, autocomplete: 'off' }),
				el('span', { class: 'ob-field-error', 'aria-live': 'polite' }),
			);
		const form = el(
			'form',
			{ class: 'ob-form', novalidate: true },
			field('name', 'Business name', 'text', '80'),
			field('email', 'Their email', 'email', '254'),
			el(
				'label',
				{ class: 'ob-choice' },
				el('input', { type: 'checkbox', name: 'test' }),
				'Test client (emails say [TEST])',
			),
			el('button', { type: 'submit', class: 'brass-btn brass-btn--primary' }, 'Create client'),
			status,
		);
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const get = (n: string) => form.querySelector<HTMLInputElement>(`[name="${n}"]`);
			for (const f of form.querySelectorAll('[data-field]')) f.removeAttribute('data-invalid');
			status.textContent = 'Saving…';
			try {
				const c = await api.create({
					name: get('name')?.value.trim() ?? '',
					email: get('email')?.value.trim() ?? '',
					mode: get('test')?.checked ? 'test' : 'live',
				});
				location.hash = `#c/${c.id}`;
			} catch (err) {
				status.textContent = '';
				if (err instanceof ApiError && err.field) {
					const f = form.querySelector(`[data-field="${err.field}"]`);
					f?.setAttribute('data-invalid', '');
					const msg = f?.querySelector('.ob-field-error');
					if (msg) msg.textContent = err.message;
				} else showError(err, 'create the client');
			}
		});
		view.replaceChildren(
			back(),
			el('h1', { class: 'display text-4xl' }, 'New client'),
			el(
				'p',
				{ class: 'text-secondary' },
				'Just a name and email. Everything else — answers, photos, stage — goes on their page next.',
			),
			el('section', { class: 'panel' }, form),
		);
		form.querySelector<HTMLInputElement>('input[name=name]')?.focus();
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
					back(),
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
		const chips = el('div', { class: 'flex flex-wrap gap-2' });
		const meta = el('p', { class: 'ob-meta' });
		const stageBox = el('div', { class: 'flex flex-col gap-3' });
		const intakeNote = el('p', { class: 'ob-meta' });
		const photoBox = el('div', { class: 'flex flex-col gap-3' });
		const reviewBox = el('div', { class: 'flex flex-col gap-3' });
		const linkBox = el('div', { class: 'flex flex-col gap-3' });
		const manageBox = el('div', { class: 'ob-actions' });
		let uploading = 0;

		const save = async (p: Patch, doing: string): Promise<boolean> => {
			try {
				const fresh = await api.patch(c.id, p);
				c = { ...fresh, notes: 'notes' in p ? fresh.notes : c.notes };
				clearError();
				drawTop();
				return true;
			} catch (e) {
				showError(e, doing);
				return false;
			}
		};

		const drawTop = () => {
			heading.textContent = c.name;
			chips.replaceChildren(
				el(
					'span',
					{ class: 'ob-chip', 'data-status': c.stage === 'live' ? 'done' : 'active' },
					STAGE_TEXT[c.stage].title,
				),
				...(c.mode === 'test' ? [el('span', { class: 'ob-chip' }, 'Test')] : []),
				...(c.status === 'archived' ? [el('span', { class: 'ob-chip' }, 'Archived')] : []),
			);
			meta.textContent = `${c.email} · ${ago(c.last_seen_at)}`;
			intakeNote.textContent = c.intake_at
				? `${c.intake_by === 'studio' ? 'Filled in by you' : 'Sent by the client'} ${shortDate(c.intake_at)}. Changes save as you type.`
				: 'Not sent yet. Fill it in with them here — that counts as sent, and their page moves on.';
			drawStage();
		};

		// Stage, preview and live addresses.
		const drawStage = () => {
			const at = STAGES.indexOf(c.stage);
			const bar = el('div', { class: 'ob-stagebar', role: 'group', 'aria-label': 'Stage' });
			STAGES.forEach((s: Stage, i) => {
				const b = el(
					'button',
					{ type: 'button', 'aria-pressed': String(s === c.stage), 'data-past': i < at },
					STAGE_TEXT[s].title,
				);
				b.addEventListener('click', () => {
					if (s !== c.stage) save({ stage: s }, 'move the stage');
				});
				bar.append(b);
			});
			const addr = (key: 'preview_url' | 'live_url', label: string, hint: string) => {
				const input = el('input', {
					type: 'url',
					inputmode: 'url',
					name: key,
					placeholder: 'https://',
					autocomplete: 'off',
				});
				input.value = c[key];
				const err = el('span', { class: 'ob-field-error', 'aria-live': 'polite' });
				const box = el(
					'label',
					{ class: 'ob-field' },
					label,
					el('span', { class: 'ob-hint' }, hint),
					input,
					err,
				);
				input.addEventListener('change', async () => {
					try {
						const fresh = await api.patch(c.id, { [key]: input.value });
						c = { ...fresh, notes: c.notes };
						input.value = c[key];
						err.textContent = '';
						box.removeAttribute('data-invalid');
						clearError();
					} catch (e) {
						if (e instanceof ApiError && e.field === key) {
							err.textContent = e.message;
							box.setAttribute('data-invalid', '');
						} else showError(e, 'save the address');
					}
				});
				return box;
			};
			const focused = stageBox.contains(document.activeElement);
			if (focused) {
				// Only refresh the buttons; never rebuild an address box mid-typing.
				stageBox.querySelector('.ob-stagebar')?.replaceWith(bar);
				return;
			}
			stageBox.replaceChildren(
				bar,
				el(
					'p',
					{ class: 'ob-meta' },
					`Their page says: “${STAGE_TEXT[c.stage].client}” It follows within seconds.`,
				),
				addr(
					'preview_url',
					'Preview address',
					'Shown to them at Review, with Looks good / Request changes.',
				),
				addr('live_url', 'Live address', 'Shown to them at Live.'),
			);
		};

		// Intake: the same form the client sees.
		const intake = intakeForm(c.intake, {
			voice: 'studio',
			onChange: () => intakeSave.poke(),
		});
		const intakeStatus = el('p', { class: 'ob-status', 'aria-live': 'polite' });
		const intakeSave = debounce(async () => {
			intakeStatus.textContent = 'Saving…';
			try {
				const fresh = await api.patch(c.id, { intake: intake.read() });
				c = { ...fresh, notes: c.notes };
				intake.mark(null);
				intakeStatus.textContent = 'Saved.';
				drawTop();
			} catch (e) {
				intakeStatus.textContent = '';
				if (e instanceof ApiError && e.field) intake.mark(e.field, e.message);
				else showError(e, 'save the intake');
			}
		}, 800);

		// Photos: originals and their finished versions.
		const drawPhotos = () => {
			const photos = c.photos ?? [];
			const originals = photos.filter((p) => p.kind === 'original');
			const finishedOf = new Map(photos.filter((p) => p.kind === 'finished').map((p) => [p.of, p]));
			const progress = el('p', { class: 'ob-status', 'aria-live': 'polite' });

			const pick = (multiple: boolean, onFiles: (files: File[]) => void) => {
				const input = el('input', {
					type: 'file',
					accept: 'image/*',
					class: 'sr-only',
					...(multiple ? { multiple: true } : {}),
				});
				input.addEventListener('change', () => {
					const files = [...(input.files ?? [])];
					input.value = '';
					if (files.length) onFiles(files);
				});
				return input;
			};
			const sendAll = async (files: File[], fields: (f: File) => Record<string, string>) => {
				uploading++;
				let done = 0;
				for (const f of files) {
					progress.textContent = `Uploading ${done + 1} of ${files.length}…`;
					try {
						const p = await preparePhoto(f, null);
						await api.upload(c.id, p, fields(f));
						done++;
					} catch (e) {
						showError(e, `upload ${f.name}`);
					}
				}
				uploading--;
				progress.textContent =
					done === files.length ? `${done} uploaded.` : `${done} of ${files.length} uploaded.`;
				await reload();
			};

			const addInput = pick(true, (files) => sendAll(files, () => ({ kind: 'original' })));
			const add = el('label', { class: 'brass-btn brass-btn--small' }, 'Add photos', addInput);
			const actions = el('div', { class: 'ob-actions' }, add);
			if (originals.length)
				actions.append(
					el(
						'a',
						{
							class: 'brass-btn brass-btn--small brass-btn--quiet',
							href: zipUrl(c.id),
							download: '',
						},
						`Download all (${originals.length})`,
					),
				);

			const tile = (p: Photo | undefined, label: string) =>
				p
					? el(
							'a',
							{
								class: 'ob-photo',
								href: photoUrl(c.id, p.id, 'full'),
								target: '_blank',
								rel: 'noopener',
							},
							el('img', { src: photoUrl(c.id, p.id, 'thumb'), alt: label, loading: 'lazy' }),
						)
					: el('span', { class: 'ob-photo' }, el('span', { class: 'ob-photo-msg' }, 'Needs edit'));

			const pairs = el('ul', { class: 'ob-pairs' });
			for (const o of originals) {
				const fin = finishedOf.get(o.id);
				const finInput = pick(false, (files) =>
					sendAll(files, () => ({ kind: 'finished', of: o.id })),
				);
				const del = confirmButton('Delete', 'Delete both? Tap again', '', async () => {
					try {
						await api.removePhoto(c.id, o.id);
						await reload();
					} catch (e) {
						showError(e, 'delete the photo');
					}
				});
				pairs.append(
					el(
						'li',
						{ class: 'ob-pair', 'data-needs': !fin },
						tile(o, `Original: ${o.name}`),
						tile(fin, `Finished: ${o.name}`),
						el(
							'div',
							{ class: 'ob-pair-meta' },
							el('strong', {}, o.name),
							o.source === 'client' ? 'From the client' : `${(o.size / 1_048_576).toFixed(1)} MB`,
							el('a', { href: photoUrl(c.id, o.id, 'full', true) }, 'Download original'),
							el('label', {}, fin ? 'Replace finished version' : 'Add finished version', finInput),
							...(fin
								? [el('a', { href: photoUrl(c.id, fin.id, 'full', true) }, 'Download finished')]
								: []),
							del,
						),
					),
				);
			}
			const left = originals.filter((o) => !finishedOf.has(o.id)).length;
			photoBox.replaceChildren(
				actions,
				progress,
				el(
					'p',
					{ class: 'ob-meta' },
					originals.length
						? `${originals.length} original${originals.length === 1 ? '' : 's'} · ${left ? `${left} still to edit` : 'all edited'}. Originals stay full size for Higgsfield.`
						: 'No photos yet. On your phone, Add photos opens the camera or your library.',
				),
				pairs,
			);
		};

		const drawReviews = () => {
			const reviews = c.reviews ?? [];
			reviewBox.replaceChildren(
				...(reviews.length
					? reviews.map((r) =>
							el(
								'p',
								{ class: 'ob-review' },
								el('small', {}, shortDate(r.created_at)),
								r.verdict === 'ok' ? 'Looks good ✓' : `Asked for changes:\n${r.text}`,
							),
						)
					: [
							el(
								'p',
								{ class: 'ob-meta' },
								'Nothing yet. Move them to Review with a preview address and they can answer from their page.',
							),
						]),
			);
		};

		const drawChecklist = () => {
			const box = el('div', { class: 'ob-choices ob-choices--grid' });
			for (const [key, label] of CHECKLIST) {
				const input = el('input', { type: 'checkbox', checked: c.checklist[key] });
				input.addEventListener('change', () =>
					save({ checklist: { [key]: input.checked } }, 'save the checklist'),
				);
				box.append(el('label', { class: 'ob-choice' }, input, label));
			}
			const notes = el('textarea', { name: 'notes', maxlength: '5000' });
			notes.value = c.notes;
			const saved = el('p', { class: 'ob-meta', 'aria-live': 'polite' });
			const later = debounce(async () => {
				saved.textContent = (await save({ notes: notes.value }, 'save your notes'))
					? 'Saved.'
					: 'Not saved.';
			}, 600);
			notes.addEventListener('input', () => {
				saved.textContent = '…';
				later.poke();
			});
			return el(
				'div',
				{ class: 'flex flex-col gap-4' },
				box,
				el('label', { class: 'ob-field' }, 'Notes', notes),
				saved,
			);
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
						c = { ...(await api.rotate(c.id)), notes: c.notes };
						clearError();
						drawLink('New link made. The old one no longer works.');
					} catch (e) {
						showError(e, 'make a new link');
					}
				},
			);
			linkBox.replaceChildren(
				el(
					'p',
					{ class: 'ob-meta' },
					'Only for clients you can’t meet: they fill in the same answers and add photos, then follow along and review here.',
				),
				a,
				el('div', { class: 'ob-actions' }, copy, rotate),
				note,
				qrBox,
			);
		};

		const details = () => {
			const status = el('p', { class: 'ob-status', 'aria-live': 'polite' });
			const input = (name: 'name' | 'email', label: string, type: string) =>
				el(
					'label',
					{ class: 'ob-field', 'data-field': name },
					label,
					el('input', { name, type, value: c[name], autocomplete: 'off' }),
					el('span', { class: 'ob-field-error' }),
				);
			const test = el('input', { type: 'checkbox', name: 'test', checked: c.mode === 'test' });
			const form = el(
				'form',
				{ class: 'ob-form', novalidate: true },
				input('name', 'Business name', 'text'),
				input('email', 'Their email', 'email'),
				el('label', { class: 'ob-choice' }, test, 'Test client (emails say [TEST])'),
				el('button', { type: 'submit', class: 'brass-btn brass-btn--small' }, 'Save details'),
				status,
			);
			form.addEventListener('submit', async (e) => {
				e.preventDefault();
				const v = (n: string) =>
					form.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value.trim() ?? '';
				for (const f of form.querySelectorAll('[data-field]')) f.removeAttribute('data-invalid');
				try {
					c = {
						...(await api.patch(c.id, {
							name: v('name'),
							email: v('email'),
							mode: test.checked ? 'test' : 'live',
						})),
						notes: c.notes,
					};
					status.textContent = 'Saved.';
					clearError();
					drawTop();
				} catch (err) {
					if (err instanceof ApiError && err.field) {
						const f = form.querySelector(`[data-field="${err.field}"]`);
						f?.setAttribute('data-invalid', '');
						const m = f?.querySelector('.ob-field-error');
						if (m) m.textContent = err.message;
					} else showError(err, 'save the details');
				}
			});
			return form;
		};

		const drawManage = () => {
			const archived = c.status === 'archived';
			const arch = el(
				'button',
				{ type: 'button', class: 'brass-btn brass-btn--small' },
				archived ? 'Unarchive' : 'Archive',
			);
			arch.addEventListener('click', async () => {
				if (
					await save(
						{ status: archived ? 'active' : 'archived' },
						archived ? 'unarchive' : 'archive',
					)
				)
					drawManage();
			});
			const del = confirmButton(
				'Delete',
				`Delete ${c.name} and every photo for good? Tap again`,
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
						: 'Archiving switches their link off and keeps everything, photos included.',
				),
			);
		};

		const reload = async () => {
			try {
				const fresh = await api.get(c.id);
				if (mine !== token) return;
				const photosChanged = JSON.stringify(fresh.photos) !== JSON.stringify(c.photos);
				const reviewsChanged = JSON.stringify(fresh.reviews) !== JSON.stringify(c.reviews);
				c = { ...fresh, notes: c.notes };
				drawTop();
				intake.fill(c.intake);
				if (photosChanged && uploading === 0) drawPhotos();
				if (reviewsChanged) drawReviews();
			} catch {
				/* the next tick tries again */
			}
		};

		drawTop();
		drawPhotos();
		drawReviews();
		drawLink();
		drawManage();
		view.replaceChildren(
			back(),
			el('div', { class: 'flex flex-wrap items-center gap-3' }, heading, chips),
			meta,
			section('Stage', stageBox),
			section('Their answers', intakeNote, intake.form, intakeStatus),
			section('Photos', photoBox),
			section('Review answers', reviewBox),
			section('Your checklist', drawChecklist()),
			section('Their link', linkBox),
			section('Details', details()),
			section('Manage', manageBox),
		);
		every(reload);
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
