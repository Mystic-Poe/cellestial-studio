// Public identifiers only. Nothing secret ever goes in this file.

// Turnstile widget "cellestial-contact-form". Public by design: it ships in the
// page HTML. PUBLIC_TURNSTILE_SITE_KEY overrides it, e.g. with Cloudflare's
// always-pass test key 1x00000000000000000000AA for local work.
export const TURNSTILE_SITE_KEY: string =
	import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAAGAXa00iSv2HhMz-';

// The founding-client survey's "Leave the review" button (/survey). Empty on
// purpose until the Google Business Profile is out of verification: @gro
// supplies the real review link then, and this one line is the whole change.
// While it is empty the button shows but is disabled.
export const REVIEW_LINK: string = '';
