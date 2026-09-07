/**
 * The social card's physical facts: how big it is and what format it is in.
 *
 * These live here, alone, because two places need them and they must agree:
 *   - `src/app/opengraph-image.tsx` re-exports them as the route's `size` and
 *     `contentType`, which is what Next.js uses to render and serve the file.
 *   - `src/lib/openGraphBase.ts` puts them in the <meta> tags that tell a
 *     scraper what to expect before it fetches anything.
 *
 * When those two disagree the tags lie, and nothing at runtime notices: the
 * image still renders, so it reads as working. That is exactly how og:image:type
 * stayed missing sitewide until 2026-08-01. One export, one truth.
 *
 * Changing the format here is a real decision, not a tidy-up. See the comment in
 * opengraph-image.tsx: PNG is what next/og natively emits and it put this card
 * at 762 KB, over WhatsApp's ceiling, which silently killed the preview.
 */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 } as const;

export const SOCIAL_CARD_CONTENT_TYPE = "image/jpeg" as const;

/**
 * The ceiling the card is kept under, in bytes.
 *
 * WhatsApp is the binding constraint at ~600 KB and it fails closed: an image
 * over the limit is dropped with no error, no fallback, and a preview that looks
 * merely image-less rather than broken. Facebook allows 8 MB and Twitter 5 MB,
 * so nothing else here is close to load-bearing.
 *
 * 300 KB, not 600 KB, because reports of the real cutoff vary and a card that
 * sits just under a limit you inferred is a card that breaks on a bad day.
 * Current output is ~204 KB at JPEG q95. Enforced by scripts/verify-og-size.mjs.
 */
export const SOCIAL_CARD_MAX_BYTES = 300 * 1024;

import type { Metadata } from "next";
import { PAGE_CARD_ALT, pageCardUrl, type PageCardSlug } from "./pageCards";

/**
 * Give a page its own social card, on both the Open Graph and the Twitter
 * surfaces. Twitter is set explicitly because the root layout's file-convention
 * image otherwise wins there: a page that overrides only `openGraph.images`
 * ships the new picture to Facebook, WhatsApp and Slack and the old one to X.
 */
export function withSocialCard(meta: Metadata, slug: PageCardSlug): Metadata {
  const image = {
    url: pageCardUrl(slug),
    width: SOCIAL_CARD_SIZE.width,
    height: SOCIAL_CARD_SIZE.height,
    alt: PAGE_CARD_ALT[slug],
    type: SOCIAL_CARD_CONTENT_TYPE,
  };
  return {
    ...meta,
    openGraph: { ...(meta.openGraph ?? {}), images: [image] },
    twitter: {
      card: "summary_large_image",
      ...(meta.twitter ?? {}),
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
