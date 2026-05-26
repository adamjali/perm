/**
 * JsonLdScript — server-side JSON-LD <script> emitter.
 *
 * Centralizes the JSON-LD <script type="application/ld+json"> emission for
 * schema.org structured data. The site ships several of these (FAQPage on
 * homepage + /faq, BreadcrumbList + ItemList on listings, Article schemas on
 * detail pages, homepage aggregateRating partial) and they previously
 * inlined the same dangerouslySetInnerHTML pattern at every call site.
 *
 * Schemas are ALWAYS built server-side from hardcoded constants (page
 * content, post frontmatter); no untrusted user input reaches this
 * component. CSP allows the inline JSON-LD via 'unsafe-inline' on
 * script-src (next.config.ts).
 */

export interface JsonLdScriptProps {
  /** A schema.org object built server-side from hardcoded data. */
  schema: unknown;
}

export function JsonLdScript({ schema }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
