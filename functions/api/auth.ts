// Step 1 of the Decap login handshake: send the editor off to GitHub.
//
// Decap opens this route in a popup. We never see a password and we hold no
// secret here -- this half of the flow is public by design. The only thing
// worth guarding is that the browser that comes back is the same one that
// left, so we mint a random `state`, park it in an HttpOnly cookie, and check
// it again in the callback.

interface Env {
  OAUTH_GITHUB_CLIENT_ID: string;
}

const SCOPE = 'public_repo'; // widen to `repo` only if the repo goes private

export const onRequestGet: (ctx: {
  request: Request;
  env: Env;
}) => Promise<Response> = async ({ request, env }) => {
  const clientId = env.OAUTH_GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response(
      'OAUTH_GITHUB_CLIENT_ID is not set on this deployment.',
      { status: 500, headers: { 'content-type': 'text/plain' } },
    );
  }

  const state = crypto.randomUUID();
  const url = new URL(request.url);

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', `${url.origin}/api/auth/callback`);
  authorize.searchParams.set('scope', SCOPE);
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      // Host-only, HttpOnly, short-lived: the browser hands this back to the
      // callback and nothing else can read it.
      'set-cookie': `decap_oauth_state=${state}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'cache-control': 'no-store',
    },
  });
};
