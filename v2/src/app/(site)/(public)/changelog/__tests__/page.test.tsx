// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { PostSummary } from "@/lib/content/types";

// Stub the content layer + heavy children so we can test the page's structured
// data emission in isolation.
vi.mock("@/lib/content", () => ({
  getAllPosts: vi.fn(),
}));

vi.mock("@/components/content", () => ({
  ContentHero: () => null,
}));

vi.mock("@/components/content/ChangelogTimeline", () => ({
  default: () => null,
}));

import { getAllPosts } from "@/lib/content";
import ChangelogPage from "../page";

function mkPost(slug: string, date: string, updated?: string): PostSummary {
  return {
    slug,
    type: "changelog",
    meta: {
      title: `Changelog ${slug}`,
      description: "desc",
      date,
      ...(updated ? { updated } : {}),
      author: "PERM Tracker",
      tags: [],
      readingTime: "1 min read",
      published: true,
    },
  };
}

function parseLdJsonFromPage(): Record<string, unknown> {
  // Render the (Server) component to DOM; React's renderToString equivalent via RTL.
  // Server components are ordinary functions; we can invoke directly.
  vi.mocked(getAllPosts).mockReturnValue([
    mkPost("entry-one", "2026-01-15"),
    mkPost("entry-two", "2026-02-20", "2026-03-04"),
  ]);
  const tree = ChangelogPage();
  const { container } = render(tree);
  const script = container.querySelector('script[type="application/ld+json"]');
  expect(script).not.toBeNull();
  return JSON.parse(script!.innerHTML) as Record<string, unknown>;
}

describe("ChangelogPage structured data", () => {
  it("emits a @graph with the ItemList (the shared breadcrumb bar carries the BreadcrumbList)", () => {
    const ld = parseLdJsonFromPage();
    expect(ld["@context"]).toBe("https://schema.org");
    const graph = ld["@graph"] as Array<{ "@type": string }>;
    expect(graph).toBeInstanceOf(Array);
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("ItemList");
    // One BreadcrumbList per page, from SiteBreadcrumbs; a second here would conflict.
    expect(types).not.toContain("BreadcrumbList");
  });

  it("ItemList items point at anchor URLs (/changelog#<slug>), not 404-bound detail URLs", () => {
    const ld = parseLdJsonFromPage();
    const graph = ld["@graph"] as Array<{
      "@type": string;
      itemListElement?: Array<{ url: string }>;
    }>;
    const itemList = graph.find((n) => n["@type"] === "ItemList");
    expect(itemList).toBeDefined();
    const items = itemList!.itemListElement!;
    expect(items.length).toBe(2);
    for (const entry of items) {
      // Anchor URL shape, NOT a detail URL like /changelog/entry-one which would 404
      expect(entry.url).toMatch(/^https?:\/\/[^/]+\/changelog#[a-z0-9-]+$/);
      expect(entry.url).not.toMatch(/\/changelog\/[a-z0-9-]+$/);
    }
  });

  it("each ItemList entry is a position, an anchor URL and a name, with no thin Article", () => {
    // The nested Article carried only a name and dates, a second, incomplete
    // Article for each entry (Oct 7 2026). The dates show on the page itself.
    const ld = parseLdJsonFromPage();
    const graph = ld["@graph"] as Array<{ "@type": string; itemListElement?: Array<Record<string, unknown>> }>;
    const items = graph.find((n) => n["@type"] === "ItemList")!.itemListElement!;
    for (const it of items) expect(Object.keys(it).sort()).toEqual(["@type", "name", "position", "url"]);
    expect(JSON.stringify(items)).not.toMatch(/"Article"|datePublished/);
  });
});
