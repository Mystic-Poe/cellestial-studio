// Photo files: where they live in R2, how an upload is checked, and the
// "Download all" zip, streamed as it is sent so nothing extra is stored.

/** The part of the R2 bucket binding this Worker uses. */
export interface R2Object {
	body: ReadableStream<Uint8Array>;
	size: number;
	httpMetadata?: { contentType?: string };
}
export interface R2Like {
	put(
		key: string,
		value: ArrayBuffer | ReadableStream | Uint8Array,
		opts?: { httpMetadata?: { contentType?: string } },
	): Promise<unknown>;
	get(key: string): Promise<R2Object | null>;
	delete(keys: string | string[]): Promise<void>;
}

export const photoKey = (clientId: string, photoId: string, thumb = false) =>
	`c/${clientId}/${photoId}${thumb ? '.thumb' : ''}`;

const IMAGE_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/heic',
	'image/heif',
	'image/gif',
]);
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif)$/i;
const THUMB_MAX = 2 * 1024 * 1024;

export type Upload =
	| { ok: true; file: File; thumb: File | null; fields: Record<string, string> }
	| { ok: false; status: number; error: string };

/** A sensible file name: no path, no control characters, at most 120 long. */
export function safeName(raw: string, fallback = 'photo.jpg'): string {
	const base = raw.split(/[\\/]/).pop() ?? '';
	const clean = [...base]
		.filter((ch) => ch !== '"' && ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
		.join('')
		.trim()
		.slice(-120);
	return clean || fallback;
}

export const isImage = (f: File) =>
	IMAGE_TYPES.has(f.type.toLowerCase()) ||
	((f.type === '' || f.type === 'application/octet-stream') && IMAGE_EXT.test(f.name));

/** Reads a multipart upload: `file` (required), `thumb` (optional), other text fields. */
export async function readUpload(request: Request, maxBytes: number): Promise<Upload> {
	if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data'))
		return { ok: false, status: 400, error: 'Send the photo as a form upload.' };
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > maxBytes + THUMB_MAX + 64 * 1024)
		return { ok: false, status: 413, error: 'That photo is too big.' };
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return { ok: false, status: 400, error: 'Unreadable upload.' };
	}
	const file = form.get('file');
	if (!(file instanceof File) || file.size === 0)
		return { ok: false, status: 400, error: 'No photo in the upload.' };
	if (!isImage(file))
		return { ok: false, status: 415, error: 'Photos only (JPEG, PNG, HEIC, WebP).' };
	if (file.size > maxBytes) return { ok: false, status: 413, error: 'That photo is too big.' };
	const t = form.get('thumb');
	const thumb =
		t instanceof File && t.size > 0 && t.size <= THUMB_MAX && isImage(t) ? (t as File) : null;
	const fields: Record<string, string> = {};
	for (const [k, v] of form.entries()) if (typeof v === 'string') fields[k] = v.slice(0, 200);
	return { ok: true, file, thumb, fields };
}

// --- zip (stored entries, data descriptors, UTF-8 names) ---

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

export function crc32(data: Uint8Array, crc = 0): number {
	let c = ~crc >>> 0;
	for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
	return ~c >>> 0;
}

export interface ZipEntry {
	name: string;
	open(): Promise<ReadableStream<Uint8Array> | null>;
}

function dosTime(d: Date): [number, number] {
	const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
	const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
	return [time, date];
}

const FLAGS = 0x0808; // bit 3: sizes after the data; bit 11: UTF-8 names

/** A zip of the entries, produced as it is read. Entries that can't be opened are skipped. */
export function zipStream(entries: ZipEntry[], now = new Date()): ReadableStream<Uint8Array> {
	const enc = new TextEncoder();
	const [time, date] = dosTime(now);
	const central: Uint8Array[] = [];
	let offset = 0;
	let count = 0;

	async function* parts(): AsyncGenerator<Uint8Array> {
		for (const e of entries) {
			const body = await e.open();
			if (!body) continue;
			const name = enc.encode(e.name);
			const start = offset;
			const local = new DataView(new ArrayBuffer(30));
			local.setUint32(0, 0x04034b50, true);
			local.setUint16(4, 20, true);
			local.setUint16(6, FLAGS, true);
			local.setUint16(8, 0, true);
			local.setUint16(10, time, true);
			local.setUint16(12, date, true);
			local.setUint16(26, name.length, true);
			yield new Uint8Array(local.buffer);
			yield name;
			offset += 30 + name.length;

			let crc = 0;
			let size = 0;
			const reader = body.getReader();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				crc = crc32(value, crc);
				size += value.length;
				yield value;
			}
			offset += size;

			const desc = new DataView(new ArrayBuffer(16));
			desc.setUint32(0, 0x08074b50, true);
			desc.setUint32(4, crc, true);
			desc.setUint32(8, size, true);
			desc.setUint32(12, size, true);
			yield new Uint8Array(desc.buffer);
			offset += 16;

			const cd = new DataView(new ArrayBuffer(46));
			cd.setUint32(0, 0x02014b50, true);
			cd.setUint16(4, 20, true);
			cd.setUint16(6, 20, true);
			cd.setUint16(8, FLAGS, true);
			cd.setUint16(10, 0, true);
			cd.setUint16(12, time, true);
			cd.setUint16(14, date, true);
			cd.setUint32(16, crc, true);
			cd.setUint32(20, size, true);
			cd.setUint32(24, size, true);
			cd.setUint16(28, name.length, true);
			cd.setUint32(42, start, true);
			central.push(new Uint8Array(cd.buffer), name);
			count++;
		}
		let cdSize = 0;
		for (const c of central) {
			cdSize += c.length;
			yield c;
		}
		const end = new DataView(new ArrayBuffer(22));
		end.setUint32(0, 0x06054b50, true);
		end.setUint16(8, count, true);
		end.setUint16(10, count, true);
		end.setUint32(12, cdSize, true);
		end.setUint32(16, offset, true);
		yield new Uint8Array(end.buffer);
	}

	const it = parts();
	return new ReadableStream<Uint8Array>({
		async pull(ctrl) {
			const { done, value } = await it.next();
			if (done) ctrl.close();
			else ctrl.enqueue(value);
		},
		async cancel() {
			await it.return(undefined);
		},
	});
}

/** Zip names: numbered so they keep their order and never collide. */
export function zipNames(names: string[]): string[] {
	const width = String(names.length).length;
	return names.map((n, i) => `${String(i + 1).padStart(width, '0')}-${safeName(n)}`);
}
