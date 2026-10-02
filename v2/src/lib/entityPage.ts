/**
 * What the three entity detail pages (employers, law firms, occupations)
 * build the same way: their prerendered slugs, their metadata and their
 * structured data.
 *
 * @see src/components/entities/EntityPageParts.tsx for the parts they render alike
 */

import type { Metadata } from "next";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { SITE_URL } from "@/lib/constants/site";
import type { EntityKind } from "@/lib/entityPayload";
import { openGraphBaseNoImage } from "@/lib/openGraphBase";
import { getDatasetSchema } from "@/lib/structuredData";
import { listByKind, PRERENDERED_ENTITY_HEAD } from "@/lib/turso/entities";
import type { DatasetFreshness } from "@/lib/turso/publicData";

/** DOL's own denial rate, used when the aggregate document cannot be read. */
export const FALLBACK_BASELINE_DENIAL_PCT = 2.57;

/**
 * The slugs prerendered at build: the head of the kind's ranking, read from
 * the entity table so each one is a slug `getBySlug` can find. The rest
 * render on first request.
 */
export async function entityStaticParams(kind: EntityKind): Promise<{ slug: string }[]> {
  const rows = await listByKind(kind, PRERENDERED_ENTITY_HEAD);
  return rows.map((r) => ({ slug: r.slug }));
}

/**
 * An entity page's metadata. The canonical and the Open Graph URL name the
 * same path. A page under the floor for its own page (`hasOwnPage`) renders
 * for people and asks not to be indexed; the sitemap omits it too.
 */
export function entityMetadata({
  title,
  absolute,
  description,
  path,
  noindex = false,
}: {
  /** From `entityTitle`, with `absolute` when the brand suffix had to go. */
  title: string;
  absolute: boolean;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  return {
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...openGraphBaseNoImage,
      title: `${title} | PERM Tracker`,
      description,
      url: path,
    },
    // Segment-level, so the root layout's twitter.images doesn't win: the
    // route's own card then fills twitter:image as well as og:image.
    twitter: { card: "summary_large_image" },
  };
}

/**
 * The page's JSON-LD: a Dataset dated by DOL's own as-of for the disclosure
 * corpus (never the build date, which would claim the figures changed on
 * every deploy), and the breadcrumb trail ending in this page's name.
 */
export function entityJsonLd({
  path,
  name,
  dataset,
  freshness,
}: {
  path: string;
  /** The page's own name, last in the breadcrumb trail. */
  name: string;
  dataset: { name: string; description: string; variableMeasured: string[] };
  freshness: Record<string, DatasetFreshness>;
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      getDatasetSchema(SITE_URL, {
        name: dataset.name,
        description: dataset.description,
        url: `${SITE_URL}${path}`,
        dateModified: freshness["perm-cases"]?.asOf ?? undefined,
        variableMeasured: dataset.variableMeasured,
      }),
      breadcrumbSchema(path, name),
    ],
  };
}
