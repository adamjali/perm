import { describe, expect, it } from "vitest";

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";
import { getPostBySlug } from "@/lib/content";
import { HERO_SIZES } from "@/lib/content/heroCrops";

/**
 * An article shares its header's 16x9 copy, not the generated title card: Google's Discover page asks for a
 * large, relevant 16x9 picture in og:image and says to avoid text-heavy ones (read Nov 4 2026).
 */
describe("the picture an article shares", () => {
  it("is the header's 16x9 copy, with its size and alt text, on Open Graph and X alike", async () => {
    const slug = "how-accurate-are-perm-estimates";
    const post = getPostBySlug("guides", slug)!;
    const { generateMetadata } = createContentDetailPage("guides");
    const meta = await generateMetadata({ params: Promise.resolve({ slug }) } as never);
    const expected = [
      {
        url: "/images/content/heroes/guides/how-accurate-are-perm-estimates-16x9.webp",
        ...HERO_SIZES.wide,
        alt: post.meta.imageAlt,
      },
    ];
    expect((meta.openGraph as { images?: unknown }).images).toEqual(expected);
    expect((meta.twitter as { images?: unknown }).images).toEqual(expected);
  });
});
