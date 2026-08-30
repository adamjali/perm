import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BROWSE_BUCKETS,
  BROWSE_OTHER,
  bucketOf,
  type BrowseBucket,
} from "@/lib/entityBrowse";
import { MIN_TOTAL_FOR_PAGE, hasOwnPage } from "@/lib/entityPayload";
import type { BrowseEntry } from "@/lib/turso/entityBrowse";

import { BrowseIndexGrid, BrowseList, BrowseStrip } from "../EntityBrowse";

/**
 * The A-Z modules exist to put real anchors in server-rendered HTML.
 *
 * That is the whole claim, so it is the thing asserted: `/perm-employers`
 * served 54 crawlable `<a href="/perm-employers/...">` links against 16,309
 * employer pages, because the ranked table is a client component that fetches
 * and filters in the browser. A strip of letters that rendered as buttons, or
 * a list that lazily hydrated, would look identical to a reader and change
 * nothing at all for the crawler this was built for.
 */

const BASE = "/perm-employers";

/** A corpus spanning every bucket, including entities below the page floor. */
function corpus(): Array<{ slug: string; name: string; total: number; rank: number }> {
  const out: Array<{ slug: string; name: string; total: number; rank: number }> = [];
  let rank = 1;
  for (const b of BROWSE_BUCKETS) {
    const lead = b === BROWSE_OTHER ? "7" : b;
    for (let i = 0; i < 3; i += 1) {
      out.push({
        slug: `${lead}-firm-${i}`,
        name: `${lead.toUpperCase()} Firm ${i}`,
        // One in three sits below the floor, so a naive "link everything"
        // implementation would be caught rather than flattered.
        total: i === 0 ? MIN_TOTAL_FOR_PAGE - 1 : MIN_TOTAL_FOR_PAGE + i,
        rank: rank++,
      });
    }
  }
  return out;
}

function counts(pageworthy: BrowseEntry[]): Record<BrowseBucket, number> {
  const out = Object.fromEntries(BROWSE_BUCKETS.map((b) => [b, 0])) as Record<
    BrowseBucket,
    number
  >;
  for (const e of pageworthy) out[bucketOf(e.slug)] += 1;
  return out;
}

describe("BrowseList", () => {
  it("renders one real anchor per entity, with its filing count beside it", () => {
    const entries: BrowseEntry[] = [
      { slug: "acme-inc", name: "ACME INC", total: 1605, rank: 1 },
      { slug: "apex-llc", name: "APEX LLC", total: 12, rank: 2 },
    ];
    render(<BrowseList base={BASE} entries={entries} unit="filings" />);

    const acme = screen.getByRole("link", { name: "ACME INC" });
    expect(acme).toHaveAttribute("href", "/perm-employers/acme-inc");
    expect(screen.getByRole("link", { name: "APEX LLC" })).toHaveAttribute(
      "href",
      "/perm-employers/apex-llc",
    );
    // The count is what makes this an index rather than a wall of links: it is
    // the fact a reader uses to decide whether a row is worth opening.
    expect(screen.getByText("1,605")).toBeInTheDocument();
  });

  it("separates adjacent list items, so extractors do not read one word", () => {
    // React renders array items with NOTHING between them, so two names glue
    // for anything that walks the DOM - Google has reproduced that verbatim in
    // a listing for a sibling site. The separator has to be part of each
    // iteration, and this list is the highest-count instance in the codebase.
    const { container } = render(
      <BrowseList
        base={BASE}
        entries={[
          { slug: "alpha", name: "ALPHA", total: 5, rank: 1 },
          { slug: "beta", name: "BETA", total: 4, rank: 2 },
        ]}
        unit="filings"
      />,
    );
    expect(container.textContent).not.toContain("ALPHA5");
    expect(container.textContent).not.toMatch(/5BETA/);
  });
});

describe("the union of every letter page", () => {
  it("covers every pageworthy entity exactly once, and links nothing below the floor", () => {
    const all = corpus();
    const pageworthy = all.filter(hasOwnPage);
    expect(pageworthy.length).toBeGreaterThan(50);

    // Each bucket rendered exactly as a letter page renders it: the rows the
    // query would return for that bucket, filtered by the shared threshold.
    const linked: string[] = [];
    for (const bucket of BROWSE_BUCKETS) {
      const entries = pageworthy.filter((e) => bucketOf(e.slug) === bucket);
      const { container, unmount } = render(
        <BrowseList base={BASE} entries={entries} unit="filings" />,
      );
      for (const a of container.querySelectorAll("a[href]")) {
        linked.push(a.getAttribute("href")!);
      }
      unmount();
    }

    const expected = pageworthy.map((e) => `${BASE}/${e.slug}`).sort();
    expect([...linked].sort()).toEqual(expected);
    // No duplicates: an entity listed under two letters would be the partition
    // overlapping, and a crawler seeing one canonical page from two parents.
    expect(new Set(linked).size).toBe(linked.length);
    // And nothing below the floor, which has no page to link to.
    for (const e of all.filter((x) => !hasOwnPage(x))) {
      expect(linked).not.toContain(`${BASE}/${e.slug}`);
    }
  });
});

describe("BrowseStrip", () => {
  it("links every non-empty bucket, so any letter reaches all the others", () => {
    const pageworthy = corpus().filter(hasOwnPage);
    render(<BrowseStrip base={BASE} counts={counts(pageworthy)} active="s" />);

    const nav = screen.getByRole("navigation", { name: /first letter/i });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(27);
    expect(links.map((a) => a.getAttribute("href"))).toContain(
      "/perm-employers/browse/0-9",
    );
    expect(within(nav).getByRole("link", { name: "S" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does NOT link a bucket with nothing in it", () => {
    // Three occupation letters are genuinely empty. Linking a page that says
    // "nothing here" is the thin-page pattern this surface works to avoid, and
    // the sitemap omits the same buckets, so the two halves have to agree.
    const empty = counts([]);
    const { container } = render(<BrowseStrip base={BASE} counts={{ ...empty, a: 4 }} />);
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["/perm-employers/browse/a"]);
    // Still SHOWN, just inert: a letter vanishing from the strip is
    // indistinguishable from a query that failed.
    expect(screen.getByText("Z")).toBeInTheDocument();
  });
});

describe("BrowseIndexGrid", () => {
  it("gives each letter its own count, which is the page's actual content", () => {
    const pageworthy = corpus().filter(hasOwnPage);
    render(
      <BrowseIndexGrid base={BASE} counts={counts(pageworthy)} plural="employers" />,
    );
    const a = screen.getByRole("link", { name: /^A/ });
    expect(a).toHaveAttribute("href", "/perm-employers/browse/a");
    expect(a.textContent).toContain("2 employers");
  });
});
