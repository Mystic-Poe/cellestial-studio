# cellestial-onboard

Done-for-you client onboarding: the client page (`/start/#<code>`) and
Gabriel's dashboard (`/dashboard/`). The client never makes an account
anywhere; the studio hosts their site and hands everything over on request.

Records live in the D1 database `cellestial-onboard`; photo files in the
private R2 bucket `cellestial-onboard-photos`. Nothing about a client is ever
in this repo.

## Routes

Client (anyone holding a live link code):

- `GET /api/onboard/client/<code>`: what their page shows: name, stage,
  their answers, whether sent, their own uploads, preview/live address once
  reached. Never notes, checklist, id or reviews.
- `PUT …/intake` `{intake, send?}`: saves answers; the first `send` emails
  Gabriel. Locked once the stage passes Design.
- `POST …/photos` (form: `file`, `thumb?`): photos only, 25 MB each, 25 per
  client. `GET`/`DELETE …/photos/<id>`: their own uploads only.
- `POST …/review` `{verdict: ok|changes, text?}`: only at Review; emails Gabriel.

Admin (`/api/onboard/admin/clients…`): list, create, read (with photos and
reviews), edit (stage, answers, addresses, checklist, notes, status), new
link, delete (files too), photo upload (original or finished, full size),
photo read (`?size=thumb|full&download=1`), photo delete, `photos.zip` (every
original, streamed). Behind Cloudflare Access **and** checked again here.
Changes must come from the site itself (JSON, or a form upload that proves
its origin). Without `ACCESS_TEAM`/`ACCESS_AUD` every admin route answers 503.

The intake fields and stages are defined once, in `src/onboard/intake.ts`,
shared by both pages and this Worker.

## Free-tier caps

R2 is the only thing on the account that bills past its free tier, so
`src/quota.ts` keeps it there: uploads stop once everything stored reaches
8 GB (Gabriel is emailed once a day while full), and at 1,500 uploads a UTC
day (100 of them at most from any one client link). Client photo views are rate limited per link and served from the edge
cache after the first read. The dashboard list shows storage and today's
uploads.

## Settings

| Name             | Kind   | What it is                                           |
| ---------------- | ------ | ---------------------------------------------------- |
| `DB`             | D1     | `cellestial-onboard` (in `wrangler.jsonc`)           |
| `PHOTOS`         | R2     | `cellestial-onboard-photos` (in `wrangler.jsonc`)    |
| `RATE`           | limit  | 5 emails a minute per IP                             |
| `RATE_CLIENT`    | limit  | 60 writes a minute per client link                   |
| `RATE_READ`      | limit  | 120 photo views a minute per client link             |
| `RESEND_API_KEY` | secret | Same Resend key as the contact form                  |
| `NOTIFY_TO`      | var    | Where Gabriel's emails land                          |
| `NOTIFY_FROM`    | var    | A verified sender on the Resend domain               |
| `ACCESS_TEAM`    | var    | Access team domain (in `wrangler.jsonc`)             |
| `ACCESS_AUD`     | var    | The Access application's AUD tag (in `wrangler.jsonc`) |

`keep_vars` is on, so a deploy never wipes vars set in the dashboard.

## Commands

```
pnpm dlx wrangler r2 bucket create cellestial-onboard-photos          # once
pnpm dlx wrangler d1 migrations apply cellestial-onboard --remote --config workers/onboard/wrangler.jsonc
pnpm dlx wrangler deploy --config workers/onboard/wrangler.jsonc
pnpm test                                   # unit tests, all Workers
pnpm build && node workers/onboard/test/dev-server.mjs    # local site + Worker on port 4410
node tools/onboard/check-start.mjs          # browser walk of the client page (dev server running)
node tools/onboard/check-dashboard.mjs      # browser walk of the dashboard
```
