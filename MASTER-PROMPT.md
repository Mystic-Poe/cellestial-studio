# Build the Cellestial Studio redesign.

> The owner's master prompt for this build, saved word for word from the session it was
> given in (2026-11-19). Only the heading and bullet marks were added.

## What and why

This site sells websites by being one. A visitor should feel in the first ten seconds that whoever built this can build something extraordinary for them — then, when they reach the offers, find plain language, honest prices, and a simple way to ask. Wonder up top, clarity underneath. That contrast is the whole design: the Sky is the proof, the Roots are the pitch.

It is a visual redesign of the live site. The business plumbing already works and already makes money possible — your job is the experience on top of it, nothing underneath it.

## Source of truth

- BUILD_SPEC.md — every element (A–G), its assets, and how each piece behaves
- SPEC-ADDENDUM.md — locked decisions and the exact Roots tile copy; it wins over BUILD_SPEC.md on any conflict
- cellestial-assets/ — the only imagery you may use

Read what a task needs, when it needs it. Delegate to subagents freely — give each one the spec section and assets for its piece, not the whole pack. How you organise the work, what order, and what internal process you use is your call. I am not going to read plans or approve steps; I will judge the finished site.

## Boundaries

- Never change routes, handlers, or logic for the contact form (Turnstile → Resend), /admin (Decap broker), or /start deep links. Restyle their surfaces only. If a piece seems to require touching them, that piece is wrong — rethink it.
- Use only the assets in cellestial-assets/, only as the spec assigns them. No generated, stock, or substitute imagery. No social icons anywhere — there are none.
- Copy, prices, and offers are locked in the spec files. Use tile copy verbatim. Invent nothing: no offers, no prices, no post-cohort deal, no Google care.
- Silent site. No sound anywhere.
- There is no Work section and no Ownership section — the lit stars are the work, and ownership wording lives inside the tiles where the spec puts it.

## What done looks like — testable, not vibes

- Loading: the C powers up, electricity writes "Cellestial" and cools to brass-and-blue, 6–8s (never under 6), skippable by tap/click/key, short version on same-session return. It must feel like the reference video in the assets, not an approximation of it.
- Sky: endless 3D flight through the 12 constellations in the spec's order, real star patterns, faint brass honeycomb the light-beads actually travel. Sky starts empty except Cellestial's star. Any empty star is pickable; a star is claimed only when a build request is sent, then stays lit; a lit star shows exactly what was asked, nothing added. "See what holds up the sky" appears only after one full round. Flight is smooth on a phone — if frame rate drops, scale effects down automatically rather than shipping jank.
- Roots: stars fall, crash, and become mycelium; underground, 5 nodes in spec order, prices inside the tiles, guided light that suggests but never locks navigation. Wording on screen matches the addendum character-for-character.
- Close and chrome: "Claim your star" big, "Contact me" smaller under it, both wired to the existing flows. Logo and three-bar menu present throughout; menu teleports match the spec's four destinations.
- Accessibility: prefers-reduced-motion gets a still sky with the exit button already present — no flight, no loader sequence.
- Proof it didn't break the business: the build passes, and a diff review shows no logic changes to the three protected systems. The contact form still submits, /admin still loads, /start links still resolve.
- Proof it looks right: screenshot every scene at 390×844 and 1440×900 and compare against the assigned asset/spec for that scene. A scene that merely renders is not done; a scene that matches its reference is.

## When to stop and ask me

Only two things: (1) the spec files genuinely contradict each other or leave a visitor-facing decision unspecified, or (2) something outside this repo blocks you. Everything else — libraries, structure, task order, retries — decide it yourself and keep moving. If an approach fails twice, abandon it and take another route instead of stacking fixes.

Deliver: the built site, committed scene by scene, with a short final report — what was built, the screenshot comparisons, and the protected-systems diff check. Keep the report short; the site is the deliverable.
