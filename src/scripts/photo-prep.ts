// Gets a photo ready to send: a small thumbnail for the page, and (for client
// uploads) a resized copy so a phone on mobile data isn't sending 12 MB files.
// Gabriel's own uploads stay full size: the Higgsfield edit needs the detail.
// If the browser can't read the image (some HEIC files), the original goes
// as it is, with no thumbnail.

const THUMB_SIDE = 480;

async function draw(bitmap: ImageBitmap, side: number, quality: number): Promise<Blob | null> {
	const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
	const w = Math.max(1, Math.round(bitmap.width * scale));
	const h = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.drawImage(bitmap, 0, 0, w, h);
	return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export interface Prepared {
	file: File;
	thumb: Blob | null;
}

/** `maxSide` null keeps the file exactly as it is. */
export async function preparePhoto(file: File, maxSide: number | null): Promise<Prepared> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		return { file, thumb: null };
	}
	try {
		const thumb = await draw(bitmap, THUMB_SIDE, 0.8);
		if (maxSide === null || Math.max(bitmap.width, bitmap.height) <= maxSide)
			return { file, thumb };
		const small = await draw(bitmap, maxSide, 0.86);
		if (!small || small.size >= file.size) return { file, thumb };
		const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
		return { file: new File([small], `${name}.jpg`, { type: 'image/jpeg' }), thumb };
	} finally {
		bitmap.close();
	}
}

/** Sends a prepared photo as a form upload; resolves to the parsed JSON answer. */
export async function sendPhoto(
	url: string,
	p: Prepared,
	fields: Record<string, string> = {},
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> | null }> {
	const form = new FormData();
	form.append('file', p.file, p.file.name);
	if (p.thumb) form.append('thumb', p.thumb, 'thumb.jpg');
	for (const [k, v] of Object.entries(fields)) form.append(k, v);
	try {
		const res = await fetch(url, { method: 'POST', body: form, credentials: 'same-origin' });
		const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
		return { ok: res.ok, status: res.status, data };
	} catch {
		return { ok: false, status: 0, data: { error: 'No connection.' } };
	}
}
