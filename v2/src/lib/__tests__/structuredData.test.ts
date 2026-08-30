import { describe, it, expect } from "vitest";
import {
  getDatasetSchema,
  SCHEMA_IDS,
  getSoftwareApplicationSchema,
  getOrganizationSchema,
  getWebSiteSchema,
  getFAQPageSchema,
  getHomepageRatingPartialSchema,
} from "../structuredData";
import { GITHUB_REPO_URL } from "@/lib/constants/externalLinks";

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

  it("carries the lowercase domain as Google's documented backup name", () => {
    // REVERSED on 2026-08-29. This test used to assert the opposite, on the
    // belief that listing the URL form caused Google to print the URL. Google's
    // site-names doc says to do exactly this: "add your domain or subdomain
    // name as your alternative name", and it "needs to be in all lowercase ...
    // for our system to detect this as a site name preference."
    expect(schema.alternateName).toContain("permtracker.app");
  });

  it("uses the bare lowercase host, never a URL", () => {
    // A scheme or a trailing slash is NOT the domain form Google detects, and
    // an uppercase character disqualifies it outright.
    for (const alt of schema.alternateName) {
      expect(alt).not.toMatch(/^https?:\/\//);
      expect(alt).not.toMatch(/\//);
      if (alt.includes(".")) expect(alt).toBe(alt.toLowerCase());
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
    expect(schema.sameAs).toEqual([GITHUB_REPO_URL]);
    // Defensive: prevent regression to the placeholder bare URL
    expect(schema.sameAs).not.toContain("https://github.com");
  });

  // This markup is served on every page and read by crawlers, so a foreign
  // account here republishes exactly the brand-to-person association that was
  // deliberately removed.
  //
  // Deliberately an allowlist. The obvious version blocklists the old personal
  // handles, but that writes them back into a public repo to assert their
  // absence, and it only catches the two strings someone thought to list.
  // Requiring every entry to be brand-owned catches any account, including ones
  // that do not exist yet.
  it("only links the brand to brand-owned destinations", () => {
    const sameAs = (schema as { sameAs?: string[] }).sameAs ?? [];
    expect(sameAs.length).toBeGreaterThan(0);
    for (const url of sameAs) {
      expect(url.startsWith(GITHUB_REPO_URL)).toBe(true);
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

  it("declares the same applicationCategory as the @graph node it shares an @id with", () => {
    // Both nodes carry SCHEMA_IDS.software(), so they are ONE entity. When this
    // partial still said 'BusinessApplication' and the graph node said
    // 'WebApplication', that entity asserted two categories at once. Measured
    // live on 2026-08-29 before the fix.
    const graphNode = getSoftwareApplicationSchema(BASE);
    expect(partial.applicationCategory).toBe(graphNode.applicationCategory);
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

describe("getDatasetSchema", () => {
  const BASE_URL = "https://permtracker.app";
  const base = getDatasetSchema(BASE_URL, {
    name: "Microsoft Corporation PERM filings",
    description: "PERM filing record from DOL disclosure data.",
    url: `${BASE_URL}/perm-employers/microsoft-corporation`,
  });

  it("links creator by @id instead of minting a fourth anonymous Organization", () => {
    // Ten hand-rolled copies each wrote `{"@type":"Organization","name":"PERM
    // Tracker"}` inline, so the Dataset attached to a nameless duplicate rather
    // than the entity the WebSite and SoftwareApplication nodes publish under.
    expect(base.creator).toEqual({ "@id": SCHEMA_IDS.organization(BASE_URL) });
  });

  it("always carries provenance, licence and coverage", () => {
    expect(base.isBasedOn).toContain("dol.gov");
    expect(base.license).toBe(`${BASE_URL}/terms`);
    expect(base.spatialCoverage).toEqual({ "@type": "Place", name: "United States" });
  });

  it("OMITS the dating fields when the caller has nothing measured to pass", () => {
    // The whole point of making these parameters: a baked-in window is wrong
    // the day the next quarterly lands and still looks authoritative. Absent is
    // honest; stale is not.
    expect(base).not.toHaveProperty("temporalCoverage");
    expect(base).not.toHaveProperty("dateModified");
  });

  it("emits the dating fields when the caller measured them", () => {
    const dated = getDatasetSchema(BASE_URL, {
      name: "n",
      description: "d",
      url: BASE_URL,
      temporalCoverage: "2023-10-01/2026-06-30",
      dateModified: "2026-06-30",
      variableMeasured: ["filings", "approval rate"],
    });
    expect(dated.temporalCoverage).toBe("2023-10-01/2026-06-30");
    expect(dated.dateModified).toBe("2026-06-30");
    expect(dated.variableMeasured).toEqual(["filings", "approval rate"]);
  });
});
