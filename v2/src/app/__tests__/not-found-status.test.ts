import { describe, expect, it, vi } from "vitest";

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

/**
 * A miss on a dynamic route must be decided BEFORE the response starts.
 *
 * The (public) segment has a loading.tsx, so page bodies stream after a 200
 * has already been sent - a notFound() thrown in the body swaps the UI but
 * never the status. Measured live 2026-08-28: junk entity slugs answered
 * HTTP 200 with a "not found" body and an injected noindex (a soft 404, and
 * a cold server render per crawler guess). Two mechanisms fix it, and this
 * file pins both:
 *
 * 1. Content routes (blog/guides/changelog) know their full slug set at
 *    build time, so they export `dynamicParams = false` - Next answers a
 *    junk slug with a real 404 and no render at all.
 * 2. Data-backed routes (entities, queue months) cannot enumerate their
 *    slugs, so generateMetadata - which resolves before the first byte -
 *    throws notFound() on a miss instead of returning placeholder metadata.
 *
 * The wire-level truth (curl -sI on a built server) was verified by hand;
 * these tests keep the module shapes that make it true.
 */

// notFound()'s digest: "NEXT_NOT_FOUND" through Next 15.0, the HTTP-error
// fallback form after. Either proves the throw is Next's 404 signal and not
// an incidental crash (a missing env var rejecting here would look identical
// to a bare .rejects assertion).
const NOT_FOUND_DIGEST = /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404/;

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function digestOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return String((e as { digest?: string }).digest ?? e);
  }
  throw new Error("expected the metadata call to throw");
}

describe("content detail routes: junk slugs cannot render", () => {
  it("the factory's generateMetadata throws Next's notFound on a missing post", async () => {
    const { generateMetadata } = createContentDetailPage("blog");
    expect(
      await digestOf(generateMetadata(params("zzz-not-a-real-post-404"))),
    ).toMatch(NOT_FOUND_DIGEST);
  });

  it.each(["blog", "guides", "changelog"] as const)(
    "%s/[slug] exports dynamicParams = false, so a junk slug 404s without rendering",
    async (type) => {
      const mod = await import(
        `../(site)/(public)/${type}/[slug]/page`
      );
      expect(mod.dynamicParams).toBe(false);
    },
  );
});

