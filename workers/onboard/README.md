# cellestial-onboard

Backs the client onboarding page (`/start`, built at `/start/new`).

- `GET /api/onboard/invites`: Gabriel's own pending GitHub org invites and
  Cloudflare account invites, returned as salted hashes. The client page
  notices a new one and moves on by itself. No client or org name leaves the
  Worker.
- `POST /api/onboard/ping`: emails Gabriel when a client finishes a step
  (remote and test modes). Rate-limited to 5 a minute per IP.

Every secret is optional. Whatever is missing, the page falls back to its
"Done → Next" button and the client's flow still works.

## Variables — Gabriel sets these himself

| Name             | Kind   | What it is                                                      |
| ---------------- | ------ | --------------------------------------------------------------- |
| `INVITE_SALT`    | secret | Any long random string. Turns invite detection on.              |
| `CF_USER_TOKEN`  | secret | Cloudflare **user** API token with _User → Memberships → Read_  |
| `GH_TOKEN`       | secret | GitHub **classic** token, scope `read:org` only                 |
| `RESEND_API_KEY` | secret | Same Resend key as the contact form                             |
| `NOTIFY_TO`      | var    | Where pings land                                                |
| `NOTIFY_FROM`    | var    | A verified sender on the Resend domain (same as `CONTACT_FROM`) |

```
pnpm dlx wrangler secret put INVITE_SALT    --config workers/onboard/wrangler.jsonc
pnpm dlx wrangler secret put CF_USER_TOKEN  --config workers/onboard/wrangler.jsonc
pnpm dlx wrangler secret put GH_TOKEN       --config workers/onboard/wrangler.jsonc
pnpm dlx wrangler secret put RESEND_API_KEY --config workers/onboard/wrangler.jsonc
```

### Making the two tokens

- **Cloudflare:** My Profile → API Tokens → Create Token → Custom token →
  Permissions: _User · Memberships · Read_. No account or zone permissions.
- **GitHub:** Settings → Developer settings → Personal access tokens →
  Tokens (classic) → Generate → tick only `read:org`. Fine-grained tokens can't
  read pending org invitations.

Both tokens can only _see_ invites sent to Gabriel. Neither can change anything.

Deploy: `pnpm dlx wrangler deploy --config workers/onboard/wrangler.jsonc`
Tests: `node workers/onboard/test/onboard.test.mjs`
