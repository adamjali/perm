/**
 * @vitest-environment node
 *
 * The guides and blog lists page twelve at a time, and every article still has its link in the page: search
 * engines follow links, not the page buttons. Cut to twelve on the server, /guides linked 29 of its 86 guides
 * and /blog 15 of 27 (measured live, Oct 22 2026).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getAllPosts } from "@/lib/content";
import ContentListing, { PER_PAGE } from "../ContentListing";

describe.each(["guides", "blog"] as const)("the /%s list", (type) => {
  const posts = getAllPosts(type);
  const html = renderToStaticMarkup(<ContentListing posts={posts} type={type} />);

  it("holds more articles than one page, or the test proves nothing", () => {
    expect(posts.length).toBeGreaterThan(PER_PAGE);
  });

  it("links every article from the server's HTML", () => {
    const linked = new Set([...html.matchAll(new RegExp(`href="/${type}/([a-z0-9-]+)"`, "g"))].map((m) => m[1]));
    for (const p of posts) expect(linked, p.slug).toContain(p.slug);
  });

  it("shows one page of them and hides the rest", () => {
    const hidden = (html.match(/<div class="hidden">/g) ?? []).length;
    expect(hidden).toBe(posts.length - PER_PAGE);
  });
});
