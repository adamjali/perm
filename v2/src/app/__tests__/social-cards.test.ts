/**
 * Every public page has its own social card, and every card exists.
 *
 * The site used to ship one AI-drawn illustration as the social image of
 * every URL. This holds the replacement together: a registry of card slugs
 * (`src/lib/pageCards.ts`), a JPEG per slug in public/og at exactly 1200x630
 * and under the size cap, and a page for every slug that wires the card in
 * through `withSocialCard`. A slug missing any one of the three fails here,
 * rather than shipping a link preview with no picture.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PAGE_CARD_ALT } from "@/lib/pageCards";
import { SOCIAL_CARD_MAX_BYTES } from "@/lib/socialCard";

const ROOT = path.resolve(__dirname, "../../..");
const slugs = Object.keys(PAGE_CARD_ALT);

/** JPEG dimensions from the SOF marker, no image library needed. */
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error("not a JPEG marker");
    const marker = buf[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error("no SOF marker");
}

describe("page social cards", () => {
  it("has a registry with a real alt text for every card", () => {
    expect(slugs.length).toBeGreaterThanOrEqual(27);
    for (const slug of slugs) expect(PAGE_CARD_ALT[slug as keyof typeof PAGE_CARD_ALT].length).toBeGreaterThan(20);
  });

  it.each(slugs)("%s.jpg exists at 1200x630 and under the size cap", (slug) => {
    const file = path.join(ROOT, "public", "og", `${slug}.jpg`);
    expect(existsSync(file)).toBe(true);
    const buf = readFileSync(file);
    expect(jpegSize(buf)).toEqual({ width: 1200, height: 630 });
    expect(statSync(file).size).toBeLessThan(SOCIAL_CARD_MAX_BYTES);
  });

  it.each(slugs)("the %s page wires its card through withSocialCard", (slug) => {
    const page = path.join(ROOT, "src/app/(site)/(public)", slug === "home" ? "page.tsx" : `${slug}/page.tsx`);
    expect(existsSync(page)).toBe(true);
    expect(readFileSync(page, "utf8")).toContain(`withSocialCard(`);
    expect(readFileSync(page, "utf8")).toContain(`"${slug}"`);
  });

  it("the root social image is the home card, not an illustration", () => {
    const route = readFileSync(path.join(ROOT, "src/app/opengraph-image.tsx"), "utf8");
    expect(route).toContain('"og", "home.jpg"');
    expect(existsSync(path.join(ROOT, "public", "og-image-base.png"))).toBe(false);
  });
});
