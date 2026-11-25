// Photo reads go through Cloudflare's edge cache, so looking at the same
// thumbnail again doesn't touch R2 (whose reads bill past 10M a month).
// Whether a photo may be read at all is always decided first, from D1; the
// cache only saves the R2 read after that.

import type { R2Like } from './files.ts';
import type { Ctx } from './http.ts';

interface CacheLike {
	match(key: string): Promise<Response | undefined>;
	put(key: string, res: Response): Promise<void>;
	delete(key: string): Promise<boolean>;
}

const edge = (): CacheLike | undefined =>
	(globalThis as { caches?: { default?: CacheLike } }).caches?.default;

const cacheKey = (key: string) => `https://cellestialstudio.com/__onboard-photo/${key}`;
/** Photo ids never change content, so a day at the edge is safe. */
const EDGE_TTL = 86_400;

/** The first of these R2 keys that exists, from the edge cache when it can. */
export async function readPhoto(
	bucket: R2Like,
	keys: string[],
	ctx: Ctx,
): Promise<{ body: ReadableStream | null; type: string | null } | null> {
	const cache = edge();
	for (const key of keys) {
		const hit = await cache?.match(cacheKey(key));
		if (hit) return { body: hit.body, type: hit.headers.get('content-type') };
		const obj = await bucket.get(key);
		if (!obj) continue;
		const type = obj.httpMetadata?.contentType ?? null;
		if (!cache || !obj.body) return { body: obj.body, type };
		const [mine, kept] = obj.body.tee();
		ctx.waitUntil(
			cache
				.put(
					cacheKey(key),
					new Response(kept, {
						headers: {
							'content-type': type ?? 'image/jpeg',
							'cache-control': `public, max-age=${EDGE_TTL}`,
						},
					}),
				)
				.catch(() => {}),
		);
		return { body: mine, type };
	}
	return null;
}

/** Drop deleted photos from this location's cache (others age out; D1 already refuses them). */
export function forgetPhotos(keys: string[], ctx: Ctx) {
	const cache = edge();
	if (!cache) return;
	for (const k of keys) ctx.waitUntil(cache.delete(cacheKey(k)).catch(() => false));
}
