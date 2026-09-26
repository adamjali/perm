import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PostSummary, ContentType } from "@/lib/content/types";

// Mock the content layer so we control which "posts" the sitemap sees without
// touching the filesystem MDX reader. The sitemap delegates everything to
// getAllPosts() so this is the only seam we need.
vi.mock("@/lib/content", () => ({
  getAllPosts: vi.fn(),
}));

// Mock sentry so the zero-posts captureError doesn't try to network out.
vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

// The sitemap reads DOL's own as-of date for /perm-processing-times, so the
// lastmod moves when DOL publishes rather than when an unrelated blog post
// ships. Mocked so the sitemap stays a pure function of its inputs; the
// data-unreachable paths are asserted explicitly below.
//
// These seams moved from Convex to Turso on 2026-08-25. They are mocked at
// the MODULE the sitemap imports rather than at the database client, because
// that is the boundary the sitemap actually depends on.
vi.mock("@/lib/turso/processingTimes", () => ({
  getProcessingTimes: vi.fn(async () => ({ permAsOf: "2026-08-20" })),
}));
vi.mock("@/lib/turso/publicData", () => ({
  getDisclosureStats: vi.fn(async () => null),
  // Drives how many child sitemaps the index lists.
  countEntityRanks: vi.fn(async (kind: string) =>
    kind === "employer" ? 600 : 200,
  ),
  // ONE chunk's slugs. The builder stopped fetching a whole kind and slicing
  // in JS on 2026-09-10 (fourteen employer chunks meant fourteen full-table
  // reads a day), so the seam this file mocks moved with it.
  getEntitySlugWindow: vi.fn(),
  countPageworthy: vi.fn(async () => 0),
  // The live-only employer family. Zero by default so the older expectations
  // hold; the family test below arranges a corpus.
  countLiveOnlyRanks: vi.fn(async () => 0),
  getLiveOnlySlugWindow: vi.fn(async () => []),
  // DELIBERATELY a different date from the processing-times mock above. Entity
  // URLs must stamp from the quarterly DISCLOSURE corpus, not from DOL's
  // daily-moving processing-times figure, and two identical dates would let
  // that regression pass unnoticed.
  getFreshness: vi.fn(async () => ({
    "perm-cases": { asOf: "2026-06-30" },
  })),
  // One archived bulletin, so the `/visa-bulletin/<month>` family has a URL
  // for the coverage test below to find.
  // One category, so the category-by-country family has URLs to list.
  getVisaBulletins: vi.fn(async () => [
    { bulletinMonth: "2026-09", finalAction: { EB2: { india: "2014-01-01" } }, datesForFiling: {} },
  ]),
}));
// The `/perm-queue/<month>` pages are listed from the same census the hub
// builds its month strip from and the month route peeks before rendering.
// Mocked at that module; `beforeEach` arranges a census with one EMPTY month,
// because the route 404s an empty month and the sitemap must omit it.
vi.mock("@/lib/turso/backlog", () => ({
  getBacklogCensus: vi.fn(),
}));
vi.mock("@/lib/turso/sweepCoverage", () => ({
  getSweepCoverage: vi.fn(async () => ({ finishedOn: "2026-09-15" })),
}));
// The A-Z letter pages are listed from the same per-bucket counts the pages
// themselves render, so a letter with nothing in it is omitted here and
// noindexed there. Mocked at that module rather than at the database client,
// for the same reason as the seams above.
vi.mock("@/lib/turso/entityBrowse", () => ({
  browseCounts: vi.fn(),
}));

/** Per-bucket counts with `empty` at zero and every other bucket populated. */
function bucketCounts(empty: string[] = []): Record<BrowseBucket, number> {
  return Object.fromEntries(
    BROWSE_BUCKETS.map((b) => [b, empty.includes(b) ? 0 : 10]),
  ) as Record<BrowseBucket, number>;
}

