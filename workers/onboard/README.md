# cellestial-onboard

Backs client onboarding: the client page (`/start/#<code>`) and Gabriel's
dashboard (`/dashboard/`). Client records live in the D1 database
`cellestial-onboard`; nothing about a client is ever in this repo.

## Routes

- `GET /api/onboard/invites` — Gabriel's own pending GitHub org and Cloudflare
  account invites, as salted hashes. The client page notices a new one and
  moves on by itself.
- `GET /api/onboard/client/<code>` — the client's own setup (name, email,
  domain, lane, tier, mode, step, ticks). Nothing else.
- `POST /api/onboard/client/<code>/progress` — `{action: done|undo|goto, step,
  via?}`. Saves the move; on `done` in remote/test mode emails Gabriel, built
  from the stored record only. 30 moves a minute per link; 5 emails a minute
  per IP.
- `/api/onboard/admin/clients[/<id>[/rotate]]` — the dashboard's list, create,
  read, edit, new link, delete. Behind Cloudflare Access **and** checked again
  here (the Access token's signature, audience and issuer). Changes must come
  from the site itself as JSON. Without `ACCESS_TEAM`/`ACCESS_AUD` every admin
  route answers 503, never open.

The progress rules are in `src/onboard/progress.ts`, shared with the page.

## Settings

| Name             | Kind   | What it is                                                     |
| ---------------- | ------ | -------------------------------------------------------------- |
| `DB`             | D1     | `cellestial-onboard` (in `wrangler.jsonc`)                     |
| `INVITE_SALT`    | secret | Any long random string. Turns invite detection on.             |
| `CF_USER_TOKEN`  | secret | Cloudflare **user** API token with _User → Memberships → Read_ |
| `GH_TOKEN`       | secret | GitHub **classic** token, scope `read:org` only                |
| `RESEND_API_KEY` | secret | Same Resend key as the contact form                            |
| `NOTIFY_TO`      | var    | Where step emails land                                         |
| `NOTIFY_FROM`    | var    | A verified sender on the Resend domain                         |
| `ACCESS_TEAM`    | var    | Access team domain, e.g. `yourteam.cloudflareaccess.com`       |
| `ACCESS_AUD`     | var    | The Access application's Audience (AUD) tag                    |

`keep_vars` is on, so a deploy never wipes vars set in the dashboard.

### Turning the dashboard on (Gabriel, once)

1. Cloudflare dashboard → **Zero Trust** (pick the free plan if asked; choose a
   team name — that is your team domain, `<name>.cloudflareaccess.com`).
2. **Access → Applications → Add an application → Self-hosted.**
   - Name: `Onboarding dashboard`. Session duration: 24 hours.
   - Public hostnames: `cellestialstudio.com` path `dashboard`, and a second one
     `cellestialstudio.com` path `api/onboard/admin`.
   - Policy: Action **Allow**, Include **Emails** → `cellestial.studio@gmail.com`.
   - Login method: One-time PIN.
3. Open the new application → **Overview** → copy the **Application Audience
   (AUD) Tag**.
4. Workers & Pages → `cellestial-onboard` → Settings → Variables and Secrets →
   add `ACCESS_TEAM` (the team domain, no `https://`) and `ACCESS_AUD` (the tag),
   both as plain text. Deploy.

## Commands

```
pnpm dlx wrangler d1 migrations apply cellestial-onboard --remote --config workers/onboard/wrangler.jsonc
pnpm dlx wrangler deploy --config workers/onboard/wrangler.jsonc
pnpm test                                   # unit tests, all Workers
pnpm build && node workers/onboard/test/dev-server.mjs    # local site + Worker on port 4410
node tools/onboard/check-start.mjs          # browser walk of /start   (dev server running)
node tools/onboard/check-dashboard.mjs      # browser walk of /dashboard
```
