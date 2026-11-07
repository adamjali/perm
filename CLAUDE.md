# CLAUDE.md - PERM Tracker

**Status:** Production | **Version:** 2.0.0 | **Last Updated:** 2026-11-07

This file and [v2/CLAUDE.md](v2/CLAUDE.md) load into every session, so both hold only what every session needs. The
history, the evidence and every dated lesson (972 KB until Nov 7 2026) moved word for word to
[`v2/docs/notes/`](v2/docs/notes/README.md), one file per area. **Before working in an area, read its notes file, or grep
the folder for the file, table, route or word you're touching.** A pointer anywhere that says "see v2/CLAUDE.md,
section X" or "Detailed in v2/CLAUDE.md under X" means the section headed X in that folder
(`grep -rn "^## X" v2/docs/notes/`).

**Where a new note goes** (every session, so this file stays small; `v2/scripts/test_instruction_size.py` fails CI when
either CLAUDE.md passes its limit):
- a lesson, with its evidence: the end of its area's notes file, under a dated heading;
- a one-line summary of the day's work: the end of `v2/docs/notes/timeline.md`;
- a standing decision of the owner's: one line under "Standing decisions" below, dated, with the reasons in the notes;
- a rule every change must follow: one line in v2/CLAUDE.md's "Rules every change follows".

> The codebase-map table below is a dated snapshot (2026-02-21) and its counts
> have drifted: the suite is now **634 files / 9,026 tests across 5 vitest
> projects** (2026-10-08), not the 151 files / 3 projects TESTING.md records. Treat those
> docs as orientation, and `v2/CLAUDE.md` plus `pnpm test:run` as current.

## Production URLs

- **Frontend:** https://permtracker.app
- **Convex Dashboard:** https://dashboard.convex.dev

## Documentation

| Topic | File |
|-------|------|
| **Developer Guide (PRIMARY)** | [v2/CLAUDE.md](v2/CLAUDE.md) |
| **API Reference** | [v2/docs/API.md](v2/docs/API.md) |
| Design System (look, motion, gates) | [v2/docs/DESIGN_SYSTEM.md](v2/docs/DESIGN_SYSTEM.md) |
| PERM Workflow (canonical) | [perm_flow.md](perm_flow.md) |
| Testing Guide | [v2/TEST_README.md](v2/TEST_README.md) |
| **Codebase Map (7 docs)** | [.planning/codebase/](.planning/codebase/) |
| Planning & Roadmap | [.planning/](.planning/) |
| **History and lessons, by area** | [v2/docs/notes/](v2/docs/notes/README.md) |

**See [v2/CLAUDE.md](v2/CLAUDE.md) for Quick Start, commands, patterns, and all developer docs.**

---

## Codebase Map

Deep-dive documentation in `.planning/codebase/` (3,856 lines, last updated 2026-02-21). **Read these before making significant changes.**

| Document | Lines | What It Covers | When To Read |
|----------|-------|----------------|--------------|
| [STACK.md](.planning/codebase/STACK.md) | 279 | All dependencies with versions, config files inventory, runtime details, CI/CD, pnpm overrides, version compatibility notes | Adding/upgrading dependencies, debugging build issues |
| [INTEGRATIONS.md](.planning/codebase/INTEGRATIONS.md) | 459 | Every external API (AI, email, push, calendar, search, Sentry), env vars inventory, webhook flows, auth providers, sequence diagrams | Working with external services, adding integrations, env var questions |
| [ARCHITECTURE.md](.planning/codebase/ARCHITECTURE.md) | 595 | System architecture with Mermaid diagrams, data flows (case CRUD, auth, AI chat, notifications), state management, API layer, database tables, dependency graph | Understanding how systems connect, planning new features, debugging data flow |
| [STRUCTURE.md](.planning/codebase/STRUCTURE.md) | 720 | Every directory and file with descriptions, naming conventions, import patterns, barrel exports, module boundaries, where to add new code | Finding files, understanding organization, adding new features |
| [CONVENTIONS.md](.planning/codebase/CONVENTIONS.md) | 580 | TypeScript patterns, React patterns, Convex patterns, error handling, date protocol, form patterns, CSS/styling, naming rules, anti-patterns with examples | Writing new code, code review, understanding project patterns |
| [TESTING.md](.planning/codebase/TESTING.md) | 800 | All 151 test files listed, Vitest config (3 projects), test utilities inventory, mocking patterns, coverage setup, flaky tests, factory patterns | Writing tests, debugging test failures, understanding test infrastructure |
| [CONCERNS.md](.planning/codebase/CONCERNS.md) | 423 | Risk matrix, tech debt (SWC bug, disabled React Compiler), dead code audit, security concerns, performance bottlenecks, dependency vulnerabilities, prioritized recommendations | Before refactoring, sprint planning, addressing tech debt |

