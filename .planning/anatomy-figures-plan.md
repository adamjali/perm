# Isometric figures and pictures: where they go (plan, Oct 21 2026)

Two skills draw them. `anatomy` makes interactive figures that explain how something works, and every number they show
comes from code (here: the central rules in `convex/lib/perm`, so a figure can't contradict the app). `anatomy-asset`
makes still pictures (spots, page pictures, promo tiles), mostly grey with the lime and the stage colours.

The owner approves each one before it's built (Oct 21 2026). Nothing below is built yet.

## Where they go

| Place | What | Why |
|---|---|---|
| Guides that explain a mechanism: filing window, DOL's queue, visa bulletin cutoff, RFI path, PWD validity, the I-140's 180 days | `anatomy` explainer | Hard to say in words; runs on the same code as the app. Highest value |
| `/guides` and `/blog` topic sections | a set of small pictures, one camera and scale | Helps scanning; nothing real to photograph for a topic |
| Homepage, the "Both sides" section | two small pictures: a split-flap board (waiting), a docket drawer (attorneys) | Ties the site to the films. Never above the case box (35% of visits look up a case) |
| `/for-attorneys`, security section only | one picture | Encryption and separate accounts can't be screenshotted; the rest stays real app pictures |
| Signed-in app empty states (no cases, no notifications) | small pictures | The one place in the app with room |
| 404 page, `/developers` | small pictures | Nothing real to show there |
| Chrome Web Store and Product Hunt tiles | promo art | Waits on the store listing |

## Where they don't, and why

| Place | Why not |
|---|---|
| Data pages | The data is the picture (at most one explainer below the data) |
| Calculators | They already draw the answer's shape (the ruler, the wage ladder) |
| Article header pictures | Each has its own credited real picture |
| Film explainers | Their point is the site's own recording; each change is a re-render |
| Social cards | Real screenshots by choice; only the drawn-motif cards (indexes, legal) could switch |
| Privacy, Terms, Security, API terms | Legal pages stay plain; a vault picture would be decoration posing as a claim |
| Email preferences page, emails | People come to turn mail off; Gmail and Outlook don't show SVG |
| Sign-in, sign-up | `/login` bare on purpose; `/signup` shows a real screenshot and live figures (owner's call, twice) |
| Settings, onboarding, dashboard, cases, calendar, timeline | Working screens; onboarding has its own drawing |
| About, `/press`, changelog, embeds, translations | Real portrait and pages; `/press` kept as is; changelog shows the interface as shipped; embeds sit in other sites at a fixed height |

## Rules for every one

- Loaded as an image file (`<img src="/….svg">`), below the fold, never the first thing a page paints. Inline SVG in a
  server component rides in the page payload twice.
- No motion that runs by itself (`calm-system.test.ts`, WCAG 2.2.2): ship still, or one interaction-driven move.
- Alt text on each; keyboard and a live readout for the interactive ones; text and marks at AA contrast.
- 70 to 240 KB each. The site is flat with square corners and 2px borders, so keep them grey with lime and few in
  number, or they look pasted on.