/**
 * A corpus of `sizes[kind]` ranked entities, served the way Turso serves it:
 * `countEntityRanks` answers the size and `getEntitySlugWindow` answers one
 * rank window. Arranging BOTH from one object is the point - a fixture where
 * the count and the windows disagree would let a builder that emits the wrong
 * number of chunks, or drops the last one, pass.
 */
function arrangeEntities(sizes: Record<string, number>) {
  const size = (kind: string) => sizes[kind] ?? 0;
  vi.mocked(countEntityRanks).mockImplementation(async (kind: string) =>
    size(kind),
  );
  vi.mocked(getEntitySlugWindow).mockImplementation(
    async (kind: string, chunk: number, per: number) => {
      const lo = chunk * per;
      const hi = Math.min(lo + per, size(kind));
      return Array.from({ length: Math.max(0, hi - lo) }, (_, i) =>
        `${kind}-${lo + i + 1}`,
      );
    },
  );
}

import { getAllPosts } from "@/lib/content";
import { captureError } from "@/lib/sentry";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { countEntityRanks, countLiveOnlyRanks, getEntitySlugWindow, getLiveOnlySlugWindow } from "@/lib/turso/publicData";
import { browseCounts } from "@/lib/turso/entityBrowse";
import { getBacklogCensus } from "@/lib/turso/backlog";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BROWSE_BUCKETS, type BrowseBucket } from "@/lib/entityBrowse";
import {
  childNames,
  entityEntries,
  indexXml,
  liveEmployerEntries,
  pagesEntries,
  parseChildName,
  SITEMAP_CHUNK,
  urlsetXml,
} from "@/lib/sitemap/build";
import { revalidate } from "../sitemap.xml/route";

/** The whole sitemap as one flat list, which is what the old tests asserted. */
async function sitemap() {
  const names = await childNames();
  const out = [];
  for (const n of names) {
    if (n === "pages") { out.push(...(await pagesEntries())); continue; }
    const parsed = parseChildName(n)!;
    out.push(...(await entityEntries(parsed.kind, parsed.chunk)));
  }
  return out.map((e) => ({ url: e.url, lastModified: e.lastModified }));
}

/** A backlog census whose months carry the given totals; everything else empty. */
function queueCensus(months: [string, number][]) {
  return {
    statuses: [],
    pending: 0,
    decided: 0,
    total: months.reduce((a, [, n]) => a + n, 0),
    months: months.map(([month, total]) => ({
      month,
      total,
      pending: total,
      decided: 0,
      statuses: [],
    })),
  } as never;
}

function mkPost(
  slug: string,
  type: ContentType,
  date: string,
  updated?: string,
): PostSummary {
  return {
    slug,
    type,
    meta: {
      title: `${type} ${slug}`,
      description: "desc",
      date,
      ...(updated ? { updated } : {}),
      author: "PERM Tracker",
      tags: [],
      readingTime: "1 min read",
      published: true,
    },
  };
}

