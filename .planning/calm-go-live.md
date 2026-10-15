# The middle-ground redesign: going live

Branch `calm/middle` (built on `calm/phase-1`). **Live since Thu Oct 15 2026, 6:04 PM EDT**
(owner's yes, 4:37 PM: "yes to all going live stuff immediately"). The record of each step
is below; what's left is under "After a week live" and "Still to do, last".

## Done ahead of time (changes nothing live)

- The full test suite passes on GitHub for the branch (dispatched per push: `test.yml`
  runs on main pushes and pull requests only).
- New database variable names beside the old ones, with identical values (compared by
  hash, never printed):
  - server: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `DATABASE_RW_AUTH_TOKEN` in
    `/srv/permtracker/app/env/production.env`; `DATABASE_URL`, `DATABASE_AUTH_TOKEN` in
    `uscis.env` (backups `*.bak-20261015-db-names`);
  - Convex production: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`.
  The live code reads only the `TURSO_*` names, so these sit unused until the merge.
- The retired Turso pointers are gone from the Convex dev deployment and commented out
  in `v2/.env.local` (backup `.env.local.bak-20261015`).

- nginx on the server already runs this branch's `scripts/oracle/nginx/permtracker.conf`
  (search engines may hold 12 requests at once, installed Oct 15 2026, 3:06 PM EDT with the
  owner's yes). `main` still says 6 until the merge: don't install the config from `main`
  before then.

## At go-live, in order (done Oct 15 2026)

1. Done, 5:54 PM EDT: `calm/middle` fast-forwarded to `main` (fe78aab2). Tests passed on
   main, the Oracle deploy switched at 6:04 PM, and its purge step dropped Cloudflare's
   copies of the changed pages.
2. Done, about 6:00 PM: `npx convex deploy -y` once main's suite was green (schema change
   was comments only; no index deleted).
3. Done, 5:58 PM: the USCIS runner reinstalled. It lives at `/usr/local/bin/permtracker-uscis`
   (not `/usr/local/sbin`, as these notes first said); the old copy is beside it as
   `.bak-20261015`. A run of the backtests job at 6:05 PM recorded its ok rows through
   `lib_db` and wrote `pwd_backtest` with `unit: "workday"`.
4. Done: `check_settings.py` on the server, every line PASS.
5. Waiting: Search Console re-crawl of the homepage and the busiest data pages, when the
   owner's Chrome is free (driving it needs the browser to itself).
6. Live checks after the switch: the new footer and the case promises on every page checked,
   phone widths 390 and 320 with no sideways scroll or small text. The employer pages'
   case-number links were 20px tall on a phone; fixed and pushed at 6:13 PM (7c0a2c4d).
7. The wage-request day moved to DOL's working days with the merge: the next PWD pass
   (5:40 AM) writes `pwd_day_queue` with `clock: "dol"`; until then the page reads the older
   count a day back.

## After a week live

- Remove the old `TURSO_*` names from the server env files and Convex production once
  nothing has logged a fallback.
- GitHub's secrets are still named `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; the
  workflows already pass them in as `DATABASE_*`. Renaming the secrets needs their
  values (GitHub never shows them), so it's re-entering two values, or leaving the
  names as they are.
- `TURSO_PLATFORM_TOKEN` (GitHub) served the retired Turso bill check and can be deleted.

## Still to do, last

- Redo the two homepage films (the transcript in `src/lib/constants/films.ts` changes
  with them: it still says "who files these cases").
- Drop the Storybook adapter patch once 10.6.2 clears the release floor (Oct 19 2026),
  if it carries the fix (`.planning/VERSION-DECISIONS.md`).
