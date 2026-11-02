import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import type { PostSummary } from "@/lib/content/types";
import ContentListing from "../ContentListing";
import ChangelogListing from "../ChangelogListing";

const post = (slug: string, date: string, extra: Partial<PostSummary["meta"]> = {}): PostSummary => ({
  slug,
  type: "guides",
  meta: { title: slug, description: `About ${slug}`, date, author: "", tags: [], readingTime: "5 min read", published: true, category: "queue", ...extra },
});

const POSTS = [
  post("Older guide", "2026-09-01"),
  post("Newer guide", "2026-10-20"),
  post("Practice guide", "2026-10-01", { tags: ["practice"], category: "deadlines" }),
];

afterEach(() => window.history.replaceState(null, "", "/"));

describe("the listings' filter and sort", () => {
  it("sorts into one list under a heading that says how, from the address", () => {
    window.history.replaceState(null, "", "/guides?sort=newest");
    render(<ContentListing posts={POSTS} type="guides" />);
    const list = screen.getByRole("region", { name: "All 3 guides, newest first" });
    expect(within(list).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Newer guide", "Practice guide", "Older guide"]);
    expect(screen.getByLabelText("Sort")).toHaveValue("newest");
  });

  it("keeps only the articles for the audience asked for", () => {
    window.history.replaceState(null, "", "/guides?for=practice&sort=title");
    render(<ContentListing posts={POSTS} type="guides" />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Practice guide"]);
    expect(screen.getByLabelText("For")).toHaveValue("practice");
  });

  it("lists by topic by default", () => {
    render(<ContentListing posts={POSTS} type="guides" />);
    expect(screen.queryByRole("region", { name: /^All 3 guides/ })).toBeNull();
    expect(screen.getByLabelText("Sort")).toHaveValue("topic");
  });

  it("filters the changelog by kind and sorts it", () => {
    window.history.replaceState(null, "", "/changelog?kind=Correction&sort=oldest");
    const entries = [
      post("A release", "2026-10-01", { category: "Release" }),
      post("First fix", "2026-09-01", { category: "Correction" }),
      post("Second fix", "2026-10-15", { category: "Correction" }),
    ];
    render(<ChangelogListing posts={entries} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["First fix", "Second fix"]);
    expect(screen.getByLabelText("Kind")).toHaveValue("Correction");
  });
});
