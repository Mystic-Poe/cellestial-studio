// A stand-in for an R2 bucket binding: put/get/delete over a Map.
export function fakeR2() {
	const objects = new Map();
	const toBytes = async (v) => {
		if (v instanceof Uint8Array) return v;
		if (v instanceof ArrayBuffer) return new Uint8Array(v);
		if (v instanceof ReadableStream) return new Uint8Array(await new Response(v).arrayBuffer());
		if (v instanceof Blob) return new Uint8Array(await v.arrayBuffer());
		return new TextEncoder().encode(String(v));
	};
	return {
		objects,
		async put(key, value, opts = {}) {
			objects.set(key, { bytes: await toBytes(value), httpMetadata: opts.httpMetadata ?? {} });
			return { key };
		},
		async get(key) {
			const o = objects.get(key);
			if (!o) return null;
			return {
				size: o.bytes.length,
				httpMetadata: o.httpMetadata,
				body: new Blob([o.bytes]).stream(),
			};
		},
		async delete(keys) {
			for (const k of [keys].flat()) objects.delete(k);
		},
	};
}
