/**
 * The site-wide social card, served at /opengraph-image.
 *
 * The home card from public/og/, rendered by scripts/make-page-cards.mjs from
 * a real screenshot of the homepage inset in the house frame. A card shows
 * the real product, never a drawn stand-in: it is what every link preview
 * and image result shows for the site. Every public page sets its own card
 * through `withSocialCard`; this route is what any page without one falls
 * back to, and what the root layout's metadata points at.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SOCIAL_CARD_SIZE, SOCIAL_CARD_CONTENT_TYPE } from "@/lib/socialCard";
import { PAGE_CARD_ALT } from "@/lib/pageCards";

export const runtime = "nodejs";
export const revalidate = false;
export const alt = PAGE_CARD_ALT.home;
export const size = SOCIAL_CARD_SIZE;
export const contentType = SOCIAL_CARD_CONTENT_TYPE;

export default async function Image() {
  const jpeg = await readFile(join(process.cwd(), "public", "og", "home.jpg"));
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": SOCIAL_CARD_CONTENT_TYPE,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