describe("sitemap.ts", () => {
  beforeEach(() => {
    // A healthy default. Below 500 total the sitemap now THROWS rather than
    // emit a truncated file, so every test that is not about that guard has
    // to start from a corpus that clears it.
    arrangeEntities({ employer: 600, attorney: 200, occupation: 200 });
    vi.mocked(getProcessingTimes).mockResolvedValue({
      permAsOf: "2026-08-20",
    } as never);
    vi.mocked(browseCounts).mockResolvedValue(bucketCounts());
    vi.mocked(getBacklogCensus).mockResolvedValue(queueCensus([
      ["2025-11", 5],
      ["2025-12", 3],
      ["2026-09", 0],
    ]));
    vi.clearAllMocks();
    // EVERY TEST ARRANGES ITS OWN LIVE-ONLY STATE. `vi.clearAllMocks()` clears
    // CALLS and keeps IMPLEMENTATIONS, so the 12,000-row arrangement in the
    // live-only test leaked into whatever ran next. In source order the count
    // and the window mock stayed a matched pair; under CI's `sequence.shuffle`
    // they came apart, a child got emitted for a window that returned nothing,
    // and the "0 rows" guard threw. CI was red from 2026-09-17 to 09-19 while
    // every local run passed. Reset both to the safe default here and let the
    // tests that care opt in.
    vi.mocked(countLiveOnlyRanks).mockResolvedValue(0);
    vi.mocked(getLiveOnlySlugWindow).mockResolvedValue([]);
  });

  it("lists every /perm-queue month holding a case, from the census, and OMITS an empty month (that page 404s)", async () => {
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const entries = await sitemap();
    const byUrl = new Map(entries.map((e) => [e.url, e.lastModified]));
    expect(byUrl.get("https://permtracker.app/perm-queue/2025-11")).toBe("2026-09-15");
    expect(byUrl.get("https://permtracker.app/perm-queue/2025-12")).toBe("2026-09-15");
    expect(byUrl.has("https://permtracker.app/perm-queue/2026-09")).toBe(false);
    // The hub is still there beside its children.
    expect(byUrl.has("https://permtracker.app/perm-queue")).toBe(true);
  });

  it("still builds, without month URLs, when the census read fails: a missing family is not a reason to lose the sitemap", async () => {
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    vi.mocked(getBacklogCensus).mockRejectedValue(new Error("turso down"));
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://permtracker.app/perm-queue");
    expect(urls.filter((u) => u.startsWith("https://permtracker.app/perm-queue/"))).toEqual([]);
  });

  it("lists the live-only employers as their own child family, partitioned exactly by rank window", async () => {
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const size = 12_000;
    vi.mocked(countLiveOnlyRanks).mockResolvedValue(size);
    vi.mocked(getLiveOnlySlugWindow).mockImplementation(async (chunk: number, per: number) => {
      const lo = chunk * per;
      const hi = Math.min(lo + per, size);
      // Every third row has no date yet, so the fallback path is exercised
      // beside the per-page one.
      return Array.from({ length: Math.max(0, hi - lo) }, (_, i) => ({
        slug: `live-${lo + i + 1}`,
        lastChanged: (lo + i) % 3 === 2 ? null : `2026-08-${String(10 + ((lo + i) % 15)).padStart(2, "0")}`,
      }));
    });
    const names = await childNames();
    expect(names.filter((n) => n.startsWith("live-employer-"))).toEqual([
      "live-employer-1", "live-employer-2", "live-employer-3",
    ]);
    expect(parseChildName("live-employer-2")).toEqual({ kind: "live-employer", chunk: 1 });
    const all: string[] = [];
    for (const c of [0, 1, 2]) all.push(...(await liveEmployerEntries(c)).map((e) => e.url));
    expect(all).toHaveLength(size);
    expect(new Set(all).size).toBe(size);
    expect(all[0]).toBe("https://permtracker.app/perm-employers/live-1");
    expect(all[size - 1]).toBe("https://permtracker.app/perm-employers/live-12000");
    // LASTMOD IS PER PAGE: each URL carries the day that employer's page last
    // changed, and only an undated row falls back to the sweep's finish date.
    // It used to be the sweep date on every URL, a nightly timestamp.
    const first = await liveEmployerEntries(0);
    expect(first[0]!.lastModified).toBe("2026-08-10");
    expect(first[1]!.lastModified).toBe("2026-08-11");
    expect(first[2]!.lastModified).toBe("2026-09-15");
    expect(new Set(first.map((e) => e.lastModified)).size).toBeGreaterThan(2);
  });

  it("lists NO live-only children when the nightly table cannot be read, and keeps the other families", async () => {
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    vi.mocked(countLiveOnlyRanks).mockRejectedValue(new Error("no such table: perm_live_only_index"));
    const names = await childNames();
    expect(names.some((n) => n.startsWith("live-employer-"))).toBe(false);
    expect(names).toContain("employer-1");
  });

  it("every dynamic public segment has at least one URL in the sitemap (the class that hid the month pages)", async () => {
    // Walk the public app tree for `[param]` directories and require a URL
    // under each one's parent path. A generated family that nothing lists is
    // exactly how ~40 month pages went unadvertised for three weeks; this
    // reads the TREE rather than a hand-kept list so a new family cannot
    // slip past it. Deliberate exclusions would be named here with a reason;
    // today there are none.
    vi.mocked(getAllPosts).mockReturnValue([
      mkPost("a", "blog", "2026-01-01"),
      mkPost("g", "guides", "2026-01-01"),
      mkPost("c", "changelog", "2026-01-01"),
    ]);
    const root = join(process.cwd(), "src/app/(site)/(public)");
    const families: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (!statSync(full).isDirectory()) continue;
        if (/^\[.+\]$/.test(name)) {
          families.push(relative(root, dir).replace(/\\/g, "/"));
          continue;
        }
        walk(full);
      }
    };
    walk(root);
    expect(families.length).toBeGreaterThanOrEqual(10);
    const urls = (await sitemap()).map((e) => e.url);
    const missing = families.filter(
      (prefix) => !urls.some((u) => u.startsWith(`https://permtracker.app/${prefix}/`)),
    );
    expect(missing).toEqual([]);
  });

  it("opts into daily ISR via revalidate=86400", async () => {
    expect(revalidate).toBe(86400);
  });

  it("homepage lastModified derives from the newest post's date or updated", async () => {
    vi.mocked(getAllPosts).mockReturnValue([
      mkPost("first", "blog", "2026-01-01"),
      mkPost("second", "blog", "2026-02-15", "2026-03-04"),
      mkPost("third", "tutorials", "2026-01-20"),
    ]);
    const entries = await sitemap();
    // With the trailing slash since 2026-09-15: the form Google inspects and the canonical declares.
    const root = entries.find((e) => e.url === "https://permtracker.app/");
    expect(root).toBeDefined();
    // The second post has the most recent `updated` (2026-03-04) — that should win.
    expect(root!.lastModified).toBe("2026-03-04");
  });

  it("does NOT include /login or /signup (they are noindex per their page metadata)", async () => {
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).not.toContain("https://permtracker.app/login");
    expect(urls).not.toContain("https://permtracker.app/signup");
  });

  it("includes the standard public listing pages", async () => {
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const urls = new Set((await sitemap()).map((e) => e.url));
    for (const path of [
      "https://permtracker.app/",
      "https://permtracker.app/blog",
      "https://permtracker.app/guides",
      "https://permtracker.app/changelog",
      "https://permtracker.app/faq",
      "https://permtracker.app/calculators",
      "https://permtracker.app/methodology",
      "https://permtracker.app/contact",
      "https://permtracker.app/terms",
      "https://permtracker.app/privacy",
    ]) {
      expect(urls.has(path)).toBe(true);
    }
  });

  it("includes every calculator under /tools", async () => {
    // Arrange the mock here rather than inheriting it. `vi.clearAllMocks()`
    // clears calls but keeps implementations, so this test used to pass on the
    // previous test's `mockReturnValue` — which holds in source order and
    // breaks under `sequence.shuffle`, which this project turns on in CI
    // precisely to find order dependencies like this one. Reproduced with
    // `CI=1 vitest --sequence.seed=8`: getAllPosts() returned undefined and
    // sitemap.ts threw on `.length`.
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    // A tool page that ships but never reaches the sitemap is invisible to
    // search, which is most of the reason these exist as separate URLs.
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "https://permtracker.app/tools",
        "https://permtracker.app/tools/perm-timeline-calculator",
        "https://permtracker.app/tools/pwd-calculator",
        "https://permtracker.app/tools/green-card-timeline",
        "https://permtracker.app/tools/i140-calculator",
        "https://permtracker.app/tools/priority-date-calculator",
        "https://permtracker.app/tools/perm-deadline-calculator",
      ]),
    );
  });

  it("uses DOL's as-of date for the calculators that render live figures", async () => {
    // Arranges its own posts for the same reason as the test above.
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    // Same reasoning as /perm-processing-times: lastmod should move when the
    // numbers move, not when an unrelated blog post ships.
    const entries = await sitemap();
    const timeline = entries.find((e) => e.url.endsWith("/tools/perm-timeline-calculator"));
    const pwd = entries.find((e) => e.url.endsWith("/tools/pwd-calculator"));
    expect(timeline?.lastModified).toBe("2026-08-20");
    expect(pwd?.lastModified).toBe("2026-08-20");
  });

  it("emits per-slug URLs for every content type, changelog included", async () => {
    vi.mocked(getAllPosts).mockReturnValue([
      mkPost("blog-a", "blog", "2026-01-01"),
      mkPost("tutorial-a", "tutorials", "2026-01-02"),
      mkPost("guide-a", "guides", "2026-01-03"),
      mkPost("resource-a", "resources", "2026-01-04"),
      mkPost("changelog-a", "changelog", "2026-01-05"),
    ]);
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://permtracker.app/blog/blog-a");
    expect(urls).toContain("https://permtracker.app/tutorials/tutorial-a");
    expect(urls).toContain("https://permtracker.app/guides/guide-a");
    expect(urls).toContain("https://permtracker.app/resources/resource-a");
    // Changelog entries DO have detail routes now. They were written months
    // ago and served a 404 the whole time, because the content type was
    // supported everywhere except the route itself.
    expect(urls).toContain("https://permtracker.app/changelog/changelog-a");
  });

  it("captureErrors when zero posts (build-time content failure should never be silent)", async () => {
    vi.mocked(getAllPosts).mockReturnValue([]);
    await sitemap();
    // Assert the SPECIFIC error rather than the call count. The default mock
    // returns no entities either, so the entity-loss guard fires in the same
    // run, and a toHaveBeenCalledOnce() here fails for a reason that has
    // nothing to do with what this test is named for.
    const messages = vi
      .mocked(captureError)
      .mock.calls.map((c) => (c[0] as Error).message);
    expect(messages.some((m) => /zero content posts/i.test(m))).toBe(true);
  });

  it("does not stamp the CLOCK on the hubs when the content read comes back empty", async () => {
    // The fallback here used to be `new Date().toISOString().split("T")[0]`,
    // which is wrong twice: it moves every day, so the homepage's lastmod
    // becomes a timestamp rather than a fact (Google discounts those), and
    // toISOString is UTC, so after ~8pm ET it stamps TOMORROW - a future
    // lastmod on the homepage, produced by a degraded build.
    vi.mocked(getAllPosts).mockReturnValue([]);
    const entries = await sitemap();
    const home = entries.find((e) => e.url === "https://permtracker.app/");
    expect(home).toBeDefined();

    const stamped = String(home!.lastModified);
    const todayUtc = new Date().toISOString().slice(0, 10);
    const tomorrowUtc = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    expect(stamped).not.toBe(todayUtc);
    expect(stamped).not.toBe(tomorrowUtc);
    // And never in the future, whichever day this test runs.
    expect(stamped <= todayUtc).toBe(true);
    expect(stamped).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("REFUSES to emit when the entity read comes back nearly empty", async () => {
    // This is the defect that actually shipped. While Convex was disabled the
    // entity read failed on every build, this guard reported "0 entity URLs"
    // to Sentry, and the sitemap went out with 46 URLs anyway - telling Google
    // the site has 46 pages instead of 21,224. Reporting a 99.8% loss is not a
    // response to it.
    //
    // Throwing is the safer failure: on revalidation Next keeps serving the
    // last good sitemap, so a transient outage costs freshness instead of
    // every entity URL.
    arrangeEntities({ employer: 0, attorney: 0, occupation: 0 });
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    await expect(sitemap()).rejects.toThrow(/built with only 0 rows/i);
    const messages = vi
      .mocked(captureError)
      .mock.calls.map((c) => (c[0] as Error).message);
    // Still reported as well as refused: the build fails loudly AND the reason
    // reaches Sentry, because a failed build with no explanation is its own
    // kind of silence.
    expect(messages.some((m) => /built with only 0 rows/i.test(m))).toBe(true);
  });

  it("uses DOL's as-of date for /perm-processing-times, not the newest post date", async () => {
    // It previously used latestPostDate, so the lastmod moved whenever an
    // unrelated blog post shipped and stayed put when DOL actually published.
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const entry = (await sitemap()).find((e) =>
      e.url.endsWith("/perm-processing-times"),
    );
    expect(entry!.lastModified).toBe("2026-08-20");
  });

  it("still builds when the DISCLOSURE read fails: a stale lastmod is not a reason to fail", async () => {
    // Deliberately different from the entity case above, and the distinction
    // is the whole point. Losing one lastmod degrades a date; losing the
    // entity read drops 21,178 URLs. Only the second is worth failing over.
    vi.mocked(getProcessingTimes).mockRejectedValue(new Error("turso down"));
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.url.endsWith("/perm-processing-times"))).toBe(true);
  });

  it("lists the A-Z browse index and every populated letter page", async () => {
    // The letter pages are what make 21,000 entity pages reachable by a
    // crawlable link at all: the hubs render a client-side table, so before
    // these existed /perm-employers served 54 anchors against 16,309 pages.
    // A sitemap entry does not create the link, but a letter page missing from
    // here is one that has to be discovered entirely by internal link.
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const urls = new Set((await sitemap()).map((e) => e.url));

    for (const base of ["perm-employers", "perm-attorneys", "perm-wages"]) {
      expect(urls.has(`https://permtracker.app/${base}/browse`)).toBe(true);
      expect(urls.has(`https://permtracker.app/${base}/browse/a`)).toBe(true);
      expect(urls.has(`https://permtracker.app/${base}/browse/z`)).toBe(true);
      // The residue bucket is a URL like any other, and its slug is the one
      // most likely to be mangled by a path builder.
      expect(urls.has(`https://permtracker.app/${base}/browse/0-9`)).toBe(true);
    }
  });

  it("OMITS a letter with nothing in it, matching that page's own noindex", async () => {
    // No SOC title begins with X, Y or Z, so three occupation letters are
    // genuinely empty. Those pages set robots:{index:false}; advertising them
    // here would contradict their own directive and submit a page whose whole
    // content is "nothing here". The two halves are separate code, which is
    // exactly why this is asserted rather than assumed.
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    vi.mocked(browseCounts).mockImplementation(async (kind: string) =>
      kind === "occupation" ? bucketCounts(["x", "y", "z"]) : bucketCounts(),
    );
    const urls = new Set((await sitemap()).map((e) => e.url));

    expect(urls.has("https://permtracker.app/perm-wages/browse/x")).toBe(false);
    expect(urls.has("https://permtracker.app/perm-wages/browse/w")).toBe(true);
    // Only that kind loses them. An employer X page exists and must stay.
    expect(urls.has("https://permtracker.app/perm-employers/browse/x")).toBe(true);
  });

  it("still builds when the browse counts read fails: it costs one hop, not 21,000 URLs", async () => {
    // Deliberately different from the entity-loss guard, and the distinction
    // is the point. Losing the letter URLs means the detail pages are found
    // through their own children a crawl later; losing the entity read drops
    // every detail URL. Only the second is worth failing the build over.
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    vi.mocked(browseCounts).mockRejectedValue(new Error("turso down"));
    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain("https://permtracker.app/perm-employers");
    expect(urls.some((u) => u.includes("/browse/"))).toBe(false);
    const messages = vi
      .mocked(captureError)
      .mock.calls.map((c) => (c[0] as Error).message);
    expect(messages.some((m) => /turso down/i.test(m))).toBe(true);
  });

  it("lists EVERY entity, not just the head of each kind", async () => {
    // The seed on the index page is 250 rows; the sitemap must carry the whole
    // corpus. A sitemap built from the seed looks entirely healthy and hides
    // 16,000 pages from search.
    // Counts above the per-kind loss floor. The old fixture used 3 rows for
    // attorneys, which the summed guard tolerated and the per-kind guard
    // correctly does not: 3 law firms where there are 3,736 is exactly the
    // catastrophic read this now refuses to publish.
    arrangeEntities({ employer: 2500, attorney: 300, occupation: 200 });
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const entries = await sitemap();
    // DETAIL URLs only. A bare `includes` also matched the A-Z letter pages
    // that now sit under the same prefix, which inflated this by 28 per kind -
    // and 28 extra URLs is exactly the shape of the truncation bug this test
    // was written to catch, so it has to count the thing it names.
    const STATIC_UNDER_PREFIX = ["browse", "compare", "under-review"];
    const count = (p: string) =>
      // ...and the static pages that live under an entity prefix.
      entries.filter((e) => e.url.includes(p) && !STATIC_UNDER_PREFIX.some((x) => e.url.includes(`${p}${x}`)))
        .length;

    expect(count("/perm-employers/")).toBe(2500);
    expect(count("/perm-attorneys/")).toBe(300);
    expect(count("/perm-wages/")).toBe(200);
    // The LAST row specifically, not just the total: a count alone cannot tell
    // a complete list from one that stopped early and was padded.
    expect(entries.some((e) => e.url.endsWith("/perm-employers/employer-2500"))).toBe(true);
  });
});

