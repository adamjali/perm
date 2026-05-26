import type { Metadata } from "next";

/**
 * Shared Open Graph defaults that every per-page `openGraph` override must
 * spread to preserve.
 *
 * Why this exists: Next.js 16 metadata is shallowly merged. When a page exports
 * its own `openGraph` object, Next.js REPLACES the layout's `openGraph` entirely
 * — `siteName`, `locale`, `type`, `images` are all dropped from the rendered
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
 * For content-detail pages overriding `type` to "article", spread first and
 * then override (the `satisfies` typing below preserves enough inference to let
 * a child object widen `type` without a cast).
 *
 * Image paths are relative to `metadataBase` (set in `src/app/layout.tsx`), so
 * `/opengraph-image` resolves to `https://permtracker.app/opengraph-image`.
 */
export const openGraphBase = {
  siteName: "PERM Tracker",
  locale: "en_US",
  type: "website" as const,
  images: [
    {
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "PERM Tracker - Deadline Management for Immigration Attorneys",
    },
  ],
} satisfies NonNullable<Metadata["openGraph"]>;
