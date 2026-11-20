// A small typed event emitter. No DOM, no dependencies.

export type Listener<T> = (payload: T) => void;

export interface Emitter<Events> {
	/** Subscribe. Returns the function that unsubscribes. */
	on<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void;
	once<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void;
	emit<K extends keyof Events>(type: K, payload: Events[K]): void;
	/** How many listeners a type has: lets a caller skip building a payload nobody reads. */
	count<K extends keyof Events>(type: K): number;
}

export function createEmitter<Events>(): Emitter<Events> {
	const all = new Map<keyof Events, Set<Listener<never>>>();

	const on = <K extends keyof Events>(type: K, fn: Listener<Events[K]>) => {
		let set = all.get(type);
		if (!set) {
			set = new Set();
			all.set(type, set);
		}
		set.add(fn as Listener<never>);
		return () => {
			set.delete(fn as Listener<never>);
		};
	};

	return {
		on,
		once(type, fn) {
			const off = on(type, (payload) => {
				off();
				fn(payload);
			});
			return off;
		},
		emit(type, payload) {
			const set = all.get(type);
			if (!set) return;
			// A listener may unsubscribe (or subscribe) while it runs.
			for (const fn of [...set]) {
				try {
					(fn as Listener<unknown>)(payload);
				} catch (err) {
					console.error('[sky] listener failed', err);
				}
			}
		},
		count(type) {
			return all.get(type)?.size ?? 0;
		},
	};
}
