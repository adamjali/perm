# The middle-ground redesign: going live

Branch `calm/middle` (built on `calm/phase-1`). Nothing here is live. Every step below
changes production and waits for the owner's yes, one at a time.

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

## At go-live, in order

1. Merge `calm/middle` to `main`. The site deploys once CI passes on main.
2. Deploy Convex (`npx convex deploy -y` from `v2/`) once that suite is green: emails,
   notification copy and chat changes live under `convex/`.
3. Reinstall `/usr/local/sbin/permtracker-uscis` from `v2/scripts/oracle/bin/` the same
   day: the installed copy imports `lib_turso`, which the branch renamed to `lib_db`.
4. Drop Cloudflare's cached pages for the changed routes (the deploy's purge step does
   this when `CF_PURGE_TOKEN` is set).
5. Ask Search Console to re-crawl the homepage and the busiest data pages.

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
