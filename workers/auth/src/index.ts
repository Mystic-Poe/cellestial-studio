// Decap CMS GitHub OAuth broker — standalone Worker.
//
// Why this exists: GitHub will not hand an access token to a web page. It only
// trades an authorization code for a token with a caller that can prove it
// holds the client secret, and a browser has nowhere safe to keep one. This
// Worker is the smallest possible server that runs that one errand.
//
// Why it is its own Worker rather than part of the site: the site is a static
// Astro build served by the `cellestial-studio` Worker. Keeping the broker
// separate means the site's build and output shape never change to serve two
// endpoints.
//
// Routes (bound in wrangler.jsonc, narrow on purpose):
//   GET /api/auth           -> send the browser to GitHub
//   GET /api/auth/callback  -> trade the code for a token, hand it to Decap

export interface Env {
	OAUTH_GITHUB_CLIENT_ID: string;
	// Secret. Set by Gabriel at activation time; absent until then, which makes
	// the callback fail honestly rather than silently.
	OAUTH_GITHUB_CLIENT_SECRET?: string;
}

const SCOPE = 'public_repo'; // widen to `repo` only if the repo goes private
const STATE_COOKIE = 'decap_oauth_state';
const COOKIE_PATH = '/api/auth';

const setState = (state: string) =>
	`${STATE_COOKIE}=${state}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
const clearState = `${STATE_COOKIE}=; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/**
 * Decap's login popup talks to the editor window by postMessage. The exchange:
 *   popup  -> opener : "authorizing:github"
 *   opener -> popup  : any message, which confirms the channel and origin
 *   popup  -> opener : "authorization:github:success:{...}" (or ":error:")
 * So the response has to be a page that runs script, not JSON.
 */
function handshakePage(message: string): Response {
	// JSON-encode, then neutralise `<` so no payload can close the script tag.
	const safe = JSON.stringify(message).replace(/</g, '\\u003c');
	return new Response(
		`<!doctype html><html><head><meta charset="utf-8" /><title>Signing in…</title></head>
<body><p>Completing sign-in…</p><script>
(function () {
  var message = ${safe};
  function handshake(event) {
    window.opener.postMessage(message, event.origin);
    window.removeEventListener('message', handshake, false);
  }
  if (!window.opener) {
    document.body.textContent = 'This page must be opened from the content manager.';
    return;
  }
  window.addEventListener('message', handshake, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`,
		{
			status: 200,
			headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
		},
	);
}

function authError(reason: string): Response {
	const res = handshakePage(`authorization:github:error:${JSON.stringify({ message: reason })}`);
	res.headers.append('set-cookie', clearState);
	return res;
}

function start(request: Request, env: Env): Response {
	if (!env.OAUTH_GITHUB_CLIENT_ID) {
		return new Response('OAUTH_GITHUB_CLIENT_ID is not set on this Worker.', {
			status: 500,
			headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
		});
	}

	const state = crypto.randomUUID();
	const origin = new URL(request.url).origin;

	const authorize = new URL('https://github.com/login/oauth/authorize');
	authorize.searchParams.set('client_id', env.OAUTH_GITHUB_CLIENT_ID);
	authorize.searchParams.set('redirect_uri', `${origin}/api/auth/callback`);
	authorize.searchParams.set('scope', SCOPE);
	authorize.searchParams.set('state', state);

	return new Response(null, {
		status: 302,
		headers: {
			location: authorize.toString(),
			'set-cookie': setState(state),
			'cache-control': 'no-store',
		},
	});
}

async function callback(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	const cookie = request.headers.get('cookie') ?? '';
	const expected = new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`).exec(cookie)?.[1];

	if (!code) return authError('GitHub did not return an authorization code.');
	if (!state || !expected || state !== expected) {
		return authError('Login state did not match. Start again from /admin.');
	}
	if (!env.OAUTH_GITHUB_CLIENT_ID || !env.OAUTH_GITHUB_CLIENT_SECRET) {
		return authError('OAuth credentials are not configured on this Worker yet.');
	}

	const exchange = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json',
			'user-agent': 'cellestial-auth-broker',
		},
		body: JSON.stringify({
			client_id: env.OAUTH_GITHUB_CLIENT_ID,
			client_secret: env.OAUTH_GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: `${url.origin}/api/auth/callback`,
		}),
	});

	if (!exchange.ok) {
		return authError(`GitHub rejected the token exchange (HTTP ${exchange.status}).`);
	}

	const data = (await exchange.json()) as {
		access_token?: string;
		error?: string;
		error_description?: string;
	};

	if (!data.access_token) {
		return authError(data.error_description || data.error || 'No access token returned.');
	}

	const res = handshakePage(
		`authorization:github:success:${JSON.stringify({
			token: data.access_token,
			provider: 'github',
		})}`,
	);
	res.headers.append('set-cookie', clearState);
	return res;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);

		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
		}
		if (pathname === '/api/auth' || pathname === '/api/auth/') return start(request, env);
		if (pathname === '/api/auth/callback') return callback(request, env);

		// The route pattern is narrow, so this should be unreachable. If it is
		// reached, the pattern is wider than intended -- say so instead of
		// shadowing the site with a blank 404.
		return new Response('Not found. This Worker only serves /api/auth and /api/auth/callback.', {
			status: 404,
			headers: { 'content-type': 'text/plain' },
		});
	},
};
