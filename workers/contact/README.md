# cellestial-contact

The contact form endpoint: `POST /api/contact`.

Our own edge function + Turnstile + Resend, per the ratified forms default. Lead
data never passes through a third-party form service.

Order of operations is deliberate: shape validation, then Turnstile, then
Resend. Spam can never spend the mail quota, and a misconfigured Worker returns
503 rather than looking like a delivered message.

## Variables — all four are Gabriel's to set

| Name | Kind | Value |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | secret | From the Turnstile widget (below) |
| `RESEND_API_KEY` | secret | From the Resend dashboard |
| `CONTACT_TO` | var | Where enquiries land |
| `CONTACT_FROM` | var | A verified sender on the Resend domain |

```
pnpm dlx wrangler secret put TURNSTILE_SECRET_KEY --config workers/contact/wrangler.jsonc
pnpm dlx wrangler secret put RESEND_API_KEY       --config workers/contact/wrangler.jsonc
```

## Steps that need an account (not done — no credentials here)

1. **Turnstile widget** — Cloudflare dashboard → Turnstile → add a widget for
   `cellestialstudio.com`. It yields a **site key** (public) and a **secret
   key**. The site key goes in the site build as `PUBLIC_TURNSTILE_SITE_KEY`;
   until it is set, `/contact` renders the form disabled with a notice rather
   than shipping a submit button that fails.
2. **Resend** — sign up (`cellestial.studio@gmail.com`), verify the sending
   domain, create an API key.

## Known limit, not enforced

Resend's free tier is **3,000/month and 100/day** — both, not either. This
Worker does not count sends, because that needs durable storage (KV or D1) and
none is provisioned. Two options when it matters: a KV counter keyed by day, or
let Resend reject and surface its error, which the endpoint already does
honestly (502, no false success). Worth a decision before launch traffic.