describe("sitemap index and chunking", () => {
  beforeEach(() => {
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    // Arranged HERE too, not inherited from the block above. `pagesEntries()`
    // reads the browse counts, and a bare `vi.fn()` returns undefined, so
    // `browseCounts(...).catch` threw. It passed in source order (the other
    // describe's beforeEach had already run) and went red under
    // `sequence.shuffle`, which CI turns on for exactly this. Reproduced with
    // `CI=1 vitest --sequence.seed=17`.
    vi.mocked(browseCounts).mockResolvedValue(bucketCounts());
  });

  it("chunks a kind into children of at most SITEMAP_CHUNK URLs", async () => {
    // 16,305 employers is what production actually holds.
    vi.mocked(countEntityRanks).mockImplementation(async (kind: string) =>
      kind === "employer" ? 16305 : kind === "attorney" ? 3736 : 1137,
    );
    const names = await childNames();
    expect(names[0]).toBe("pages");
    // ceil(16305/5000) = 4, and the smaller kinds fit in one each.
    expect(names.filter((n) => n.startsWith("employer-"))).toHaveLength(4);
    expect(names.filter((n) => n.startsWith("attorney-"))).toHaveLength(1);
    expect(names.filter((n) => n.startsWith("occupation-"))).toHaveLength(1);
  });

  it("always lists at least one child per kind, even at zero", async () => {
    // A kind that reads as empty must still HAVE a child URL: the child then
    // throws and Next serves the last good copy. Omitting it from the index
    // would quietly retire a whole section instead.
    vi.mocked(countEntityRanks).mockResolvedValue(0);
    const names = await childNames();
    for (const k of ["employer", "attorney", "occupation"]) {
      expect(names.filter((n) => n.startsWith(`${k}-`))).toHaveLength(1);
    }
  });

  it("parses child names and refuses anything else", async () => {
    expect(parseChildName("employer-1")).toEqual({ kind: "employer", chunk: 0 });
    expect(parseChildName("occupation-3")).toEqual({ kind: "occupation", chunk: 2 });
    for (const bad of ["pages", "employer", "employer-0x", "../../etc", "employer-99999"]) {
      expect(parseChildName(bad)).toBeNull();
    }
  });

  it("emits a sitemapindex, not a urlset", async () => {
    vi.mocked(countEntityRanks).mockResolvedValue(100);
    const xml = indexXml(await childNames(), "2026-08-20");
    expect(xml).toContain("<sitemapindex");
    expect(xml).not.toContain("<urlset");
    // Children must be absolute URLs, and at or below the index's directory.
    expect(xml).toContain("https://permtracker.app/sitemaps/pages.xml");
  });

  it("escapes XML in a slug rather than emitting broken markup", () => {
    const xml = urlsetXml([{ url: "https://x.test/a?b=1&c=2", lastModified: "2026-01-01" }]);
    expect(xml).toContain("a?b=1&amp;c=2");
    expect(xml).not.toContain("&c=2");
  });

  it("does not emit changefreq or priority", async () => {
    // Google's docs: "Google ignores <priority> and <changefreq> values."
    // Bing said the same in July 2025. Measured at 115 bytes per URL, which is
    // a bare loc+lastmod; this keeps it that way.
    const xml = urlsetXml(await pagesEntries());
    expect(xml).not.toContain("changefreq");
    expect(xml).not.toContain("<priority>");
  });
});

