import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KNOWN_PERSON_AUTHORS } from "@/lib/constants/externalLinks";
import { CONTENT_TYPE_CONFIG } from "../types";
import { describe, it, expect } from "vitest";
import {
  generateArticleSchema,
  generateHowToSchema,
  generateBreadcrumbSchema,
  generateItemListSchema,
} from "../seo";
import type { PostMeta, ContentType, PostSummary } from "../types";

const BASE_URL = "https://permtracker.app";

function createTestMeta(overrides: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "Test Article Title",
    description: "A test description for the article.",
    date: "2025-06-15",
    author: "PERM Tracker",
    tags: ["perm", "immigration"],
    readingTime: "5 min read",
    published: true,
    ...overrides,
  };
}

describe("generateArticleSchema", () => {
  const slug = "test-article";
  const type: ContentType = "blog";

  it("points Speakable at elements every article renders exactly once", () => {
    // "first h2 + p" matched nothing on 8 of 77 live articles (a table or
    // list follows the heading); these two matched once on all 77, Oct 7 2026.
    const schema = generateArticleSchema(createTestMeta(), slug, type);
    expect(schema.speakable.cssSelector).toEqual([".article-description", ".article-content > p:first-of-type"]);
    const dir = join(__dirname, "..", "..", "..", "components", "content");
    expect(readFileSync(join(dir, "ArticleHeader.tsx"), "utf8")).toMatch(/className="article-description /);
    expect(readFileSync(join(dir, "ArticleBody.tsx"), "utf8")).toMatch(/className="article-content /);
  });

  it("returns correct @context and @type", () => {
    const schema = generateArticleSchema(createTestMeta(), slug, type);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Article");
  });

  it("sets headline from meta.title", () => {
    const meta = createTestMeta({ title: "My Custom Headline" });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.headline).toBe("My Custom Headline");
  });

  it("sets description from meta.description", () => {
    const meta = createTestMeta({ description: "Custom description here." });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.description).toBe("Custom description here.");
  });

  it("uses meta.image when provided (prepends BASE_URL)", () => {
    const meta = createTestMeta({ image: "/images/featured.png" });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.image).toBe(`${BASE_URL}/images/featured.png`);
  });

  it("falls back to opengraph-image when no meta.image", () => {
    const meta = createTestMeta({ image: undefined });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.image).toBe(`${BASE_URL}/opengraph-image`);
  });

  it("uses meta.updated for dateModified when available", () => {
    const meta = createTestMeta({
      date: "2025-01-01",
      updated: "2025-06-01",
    });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.datePublished).toBe("2025-01-01T00:00:00+00:00");
    expect(schema.dateModified).toBe("2025-06-01T00:00:00+00:00");
  });

  it("falls back to meta.date for dateModified when no updated", () => {
    const meta = createTestMeta({ date: "2025-03-10", updated: undefined });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.dateModified).toBe("2025-03-10T00:00:00+00:00");
  });

  it("constructs correct mainEntityOfPage URL from type and slug", () => {
    const schema = generateArticleSchema(
      createTestMeta(),
      "my-slug",
      "tutorials"
    );
    expect(schema.mainEntityOfPage).toEqual({
      "@type": "WebPage",
      "@id": `${BASE_URL}/tutorials/my-slug`,
    });
  });

  it("joins tags as comma-separated keywords", () => {
    const meta = createTestMeta({ tags: ["perm", "labor", "dol"] });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.keywords).toBe("perm, labor, dol");
  });
});