---

## GSD Workflow

Uses GSD (`~/gsd-adam`). Config: quality profile, all gates ON, auto_advance OFF, branching none.
v1.0 (10 phases) + v2.0 (22 phases) shipped. Post-v2 features ongoing.
Key: `/gsd:feature`, `/gsd:quick`, `/gsd:map-codebase`, `/gsd:help`

---

## Deployment

The site runs on an Oracle server behind Cloudflare (since Sep 28 2026; runbook
[`v2/scripts/oracle/README.md`](v2/scripts/oracle/README.md)). Vercel is retired.

- **Site:** a push to `main` runs `Oracle build and deploy`. It builds at once, and
  goes live only in the 1 to 5 AM Eastern window (the server's 2 AM run ships main
  when the site changed; `gh workflow run oracle-deploy.yml -f when=now` for an
  urgent fix). Every deploy empties the page cache, so they're batched.
- **Convex:** `pnpm convex:deploy` from `v2/`, by hand, once GitHub's suite is green: it refuses an
  unclean, unpushed or untested commit and records the commit it deployed (`DEPLOYED_COMMIT`; rollback in
  `v2/scripts/oracle/README.md`).

### Project Names (avoid confusion)

| Service | Name | Notes |
|---------|------|-------|
| GitHub repo | `perm` | See remote origin |
| Local folder | `perm-tracker/v2/` | All code lives in `v2/` |
| Oracle server | `ssh permtracker` | the site, the database (sqld), nginx, the timers |
| Cloudflare | `permtracker.app` zone | DNS, the tunnel `permtracker-oracle`, R2 backups, the mail Worker |
| Convex prod | See `.env.local` | `pnpm convex:deploy` from `v2/` |
| Convex dev | See `.env.local` | `npx convex dev` from `v2/` |

**Always run commands from `v2/` directory.** Claude is always launched from `v2/`.

---

## Standing decisions (the owner's; never re-ask)

Each was decided once and holds until the owner changes it. The reasons are in the notes (grep the words).

**Shipping and the server**
- Push to `main` once `pnpm check` passes; the site ships only in the 1 to 5 AM ET night run, `-f when=now` for an urgent fix; Convex deploys once GitHub's suite is green (Oct 8, Oct 18).
- The disk is 150 GB of Oracle's free 200 on purpose: the rest is room for a second free server (Sep 28). The server's Oracle identity holds `manage all-resources in tenancy` (Oct 13).
- Alarms are email only, never a phone push (Oct 10). The database RAM lock is retired (Oct 29).
- Limits are lax and broad, set from measurements: performance, experience and SEO first (Sep 29).
- The automatic defense acts at 5 people shown the busy page in 10 minutes, and a full app 3 minutes running still acts with nobody refused (Oct 3, Oct 5).
- Meta's AI crawler, Perplexity, ClaudeBot and Applebot read at 30 pages a minute; people's AI assistants have their own room at the front door (Oct 2 to Oct 22).
- Sign-in has no Cloudflare check; sign-up and password reset keep one (Oct 23).
- Cloudflare Web Analytics stays off; never ask again (Oct 25, Oct 26).
- Analytics: PostHog sends fewer events rather than paying (Nov 4): clicks and web vitals from one page load in four, no automatic field-change or form-submit events (Nov 5); click text is masked in the signed-in app (Oct 12).
- The chat stays on Gemini's free tier, as the Privacy Policy discloses, with OpenRouter as its last fallback (Oct 29, Nov 5).