describe("entity lastmod tracks the corpus, not the daily figure", () => {
  beforeEach(() => {
    // Arranged in this block's own beforeEach: vi.clearAllMocks() keeps
    // implementations but CI shuffles test order, so inheriting another
    // describe's arrangement is the order-dependency this file already got
    // caught by once.
    arrangeEntities({ employer: 600, attorney: 200, occupation: 200 });
    vi.mocked(browseCounts).mockResolvedValue(bucketCounts());
  });

  it("gives each chunk its own slice, covering every rank exactly once", async () => {
    // THE CHUNK ARGUMENT WAS UNTESTED UNTIL THIS EXISTED, and it is new: the
    // builder used to fetch a whole kind and `.slice()` in JS, so paging was
    // arithmetic on an array it already held. It is a rank window in SQL now,
    // and a builder that passed a constant 0 - the obvious way to get this
    // wrong - shipped fifteen identical employer files listing the same 5,000
    // URLs, with 66,000 entities absent. Probed: every fixture in this file
    // held fewer rows than one chunk, so that mutation passed 23/23.
    const per = SITEMAP_CHUNK;
    arrangeEntities({ employer: per * 2 + 7, attorney: 10, occupation: 10 });

    const chunks = await Promise.all([
      entityEntries("employer", 0),
      entityEntries("employer", 1),
      entityEntries("employer", 2),
    ]);
    expect(chunks.map((c) => c.length)).toEqual([per, per, 7]);

    // Union covers every rank, and no URL appears in two files. A sitemap
    // that repeats a URL across children is not merely wasteful: it is the
    // exact artefact a constant-chunk bug produces, and it looks fine in any
    // single file.
    const urls = chunks.flat().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(`https://permtracker.app/perm-employers/employer-1`);
    expect(urls).toContain(`https://permtracker.app/perm-employers/employer-${per + 1}`);
    expect(urls).toContain(`https://permtracker.app/perm-employers/employer-${per * 2 + 7}`);
  });

  it("stamps entity URLs with the disclosure as-of, never the processing-times one", async () => {
    // The two mocks carry different dates on purpose. permAsOf() returns DOL's
    // PROCESSING-TIMES stamp, which moves daily; entity pages render the
    // QUARTERLY corpus. Before this fix every one of ~20,960 entity URLs
    // restamped every day for data that changes four times a year, which is a
    // lastmod Google discounts - and discounting it costs recrawl priority on
    // exactly the pages whose numbers actually did move.
    const entries = await entityEntries("employer", 0);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.lastModified).toBe("2026-06-30");
      expect(e.lastModified).not.toBe("2026-08-20");
    }
  });
});
