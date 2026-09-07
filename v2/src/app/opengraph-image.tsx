/**
 * The site-wide social card, served at /opengraph-image.
 *
 * WHAT IT USED TO BE. An AI-drawn isometric laptop whose screen read
 * "Immigration Case Tracking Dashboard, Client J. Doe, I-140, Biometrics,
 * Interview, Approved": USCIS steps, not PERM, an invented client, and the old
 * "Deadline Tracking" tagline, on every one of ~13,758 URLs and in every
 * WhatsApp and iMessage preview. Google Images showed it for the site while
 * the rival's per-page screenshots showed real product (measured 2026-09-07).
 *
 * WHAT IT IS NOW. The home card from public/og/, rendered by
 * scripts/make-page-cards.mjs from a real screenshot of the homepage inset in
 * the house frame. Every public page sets its own card through
 * `withSocialCard`; this route is what any page without one falls back to,
 * and what the root layout's metadata points at.
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
