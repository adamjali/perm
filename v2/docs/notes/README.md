# PERM Tracker notes

Everything learned building and running PERM Tracker: what broke, what was measured, what the owner decided and why.
Until Nov 7 2026 all of it sat in the two CLAUDE.md files, which every Claude Code session loads; by then they had
reached 972 KB and crowded out the work. It moved here word for word, one file per area, so a session reads only the
part it needs.

## How to use it

- **Before working in an area, grep this folder** for the file, table, route, function or word you're about to touch:
  `grep -rn "sendOrQueue" v2/docs/notes/`. Every lesson names what it's about, so the search finds it.
- **A pointer that says "see v2/CLAUDE.md, section X"** (in code comments, `.planning/`, memory) means the section
  headed X in one of these files: `grep -rn "^## X" v2/docs/notes/`.
- The standing decisions and the rules every change follows stay in the two CLAUDE.md files, one line each.

## The files

| file | what it holds |
|---|---|
| [data.md](data.md) | DOL, USCIS and State sources, every ingest, the corpus tables, employer identity, WARN, the policy feed |
| [estimates.md](estimates.md) | how each estimate dates a case, the backtests, the scorecard |
| [ops.md](ops.md) | the Oracle server, nginx and Cloudflare, the firewall and the defense, deploys, monitoring, the database's speed, costs |
| [site.md](site.md) | public pages: glued text, iPhone layout, motion and loading, the header and data rail, charts, pictures, articles |
| [seo.md](seo.md) | the sitemap, IndexNow, Search Console, titles, structured data, robots.txt |
| [email.md](email.md) | Resend's budgets, every alert kind, preference links, the digest, ratings and reviews, the spam check |
| [app.md](app.md) | the signed-in app, deadlines, the calendar, the chat, the API, MCP, webhooks, the extension |
| [testing.md](testing.md) | vitest and CI traps, the gates, dependency upgrades, the dev server, captures |
| [business.md](business.md) | security audits, licensing, the legal name, rival trackers |
| [timeline.md](timeline.md) | a short entry per day of work, newest at the end |

## Adding to it

- A lesson goes at the end of the file for its area under a dated heading: `## Nov 7 2026: <what happened>`. Say what
  broke or was measured, the numbers, the fix, and the file or test that holds it now.
- One short entry for the day goes at the end of `timeline.md`.
- A rule every change must follow also gets one line in `v2/CLAUDE.md` ("Rules every change follows"); a standing
  decision of the owner's gets one line in the root `CLAUDE.md` ("Standing decisions"). Nothing else goes in either:
  `v2/scripts/test_instruction_size.py` fails CI when they grow past their limits.
- This repository is public: no secrets, no personal details, no names of people outside the team.