describe("generateHowToSchema", () => {
  const slug = "setup-guide";

  it("returns correct @context and @type", () => {
    const schema = generateHowToSchema(createTestMeta(), slug);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("HowTo");
  });

  it("sets name from meta.title", () => {
    const meta = createTestMeta({ title: "How to File PERM" });
    const schema = generateHowToSchema(meta, slug);
    expect(schema.name).toBe("How to File PERM");
  });

  it("omits image when not provided", () => {
    const meta = createTestMeta({ image: undefined });
    const schema = generateHowToSchema(meta, slug);
    expect(schema.image).toBeUndefined();
  });

  it("includes image with BASE_URL when provided", () => {
    const meta = createTestMeta({ image: "/images/howto.png" });
    const schema = generateHowToSchema(meta, slug);
    expect(schema.image).toBe(`${BASE_URL}/images/howto.png`);
  });

  it("maps steps with correct position numbers", () => {
    const steps = [
      { name: "Step One", text: "Do this first." },
      { name: "Step Two", text: "Then do this." },
      { name: "Step Three", text: "Finally this." },
    ];
    const schema = generateHowToSchema(createTestMeta(), slug, steps);
    expect(schema.step).toEqual([
      { "@type": "HowToStep", position: 1, name: "Step One", text: "Do this first." },
      { "@type": "HowToStep", position: 2, name: "Step Two", text: "Then do this." },
      { "@type": "HowToStep", position: 3, name: "Step Three", text: "Finally this." },
    ]);
  });

  it("returns empty step array when no steps provided", () => {
    const schema = generateHowToSchema(createTestMeta(), slug);
    expect(schema.step).toEqual([]);
  });
});

describe("generateBreadcrumbSchema", () => {
  it("returns correct @context and @type", () => {
    const schema = generateBreadcrumbSchema([
      { name: "Home", href: "/" },
    ]);
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("BreadcrumbList");
  });

  it("maps items with correct positions starting at 1", () => {
    const items = [
      { name: "Home", href: "/" },
      { name: "Blog", href: "/blog" },
      { name: "Article", href: "/blog/my-post" },
    ];
    const schema = generateBreadcrumbSchema(items);
    expect(schema.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: "Article", item: `${BASE_URL}/blog/my-post` },
    ]);
  });

  it("prepends BASE_URL to each href", () => {
    const schema = generateBreadcrumbSchema([
      { name: "Guides", href: "/guides" },
    ]);
    expect(schema.itemListElement[0].item).toBe(`${BASE_URL}/guides`);
  });

  it("handles single item", () => {
    const schema = generateBreadcrumbSchema([
      { name: "Home", href: "/" },
    ]);
    expect(schema.itemListElement).toHaveLength(1);
    expect(schema.itemListElement[0].position).toBe(1);
  });

  it("handles multiple items", () => {
    const items = [
      { name: "Home", href: "/" },
      { name: "Tutorials", href: "/tutorials" },
      { name: "Getting Started", href: "/tutorials/getting-started" },
      { name: "Step 1", href: "/tutorials/getting-started/step-1" },
    ];
    const schema = generateBreadcrumbSchema(items);
    expect(schema.itemListElement).toHaveLength(4);
    expect(schema.itemListElement[3].position).toBe(4);
    expect(schema.itemListElement[3].name).toBe("Step 1");
  });
});

