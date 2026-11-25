// Signs Cloudflare Access style tokens for tests, and stubs the certs fetch.
export const TEAM = 'studio-test.cloudflareaccess.com';
export const AUD = 'aud-tag-123';

const alg = {
	name: 'RSASSA-PKCS1-v1_5',
	modulusLength: 2048,
	publicExponent: new Uint8Array([1, 0, 1]),
	hash: 'SHA-256',
};
const pair = await crypto.subtle.generateKey(alg, true, ['sign', 'verify']);
export const certs = {
	keys: [{ ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'RS256' }],
};

const b64u = (x) => Buffer.from(x).toString('base64url');
export async function accessToken(over = {}) {
	const now = Math.floor(Date.now() / 1000);
	const head = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
	const body = b64u(
		JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, exp: now + 600, iat: now, ...over }),
	);
	const sig = await crypto.subtle.sign(
		'RSASSA-PKCS1-v1_5',
		pair.privateKey,
		new TextEncoder().encode(`${head}.${body}`),
	);
	return `${head}.${body}.${b64u(new Uint8Array(sig))}`;
}
