// The two flows. Each is the contact form in a dialog:
//
//   the build request   "Claim your star"   #claim-dialog   > #claim-form
//   the message box     "Contact me"        #contact-dialog > #contact-box-form
//
// Both are sent by the shared submit, scripts/contact-submit.ts, which this
// file calls and never changes. What is posted is the form and nothing else:
// name, email, message, the Turnstile token and, on the build request, the
// hidden `star` field. Nothing is ever added to the message.
//
// The one rule of the claim: a star is claimed only when /api/contact has
// answered OK. The ask is read when a submit starts (the shared submit clears
// the form on success) and handed to the claims store only in onSent. A send
// that failed records nothing. Neither does one that was overtaken: its
// dialog was closed and opened again before the answer came.
//
// Without script none of this runs, and every trigger is a link to /contact.

import { isSlotId } from '../content/constellations.ts';
import { wireContactForm } from '../scripts/contact-submit.ts';
import type { ClaimFlow, ClaimsStore, Director, SlotId } from './contracts.ts';

/** How long "Sent." stays up before the dialog closes. */
const SENT_BEAT_MS = 1400;

const TURNSTILE_API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
	render(el: HTMLElement, opts: { sitekey: string; theme: 'dark'; size: 'flexible' }): string;
	reset(id: string): void;
}

const turnstile = (): Turnstile | undefined =>
	(window as unknown as { turnstile?: Turnstile }).turnstile;

/** A dialog and the form inside it. */
interface Box {
	readonly dialog: HTMLDialogElement;
	readonly form: HTMLFormElement;
	readonly status: HTMLElement;
	readonly send: HTMLButtonElement | null;
	/** False when the page was built without a Turnstile key: Send is disabled and stays so. */
	readonly live: boolean;
	readonly turnstileSlot: HTMLElement | null;
	/** This dialog's own Turnstile widget, once rendered. */
	widget: string | null;
	/** How many times the dialog has been opened. A send from an earlier opening is stale. */
	opening: number;
	closeTimer: ReturnType<typeof setTimeout> | undefined;
	/** What follows once the dialog has closed after a send. */
	next: (() => void) | null;
}

function findBox(dialogId: string, formId: string): Box | null {
	const dialog = document.getElementById(dialogId);
	const form = document.getElementById(formId);
	if (!(dialog instanceof HTMLDialogElement) || !(form instanceof HTMLFormElement)) return null;
	const status = form.querySelector<HTMLElement>('[data-status]');
	if (!status) return null;
	const send = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	return {
		dialog,
		form,
		status,
		send,
		live: send !== null && !send.disabled,
		turnstileSlot: form.querySelector<HTMLElement>('[data-turnstile-slot]'),
		widget: null,
		opening: 0,
		closeTimer: undefined,
		next: null,
	};
}

// ────────────────────────────────────────────────────────── Turnstile ──
//
// Explicit rendering, as before: the API is fetched once, the first time a
// dialog opens, and each dialog gets one widget of its own, reset whenever
// that dialog is opened again or a send fails.

let apiLoading: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
	if (turnstile()) return Promise.resolve();
	apiLoading ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = TURNSTILE_API;
		script.async = true;
		script.dataset.turnstileApi = '';
		script.addEventListener('load', () => resolve(), { once: true });
		script.addEventListener(
			'error',
			() => {
				// Offline or blocked. Forget it, so that the next opening tries again.
				script.remove();
				apiLoading = null;
				reject(new Error('the Turnstile script did not load'));
			},
			{ once: true },
		);
		document.head.append(script);
	});
	return apiLoading;
}

function ensureTurnstile(box: Box): void {
	const slot = box.turnstileSlot;
	const sitekey = slot?.dataset.sitekey;
	if (!slot || !sitekey) return;
	if (box.widget !== null) {
		turnstile()?.reset(box.widget);
		return;
	}
	loadTurnstile().then(
		() => {
			const api = turnstile();
			if (api && box.widget === null) {
				box.widget = api.render(slot, { sitekey, theme: 'dark', size: 'flexible' });
			}
		},
		() => {
			// The form is still there. A send without a token fails, and says so.
		},
	);
}

// ────────────────────────────────────────────────────────── the flows ──

