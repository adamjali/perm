import { describe, it, expect } from "vitest";
import {
  SCHEMA_IDS,
  getSoftwareApplicationSchema,
  getOrganizationSchema,
  getWebSiteSchema,
  getFAQPageSchema,
  getHomepageRatingPartialSchema,
} from "../structuredData";

const BASE = "https://permtracker.app";

describe("SCHEMA_IDS", () => {
  it("emits stable, fully-qualified @id fragments", () => {
    expect(SCHEMA_IDS.software(BASE)).toBe("https://permtracker.app/#software");
    expect(SCHEMA_IDS.organization(BASE)).toBe("https://permtracker.app/#organization");
    expect(SCHEMA_IDS.website(BASE)).toBe("https://permtracker.app/#website");
  });

  it("composes with any base URL (preview deployments, local dev)", () => {
    const preview = "https://perm-abc123.vercel.app";
    expect(SCHEMA_IDS.software(preview)).toBe("https://perm-abc123.vercel.app/#software");
    expect(SCHEMA_IDS.organization(preview)).toBe("https://perm-abc123.vercel.app/#organization");
  });
});

describe("getSoftwareApplicationSchema", () => {
  const schema = getSoftwareApplicationSchema(BASE);

  it("has correct @context and @type", () => {
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("SoftwareApplication");
  });

  it("creator cross-references the Organization @id (not an inline duplicate)", () => {
    expect(schema.creator).toEqual({ "@id": SCHEMA_IDS.organization(BASE) });
  });

  it("does NOT include aggregateRating in the root @graph schema", () => {
    // aggregateRating must only ship on pages where the rating is visible
    // (homepage, via getHomepageRatingPartialSchema). Shipping it in the root
    // @graph would put a rating on every page (/blog, /privacy, etc.) without
    // a visible widget — Google rich-results policy violation that can
    // suppress all rich results for the domain.
    expect(schema).not.toHaveProperty("aggregateRating");
  });

  it("offers, contactPoint, and feature list intact", () => {
    expect(schema.offers).toMatchObject({ "@type": "Offer", price: "0", priceCurrency: "USD" });
    expect(schema.featureList).toBeInstanceOf(Array);
    expect(schema.featureList.length).toBeGreaterThan(0);
  });
});

describe("getWebSiteSchema", () => {
  const schema = getWebSiteSchema(BASE);

  it("has correct @type and brand name", () => {
    expect(schema["@type"]).toBe("WebSite");
    expect(schema.name).toBe("PERM Tracker");
  });

  it("alternateName never contains the URL form (Google site-name policy)", () => {
    // Listing the URL ('permtracker.app') as an alternate site name is exactly
    // what was making Google display the URL as the site name in SERP.
    for (const alt of schema.alternateName) {
      expect(alt).not.toMatch(/\.app/);
      expect(alt).not.toMatch(/^https?:\/\//);
    }
  });

  it("publisher cross-references the Organization @id", () => {
    expect(schema.publisher).toEqual({ "@id": SCHEMA_IDS.organization(BASE) });
  });
});

describe("getOrganizationSchema", () => {
  const schema = getOrganizationSchema(BASE);

  it("has correct @type and required fields", () => {
    expect(schema["@type"]).toBe("Organization");
    expect(schema.name).toBe("PERM Tracker");
    expect(schema.url).toBe(BASE);
  });

  it("sameAs contains the real brand repo, not a placeholder", () => {
    expect(schema.sameAs).toEqual(["https://github.com/adamjali/perm"]);
    // Defensive: prevent regression to the placeholder bare URL
    expect(schema.sameAs).not.toContain("https://github.com");
  });

  // This markup is served on every page and read by crawlers, so a personal
  // account here would republish exactly the brand-to-person association that
  // was deliberately removed. Guard the class of mistake, not one string.
  it("never links the brand to a personal account", () => {
    const sameAs = (schema as { sameAs?: string[] }).sameAs ?? [];
    for (const url of sameAs) {
      expect(url).not.toMatch(/amohamed369|adamdragon/i);
    }
  });
});

describe("getFAQPageSchema", () => {
  it("wraps Q&As in mainEntity with the right @types", () => {
    const schema = getFAQPageSchema([
      { question: "Q1?", answer: "A1" },
      { question: "Q2?", answer: "A2" },
    ]);
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Q1?",
      acceptedAnswer: { "@type": "Answer", text: "A1" },
    });
  });
});

describe("getHomepageRatingPartialSchema", () => {
  const partial = getHomepageRatingPartialSchema(BASE);

  it("has @type SoftwareApplication and @id matching the root entity", () => {
    expect(partial["@type"]).toBe("SoftwareApplication");
    expect(partial["@id"]).toBe(SCHEMA_IDS.software(BASE));
    // This @id-merge contract is how Google attaches the rating to the
    // SoftwareApplication entity declared in the root @graph.
  });

  it("aggregateRating fields are present and string-typed (schema.org)", () => {
    expect(partial.aggregateRating).toMatchObject({
      "@type": "AggregateRating",
      ratingValue: expect.any(String),
      reviewCount: expect.any(String),
      bestRating: expect.any(String),
      worstRating: expect.any(String),
    });
  });

  it("rating values are well-formed numerics (Google parses them as numbers)", () => {
    const r = partial.aggregateRating;
    expect(Number(r.ratingValue)).toBeGreaterThan(0);
    expect(Number(r.reviewCount)).toBeGreaterThan(0);
    expect(Number(r.bestRating)).toBeGreaterThanOrEqual(Number(r.ratingValue));
    expect(Number(r.worstRating)).toBeLessThanOrEqual(Number(r.ratingValue));
  });
});
