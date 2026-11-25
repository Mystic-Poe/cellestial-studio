// The second lock on the admin routes. Cloudflare Access already stands in
// front of them; this checks Access's signed token again inside the Worker, so
// an Access rule switched off by mistake still leaves the routes shut.
//
// RS256 only. Keys come from the team's own certs endpoint and are kept for
// ten minutes. Anything unexpected is a denial, never a pass.

export interface AccessEnv {
	ACCESS_TEAM?: string;
	ACCESS_AUD?: string;
}

type Jwk = JsonWebKey & { kid?: string };

let cache: { team: string; at: number; keys: Jwk[] } | null = null;
const KEY_TTL_MS = 10 * 60_000;

/** For tests: forget cached keys. */
export function resetAccessKeys(): void {
	cache = null;
}

async function keysFor(team: string, refresh = false): Promise<Jwk[]> {
	if (!refresh && cache && cache.team === team && Date.now() - cache.at < KEY_TTL_MS)
		return cache.keys;
	const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
	if (!res.ok) throw new Error('certs unavailable');
	const body = (await res.json()) as { keys?: Jwk[] };
	const keys = Array.isArray(body.keys) ? body.keys : [];
	cache = { team, at: Date.now(), keys };
	return keys;
}

const fromB64u = (s: string): Uint8Array<ArrayBuffer> => {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
	const out = new Uint8Array(new ArrayBuffer(bin.length));
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
};
const parse = (s: string): Record<string, unknown> =>
	JSON.parse(new TextDecoder().decode(fromB64u(s)));

export async function verifyAccess(
	request: Request,
	env: AccessEnv,
): Promise<'ok' | 'unconfigured' | 'denied'> {
	const team = env.ACCESS_TEAM?.trim();
	const aud = env.ACCESS_AUD?.trim();
	if (!team || !aud) return 'unconfigured';

	const token = request.headers.get('cf-access-jwt-assertion');
	if (!token) return 'denied';
	try {
		const parts = token.split('.');
		if (parts.length !== 3 || !parts[2]) return 'denied';
		const [h, p, s] = parts;
		const header = parse(h);
		if (header.alg !== 'RS256' || typeof header.kid !== 'string') return 'denied';

		let jwk = (await keysFor(team)).find((k) => k.kid === header.kid);
		if (!jwk) jwk = (await keysFor(team, true)).find((k) => k.kid === header.kid);
		if (!jwk) return 'denied';

		const key = await crypto.subtle.importKey(
			'jwk',
			{ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['verify'],
		);
		const valid = await crypto.subtle.verify(
			'RSASSA-PKCS1-v1_5',
			key,
			fromB64u(s),
			new TextEncoder().encode(`${h}.${p}`),
		);
		if (!valid) return 'denied';

		const claims = parse(p);
		const now = Math.floor(Date.now() / 1000);
		if (typeof claims.exp !== 'number' || claims.exp <= now) return 'denied';
		if (typeof claims.nbf === 'number' && claims.nbf > now + 30) return 'denied';
		if (claims.iss !== `https://${team}`) return 'denied';
		const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
		if (!auds.includes(aud)) return 'denied';
		return 'ok';
	} catch {
		return 'denied';
	}
}
