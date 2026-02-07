/**
 * StructuredData
 *
 * Server component that renders JSON-LD structured data for content pages.
 * Rendered inline as a script tag for immediate crawler availability.
 */

import type { PostMeta, ContentType } from "@/lib/content/types";
import { generateArticleSchema, generateBreadcrumbSchema } from "@/lib/content/seo";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";

interface StructuredDataProps {
  type: ContentType;
  slug: string;
  meta: PostMeta;
}

export default function StructuredData({ type, slug, meta }: StructuredDataProps) {
  const config = CONTENT_TYPE_CONFIG[type];

  const articleSchema = generateArticleSchema(meta, slug, type);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: config.plural, href: `/${type}` },
    { name: meta.title, href: `/${type}/${slug}` },
  ]);

  const jsonLd = JSON.stringify([articleSchema, breadcrumbSchema]);

  // JSON-LD content is generated server-side from trusted frontmatter data (not user input).
  // This is the recommended Next.js pattern for structured data: https://nextjs.org/docs/app/building-your-application/optimizing/metadata#json-ld
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd }}
    />
  );
}
