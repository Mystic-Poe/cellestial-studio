// The intake form, the same on the client's page and the dashboard. It only
// draws and reads the fields; saving is the page's job.

import { emptyIntake, type Intake, PAGES } from '../onboard/intake.ts';
import { el } from './ui.ts';

export interface IntakeForm {
	form: HTMLFormElement;
	read(): Intake;
	/** Marks one field (by intake key) with a message; null clears every mark. */
	mark(field: string | null, message?: string): void;
	/** Replaces the values, unless the person is typing in this form right now. */
	fill(i: Intake): void;
}

interface Options {
	/** Words for the client ("you") or for Gabriel ("they"). */
	voice: 'client' | 'studio';
	onChange(): void;
}

export function intakeForm(initial: Intake, opts: Options): IntakeForm {
	const you = opts.voice === 'client';
	const text = (
		name: keyof Intake,
		label: string,
		hint = '',
		attrs: Record<string, string> = {},
		area = false,
	) => {
		const input = area
			? el('textarea', { name, maxlength: '1000', rows: '4', ...attrs })
			: el('input', { name, type: 'text', maxlength: '120', autocomplete: 'off', ...attrs });
		return el(
			'label',
			{ class: 'ob-field', 'data-field': name },
			label,
			...(hint ? [el('span', { class: 'ob-hint' }, hint)] : []),
			input,
			el('span', { class: 'ob-field-error', 'aria-live': 'polite' }),
		);
	};

	const pages = el(
		'fieldset',
		{ class: 'ob-choices ob-choices--grid', 'data-field': 'pages' },
		el('legend', {}, you ? 'What do you want on your site?' : 'Pages they want'),
		...PAGES.map((p) =>
			el(
				'label',
				{ class: 'ob-choice' },
				el('input', { type: 'checkbox', name: 'pages', value: p }),
				p === 'Booking' ? 'Booking link' : p,
			),
		),
	);

	const likes = el(
		'fieldset',
		{ class: 'ob-choices', 'data-field': 'likes' },
		el('legend', {}, you ? 'Websites you like (optional)' : 'Sites they like'),
		...[0, 1, 2].map((i) =>
			el('input', {
				class: 'ob-input',
				name: 'likes',
				type: 'url',
				inputmode: 'url',
				autocomplete: 'off',
				placeholder: i === 0 ? 'example.com' : '',
				'aria-label': `Website ${i + 1}`,
				maxlength: '300',
			}),
		),
		el('span', { class: 'ob-field-error', 'aria-live': 'polite' }),
	);

	const domainBox = text('domain', 'Your web address', '', { placeholder: 'example.com' });
	const hasDomain = el(
		'fieldset',
		{ class: 'ob-choices', 'data-field': 'has_domain' },
		el('legend', {}, you ? 'Do you already have a web address?' : 'Do they have a web address?'),
		...(
			[
				['no', you ? 'No — please get me one' : 'No — we buy one'],
				['yes', 'Yes'],
			] as const
		).map(([v, l]) =>
			el(
				'label',
				{ class: 'ob-choice' },
				el('input', { type: 'radio', name: 'has_domain', value: v }),
				l,
			),
		),
	);
	const domainNote = el(
		'p',
		{ class: 'ob-note' },
		you ? 'Gabriel will get in touch about moving it.' : 'Contact them about moving it.',
	);

	const form = el(
		'form',
		{ class: 'ob-form', novalidate: true },
		text(
			'about',
			you ? 'What does your business do?' : 'What the business does',
			you ? 'A few sentences, in your own words.' : '',
			{ required: 'true' },
			true,
		),
		text('area', you ? 'Area you serve' : 'Area served', '', { placeholder: 'Town or region' }),
		text('phone', 'Phone for the site', '', { type: 'tel', inputmode: 'tel', autocomplete: 'tel' }),
		text('contact_email', 'Email for the site', '', {
			type: 'email',
			inputmode: 'email',
			autocomplete: 'email',
		}),
		text('hours', 'Opening hours', '', { placeholder: 'Mon–Fri 8–5' }),
		pages,
		text(
			'extra',
			'Anything else?',
			you ? 'Services, prices, anything you want on the site.' : '',
			{},
			true,
		),
		likes,
		hasDomain,
		domainBox,
		domainNote,
	);

	const field = (name: string) =>
		form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
	const syncDomain = () => {
		const yes = form.querySelector<HTMLInputElement>('[name="has_domain"][value="yes"]')?.checked;
		domainBox.hidden = !yes;
		domainNote.hidden = !yes;
	};

	const read = (): Intake => {
		const i = emptyIntake();
		for (const k of [
			'about',
			'area',
			'phone',
			'contact_email',
			'hours',
			'extra',
			'domain',
		] as const)
			i[k] = field(k)?.value.trim() ?? '';
		i.pages = [...form.querySelectorAll<HTMLInputElement>('[name="pages"]:checked')].map(
			(x) => x.value,
		);
		i.likes = [...form.querySelectorAll<HTMLInputElement>('[name="likes"]')]
			.map((x) => x.value.trim())
			.filter(Boolean);
		const hd = form.querySelector<HTMLInputElement>('[name="has_domain"]:checked')?.value;
		i.has_domain = hd === 'yes' || hd === 'no' ? hd : '';
		if (i.has_domain !== 'yes') i.domain = '';
		return i;
	};

	const fill = (i: Intake) => {
		if (form.contains(document.activeElement)) return;
		for (const k of [
			'about',
			'area',
			'phone',
			'contact_email',
			'hours',
			'extra',
			'domain',
		] as const) {
			const f = field(k);
			if (f) f.value = i[k];
		}
		for (const x of form.querySelectorAll<HTMLInputElement>('[name="pages"]'))
			x.checked = i.pages.includes(x.value);
		const boxes = [...form.querySelectorAll<HTMLInputElement>('[name="likes"]')];
		boxes.forEach((x, n) => {
			x.value = i.likes[n] ?? '';
		});
		for (const x of form.querySelectorAll<HTMLInputElement>('[name="has_domain"]'))
			x.checked = x.value === i.has_domain;
		syncDomain();
	};

	const mark = (name: string | null, message = '') => {
		for (const f of form.querySelectorAll<HTMLElement>('[data-field]')) {
			const on = name !== null && f.dataset.field === name;
			f.toggleAttribute('data-invalid', on);
			const err = f.querySelector('.ob-field-error');
			if (err) err.textContent = on ? message : '';
		}
		if (name)
			form.querySelector<HTMLElement>(`[data-field="${name}"] :is(input, textarea)`)?.focus();
	};

	form.addEventListener('input', () => {
		syncDomain();
		opts.onChange();
	});
	form.addEventListener('submit', (e) => e.preventDefault());
	fill(initial);
	return { form, read, mark, fill };
}
