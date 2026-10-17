import { describe, expect, it } from "vitest";

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";
import { getPostBySlug, getPostSlugs } from "@/lib/content";

// A draft (`published: false`, such as a template waiting on the attorney's
// review) has no page. It had rendered at its address while hidden from every
// list, which put an unreviewed template on the open web.
describe("draft articles", () => {
  const drafts = getPostSlugs("guides").filter((slug) => getPostBySlug("guides", slug)?.meta.published === false);

  it("has drafts to test against", () => {
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
