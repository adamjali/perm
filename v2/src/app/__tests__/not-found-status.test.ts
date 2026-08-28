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
  it("employer generateMetadata throws notFound when the slug names nothing", async () => {
    vi.resetModules();
    // Only resolveEntity decides hit-vs-miss; the rest of the module is kept
    // real so the page's other imports resolve.
    vi.doMock("@/lib/turso/entityDetail", async (importOriginal) => ({
      ...(await importOriginal<object>()),
      resolveEntity: vi.fn().mockResolvedValue(null),
    }));
    const { generateMetadata } = await import(
      "../(site)/(public)/perm-employers/[slug]/page"
    );
    expect(
      await digestOf(generateMetadata(params("zzz-not-a-real-employer"))),
    ).toMatch(NOT_FOUND_DIGEST);
    vi.doUnmock("@/lib/turso/entityDetail");
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
  });
});
