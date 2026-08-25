# Session state, 2026-08-25

Written so nothing is lost. Everything below is measured, not remembered.

## RESOLVED SINCE THE FIRST DRAFT: the public data surface moved to Turso

Convex is STILL disabled (reads and writes both; `permCases:getMeta` returns
"You have exceeded the free plan limits"), so the table could not be dropped
to recover. Instead the whole PUBLIC data surface moved to Turso, which fixes
the public site without waiting on a billing decision and means a
data-volume problem can never take it down again.

**Turso, account `adamjali`, db `permtracker-public-data`, AWS us-east-1**
(same region as Vercel's iad1). Free tier: 5 GB. Credentials in
`v2/.env.local` (gitignored, never committed).

| table | rows |
|---|---|
| perm_cases | 373,939 |
| perm_entities | 21,178 (ALL - no top-250 cap) |
| perm_wage_stats | 2,190 |
| perm_docs | 3 |
| visa_bulletins | 10 |
| processing_times | 1 (permAsOf 2026-08-20, fetched live) |

219 MB = **4.3% of the free tier**. Zero table scans across 5 browse probes.
For contrast this one table would be 43% of Convex's entire 512 MB.

**What is STILL on Convex, correctly:** accounts, user-tracked cases, chat,
notifications, audit logs, admin. The authenticated app is still down until
the billing question is settled.

### The billing question, still open
1. **Convex Pro, $25/mo** - authenticated app returns immediately.
2. **Stay free**: with the public data gone, dropping `permCases` +
   `permWageStats` would put the deployment back under 512 MB permanently -
   but dropping needs WRITES, which are disabled. Would need Convex support
   to re-enable briefly. Drafting that request is a reasonable next step.
3. The public site does not need either: it is on Turso now.

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

0. **Vercel Fluid Active CPU hit 77% (3h4m/4h)** on the Jul26-Aug25 cycle.
   Cause was hourly ISR on quarterly data across the newly-unhidden 21,178
   entity pages. Retuned to 86400s (21600s for processing-times) and
   committed. Re-check next cycle; if still climbing, move to on-demand
   revalidation from the ingest.

1. **Preloader: FOUR causes found, all fixed, NOT yet verified on device.**
   (a) the cover rule + its colour lived in globals.css, an external
   stylesheet, and WebKit paints before a pending stylesheet - so the header
   painted before the cover existed. Now inlined in <head> above the script.
   (b) a sessionStorage flag made it appear only once per session.
   (c) soft navigation never re-ran the <head> script - HomeCurtainNav now
   arms it on link click. (d) THE "LOADS FOREVER" ONE: the hide rule was
   `[data-pre="off"]`, which does not match an ABSENT attribute, and the
   boot script returns early on every route except "/". So a soft nav to /
   from /blog rendered .pre with nothing able to dismiss it. Now
   `:not([data-pre="on"])`, which fails safe.

2. **Icon migration DONE** - lucide-react removed from package.json, 0 files
   importing it, 164 on Phosphor, and correctly removed from
   optimizePackageImports (which has caused prod-only ReferenceErrors here).

3. **Remaining Convex calls on public pages** (agent `turso-queries` is on
   these): permCases.getMeta, permEntities.{getBySlug, fieldDistribution,
   comparables, listByKind}. src/lib/turso/{cases,entities}.ts written.

4. **Preloader still not verified on a real device.** Must be the absolute first thing
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
