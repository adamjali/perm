import { describe, expect, it, vi } from "vitest";

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";
import { getPostBySlug, getPostSlugs } from "@/lib/content";

// A draft (`published: false`, such as a template waiting on the attorney's
// review) has no page. It had rendered at its address while hidden from every
// list, which put an unreviewed template on the open web.
//
// The content folder may hold no draft at all (Oct 17 2026: the three
// templates went live for review), so one real guide is made to read as a
// draft here rather than the rule going untested.
vi.mock("@/lib/content", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/content")>();
  const draft = real.getPostSlugs("guides")[0];
  return {
    ...real,
    getPostBySlug: (type: Parameters<typeof real.getPostBySlug>[0], slug: string) => {
      const post = real.getPostBySlug(type, slug);
      return post && type === "guides" && slug === draft ? { ...post, meta: { ...post.meta, published: false } } : post;
    },
  };
});

describe("draft articles", () => {
  const drafts = getPostSlugs("guides").filter((slug) => getPostBySlug("guides", slug)?.meta.published === false);

  it("has a draft to test against", () => {
    expect(drafts.length).toBeGreaterThan(0);
  });

  it("gives a draft no page, and every published article one", () => {
    const { generateStaticParams } = createContentDetailPage("guides");
    const slugs = new Set(generateStaticParams().map((p) => p.slug));
    for (const d of drafts) expect(slugs.has(d), d).toBe(false);
    expect(slugs.size).toBe(getPostSlugs("guides").length - drafts.length);
  });

  it("answers a draft's address with a 404", async () => {
    const { generateMetadata } = createContentDetailPage("guides");
    await expect(generateMetadata({ params: Promise.resolve({ slug: drafts[0]! }) } as never)).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/,
    );
  });
});
