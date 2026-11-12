# cellestial-auth

The GitHub OAuth broker for Decap CMS at `/admin`.

GitHub will not give an access token to a web page — only to a server holding
the client secret. This Worker is that server, and does nothing else.

- `GET /api/auth` — redirect to GitHub, with a random `state` in an HttpOnly cookie.
- `GET /api/auth/callback` — verify `state`, trade the code for a token, hand it
  to the Decap window via postMessage.

Deploy: `pnpm dlx wrangler deploy` from this directory.

Activation (Gabriel's, once): generate a client secret on the "Cellestial Studio
Admin" OAuth App, add `https://cellestialstudio.com/api/auth/callback` as a
redirect URI, then set the secret on **this** Worker:

```
pnpm dlx wrangler secret put OAUTH_GITHUB_CLIENT_SECRET
```

The secret never goes in this repo.
