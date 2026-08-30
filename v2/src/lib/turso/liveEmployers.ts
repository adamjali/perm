/**
 * Employers we know about from the LIVE feed and nowhere else.
 *
 * ## The incoherence this fixes
 *
 * `perm_entities` is built from DOL's quarterly disclosure files, so it only
 * ever holds employers with a DECIDED case in a PUBLISHED quarter.
 * `perm_live_recent` is the remainder - every case in our corpus the
 * published files do not hold - and it knows thousands of employers the
 * entity tables have never seen. Measured on production 2026-08-30:
 *
 *     employers named in perm_live_recent          37,813
 *     of those with no perm_entities row at all    21,495
 *
 * So a visitor could look a pending case up by number, read its employer's
 * name off the case page, type that name into the employer search, and be
 * told it does not exist. We hold the information; it simply was not
 * reachable from the place a person would look for it.
 *
 * ## What these employers can and cannot say, and why the split is absolute
 *
 * DOL's live endpoint returns case number, status, employer, job title and
 * submitted date. THAT IS THE WHOLE LIST. There is no wage, no law firm, no
 * worksite state, and - because the published files are the only source of a
 * decision date - no processing time. Every published statistic on an
 * ordinary employer page (approval rate, median days, median wage, rank,
 * percentile, the peer cohort) is computed from decided rows in the
 * disclosure corpus, and for these employers that corpus is EMPTY.
 *
 * A zero is not the answer. `certified: 0, denied: 0` renders as a real
 * record of a company with no certifications, and `rank: 0` would put a
 * live-only employer at the top of a volume sort. So this module returns its
 * own shapes rather than an `EntityRow` with the missing halves filled in,
 * and nothing here can be handed to a component that draws a rate.
 *
 * ## Reads
 *
 * Every query below rides `perm_live_recent_emp (employer_slug,
 * filing_date DESC)` or `perm_entities`' own (kind, slug) primary key.
 * Verified with EXPLAIN QUERY PLAN against production, because Turso reads
 * were BLOCKED in August by exactly one unindexed path on a page a crawler
 * can walk:
 *
 *   SEARCH perm_live_recent USING INDEX perm_live_recent_emp
 *          (employer_slug>? AND employer_slug<?)
 *   SEARCH perm_live_recent USING INDEX perm_live_recent_emp (employer_slug=?)
 *   SEARCH perm_entities USING COVERING INDEX
 *          sqlite_autoindex_perm_entities_1 (kind=? AND slug=?)
 *
 * ERRORS ARE NOT SWALLOWED, same as every sibling module. A `.catch(() => [])`
 * here would turn a Turso outage into "this employer does not exist", which
 * is the one wrong answer this file was written to stop giving.
 */
import "server-only";

import type { LiveEmployerHit } from "@/lib/entityPayload";
import { slugify } from "@/lib/entitySlug";

import { one, rows } from "./client";

export type { LiveEmployerHit };

export interface LiveStage {
  status: string;
  isFinal: boolean;
  n: number;
}

/** One live-only employer's whole record: everything we hold, and no more. */
export interface LiveEmployerRecord {
  slug: string;
  /** The commonest spelling DOL printed. See `modalNames` for why. */
  name: string;
  /** Every other spelling, commonest first. Usually empty; sometimes three. */
  otherNames: string[];
  cases: number;
  pending: number;
  firstFiling: string | null;
  lastFiling: string | null;
  /** DOL's own live statuses, biggest first. */
  stages: LiveStage[];
}

/** Slugs are ASCII lowercase and hyphens, so this bounds a prefix range. */
function slugPrefixRange(needle: string): [string, string] | null {
  if (needle.length < 2) return null;
  const last = needle.charCodeAt(needle.length - 1);
  // The successor of the final character. Slugs never contain a code point
  // this could overflow (a-z, 0-9, '-'), but guard anyway rather than build
  // an upper bound that sorts BELOW the lower one and silently matches
  // nothing - a search that returns zero looks exactly like a search that
  // found zero.
  if (last >= 0x10ffff) return null;
  return [needle, needle.slice(0, -1) + String.fromCharCode(last + 1)];
}