describe("generateItemListSchema", () => {
  function createTestPost(overrides: Partial<PostMeta> & { slug?: string; type?: ContentType } = {}): PostSummary {
    const { slug = "test-post", type = "blog", ...metaOverrides } = overrides;
    return {
      slug,
      type,
      meta: createTestMeta(metaOverrides),
    };
  }

  it("returns correct @context, @type, and name", () => {
    const schema = generateItemListSchema([createTestPost()], "blog");
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("ItemList");
    expect(schema.name).toBe("PERM Tracker Blog");
  });

  it("capitalizes the listing name from the content type", () => {
    expect(generateItemListSchema([], "tutorials").name).toBe("PERM Tracker Tutorials");
    expect(generateItemListSchema([], "guides").name).toBe("PERM Tracker Guides");
    expect(generateItemListSchema([], "resources").name).toBe("PERM Tracker Resources");
  });

  it("emits one ListItem per post with its position, url and name", () => {
    const posts = [
      createTestPost({ slug: "first", title: "First Post" }),
      createTestPost({ slug: "second", title: "Second Post" }),
    ];
    const schema = generateItemListSchema(posts, "blog");
    expect(schema.numberOfItems).toBe(2);
    expect(schema.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, url: `${BASE_URL}/blog/first`, name: "First Post" },
      { "@type": "ListItem", position: 2, url: `${BASE_URL}/blog/second`, name: "Second Post" },
    ]);
  });

  it("keeps each entry to Google's summary-page shape, with no thin Article inside", () => {
    // datePublished on a ListItem is a schema.org error (it flagged all five
    // listing pages in Site Audit); nesting an Article with only a name and
    // dates made a second, incomplete Article for each URL (Oct 7 2026). The
    // dates and the full Article live on each article's own page.
    const schema = generateItemListSchema([createTestPost({ date: "2026-01-15", updated: "2026-03-04" })], "blog");
    const listItem = schema.itemListElement[0] as Record<string, unknown>;
    expect(Object.keys(listItem).sort()).toEqual(["@type", "name", "position", "url"]);
    expect(JSON.stringify(schema)).not.toMatch(/"Article"|datePublished|dateModified/);
  });

  it("returns an empty list with numberOfItems=0 for an empty posts array", () => {
    const schema = generateItemListSchema([], "blog");
    expect(schema.itemListElement).toEqual([]);
    expect(schema.numberOfItems).toBe(0);
  });
});

describe("article authorship", () => {
  const [registered, profile] = Object.entries(KNOWN_PERSON_AUTHORS)[0]!;
  const person = generateArticleSchema(
    createTestMeta({ author: registered }), "s", "blog");
  const org = generateArticleSchema(
    createTestMeta({ author: CONTENT_TYPE_CONFIG.guides.byline }), "s", "guides");

  it("emits a Person, with a corroborating profile, only for a registered name", () => {
    // sameAs is what turns a name into a checkable identity rather than a
    // string. A Person with no external reference is barely better than an
    // Organization.
    const a = person.author as Record<string, unknown>;
    expect(a["@type"]).toBe("Person");
    expect(a.name).toBe(registered);
    expect(a.url).toBe(profile.url);
    expect(a.sameAs).toContain(profile.url);
  });

  it("emits a team byline as an Organization tied to the site's own", () => {
    // Articles carry a team byline. Its node keeps its own name and points at
    // the shared Organization as its parent rather than reusing that @id under
    // a second name. This branch is also the safety property: a new name in a
    // frontmatter file cannot be published as a person with no profile behind
    // it.
    const a = org.author as Record<string, unknown>;
    expect(a["@type"]).toBe("Organization");
    expect(a.name).toBe("PERM Tracker data desk");
    expect(a.url).toBe(`${BASE_URL}/about`);
    expect(a.parentOrganization).toEqual({ "@id": `${BASE_URL}/#organization` });
    expect(a["@id"]).toBeUndefined();
  });

  it("never publishes a personal email or the operator's legal identity", () => {
    // This markup ships on every article and is read by crawlers. The persona
    // is the only identity that may appear in public output.
    //
    // THE FORBIDDEN WORDS ARE HASHED (Sep 25 2026). This file is public, and
    // its first version spelled out the very identifiers it guarded, which
    // made the test the one place in the repository that published them.
    // Each word of the markup is hashed and compared; the plain words never
    // appear here. Probe: add one of them to `org.name` and this goes red.
    const FORBIDDEN = new Set(["5bcd94d386bd0b0f", "2281e2633a8b9dc3", "575e500ddb529cc2", "dc9e896b65bf36fe"]);
    const digest = (w: string) => createHash("sha256").update(w).digest("hex").slice(0, 16);
    for (const schema of [person, org]) {
      const json = JSON.stringify(schema);
      expect(json).not.toMatch(/@gmail\.com/i);
      const words = json.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      expect(words.filter((w) => FORBIDDEN.has(digest(w)))).toEqual([]);
    }
  });
});
