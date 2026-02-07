/**
 * StructuredData
 *
 * Server component that renders JSON-LD structured data for content pages.
 * Uses Next.js built-in Script approach for safety.
 */

import Script from "next/script";
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

  return (
    <Script
      id={`structured-data-${type}-${slug}`}
      type="application/ld+json"
      strategy="afterInteractive"
    >
      {jsonLd}
    </Script>
  );
}
