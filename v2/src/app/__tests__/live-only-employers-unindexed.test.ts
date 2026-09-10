import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Employers known only to the live feed are findable, and NOT indexable.
 *
 * The feature they belong to says: if we hold information about something, a
 * person should be able to find it everywhere they would reasonably look. A
 * case is findable by number and that lookup names its employer, so the
 * employer had to become findable by name - 21,495 of them on 2026-08-30,
 * 23% of the 93,007 employers we hold (and 57% of the 37,813 the live feed
 * names), previously reachable only by knowing a case number.
 *
 * That argument is about PEOPLE and it does not extend to crawlers. 17,681 of
 * those employers hold exactly one case, so the page is a heading and one row
 * by construction. Twenty thousand of those is the scaled-thin-content shape
 * Google's own policy names, whatever we intended by it. Two mechanisms keep
 * them out of the index and this file pins the one that is easy to break
 * later; `not-found-status.test.ts` pins the other (`robots: index: false` on
 * the page itself).
 *
 * The mechanism here is structural rather than a flag: the sitemap is built
 * from `perm_entities`, and an employer is live-only precisely BECAUSE it has
 * no row there. So the gate is that the sitemap builder never learns to read
 * the live table. It cannot regress by accident; it can only regress by
 * someone adding the import.
 */

const ROOT = join(__dirname, "..", "..");

/**
 * One exported function's body, from its signature to the closing brace in
 * column 0.
 *
 * Needed because the obvious assertion does not work. A test here first read
 * `/getEntitySlugWindow[\s\S]*?MIN_TOTAL_FOR_PAGE/` over the whole file, and
 * `[\s\S]*?` happily runs PAST the end of that function into the next one
 * that mentions the same constant - `countPageworthy`, 300 lines later. So it
 * passed over a window whose floor had been replaced with a bare `1`, which
 * is precisely the drift it was written to catch. Probed: with the body
 * sliced out first, that mutation goes red.
 */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  if (start === -1) return "";
  const end = src.indexOf("\n}", start);
  return end === -1 ? src.slice(start) : src.slice(start, end + 2);
}

function source(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("the sitemap cannot reach the live-only employers", () => {
  it("never reads perm_live_recent, directly or through its module", () => {
    const sitemap = source("lib/sitemap/build.ts");

    // THE CONTROL. A sweep that cannot match reports everything clean, and a
    // path typo here would do exactly that - the file would read as empty and
    // both assertions below would pass over nothing. Assert something that
    // must be present in the same run.
    expect(sitemap).toContain("getEntitySlugWindow");
    expect(sitemap).toContain("countEntityRanks");

    expect(sitemap).not.toContain("perm_live_recent");
    expect(sitemap).not.toContain("liveEmployers");
  });

  it("advertises exactly the entities whose page is indexable", () => {
    // The live-only pages are a NEW class of URL that exists without a
    // perm_entities row. This is the pre-existing floor for the rows that DO
    // have one, and the change must not have loosened it: a sitemap that
    // advertises a page we withhold is a 404 in Google's index.
    //
    // THIS USED TO PIN `floor >= 3`, AND THAT ASSERTION IS GONE ON PURPOSE.
    // It was written to keep the crawlable surface small, because the ISR
    // bill was believed to be driven by crawls of the entity tail. Measured
    // again on 2026-09-10, it was not: builds were 66% of that bill and are
    // fixed, the crawler that mattered is answered by the firewall for 81
    // cents, and what remains scales with deploy count. The floor is 1 now,
    // by the owner's decision on evidence. A test that forbids the number the
    // owner chose is not a guard, it is a stale opinion with a red light.
    //
    // What survives is the invariant the number was standing in for, and it
    // holds at ANY floor: the sitemap and the page's own noindex must read the
    // SAME constant. If they ever diverge, one of them is wrong about every
    // entity in the gap - either we list URLs that render noindex (Google
    // calls that a crawl of pages we told it to ignore) or we withhold URLs
    // that are perfectly indexable.
    const sitemap = source("lib/sitemap/build.ts");
    const publicData = source("lib/turso/publicData.ts");
    const payload = source("lib/entityPayload.ts");

    // The sitemap's rows come from the window, and the window applies the
    // floor in SQL. Neither half is optional.
    expect(sitemap).toContain("getEntitySlugWindow(kind, chunk, SITEMAP_CHUNK)");
    const window = fnBody(publicData, "getEntitySlugWindow");
    expect(window).toContain("total >= ?");
    expect(window).toContain("MIN_TOTAL_FOR_PAGE");
    expect(window).not.toMatch(/total >= \?[\s\S]{0,80}?,\s*\d+\s*\]/);

    // And the page's noindex decision comes from the same constant, through
    // hasOwnPage, rather than from a second literal that could drift.
    expect(payload).toMatch(/hasOwnPage[\s\S]*?row\.total >= MIN_TOTAL_FOR_PAGE/);
    for (const kind of ["perm-employers", "perm-attorneys", "perm-wages"]) {
      expect(source(`app/(site)/(public)/${kind}/[slug]/page.tsx`)).toContain(
        "!hasOwnPage(row)",
      );
    }

    // The floor is still a real integer, so a botched edit cannot leave it
    // undefined and quietly make `total >= undefined` false for every row.
    const floor = Number(
      /MIN_TOTAL_FOR_PAGE\s*=\s*(\d+)/.exec(payload)?.[1],
    );
    expect(Number.isInteger(floor)).toBe(true);
    expect(floor).toBeGreaterThanOrEqual(1);
  });

  it("keeps the BULK dump's floor separate from the page floor", () => {
    // These were one constant until 2026-09-10 because they wanted the same
    // answer; at a page floor of 1 they stop wanting it. The bulk endpoint
    // hands its whole result to one caller in one response, and at the page
    // floor that is 69,204 employers rather than 9,176 - a payload the search
    // palette downloads, and a single-request copy of the compilation that §4
    // of the Terms tells other people not to take.
    const payload = source("lib/entityPayload.ts");
    const publicData = source("lib/turso/publicData.ts");

    const bulk = Number(/MIN_TOTAL_FOR_BULK\s*=\s*(\d+)/.exec(payload)?.[1]);
    const page = Number(/MIN_TOTAL_FOR_PAGE\s*=\s*(\d+)/.exec(payload)?.[1]);
    expect(Number.isInteger(bulk)).toBe(true);
    expect(bulk).toBeGreaterThanOrEqual(page);

    // The dump reads the bulk floor and the sitemap window reads the page
    // floor. Asserting the constants alone would pass over a getAllEntities
    // that had been quietly repointed at the page floor.
    const dump = fnBody(publicData, "getAllEntities");
    expect(dump).toContain("MIN_TOTAL_FOR_BULK");
    expect(dump).not.toContain("MIN_TOTAL_FOR_PAGE");
  });

});

