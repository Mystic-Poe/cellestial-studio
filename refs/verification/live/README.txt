THE LIVE SITE AFTER PUBLISHING (23 Nov 2026)

On the owner's word ("Push everything that's done to the main repo so it build on the true
website.") main was fast-forwarded from 052f82a to c66bb73 and pushed at 14:14. Workers Builds
deployed it; cellestialstudio.com served the new build 69 s later.

BEFORE THE PUSH, on c66bb73: pnpm build, pnpm test (185 of 185 in node; the Workers' own 15, 16
and 14), pnpm lint, pnpm typecheck pass; the protected-systems diff prints nothing. A clean clone
of the branch, installed with --frozen-lockfile and built, gives the same 39 files as the
checkout's build but for the stylesheet: the checkout's has 14 rules more (.flex-wrap,
.font-display, .italic, .backdrop-filter and its registered properties), which Tailwind picked
out of the untracked local notes in claude-vault/. None of the four is used anywhere in the
site's pages, scripts or sources, so nothing looks different; the live stylesheet is the clean
clone's (33,732 bytes). clean-build-sheet.jpg: the clean build at both sizes.

ON THE LIVE SITE, nothing sent:
  live-check.txt     the pages; every page against the clean build of the same commit (the same
                     but for the spam-check key, which is the real one); the other files byte
                     for byte; the three Workers answering on their routes (the contact Worker:
                     GET 405, a POST with no spam-check token 400, so it is configured and
                     nothing was sent; the sign-in broker redirects to GitHub; onboarding 405)
  live-browse.txt    a visitor's pass in a browser at 1440x900 and 390x844: the loader, the sky
                     7.6 and 7.4 s after navigation, "claim yours", the star's panel, the request
                     form (posts to /api/contact: name, email, message, star,
                     cf-turnstile-response), the menu's four destinations, the teleport to the
                     Roots, /contact/ with the real spam check, /start/new/ making a link and
                     the link opening on "Step 1 of 4"
  live-sheet.jpg     that pass, every step, both sizes
  live-console.txt   the homepage, loader to sky: no console message. On /contact/ every message
                     comes from Cloudflare's own challenge frame (a headless browser), none from
                     the site
  tools/             the three scripts (they read a clean build of the same commit beside them)

NOT DONE, and only the owner can do it: one real message through the live form. It needs a
person past the spam check, and it lands in his inbox.

TO ROLL BACK: Cloudflare dashboard, Workers & Pages, cellestial-studio, Deployments: roll back to
the deployment before 23 Nov 14:14. The old site is commit 052f82a.
