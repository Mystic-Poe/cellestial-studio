// Shared submit for every contact form: JSON-accepting POST to /api/contact,
// honest status text, never a false success.
export function wireContactForm(
	form: HTMLFormElement,
	status: HTMLElement,
	onSent?: () => void,
	onFail?: () => void,
	/** Called when a submit starts; returns a check that is true once that submit is superseded. */
	onStart?: () => () => boolean,
): void {
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (!form.reportValidity() || !button) return;

		button.disabled = true;
		status.textContent = 'Sending…';
		const stale = onStart?.() ?? (() => false);
		let sent = false;
		try {
			const response = await fetch(form.action, {
				method: 'POST',
				headers: { accept: 'application/json' },
				body: new FormData(form),
			});
			const body = (await response.json().catch(() => ({}))) as { error?: string };
			// A superseded submit (dialog closed and reopened) must not touch the new form.
			if (stale()) {
				sent = true;
				return;
			}
			if (response.ok) {
				form.reset();
				status.textContent = 'Sent. We will reply by email.';
				sent = true;
				onSent?.();
				return;
			}
			status.textContent = body.error ?? 'That did not send. Please try again.';
		} catch {
			if (stale()) {
				sent = true;
				return;
			}
			status.textContent = 'That did not send. Please check your connection.';
		} finally {
			// Stays disabled after a success; the owner re-enables it when the form is reopened.
			// (`sent` is also set for a stale response, which leaves the new form alone.)
			if (!sent) {
				button.disabled = false;
				onFail?.();
			}
		}
	});
}
