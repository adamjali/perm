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
}));
vi.mock("@/lib/entitySeed", () => ({
  fetchAllEntitiesServer: vi.fn(),
}));

/** `n` entity rows of one kind, all above the page threshold. */
function entityRows(kind: string, from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    slug: `${kind}-${from + i}`,
    name: `${kind} ${from + i}`,
    rank: from + i,
    total: 500,
    certified: 400,
    denied: 10,
    medianDays: 200,
    medianAnnualWage: 100000,
    state: null,
    code: null,
  }));
}

import { getAllPosts } from "@/lib/content";
import { captureError } from "@/lib/sentry";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { fetchAllEntitiesServer } from "@/lib/entitySeed";
import sitemap, { revalidate } from "../sitemap";

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
    vi.mocked(fetchAllEntitiesServer).mockImplementation(async (kind: string) =>
      entityRows(kind, 1, kind === "employer" ? 600 : 200),
    );
    vi.mocked(getProcessingTimes).mockResolvedValue({
      permAsOf: "2026-08-20",
    } as never);
    vi.clearAllMocks();
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
    const root = entries.find((e) => e.url === "https://permtracker.app");
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
      "https://permtracker.app",
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
    vi.mocked(fetchAllEntitiesServer).mockResolvedValue([]);
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    await expect(sitemap()).rejects.toThrow(/entity URLs/i);
    const messages = vi
      .mocked(captureError)
      .mock.calls.map((c) => (c[0] as Error).message);
    // Still reported as well as refused: the build fails loudly AND the reason
    // reaches Sentry, because a failed build with no explanation is its own
    // kind of silence.
    expect(messages.some((m) => /entity URLs/i.test(m))).toBe(true);
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

  it("lists EVERY entity, not just the head of each kind", async () => {
    // The seed on the index page is 250 rows; the sitemap must carry the whole
    // corpus. A sitemap built from the seed looks entirely healthy and hides
    // 16,000 pages from search.
    vi.mocked(fetchAllEntitiesServer).mockImplementation(async (kind: string) =>
      entityRows(kind, 1, kind === "employer" ? 2500 : 3),
    );
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const entries = await sitemap();
    const count = (p: string) => entries.filter((e) => e.url.includes(p)).length;

    expect(count("/perm-employers/")).toBe(2500);
    expect(count("/perm-attorneys/")).toBe(3);
    expect(count("/perm-wages/")).toBe(3);
    // The LAST row specifically, not just the total: a count alone cannot tell
    // a complete list from one that stopped early and was padded.
    expect(entries.some((e) => e.url.endsWith("/perm-employers/employer-2500"))).toBe(true);
  });
});