**What the site says and shows**
- English only: translated pages answer 308 to their English pages (Oct 29, Oct 31). No DACA section (Oct 24).
- Estimates, the scorecard and grades are the owner's tools: never pitched or listed as something the site offers (Oct 25). The public scorecard page may be linked and kept current; the rivals' head-to-head stays private (Nov 4).
- `/compare` is the one page that names other trackers; everywhere else they're "a third party" (Oct 27).
- The company's legal name appears only where the law needs a party (the Terms, the Privacy Policy, the API terms, the Organization's `legalName`); everywhere else it's PERM Tracker (Oct 31).
- Official data stays available with caveats: a wage that can't be pay for its unit is shown as DOL printed it, with a note, and left out of every average (Oct 3).
- Every employer with filings gets an indexable page, the live-only and no-PERM ones too (Sep 17, Oct 3). Sponsor profiles are ranked part by part, never one score (Oct 4).
- A removal masks the name and keeps every row ("Law firm 1", a noindex neutral page); each request is the owner's decision (Nov 5, reversing Oct 17).
- The ETA 9089 expiration is certification + 179 (Sep 29). The PERM range is never wider than 60 days, and the newest measurement is always used, with no fallback on age (Oct 8).
- A case alert keeps watching for a year after DOL decides (Oct 7). The green card line prints years by default (Sep 26).
- The API and the MCP server are free: `PAYWALL_ENFORCED` stays unset until billing exists (Oct 8); exports count rows, 20,000 a day on Plus (Oct 10).
- The Chrome Web Store listing waits for the LLC's rename, EIN and bank account (Oct 5).
- Nothing is posted or replied to on X or elsewhere for the site without the owner's yes for that post (Oct 11).

**Email**
- Resend's free plan stays: sign-ups may use 70 of the 100 a day and alerts keep 15 above that (Oct 13); mail anyone can set off stops at 55 (Oct 10). `EMAIL_DAILY_LIMIT` above 100 puts every saving back (Oct 12).
- One alert email per person per day, with a status change always sent at once (Sep 26, Oct 7).
- The weekly case summary stays on Monday for every account and goes only in a week something changed; the sample case sends nothing (Oct 12).
- A box opened in an alert email saves its rating at once (Oct 12, Oct 24). A congratulations note goes two business days after a good decision, read by a person, one per address, never twice (Oct 22, Oct 23).
- Reviews are the site's own: the owner approves each, declining only spam and abuse; a review needs no name (Oct 23, Nov 2). Visitor reports on consulate pages post at once and are moderated after (Nov 5).
- A law firm's own words wait for the admin's review before they show (Oct 5).

**Look and feel**
- Lime is the action and the picked option, every time; blue is a light second accent for information, never a selected state (Oct 28).
- One status colour code everywhere: certified green, denied red, filed or waiting yellow, withdrawn purple (Oct 27).
- Pictures before words; a short looping clip beats a still where something happens (Oct 26, Oct 27). Article pictures: a relevant photo first, then something colourful, a pale screenshot last (Nov 2).
- Pages, not endless lists (Oct 21). Loading screens sweep (Oct 6). Summary cards say which way a figure moved and whether that's good (Nov 1).
- A moving drawing sits beside the text with no box, and each new one waits for the owner's yes; the sideways scroll stage is the attorney page's alone (Oct 21).
- `/press` and the firm's-site section stay as they were built (Oct 11). The homepage opens with the answer, and the header offers Sign in only (Oct 27).
- Sign-up is minimal: a heading, Google, email, an optional name, a password and one line of small print (Oct 26). Nobody is sent out of the app for their role (Oct 26).
- Phones with a notch run edge to edge; Chrome on iPhone's light side strips stay (Oct 24).
- The caution-tape banner and the hero's grain stay (Nov 4). A deleted account's reviews, support mail, contact messages and ratings are kept (Nov 4).

## Resources

- **Convex:** https://docs.convex.dev
- **DOL PERM:** https://flag.dol.gov/programs/perm
- **20 CFR 656.40:** https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-D/section-656.40
