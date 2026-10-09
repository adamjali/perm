# Batch, Oct 8 2026 night

The owner's asks (9:48 PM EDT): build the four page changes from the teardown, investigate the browser
crash, the bot check and the developer platform fully, and (9:50 PM) check the scorecard against Rivals A
and C for every program and make ours the best.

## Investigations

- [x] Bot check measured (Oct 8, 11 PM): see "Bot check" below. A decision for the owner.
- [x] Browser crash: narrowed (see "Browser crash" below); evidence capture shipped, fix waits on it.
- [x] Scorecard: why Rivals A and C look ahead (see "Scorecard" below).

## Scorecard

Found (Oct 8, 10 PM): on in-line cases (filed in the month DOL is working) we beat all three rivals (live:
typically 4 days off against 10 to 17; backtest: 4 against Rival C's method's 11). Rival A's lead is on
cases DOL's queue already passed, where it answers "today": 25 of its 39 undecided dates there are already
overdue, and on our own record (five start days, 450 to 2,049 cases each, undecided counted) "today" loses
to our current rate rule every time. 11 of our 17 judged dates came from DOL's published average, retired
Oct 7. Wage requests: the 83-day figure mixes in the method retired Oct 3; the current one is 8 days off.

- [x] Head-to-head settles a waiting case once today passes the midpoint of the two dates, and carries a floor on each side's miss
- [x] Split by kind: in DOL's line, queue had passed, at an RFI (readings and the admin table)
- [x] Retired methods (DOL's average, Oct 7; the request-month wage method, Oct 3) say so in every reading
- [x] Wage requests: the page and admin already read by method (pwd-day, pwd-queue); the mixed figure was only in the raw doc
- [x] The nightly backtest scores "today" beside our rate on the passed cases, and readOurs prints both

## Page changes (owner: "do all")

- [x] Employers under review: the day's news first, then who is on hold as bars, the moves by day; tables folded (678ffae8, 34e69945)
- [x] Filing-month page: share decided first, one bar, three tiles (fea961c5); decisions per day, where DOL has reached, the initials grid from a new nightly document (c81969d6); the tables folded
- [x] Case answer: the line ahead as bars by filing month (678ffae8). The method panel is not folded yet: its anchor is linked from the answer card, and a link into a closed details element isn't opened by every browser
- [x] One quiet line on every data page offering the free alert (678ffae8; off the lookup and preference pages)
- [ ] Top H-1B employers by year and state (the owner's two screenshots), if the answer is "not well"

## Developer platform (one agent, own worktree)

- [ ] Paywall switch, keys finished, /v1/me, exports, live lookups, webhooks, docs and SDKs, admin
- [ ] Merge, gate, deploy, Convex deploy if the schema changed

## Search Console

- [ ] Run tonight's slots (open since 9:12 PM)

## Bot check (measured Oct 8, 5:52 to 10:42 PM EDT, Cloudflare's 10,000 newest samples on /perm-case-status)

- The scraper label (Windows Chrome 151 or 80 to 139): 2,148 addresses challenged, 1 got through. The check is doing its job there.
- Everyone else: 831 addresses challenged, 250 got through (solved, or a pass still valid). iPhones 86 of 137, Android 21 of 68, desktop 143 of 614.
- 58 phone addresses were challenged 2 to 35 times each and never got through, on US home ISPs. 30 challenges in five hours from one address isn't a person retrying; it reads as a scraper on residential proxies with a phone label. Not proven.
- PostHog (people who pass, then use the form): 50 of 54 sessions that submitted a case number reached the answer; median 4.1 s from submit to answer against about 0.7 s for the page itself, so the check costs a returning-less visitor about 2 to 3 s.
- Not measurable from our side: how many real people met the check on a ?case= link and left. The challenge page runs none of our code.

## Browser crash ("reading 'call'")

- About 2.5 to 3% of real desktop Chrome 154 and Edge 154 sessions; Mobile Safari 0.06%; the scraper's headless Chrome 0 of 24,000. Fires 0.3 to 0.7 s after a full load, inside a chunk of a route the page prefetches (the (auth) error chunk via the header's Sign in link, the case page via case-number forms). Steady on every build inside its own live window, so not deploy skew. Most are recovered by the error screen's one reload.
- Ruled out: chunk files differing between the release and shared/ (0 of 366 differ), Rocket Loader, an incomplete chunk graph (every dependency is in the chunks each entry waits for), the standby slot (no traffic), Ahrefs' script (no webpack).
- Webpack marks a chunk installed when any script pushes its id into self.webpackChunk_N_E and then skips a later push's modules. Every Next.js build shares that name, so a foreign push (likely a desktop browser extension) is the one mechanism that gives a missing module with nothing failing. Inference from the runtime code; not seen yet.
- Shipped: every missing-module event now records chunk ids pushed twice, scripts that aren't our build files (extensions by origin), and the deployment ids on our scripts. If foreign pushes show, rename the global for the client build (output.chunkLoadingGlobal) after a full build and test.

## Scorecard, as the readings say it now (Oct 9, 12:15 AM)

- Rival A leads 12 to 5, not clearly (about 1 time in 7 by luck). On cases in DOL's line we were closer 3 to 2 (typical miss 4 days against 13); on cases the queue had passed, Rival A 10 to 2. Rival A has 22 dates already past with no decision against 1 of ours.
- Rival B: we lead 14 to 1, clearly; ahead on both kinds.
- Rival C: even, 9 to 9; we lead 4 to 1 in DOL's line (4 days against 17), it leads 8 to 5 on passed cases.
- Ours on 11,561 real decisions (nightly backtest): typically 4 days off, 80% within a week.

## Found on the way

- CI went red on 678ffae8: WatchBanner imported the icon from the client-only entry; phosphor-server-imports.test.ts caught it, the deploy waited, fixed in 34e69945. pnpm check can't see source-scanning gates that don't name a file, so src/app/__tests__ (58 files) now runs before each push in this batch.
- Pre-existing, not from this batch: 12px labels and a 40px search box inside the month page's folded census and case browser; 38 to 40px filters on the employer table.
