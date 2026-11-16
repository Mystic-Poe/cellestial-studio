// Wires slots and every [data-claim] CTA to the claim state, the sky, and
// the dialog. Without JS none of this runs and every trigger is a /contact link.

import {
	type ClaimState,
	cancelClaim,
	confirmClaim,
	loadClaim,
	nearestSlot,
	type SlotId,
	saveClaim,
	startClaim,
} from '../sky/claim.ts';
import { wireContactForm } from './contact-submit.ts';

type Turnstile = {
	render(el: HTMLElement, opts: { sitekey: string; theme: 'dark' }): string;
	reset(id: string): void;
};
declare global {
	interface Window {
		turnstile?: Turnstile;
	}
}

const store = (() => {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
})();

const dialog = document.querySelector<HTMLDialogElement>('#claim-dialog');
const form = document.querySelector<HTMLFormElement>('#claim-form');
const status = form?.querySelector<HTMLElement>('[data-status]');
const starInput = form?.querySelector<HTMLInputElement>('[data-star-input]');
const tsSlot = form?.querySelector<HTMLElement>('[data-turnstile-slot]');
const slots = () => [...document.querySelectorAll<HTMLAnchorElement>('[data-sky-star="slot"]')];

let state: ClaimState = loadClaim(store);
let widgetId: string | null = null;
let sentThisOpen = false;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

function paint() {
	for (const el of slots()) {
		const id = el.dataset.slot as SlotId;
		el.dataset.state = state.pending === id ? 'pending' : state.held === id ? 'held' : 'open';
	}
	window.cellestialSky?.setClaim(state);
}

function ensureTurnstile() {
	if (!tsSlot) return;
	if (widgetId && window.turnstile) {
		window.turnstile.reset(widgetId);
		return;
	}
	if (!document.querySelector('script[data-turnstile-api]')) {
		const s = document.createElement('script');
		s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		s.async = true;
		s.dataset.turnstileApi = '';
		s.addEventListener('load', ensureTurnstile, { once: true });
		s.addEventListener('error', () => s.remove(), { once: true });
		document.head.append(s);
		return;
	}
	if (window.turnstile && tsSlot.dataset.sitekey) {
		widgetId = window.turnstile.render(tsSlot, { sitekey: tsSlot.dataset.sitekey, theme: 'dark' });
	}
}

function open(id: SlotId) {
	if (!dialog || !form) {
		location.href = '/contact';
		return;
	}
	clearTimeout(closeTimer);
	sentThisOpen = false;
	form.querySelector<HTMLButtonElement>('button[type="submit"]')?.removeAttribute('disabled');
	state = startClaim(state, id);
	if (starInput) starInput.value = id;
	if (status) status.textContent = '';
	paint();
	window.cellestialSky?.ignite(id);
	dialog.showModal();
	form.querySelector<HTMLInputElement>('[name="name"]')?.focus();
	ensureTurnstile();
}

function slotNearViewportCentre(): SlotId | null {
	const pos = slots().map((el) => {
		const r = el.getBoundingClientRect();
		const y = r.top + r.height / 2;
		return {
			id: el.dataset.slot as SlotId,
			x: r.left + r.width / 2,
			y,
			visible: y > 0 && y < innerHeight,
		};
	});
	return nearestSlot(pos, { x: innerWidth / 2, y: innerHeight / 2 }, state);
}

for (const el of slots()) {
	el.addEventListener('click', (e) => {
		e.preventDefault();
		open(el.dataset.slot as SlotId);
	});
}
for (const el of document.querySelectorAll<HTMLElement>('[data-claim]')) {
	el.addEventListener('click', (e) => {
		const id = slotNearViewportCentre();
		if (!id) return; // leave the /contact link to work
		e.preventDefault();
		open(id);
	});
}

document
	.querySelector('[data-claim-close]')
	?.addEventListener('click', () => dialog?.close('cancel'));

dialog?.addEventListener('close', () => {
	clearTimeout(closeTimer);
	state = sentThisOpen || dialog.returnValue === 'sent' ? confirmClaim(state) : cancelClaim(state);
	saveClaim(store, state);
	dialog.returnValue = '';
	paint();
});

if (form && status) {
	wireContactForm(
		form,
		status,
		() => {
			sentThisOpen = true;
			clearTimeout(closeTimer);
			closeTimer = setTimeout(() => dialog?.close('sent'), 1400);
		},
		() => {
			if (widgetId) window.turnstile?.reset(widgetId);
		},
	);
}

// Paint the held star from a previous visit once the sky is up.
if (window.cellestialSky) paint();
else window.addEventListener('cellestial:sky-ready', paint, { once: true });
paint();
