import { describe, it, expect } from "vitest";
import {
  generateArticleSchema,
  generateHowToSchema,
  generateBreadcrumbSchema,
} from "../seo";
import type { PostMeta, ContentType } from "../types";

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
    expect(schema.datePublished).toBe("2025-01-01");
    expect(schema.dateModified).toBe("2025-06-01");
  });

  it("falls back to meta.date for dateModified when no updated", () => {
    const meta = createTestMeta({ date: "2025-03-10", updated: undefined });
    const schema = generateArticleSchema(meta, slug, type);
    expect(schema.dateModified).toBe("2025-03-10");
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