export function createClaimFlow(claims: ClaimsStore, director: Director): ClaimFlow {
	const claimBox = findBox('claim-dialog', 'claim-form');
	const contactBox = findBox('contact-dialog', 'contact-box-form');
	const boxes = [claimBox, contactBox].filter((box): box is Box => box !== null);
	const starInput = claimBox?.form.querySelector<HTMLInputElement>('[data-star-input]') ?? null;
	const askField = claimBox?.form.querySelector<HTMLTextAreaElement>('[name="message"]') ?? null;

	/** The build request now being sent: what was asked, and for which star. */
	let asked: { ask: string; slot: SlotId | null } | null = null;

	function open(box: Box): void {
		if (box.dialog.open) return;
		for (const other of boxes) if (other !== box && other.dialog.open) other.dialog.close();
		clearTimeout(box.closeTimer);
		box.next = null;
		box.opening++;
		// A send leaves the button disabled; whoever reopens the form enables it again.
		if (box.live && box.send) box.send.disabled = false;
		box.status.textContent = '';
		box.dialog.showModal();
		box.form.querySelector<HTMLElement>('[name="name"]')?.focus();
		ensureTurnstile(box);
	}

	function follow(box: Box): void {
		const next = box.next;
		box.next = null;
		next?.();
	}

	/**
	 * Hand a sent ask to the store. Returns the star it lit, or null if the ask
	 * now waits for one (no star was chosen, or the star was lit meanwhile).
	 */
	function record(ask: string, slot: SlotId | null): SlotId | null {
		let waits = false;
		const stop = claims.subscribe((event) => {
			if (event.type === 'unplaced') waits = true;
		});
		try {
			claims.recordSent(ask, slot);
		} finally {
			stop();
		}
		return waits ? null : slot;
	}

	/**
	 * Put a form on the shared submit. The hooks must never throw: an exception
	 * in onSent would make the shared submit report a send that worked as one
	 * that failed.
	 */
	function wire(box: Box, hooks: { started?: () => void; sent?: () => void } = {}): void {
		const guarded = (hook: (() => void) | undefined) => {
			try {
				hook?.();
			} catch (err) {
				console.error('[cellestial] the claim flow threw', err);
			}
		};

		wireContactForm(
			box.form,
			box.status,
			// Sent: /api/contact answered OK, and the submit was not overtaken.
			() => {
				guarded(hooks.sent);
				clearTimeout(box.closeTimer);
				if (box.dialog.open) {
					// The "Sent." beat, then the dialog closes and `next` follows.
					box.closeTimer = setTimeout(() => box.dialog.close(), SENT_BEAT_MS);
				} else {
					follow(box); // it was closed while the request was on its way
				}
			},
			// Failed: a token is good for one try.
			() => {
				if (box.widget !== null) turnstile()?.reset(box.widget);
			},
			// Started: remember which opening this submit belongs to.
			() => {
				const opening = box.opening;
				guarded(hooks.started);
				return () => opening !== box.opening;
			},
		);

		box.dialog.addEventListener('close', () => {
			clearTimeout(box.closeTimer);
			follow(box);
		});

		// A click on the backdrop closes the dialog. The backdrop belongs to the
		// dialog element, so that is a press and a release both outside its box.
		const outside = (event: MouseEvent): boolean => {
			if (event.target !== box.dialog) return false;
			const r = box.dialog.getBoundingClientRect();
			const { clientX: x, clientY: y } = event;
			return x < r.left || x > r.right || y < r.top || y > r.bottom;
		};
		let pressedOutside = false;
		box.dialog.addEventListener('pointerdown', (event) => {
			pressedOutside = outside(event);
		});
		box.dialog.addEventListener('click', (event) => {
			if (pressedOutside && outside(event)) box.dialog.close();
			pressedOutside = false;
		});
	}

	if (claimBox) {
		wire(claimBox, {
			started() {
				const star = starInput?.value;
				asked = { ask: askField?.value ?? '', slot: isSlotId(star) ? star : null };
			},
			sent() {
				const sent = asked;
				asked = null;
				if (!sent) return;
				const star = record(sent.ask, sent.slot);
				// To the sky either way: to watch the star light, or to choose one for the ask.
				claimBox.next = star ? () => void director.showStar(star) : () => void director.go('sky');
			},
		});
	}
	if (contactBox) wire(contactBox);

	const flow: ClaimFlow = {
		openClaim(slot) {
			if (!claimBox) {
				location.assign('/contact');
				return;
			}
			if (claimBox.dialog.open) return;
			let star = slot === undefined ? claims.picked() : slot;
			// Only an empty star can be asked for.
			if (star !== null && (!isSlotId(star) || claims.isLit(star))) star = null;
			// A star named by the caller is the visitor's pick from now on.
			if (star !== null) claims.pick(star);
			if (starInput) starInput.value = star ?? '';
			asked = null;
			open(claimBox);
		},

		openContact() {
			if (!contactBox) {
				location.assign('/contact');
				return;
			}
			open(contactBox);
		},
	};

	// The triggers, wherever they are on the page and whenever they were added.
	document.addEventListener('click', (event) => {
		if (event.defaultPrevented || !(event.target instanceof Element)) return;

		const opener = event.target.closest<HTMLElement>('[data-open-claim], [data-open-contact]');
		if (opener) {
			// Only a plain click: with a modifier it is a link to /contact, in a new tab.
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			const claim = opener.hasAttribute('data-open-claim');
			if (!(claim ? claimBox : contactBox)) return; // no dialog here: the link does its job
			event.preventDefault();
			if (claim) {
				const slot = opener.dataset.slot;
				flow.openClaim(isSlotId(slot) ? slot : undefined);
			} else {
				flow.openContact();
			}
			return;
		}

		if (event.target.closest('[data-claim-close]')) claimBox?.dialog.close();
		else if (event.target.closest('[data-contact-close]')) contactBox?.dialog.close();
	});

	return flow;
}
