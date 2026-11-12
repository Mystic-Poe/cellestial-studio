// Step 2 of the Decap login handshake: trade GitHub's code for a token.
//
// This is the piece a static site cannot do. GitHub will only exchange the
// short-lived `code` for an access token if the caller can prove it holds the
// client secret, and a browser has nowhere safe to keep one. This function is
// server-side, so the secret lives in Cloudflare's environment variables --
// never in the repo, never shipped to the browser.
//
// The reply is a tiny HTML page rather than JSON because Decap's login popup
// talks to the editor window via postMessage. The exchange it expects:
//   popup  -> opener : "authorizing:github"
//   opener -> popup  : (any message, confirms the channel)
//   popup  -> opener : "authorization:github:success:{\"token\":\"...\"}"

interface Env {
  OAUTH_GITHUB_CLIENT_ID: string;
  OAUTH_GITHUB_CLIENT_SECRET: string;
}

function page(payload: string): Response {
  // JSON-encode, then neutralise `<` so the payload can never close this
  // script tag early.
  const safe = JSON.stringify(payload).replace(/</g, '\\u003c');
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

const clearState =
  'decap_oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export const onRequestGet: (ctx: {
  request: Request;
  env: Env;
}) => Promise<Response> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookie = request.headers.get('cookie') ?? '';
  const expected = /(?:^|;\s*)decap_oauth_state=([^;]+)/.exec(cookie)?.[1];

  const fail = (reason: string) => {
    const res = page(`authorization:github:error:${JSON.stringify({ message: reason })}`);
    res.headers.append('set-cookie', clearState);
    return res;
  };

  if (!code) return fail('GitHub did not return an authorization code.');
  if (!state || !expected || state !== expected) {
    return fail('Login state did not match. Start again from /admin.');
  }
  if (!env.OAUTH_GITHUB_CLIENT_ID || !env.OAUTH_GITHUB_CLIENT_SECRET) {
    return fail('OAuth credentials are not configured on this deployment.');
  }

  const exchange = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.OAUTH_GITHUB_CLIENT_ID,
      client_secret: env.OAUTH_GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });

  if (!exchange.ok) {
    return fail(`GitHub rejected the token exchange (HTTP ${exchange.status}).`);
  }

  const data = (await exchange.json()) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!data.access_token) {
    return fail(data.error_description || data.error || 'No access token returned.');
  }

  const res = page(
    `authorization:github:success:${JSON.stringify({
      token: data.access_token,
      provider: 'github',
    })}`,
  );
  res.headers.append('set-cookie', clearState);
  return res;
};