describe("entity detail routes: the miss is decided in metadata", () => {
  /**
   * "Names nothing" now means nothing in EITHER corpus.
   *
   * An employer with no `perm_entities` row is no longer automatically a 404:
   * the live feed knows 21,495 employers the published disclosure files have
   * never named, and those get a reduced page. So a genuine miss has to miss
   * twice, and both reads are mocked here rather than one.
   */
  const missBoth = () => {
    vi.doMock("@/lib/turso/entityDetail", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      resolveEntity: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/turso/liveEmployers", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      liveEmployerRecord: vi.fn().mockResolvedValue(null),
    }));
  };
  const unmockBoth = () => {
    vi.doUnmock("@/lib/turso/entityDetail");
    vi.doUnmock("@/lib/turso/liveEmployers");
  };

  it("employer generateMetadata throws notFound when the slug names nothing", async () => {
    vi.resetModules();
    // Only these two reads decide hit-vs-miss; the rest of the module is kept
    // real so the page's other imports resolve.
    missBoth();
    const { generateMetadata } = await import(
      "../(site)/(public)/perm-employers/[slug]/page"
    );
    expect(
      await digestOf(generateMetadata(params("zzz-not-a-real-employer"))),
    ).toMatch(NOT_FOUND_DIGEST);
    unmockBoth();
  });

  /**
   * The live-only page is a 200 and is NOINDEX, and both halves matter.
   *
   * 200 because a search result that 404s on click is worse than no result -
   * that is the whole reason the page exists. Noindex because 17,681 of these
   * employers hold exactly one case, so the page is a heading and one row by
   * construction, and twenty thousand of those is the scaled-thin-content
   * shape Google's own policy names whatever we meant by it.
   */
  const liveRecord = (over: Record<string, unknown> = {}) => ({
    slug: "lorenz-bus-service-inc",
    name: "Lorenz Bus Service Inc",
    otherNames: [],
    cases: 174,
    pending: 173,
    firstFiling: "2026-04-29",
    lastFiling: "2026-08-08",
    stages: [{ status: "ANALYST REVIEW", isFinal: false, n: 173 }],
    ...over,
  });

  const mockLive = (record: unknown) => {
    vi.doMock("@/lib/turso/entityDetail", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      resolveEntity: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/turso/liveEmployers", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      liveEmployerRecord: vi.fn().mockResolvedValue(record),
    }));
  };

  it("an employer known only to the live feed gets a page, and it is noindex", async () => {
    vi.resetModules();
    mockLive(liveRecord());
    const { generateMetadata } = await import(
      "../(site)/(public)/perm-employers/[slug]/page"
    );
    const meta = await generateMetadata(params("lorenz-bus-service-inc"));
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(String(meta.description)).toMatch(/Lorenz Bus Service Inc/);
    // The description must not promise a figure the page refuses to print.
    expect(String(meta.description)).not.toMatch(/approved|median|rank/i);
    expect(String(meta.description).length).toBeLessThanOrEqual(155);
    unmockBoth();
  });

  it("keeps the description under the SERP cut for the longest names DOL prints", async () => {
    // These names are the least curated in the corpus: they come straight off
    // the application with no merge pass behind them, so the longest of them
    // will blow any single template. Anything past ~155 characters is cut
    // mid-sentence, which is how a page ends up advertising half a sentence.
    vi.resetModules();
    mockLive(liveRecord({ name: "A".repeat(180), cases: 1 }));
    const { generateMetadata } = await import(
      "../(site)/(public)/perm-employers/[slug]/page"
    );
    const meta = await generateMetadata(params("a-very-long-employer"));
    expect(String(meta.description).length).toBeLessThanOrEqual(155);
    // And it must still be a sentence about this page, not a stub.
    expect(String(meta.description)).toMatch(/live record/);
    unmockBoth();
  });
});

describe("queue month route: both miss shapes are decided in metadata", () => {
  it("throws notFound for a malformed month and for a real-shaped empty one", async () => {
    vi.resetModules();
    vi.doMock("@/lib/turso/backlog", () => ({
      getMonthBacklog: vi.fn().mockResolvedValue(null),
      getPendingBefore: vi.fn().mockResolvedValue(0),
      getAdjacentMonths: vi.fn().mockResolvedValue({ prev: null, next: null }),
    }));
    // EVERY TURSO MODULE THE PAGE IMPORTS, not just the one metadata reads.
    // Importing the route pulls its whole graph in, and three of these were
    // left real: under full-suite load one of them made an actual network call
    // and the test died on its 10s timeout while passing in isolation. A test
    // that reaches the network is a CI flake waiting for a slow day.
    vi.doMock("@/lib/turso/estimate", () => ({
      getEstimatorData: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/lib/turso/liveCases", () => ({
      getLiveRemainderSummary: vi.fn().mockResolvedValue(null),
      listLiveCases: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@/lib/turso/rfi", () => ({ SMALL_STAGE_MAX: 10 }));
    const { generateMetadata } = await import(
      "../(site)/(public)/perm-queue/[month]/page"
    );
    const month = (m: string) => ({ params: Promise.resolve({ month: m }) });
    expect(await digestOf(generateMetadata(month("banana")))).toMatch(
      NOT_FOUND_DIGEST,
    );
    // 1997-01 passes the shape check; the (mocked-empty) backlog read is what
    // must refuse it. This is the miss a shape regex can never catch.
    expect(await digestOf(generateMetadata(month("1997-01")))).toMatch(
      NOT_FOUND_DIGEST,
    );
    vi.doUnmock("@/lib/turso/backlog");
    vi.doUnmock("@/lib/turso/estimate");
    vi.doUnmock("@/lib/turso/liveCases");
    vi.doUnmock("@/lib/turso/rfi");
  });
});
