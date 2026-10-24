# Reviews, ratings and phones with a notch: Oct 23 to 24 2026

What shipped overnight, with the proof for each. Mechanics: `v2/CLAUDE.md`, "Oct 24 2026". Times Eastern.

## Shipped

| what | commit | live |
|---|---|---|
| Our own reviews: form first, drifting rows, tiles, exact tally, older reviews by 100, calm errors, a thanks that fits the stars | 58db2f37, 12e44161, 62511d72 | site 2:09 AM Oct 24 |
| Sign-in without the Cloudflare check (advisory, skippable, confusing) | c14b015c | site 2:09 AM |
| A 3, 4 or 5 in the rating email goes to the review form; a 1 or 2 to the feedback page | 741127f9 | Convex 2:40 AM |
| A missing-star error no longer fills stars under a resting mouse | f237da85 | site 2:09 AM |
| Alerts and confirmations dated by the sweep's own record (`fetched_at`) | a606c2b1 | Convex 3:10 AM |
| A box in the rating email saves on open and goes straight on; scanner opens kept apart; Admin > Reviews lists every rating; Privacy Policy dated Oct 24 | ac65465e | Convex 3:10 AM, site 3:17 AM |
| The page runs edge to edge on phones with a notch | 11b9c870 | site 3:38 AM |
| `testData:removeOwnerTest` for the owner's own test runs | 6b05da23 | Convex 4:57 AM |

## Proof

- Every guard was broken on purpose and its test went red, then restored: the scanner burst, the fetcher's browser
  line, the hourly write cap (after the first version of that test stayed green: the list is trimmed to 20 either way,
  so it now checks the oldest kept open), the watched-case check, the `fetched_at` read, `viewport-fit=cover`, the
  "owner-test" guard on the cleanup, the resting-mouse fix.
- `pnpm check` passed before each push; GitHub's suite passed before each Convex deploy.
- Live after each deploy: `/reviews` 200 with "Submit review", the homepage band "What people say", `/login` with no
  Cloudflare check, a junk rating link 400, the homepage's viewport meta carrying `viewport-fit=cover`.
- End to end on production with the owner's own address and a real certified case: the confirmation email and the
  certified alert both arrived through the mail Worker (Gmail, 2:39 and 2:41 AM), the alert carried the 1 to 5 row, a
  tap saved and went on. The test data was removed at 4:57 AM and nothing was left under that address in watches,
  ratings, congratulations notes or reviews.
- The alert email showed the July 16 date for a case certified Oct 22, which is how the `fetched_at` fix was found.
- Notch: Chrome 150 headless with `Emulation.setSafeAreaInsetsOverride` (59 / 59 / 0 / 21): logo 16 to 75px, H1 32
  to 91px, no sideways scroll; at 390 wide with no inset, dev and live measured the same. Compiled CSS checked: every
  `env(safe-area-inset-*)` arbitrary value came out as valid CSS.

## Known limits

- Chrome on iPhone keeps every page inside the safe area (`AdjustInsetsForSafeArea`, crbug 40199143, open). The light
  side strips stay; owner: "it's fine just leave it". Safari runs edge to edge.
- The rating's scanner check is a pattern and can miss one: a scanner that opens only one box, from a browser-like
  line, counts. Admin > Reviews shows every open with its browser so a doubtful one can be judged.
- Not tested on a real notched phone in Safari yet.
