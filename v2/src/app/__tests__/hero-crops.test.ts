import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { HERO_SIZES, heroCrops } from "@/lib/content/heroCrops";
import { webpSize } from "../../../test-utils/image-size";

/**
 * Every article shares its header as a 16x9 copy and lists 16x9, 4x3 and 1x1 shapes in its structured data
 * (Google Discover, Nov 4 2026), so each header needs both copies scripts/make_hero_crops.py writes, at their
 * sizes. A header without them would point Discover and the Article at a file that isn't there.
 */

const ROOT = process.cwd();
const TYPES = ["guides", "blog", "changelog"] as const;

// Read the files directly: the shared unit pool can carry another file's fs mock.
function images(): { key: string; image?: string }[] {
  return TYPES.flatMap((t) =>
    readdirSync(join(ROOT, "content", t))
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => {
        const meta = matter(readFileSync(join(ROOT, "content", t, f), "utf8")).data as { image?: string; published?: boolean };
        return { key: `${t}/${f.slice(0, -4)}`, image: meta.published === false ? undefined : meta.image };
      }),
  );
}

describe("article header copies", () => {
  const posts = images().filter((p) => p.image);

  it("finds the articles (a control: an empty list would pass everything below)", () => {
    expect(posts.length).toBeGreaterThan(100);
  });

  it("names a header's three shapes, and nothing for an image that isn't a header", () => {
    expect(heroCrops("/images/content/heroes/guides/x-y.webp")).toEqual({
      wide: "/images/content/heroes/guides/x-y-16x9.webp",
      standard: "/images/content/heroes/guides/x-y.webp",
      square: "/images/content/heroes/guides/x-y-1x1.webp",
    });
    expect(heroCrops("/images/featured.png")).toBeNull();
    expect(heroCrops(undefined)).toBeNull();
  });

  it("has both copies of every article's header, at their sizes", () => {
    const wrong: string[] = [];
    for (const p of posts) {
      const crops = heroCrops(p.image);
      if (!crops) continue;
      for (const [shape, src] of [["wide", crops.wide], ["square", crops.square]] as const) {
        const file = join(ROOT, "public", src);
        if (!existsSync(file)) {
          wrong.push(`${p.key}: no ${src}`);
          continue;
        }
        const { w, h } = webpSize(file);
        if (w !== HERO_SIZES[shape].width || h !== HERO_SIZES[shape].height) wrong.push(`${p.key}: ${src} is ${w}x${h}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
