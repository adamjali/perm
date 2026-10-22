/**
 * @vitest-environment node
 *
 * "Browse by topic" renders whole on the server: one card per topic with its count, its three newest
 * articles and a link to its section, the first card the one showing, and no topic name as a heading
 * (the listing below has an h2 per topic).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getAllPosts } from "@/lib/content";
import { topicsFor } from "@/lib/content/topics";
import { TopicStack, topicCards } from "../TopicStack";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe.each(["guides", "blog"] as const)("TopicStack on /%s", (type) => {
  const posts = getAllPosts(type);
  const cards = topicCards(posts, type);
  const html = renderToStaticMarkup(<TopicStack posts={posts} type={type} />);
  const noun = type === "guides" ? ["guide", "guides"] : ["post", "posts"];

  it("has a card for every topic that holds an article", () => {
    const holding = topicsFor(type).filter((t) => posts.some((p) => p.meta.category === t.id));
    expect(holding.length).toBeGreaterThan(2);
    expect(cards.map((c) => c.topic.id)).toEqual(holding.map((t) => t.id));
    expect((html.match(/data-step-item="/g) ?? []).length).toBe(holding.length);
  });

  it("gives each card its count, its three newest and a link to its section", () => {
    for (const c of cards) {
      const n = c.count === 1 ? noun[0] : noun[1];
      expect(html).toContain(`${c.count} ${n}`);
      expect(html).toContain(`href="/${type}?topic=${c.topic.id}#articles"`);
      expect(c.newest.length).toBe(Math.min(3, c.count));
      for (const p of c.newest) expect(html).toContain(`href="/${type}/${p.slug}"`);
    }
  });

  it("shows the first card first, before any script runs", () => {
    expect(html).toMatch(/data-step-item="0" data-on="true"/);
    expect(html).toMatch(/data-step-item="1" data-on="false"/);
  });

  it("names topics in words, never as a heading", () => {
    for (const c of cards) {
      expect(html).toContain(esc(c.topic.label));
      expect(html).not.toMatch(new RegExp(`<h[1-6][^>]*>${esc(c.topic.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`));
    }
    expect((html.match(/<h2/g) ?? []).length).toBe(1);
  });

  it("falls back to the plain layout when scripts are off", () => {
    expect(html).toContain("<noscript><style>");
  });
});