/**
 * The commonest printed spelling for each of a bounded set of slugs.
 *
 * A separate round trip on purpose. The obvious one-query version leans on
 * SQLite's bare-column rule (with exactly one min/max aggregate, bare columns
 * come from the row that produced it), which would hand back the name on the
 * NEWEST filing. Measured on `lgs-staffing-llc-f-k-a-labor-guys-llc`, one
 * slug carries four spellings that differ only in whitespace:
 *
 *     LGS Staffing LLC (f/k/a Labor Guys, LLC)      264
 *     LGS Staffing LLC (f/k/a Labor Guys,  LLC)      22
 *     LGS Staffing LLC (f/k/a Labor  Guys, LLC)       8
 *     LGS Staffing LLC (f/k/a Labor Guys,  LLC         1
 *
 * The newest filing could easily carry the one-row truncated typo, and the
 * search result would then name the employer differently from its own page.
 * MIN() is worse still: a leading double space sorts ahead of the real name.
 * The mode is the only choice here that is both deterministic and right.
 */
async function modalNames(slugs: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (slugs.length === 0) return out;
  const marks = slugs.map(() => "?").join(",");
  const found = await rows<{ employer_slug: string; employer_name: string | null; n: number }>(
    `SELECT employer_slug, employer_name, count(*) AS n FROM perm_live_recent
      WHERE employer_slug IN (${marks})
      GROUP BY employer_slug, employer_name`,
    slugs,
  );
  const by = new Map<string, { name: string; n: number }[]>();
  for (const r of found) {
    if (!r.employer_name) continue;
    const list = by.get(r.employer_slug) ?? [];
    list.push({ name: r.employer_name, n: Number(r.n) || 0 });
    by.set(r.employer_slug, list);
  }
  for (const [slug, list] of by) {
    // Count first, then the name, so ties resolve the same way every render
    // rather than however the b-tree happened to come back.
    list.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    out.set(slug, list.map((x) => x.name));
  }
  return out;
}

/** Which of these slugs already have a published entity row. */
async function publishedSlugs(slugs: string[]): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  const marks = slugs.map(() => "?").join(",");
  const found = await rows<{ slug: string }>(
    `SELECT slug FROM perm_entities WHERE kind = 'employer' AND slug IN (${marks})`,
    slugs,
  );
  return new Set(found.map((r) => r.slug));
}

/**
 * Employers matching a name, that exist ONLY in the live feed.
 *
 * ## This is a slug PREFIX, and the published search beside it is a substring
 *
 * `searchByName` matches `name LIKE '%needle%'`, which SQLite serves by
 * walking all 71,512 employer rows in rank order - measured plan: `SEARCH
 * perm_entities USING INDEX idx_pe_kind_rank (kind=?)`, i.e. the index gives
 * the ordering and the LIKE is applied to every row. That is affordable on a
 * table of that size and it is NOT affordable here: `perm_live_recent` is
 * ~137k rows and this runs on an endpoint a stranger can call.
 *
 * So the needle is slugified and matched as a half-open range on the indexed
 * `employer_slug`, exactly as `searchLiveCases` and the disclosure case
 * search already do. The consequence is real and the UI must say it: typing a
 * word from the MIDDLE of a name finds nothing here. "lorenz bus" reaches
 * LORENZ BUS SERVICE INC; "bus service" does not.
 *
 * ## Why the published-entity filter is a query and not a set difference
 *
 * The caller has the published results to hand, so subtracting those looks
 * free. It is wrong: the two searches match differently, so an employer WITH
 * a page can match the slug prefix while missing the name substring. Listing
 * it under a heading that says "no published statistics exist for these"
 * would be a false statement about a company whose page is one click away.
 * The set is at most `limit` slugs and the check is a covering index read.
 */
