import type { Metadata } from "next";
import { SOCIAL_CARD_SIZE, SOCIAL_CARD_CONTENT_TYPE } from "./socialCard";

/**
 * Shared Open Graph defaults that every per-page `openGraph` override must
 * spread to preserve.
 *
 * Why this exists: Next.js 16 metadata is shallowly merged. When a page exports
 * its own `openGraph` object, Next.js REPLACES the layout's `openGraph` entirely
 *, `siteName`, `locale`, `type`, `images` are all dropped from the rendered
 * <head> unless re-specified.
 * (https://nextjs.org/docs/app/api-reference/functions/generate-metadata#merging)
 *
 * That's how `og:site_name` went missing from this site's pages and why Google
 * fell back to the URL as the displayed site name. Spread `openGraphBase` into
 * every per-page `openGraph` to keep these signals consistent.
 *
 * Usage:
 *   openGraph: { ...openGraphBase, title: "...", description: "...", url: "/x" }
 *
 * Why `satisfies` (not `as const`): the real wins are (a) type-check the
 * literal against `Metadata['openGraph']` at definition time (catches typos
 * like a misspelled `type` value), and (b) keep the object non-`readonly` so
 * consumers can spread + override its fields cleanly. The article-type override
 * in `createContentDetailPage.tsx` works fine either way, TypeScript widens
 * `type` through the spread regardless.
 *
 * Image paths are relative to `metadataBase` (set in `src/app/layout.tsx`), so
 * `/opengraph-image` resolves to `https://permtracker.app/opengraph-image`.
 *
 * CRITICAL: content-detail pages (`createContentDetailPage.tsx`) destructure
 * `images` off this base before spreading so Next.js can merge their per-slug
 * `opengraph-image.tsx`. See the comment there for the
 * `resolve-metadata.js:148` `hasOwnProperty('images')` check.
 */
/**
 * The site-wide social card descriptor, declared once.
 *
 * `type` must match the `contentType` export of `src/app/opengraph-image.tsx`.
 * It is not cosmetic: it lets a scraper know the format without a HEAD request,
 * and it was absent from every page until 2026-08-01 because this object was the
 * only place it could be added and nothing checked for it.
 *
 * Exported separately so the Twitter card in `src/app/layout.tsx` can reuse the
 * same descriptor instead of restating the URL and alt text.
 */
export const socialCardImage = {
  url: "/opengraph-image",
  width: SOCIAL_CARD_SIZE.width,
  height: SOCIAL_CARD_SIZE.height,
  type: SOCIAL_CARD_CONTENT_TYPE,
  alt: "PERM Tracker - Deadline Management for Immigration Attorneys",
} as const;

export const openGraphBase = {
  siteName: "PERM Tracker",
  locale: "en_US",
  type: "website",
  images: [socialCardImage],
} satisfies NonNullable<Metadata["openGraph"]>;
