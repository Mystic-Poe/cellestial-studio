// Small DOM helpers shared by the client page and the dashboard.

export type Kid = Node | string;

/** An element with attributes (false skips one, true sets it empty) and children. */
export function el<K extends keyof HTMLElementTagNameMap>(
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

/** Calls `fn` once things have been quiet for `ms`; `flush` runs it now. */
export function debounce(fn: () => void, ms: number) {
	let t: number | undefined;
	const run = () => {
		if (t !== undefined) clearTimeout(t);
		t = undefined;
		fn();
	};
	return {
		poke() {
			if (t !== undefined) clearTimeout(t);
			t = window.setTimeout(run, ms);
		},
		flush() {
			if (t !== undefined) run();
		},
		pending: () => t !== undefined,
	};
}

/** A button that asks for a second tap before doing something it can't undo. */
export function confirmButton(
	label: string,
	ask: string,
	cls: string,
	run: () => Promise<void>,
): HTMLButtonElement {
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
		try {
			await run();
		} finally {
			b.disabled = false;
			armed = false;
			b.textContent = label;
		}
	});
	return b;
}

export function shortDate(ms: number): string {
	return new Date(ms).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}
