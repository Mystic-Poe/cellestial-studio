// Shared submit for every contact form: JSON-accepting POST to /api/contact,
// honest status text, never a false success.
export function wireContactForm(
	form: HTMLFormElement,
	status: HTMLElement,
	onSent?: () => void,
	onFail?: () => void,
): void {
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (!form.reportValidity() || !button) return;

		button.disabled = true;
		status.textContent = 'Sending…';
		let sent = false;
		try {
			const response = await fetch(form.action, {
				method: 'POST',
				headers: { accept: 'application/json' },
				body: new FormData(form),
			});
			const body = (await response.json().catch(() => ({}))) as { error?: string };
			if (response.ok) {
				form.reset();
				status.textContent = 'Sent. We will reply by email.';
				sent = true;
				onSent?.();
				return;
			}
			status.textContent = body.error ?? 'That did not send. Please try again.';
		} catch {
			status.textContent = 'That did not send. Please check your connection.';
		} finally {
			// Stays disabled after a success; the owner re-enables it when the form is reopened.
			if (!sent) {
				button.disabled = false;
				onFail?.();
			}
		}
	});
}
