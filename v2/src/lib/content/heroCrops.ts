/**
 * An article header's three shapes, as scripts/make_hero_crops.py writes them beside the 1600x1200 header:
 * `-16x9` (1600x900) and `-1x1` (1200x1200). Google's Discover page wants a large 16x9 image in og:image or the
 * structured data, and its Article guide asks for 16x9, 4x3 and 1x1; the article shares the 16x9 one.
 * `src/app/__tests__/hero-crops.test.ts` fails a header without both copies at these sizes.
 */

export const HERO_SIZES = {
  wide: { width: 1600, height: 900 },
  standard: { width: 1600, height: 1200 },
  square: { width: 1200, height: 1200 },
} as const;

export interface HeroCrops {
  wide: string;
  standard: string;
  square: string;
}

const HERO_RE = /^(\/images\/content\/heroes\/[a-z]+\/[a-z0-9-]+)\.webp$/;

/** The three shapes of an article header, or null for an image that isn't one (no copies exist for it). */
export function heroCrops(image: string | undefined): HeroCrops | null {
  const m = image ? HERO_RE.exec(image) : null;
  if (!m) return null;
  return { wide: `${m[1]}-16x9.webp`, standard: image!, square: `${m[1]}-1x1.webp` };
}
