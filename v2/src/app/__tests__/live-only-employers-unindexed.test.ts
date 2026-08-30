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
    expect(sitemap).toContain("fetchAllEntitiesServer");
    expect(sitemap).toContain("hasOwnPage");

    expect(sitemap).not.toContain("perm_live_recent");
    expect(sitemap).not.toContain("liveEmployers");
  });

  it("still filters entity URLs to those that have a page at all", () => {
    // The live-only pages are a NEW class of URL that exists without a
    // perm_entities row. This is the pre-existing floor for the rows that DO
    // have one, and the change must not have loosened it: a sitemap that
    // advertises a page we withhold is a 404 in Google's index.
    const sitemap = source("lib/sitemap/build.ts");
    expect(sitemap).toContain("rows.filter(hasOwnPage)");
    expect(source("lib/entityPayload.ts")).toContain("MIN_TOTAL_FOR_PAGE = 3");
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
