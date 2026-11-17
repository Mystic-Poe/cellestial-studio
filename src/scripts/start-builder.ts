// Gabriel's link builder. Runs entirely in his browser: the client's details
// go into the link's #fragment and nowhere else.

import qrcode from 'qrcode-generator';
import {
	type ClientConfig,
	encodeConfig,
	type Lane,
	type Mode,
	type Tier,
} from '../onboard/link.ts';

const ORIGIN = 'https://cellestialstudio.com';

export function wireBuilder(form: HTMLFormElement): void {
	const out = document.querySelector<HTMLElement>('[data-out]');
	const link = document.querySelector<HTMLAnchorElement>('[data-link]');
	const qr = document.querySelector<HTMLElement>('[data-qr]');
	const copy = document.querySelector<HTMLButtonElement>('[data-copy-link]');
	const status = document.querySelector<HTMLElement>('[data-builder-status]');
	const domainSlots = document.querySelectorAll<HTMLElement>('[data-domain]');
	if (!out || !link || !qr || !copy || !status) return;

	let current = '';

	const update = () => {
		const f = new FormData(form);
		const get = (k: string) => String(f.get(k) ?? '').trim();
		const domain = get('domain')
			.toLowerCase()
			.replace(/^https?:\/\//, '')
			.replace(/\/.*$/, '');
		for (const s of domainSlots) s.textContent = domain || 'their domain';

		if (!form.checkValidity()) {
			out.hidden = true;
			return;
		}
		const config: ClientConfig = {
			v: 1,
			n: get('name'),
			e: get('email'),
			d: domain,
			l: get('lane') as Lane,
			t: Number(get('tier')) as Tier,
			m: get('mode') as Mode,
		};
		current = `${ORIGIN}/start/#${encodeConfig(config)}`;
		link.href = current;
		link.textContent = current;

		const code = qrcode(0, 'M');
		code.addData(current);
		code.make();
		qr.innerHTML = code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
		out.hidden = false;
		status.textContent = '';
	};

	form.addEventListener('input', update);
	form.addEventListener('submit', (e) => e.preventDefault());
	copy.addEventListener('click', () => {
		navigator.clipboard?.writeText(current).then(
			() => {
				status.textContent = 'Link copied.';
			},
			() => {
				status.textContent = 'Copy failed — press and hold the link instead.';
			},
		);
	});
	update();
}
