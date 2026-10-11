/**
 * Every article's picture is its own, made from a recorded source, and credited.
 *
 * scripts/article-heroes.json says where each article's picture comes from (a
 * licensed photograph, a page of an official form, a capture of the site) and
 * scripts/make_article_heroes.py writes it to /images/content/heroes/<type>/<slug>.webp.
 * Before that, 84 articles shared a dozen stock photos and illustrations, one of
 * them an AI drawing with invented timings. Inline figures come from
 * scripts/article-figures.json the same way, and every picture an article
 * names has to exist.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

type Meta = { image?: string; imageAlt?: string; imageCredit?: string };
type Entry = { key: string; body: string; meta: Meta };

const ROOT = process.cwd();
const TYPES = ["guides", "blog", "changelog"] as const;

// Read the files directly: the shared unit pool can carry another file's fs mock.
function articles(): Entry[] {
  return TYPES.flatMap((t) =>
    readdirSync(join(ROOT, "content", t))
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => {
        const parsed = matter(readFileSync(join(ROOT, "content", t, f), "utf8"));
        return { key: `${t}/${f.slice(0, -4)}`, body: parsed.content, meta: parsed.data as Meta };
      }),
  );
}

const heroes = JSON.parse(readFileSync(join(ROOT, "scripts", "article-heroes.json"), "utf8")) as Record<string, { credit?: string; alt?: string }>;

describe("article pictures", () => {
  const posts = articles();

  it("reads every article", () => {
    expect(posts.length).toBeGreaterThan(70);
  });

  it("gives every article its own picture, at its own path, from a recorded source", () => {
    const wrong = posts.filter((p) => p.meta.image !== `/images/content/heroes/${p.key}.webp`).map((p) => `${p.key}: ${p.meta.image}`);
    expect(wrong).toEqual([]);
    const unrecorded = posts.filter((p) => !heroes[p.key]).map((p) => p.key);
    expect(unrecorded).toEqual([]);
    const missing = posts.filter((p) => !existsSync(join(ROOT, "public", p.meta.image ?? "-"))).map((p) => p.key);
    expect(missing).toEqual([]);
  });

  it("credits every picture and describes it", () => {
    const bare = posts.filter((p) => !p.meta.imageCredit || !p.meta.imageAlt).map((p) => p.key);
    expect(bare).toEqual([]);
  });

  it("has no picture in the spec for an article that doesn't exist", () => {
    const keys = new Set(posts.map((p) => p.key));
    expect(Object.keys(heroes).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("names only pictures that exist inside the articles", () => {
    const missing: string[] = [];
    for (const p of posts) {
      for (const m of p.body.matchAll(/\bsrc="(\/images\/[^"]+)"/g)) {
        if (!existsSync(join(ROOT, "public", m[1]!))) missing.push(`${p.key}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