export async function searchLiveOnlyEmployers(
  text: string,
  limit = 25,
): Promise<LiveEmployerHit[]> {
  // Length cap FIRST: everything after it walks the string, and `text`
  // arrives from a stranger through /api/perm-entities/employer?q=.
  if (text.length > 120) return [];
  const range = slugPrefixRange(slugify(text.trim()));
  if (!range) return [];
  const take = Math.min(Math.max(1, Math.floor(limit)), 50);

  const found = await rows<{
    slug: string;
    cases: number;
    pending: number;
    latest: string | null;
  }>(
    `SELECT employer_slug AS slug, count(*) AS cases,
            SUM(CASE WHEN is_final = 0 THEN 1 ELSE 0 END) AS pending,
            MAX(filing_date) AS latest
       FROM perm_live_recent
      WHERE employer_slug >= ? AND employer_slug < ?
      GROUP BY employer_slug
      ORDER BY cases DESC, employer_slug
      LIMIT ?`,
    // One over, so the filter below cannot silently return fewer than asked
    // for merely because the top hit happened to be a published employer.
    [range[0], range[1], take + 1],
  );
  if (found.length === 0) return [];

  const slugs = found.map((r) => r.slug);
  const [published, names] = await Promise.all([
    publishedSlugs(slugs),
    modalNames(slugs),
  ]);

  const out: LiveEmployerHit[] = [];
  for (const r of found) {
    if (published.has(r.slug)) continue;
    const spellings = names.get(r.slug) ?? [];
    // No name means DOL returned a blank employer cell, which makes the row
    // unlabelable. Skipped rather than rendered as an empty link.
    const name = spellings[0];
    if (!name) continue;
    out.push({
      slug: r.slug,
      name,
      cases: Number(r.cases) || 0,
      pending: Number(r.pending) || 0,
      latestFiling: r.latest,
    });
    if (out.length >= take) break;
  }
  return out;
}

/**
 * Everything we hold about one employer from the live feed.
 *
 * The CALLER decides this employer has no published record - the employer
 * page resolves `perm_entities` first and only falls through on a miss - so
 * this does not re-check. Calling it for a published employer would return a
 * true but partial picture of that employer's newest filings, which is what
 * `recentLiveByEmployer` already renders as a band on their real page.
 */
export async function liveEmployerRecord(
  slug: string,
): Promise<LiveEmployerRecord | null> {
  // A slug longer than the writer can produce cannot name a row. `slugify`
  // truncates at 60; the cap is loose so a future widening does not silently
  // start 404ing valid pages.
  if (!slug || slug.length > 80) return null;

  const summary = await one<{
    cases: number;
    pending: number;
    first_filing: string | null;
    last_filing: string | null;
  }>(
    `SELECT count(*) AS cases,
            SUM(CASE WHEN is_final = 0 THEN 1 ELSE 0 END) AS pending,
            MIN(filing_date) AS first_filing,
            MAX(filing_date) AS last_filing
       FROM perm_live_recent WHERE employer_slug = ?`,
    [slug],
  );
  // An aggregate over no rows still returns ONE row, with count 0. Testing
  // for `summary` alone would hand every junk slug a page.
  const cases = Number(summary?.cases ?? 0);
  if (cases <= 0) return null;

  const [stageRows, names] = await Promise.all([
    rows<{ status: string | null; is_final: number; n: number }>(
      `SELECT status, is_final, count(*) AS n FROM perm_live_recent
        WHERE employer_slug = ? GROUP BY status, is_final ORDER BY n DESC`,
      [slug],
    ),
    modalNames([slug]),
  ]);

  const spellings = names.get(slug) ?? [];
  const name = spellings[0];
  if (!name) return null;

  return {
    slug,
    name,
    otherNames: spellings.slice(1),
    cases,
    pending: Number(summary?.pending ?? 0),
    firstFiling: summary?.first_filing ?? null,
    lastFiling: summary?.last_filing ?? null,
    stages: stageRows
      .filter((r): r is { status: string; is_final: number; n: number } => Boolean(r.status))
      .map((r) => ({
        status: r.status.trim().toUpperCase().replace(/\s+/g, " "),
        isFinal: Number(r.is_final) === 1,
        n: Number(r.n) || 0,
      })),
  };
}
