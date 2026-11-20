# Redesign progress

Spec: `BUILD_SPEC.md` + `SPEC-ADDENDUM.md` (the addendum wins). Branch: `redesign`.
A scene is **done** only when it builds, is screenshotted at 390×844 and
1440×900, and matches its assigned asset and spec.

| # | Piece | Spec elements | Status |
|---|---|---|---|
| 0 | Foundation: derived assets, palette, type, UI kit, scene director, claims, locked copy, constellation data | global rules, B10/B11 base components | in progress |
| 1 | Loading | A1 A2 A3 A4 A5 | in progress |
| 2 | Sky | B1–B6, B8–B11, G1 | in progress |
| 3 | Roots | E1–E6 | not started |
| 4 | Close | F1 F2 | not started |
| 5 | Chrome | C1 C2 C3 C4 | not started |
| 6 | Transitions | D1 D2 G2, A5 hand-off | not started |
| 7 | Claim flow end to end, B7 reveal | B5 B7 F1 | not started |
| 8 | Reduced motion, no-JS, phone pass | G3, checklist | not started |
| 9 | Final verification: screenshot matrix, protected-systems diff | — | not started |

## Protected systems (must show no logic change at the end)

- Contact form → Turnstile → Resend (`workers/contact`, `contact-submit.ts`, `ContactForm.astro`, `/contact`)
- `/admin` → Decap broker (`workers/auth`, `public/admin`, `home.json`)
- `/start` deep links (`workers/onboard`, `src/onboard`, `start-*.ts`, `/start`)

## Log

- 2026-11-19 — Spec frozen (`a31d2ee`). Baseline: tests and build pass. Foundation started.
- 2026-11-19 — Data layer in: 17 derived assets (983 KB) from the pack, palette sampled from
  the images, the twelve real constellation figures (147 stars, 146 claimable), the five
  Roots tiles checked character for character against the addendum, the scene contract.
  UI kit and experience core in progress; Loading and Sky started alongside on their own branches.
