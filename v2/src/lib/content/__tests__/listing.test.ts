import { describe, expect, it } from "vitest";

import { audienceOf, forAudience, isForPractice, readMinutes, sortOf, sortPosts, sortedHeading } from "../listing";
import type { PostSummary } from "../types";

const post = (slug: string, date: string, extra: Partial<PostSummary["meta"]> = {}): PostSummary => ({
  slug,
  type: "guides",
  meta: { title: slug, description: "", date, author: "", tags: [], readingTime: "5 min read", published: true, ...extra },
});

const A = post("Alpha", "2026-10-01", { readingTime: "9 min read" });
const B = post("Bravo", "2026-10-20", { updated: "2026-10-21", tags: ["practice"] });
const C = post("Charlie", "2026-09-01", { updated: "2026-11-01", readingTime: "2 min read", category: "practice" });

describe("sorting the listings", () => {
  it("sorts by publish date both ways, by last change, by title and by length", () => {
    expect(sortPosts([A, B, C], "newest").map((p) => p.slug)).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(sortPosts([A, B, C], "oldest").map((p) => p.slug)).toEqual(["Charlie", "Alpha", "Bravo"]);
    expect(sortPosts([A, B, C], "updated").map((p) => p.slug)).toEqual(["Charlie", "Bravo", "Alpha"]);
    expect(sortPosts([C, B, A], "title").map((p) => p.slug)).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(sortPosts([A, B, C], "shortest").map((p) => p.slug)).toEqual(["Charlie", "Bravo", "Alpha"]);
    expect(sortPosts([C, A], "topic").map((p) => p.slug)).toEqual(["Charlie", "Alpha"]);
  });

  it("reads the address loosely: an unknown sort or audience is the default", () => {
    expect(sortOf("newest", "topic")).toBe("newest");
    expect(sortOf("<script>", "topic")).toBe("topic");
    expect(audienceOf("practice")).toBe("practice");
    expect(audienceOf("anyone")).toBe("");
  });

  it("says what the sorted list is", () => {
    expect(sortedHeading(88, "guides", "newest")).toBe("All 88 guides, newest first");
    expect(sortedHeading(3, "posts", "title")).toBe("All 3 posts, A to Z");
  });
});

describe("who an article is for", () => {
  it("splits practice articles from the ones for the person waiting", () => {
    expect([A, B, C].map(isForPractice)).toEqual([false, true, true]);
    expect(forAudience([A, B, C], "practice").map((p) => p.slug)).toEqual(["Bravo", "Charlie"]);
    expect(forAudience([A, B, C], "waiting").map((p) => p.slug)).toEqual(["Alpha"]);
    expect(forAudience([A, B, C], "")).toHaveLength(3);
  });

  it("puts an unreadable length last", () => {
    expect(readMinutes(post("x", "2026-01-01", { readingTime: "" }))).toBe(Number.POSITIVE_INFINITY);
  });
});
