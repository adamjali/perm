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
// ships. Mocked here so the sitemap stays a pure function of its inputs; the
// unreachable-Convex path is asserted explicitly below.
vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(async () => ({ permAsOf: "2026-08-20" })),
}));

import { getAllPosts } from "@/lib/content";
import { captureError } from "@/lib/sentry";
import { fetchQuery } from "convex/nextjs";
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
      "https://permtracker.app/tutorials",
      "https://permtracker.app/guides",
      "https://permtracker.app/resources",
      "https://permtracker.app/changelog",
      "https://permtracker.app/faq",
      "https://permtracker.app/demo",
      "https://permtracker.app/contact",
      "https://permtracker.app/terms",
      "https://permtracker.app/privacy",
    ]) {
      expect(urls.has(path)).toBe(true);
    }
  });

  it("includes every calculator under /tools", async () => {
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
        "https://permtracker.app/tools/perm-deadline-calculator",
      ]),
    );
  });

  it("uses DOL's as-of date for the calculators that render live figures", async () => {
    // Same reasoning as /perm-processing-times: lastmod should move when the
    // numbers move, not when an unrelated blog post ships.
    const entries = await sitemap();
    const timeline = entries.find((e) => e.url.endsWith("/tools/perm-timeline-calculator"));
    const pwd = entries.find((e) => e.url.endsWith("/tools/pwd-calculator"));
    expect(timeline?.lastModified).toBe("2026-08-20");
    expect(pwd?.lastModified).toBe("2026-08-20");
  });

  it("emits per-slug URLs for blog/tutorials/guides/resources but NOT changelog", async () => {
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
    // Changelog entries have NO detail routes — must not be in the sitemap
    expect(urls).not.toContain("https://permtracker.app/changelog/changelog-a");
  });

  it("captureErrors when zero posts (build-time content failure should never be silent)", async () => {
    vi.mocked(getAllPosts).mockReturnValue([]);
    await sitemap();
    expect(captureError).toHaveBeenCalledOnce();
    const err = vi.mocked(captureError).mock.calls[0]![0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/zero content posts/i);
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

  it("still builds when Convex is unreachable", async () => {
    // A sitemap with one slightly stale lastmod is fine; a failed build is not.
    vi.mocked(fetchQuery).mockRejectedValueOnce(new Error("convex down"));
    vi.mocked(getAllPosts).mockReturnValue([mkPost("a", "blog", "2026-01-01")]);
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.find((e) => e.url.endsWith("/perm-processing-times"))!.lastModified,
    ).toBe("2026-01-01");
  });
});
