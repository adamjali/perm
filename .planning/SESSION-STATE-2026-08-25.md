# Session state, 2026-08-25

Written so nothing is lost. Everything below is measured, not remembered.

## THE BLOCKER (needs Adam)

**Convex free plan exceeded; the deployment is DISABLED.** Every read and
every write returns `You have exceeded the free plan limits`. Production data
pages serve their empty states. I cannot shed data to recover because writes
are off too.

- Convex free/Starter: **0.5 GB database storage**, 1 GB I/O, 1M function calls.
- Convex Pro: **$25 per developer/month**, 50 GB storage, 25M calls.
- Cause: 373,939 `permCases` rows with 7 regular + 2 full-text indexes, plus
  21,178 entities and a third search index added on 2026-08-25.
- Our case payload measures **125 MB uncompressed / 14 MB gzipped**; in SQLite
  with indexes, budget ~250 MB.

### Options
1. **Convex Pro, $25/mo.** Everything returns immediately, nothing lost.
2. **Move only `permCases` (+ `permWageStats`) off Convex**, keep aggregates,
   entities, bulletins and processing times there (they fit free comfortably).
   Recommended target: **Turso** (see below).
3. **Drop the case browser**, revert to aggregates only. Free, loses the
   feature that closed the biggest gap to permtrack.

### Storage comparison, fetched 2026-08-25 (not from memory)
| | Free storage | Notes |
|---|---|---|
| **Turso** | **5 GB**, 500M row reads/mo, 10M writes/mo, 100 DBs | SQLite/libSQL. FTS5 full-text built in. `@libsql/client` speaks HTTP straight from a Vercel function, no Worker needed. Next tier $4.99/mo for 9 GB. |
| Cloudflare D1 | **500 MB** (paid 10 GB) | Same ceiling we just hit. Also needs a Worker in front; the REST API is not for app traffic. |
| Cloudflare R2 | 10 GB, no egress fees | Object storage, not queryable. Right for the raw XLSX archive, wrong for a case browser. |
| Neon / Supabase | 0.5 GB | Same ceiling. |

**Recommendation: Turso.** Our ~250 MB is 5% of its free tier, it is SQLite so
the case browser's filters and name search map directly onto indexes and FTS5,
and it needs no extra infrastructure between Vercel and the data.

**What Adam needs to do:** create the account and hand over
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Everything after that is mine.

## DONE AND DEPLOYED

- **373,939 cases** ingested (FY2024+FY2025+FY2026, all four DOL files, the
  FY2024 old-form/new-form pair not split). Beats permtrack's 321,725 on
  coverage AND is three months fresher.
- Entity pages read the entity table, not the 250-row aggregate: search,
  state and job-family filters, sort, paging, CSV.
- Sitemap 794 -> 21,224 URLs.
- Glued text 1,006 -> 0. Em-dashes in prose 21 -> 0.
- `llms.txt` rebuilt with every data page plus dated live figures.
- Contractions: 268 replacements, 78 files. Lint 160 errors -> 2.
- `/perm-cases` crash fixed (`useQuery` on a public route with no provider).
- Entity floor 3 -> 1 in code (79% of employers were unstored) + a Convex
  name search index. NOT YET POPULATED: needs a re-ingest, which needs Convex.
- Preloader: dismisses on any interaction/navigation, cap 1800 -> 1200ms.
- Header flash: two of three causes fixed (ThemeToggle shape swap at
  hydration; `(auth)` reserving 80px vs `(public)` 64px).
- WaitLedger sizes rows from a fixed 330px budget, so the hero fits a screen
  and does not grow a row each time DOL publishes.
- Murmuration 3 -> 6 flocks.
- Invalid HTML: `{" "}` between `<td>` is a text node inside `<tr>`; 44 of
  them across 7 files, all moved inside the cells. Gated.
- Changelog tags on three untagged entries. Gated.

## OPEN

1. **Preloader still not right per Adam.** Must be the absolute first thing
   for every entry path: typed URL, click from another page, cross-group
   navigation. Currently a skeleton/blank-with-header shows instead. NEEDS
   RESEARCH (Next.js App Router first-paint ordering).
2. **Icon migration**: lucide-react -> Phosphor. 164 files. `lucide-react` is
   pinned in `optimizePackageImports`, which has caused production-only
   `ReferenceError`s here. Adam has authorised it.
3. **Header flash, third cause**: `(public)` and `(auth)` mount separate
   `AuthHeader` instances and `(auth)` has no loading boundary, so the old
   header stays painted through the RSC round-trip. Fix is to hoist the
   header and add `(auth)/loading.tsx`.
4. **`border-black` in 36 files** breaks dark mode (`--shadow-hard` flips,
   the literal border does not). Needs judgement per case: correct on a lime
   surface, wrong on `bg-card`.
5. **3 failing test files** (full suite: 4,928 passed, 1 failed, 3 files
   errored):
   - `src/app/(auth)/__tests__/metadata.test.ts` (collection error)
   - `src/app/(public)/changelog/__tests__/page.test.tsx` (collection error)
   - `src/hooks/__tests__/useToolOrchestrator.test.ts` -> "initializes with
     empty confirmations map"
6. Duplicate content-card images (three blog cards share one green marble).
7. Authenticated app: the rest of the P1/P2 craft list.

## TRAPS LEARNED TODAY (do not re-derive)

- `tsconfig` deliberately includes `.next/dev/types/**`. A dev server killed
  mid-write leaves them truncated, typecheck goes red on generated code
  nobody wrote, and the pre-push hook rejects. `rm -rf .next/dev`.
- The editor's LSP diagnostics lag badly and reported ~30 phantom errors for
  files that do not exist. `pnpm typecheck` is authoritative.
- Inserting an ASCII `'` into a single-quoted JS string terminates it. Use
  U+2019, which also does not trip `react/no-unescaped-entities`.
- travel.state.gov has refused the Internet Archive crawler since mid-July
  2026, so the visa bulletin lag will not self-resolve.
- www.dol.gov 403s this laptop after sustained traffic but serves CI fine.
  Run the ingest via `gh workflow run perm-disclosure-ingest.yml`.