describe("the search returns live-only employers as their own shape", () => {
  it("never packs one into a PackedRow", () => {
    // A PackedRow's fields after the name - rank, total, certified, denied,
    // median days, median wage - all come from DECIDED cases in the published
    // disclosure files, and for these employers that corpus is empty. Packed
    // as a row of zeros they would render as a real record of a company that
    // certified nothing, and rank #0 in a volume sort.
    const payload = source("lib/entityPayload.ts");
    expect(payload).toContain("interface LiveEmployerHit");
    expect(payload).toContain("live?: LiveEmployerHit[]");

    const route = source("app/api/perm-entities/[kind]/route.ts");
    expect(route).toContain("searchLiveOnlyEmployers");
    // Control, then the assertion: `rows` is mapped through packRow and
    // `live` is not, so the two lists cannot be confused downstream.
    expect(route).toContain("rows: found.map(packRow)");
    expect(route).not.toContain("live.map(packRow)");
  });

  it("searches the live feed for employers only", () => {
    // DOL's live endpoint returns no law-firm name (the firm is revealed at
    // publication) and no occupation, so for the other two kinds there is
    // genuinely nothing to search rather than nothing found. Searching them
    // anyway would spend a Turso read to return an empty list every time.
    const route = source("app/api/perm-entities/[kind]/route.ts");
    expect(route).toMatch(/kind === "employer"\s*\?\s*searchLiveOnlyEmployers/);
  });

  it("lets a caller skip the expensive half, which is what keeps the wider trigger free", () => {
    // The client now asks on EVERY settled query rather than only when its
    // downloaded slice came up empty, because whether the table filled says
    // nothing about whether an unpublished employer also matches. That would
    // be a cost regression if both halves ran every time: `searchByName` is a
    // LIKE the database serves by walking 71,512 employer rows, against an
    // indexed prefix range whose worst measured 2-char prefix touches 5,365.
    // `scope=live` is what keeps the expensive half on its original trigger.
    const route = source("app/api/perm-entities/[kind]/route.ts");
    expect(route).toContain('url.searchParams.get("scope") === "live"');
    expect(route).toMatch(/liveOnly \? Promise\.resolve\(\[\]\) : searchByName/);

    // A server-side control no client uses is dead code that reads as
    // protection - the same defect as the concurrency header whose only
    // caller never sent it. Assert the call site, not just the handler.
    expect(source("components/tools/EntityExplorer.tsx")).toContain(
      "onlyLive: localHasRows",
    );
    expect(source("lib/fetchEntities.ts")).toContain('"&scope=live"');
  });
});
