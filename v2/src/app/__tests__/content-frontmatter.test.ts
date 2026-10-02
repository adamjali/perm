import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content/types";

/**
 * Every content entry carries the same frontmatter keys as its siblings.
 *
 * Three changelog entries shipped without `tags` while the four older ones
 * had them, so the newest posts rendered visibly thinner than the ones they
 * replaced: no tag chips under the title. The owner spotted it by putting
 * two entries side by side. Nothing in the build cares, which is exactly why
 * it drifted.
 */

const ROOT = join(process.cwd(), "content");
const REQUIRED = ["title", "description", "date", "image", "imageAlt", "tags"];
const TYPES: ContentType[] = ["blog", "guides", "changelog"];

function frontmatter(raw: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---/.exec(raw);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]!] = kv[2]!;
  }
  return out;
}

describe("content frontmatter is consistent", () => {
  const files = TYPES.flatMap((t) => {
    let names: string[] = [];
    try {
      names = readdirSync(join(ROOT, t)).filter((f) => f.endsWith(".mdx"));
    } catch {
      return [];
    }
    return names.map((n) => ({ type: t, path: join(ROOT, t, n), name: `${t}/${n}` }));
  });

  it("scanned a plausible number of entries", () => {
    // A gate that cannot see its subject reports a perfect pass.
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(REQUIRED)("every entry declares %s", (key) => {
    const missing = files
      .filter((f) => frontmatter(readFileSync(f.path, "utf8"))[key] === undefined)
      .map((f) => f.name);
    expect(missing).toEqual([]);
  });

  it("descriptions fit inside what a SERP shows", () => {
    const tooLong = files
      .map((f) => ({
        name: f.name,
        len: (frontmatter(readFileSync(f.path, "utf8")).description ?? "")
          .replace(/^"|"$/g, "").length,
      }))
      .filter((d) => d.len > 155);
    expect(tooLong).toEqual([]);
  });

  it("every entry carries its type's team byline", () => {
    // Articles are credited to the site's team, not a named person. The
    // byline lives once, in CONTENT_TYPE_CONFIG, and each file states it.
    const wrong = files
      .map((f) => ({
        name: f.name,
        author: (frontmatter(readFileSync(f.path, "utf8")).author ?? "").replace(/^"|"$/g, ""),
        want: CONTENT_TYPE_CONFIG[f.type as ContentType].byline,
      }))
      .filter((a) => a.author !== a.want)
      .map((a) => `${a.name}: ${a.author || "(none)"}`);
    expect(wrong).toEqual([]);
  });

  it("an updated date is a real date, not before the publish date", () => {
    // `updated` is what the article header, the index cards, JSON-LD
    // dateModified, Open Graph and the sitemap show as the last revision.
    const bad = files
      .map((f) => {
        const fm = frontmatter(readFileSync(f.path, "utf8"));
        const date = (fm.date ?? "").replace(/^"|"$/g, "");
        const updated = fm.updated?.replace(/^"|"$/g, "");
        return { name: f.name, date, updated };
      })
      .filter((d) => d.updated !== undefined)
      .filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.updated!) || d.updated! < d.date)
      .map((d) => `${d.name}: ${d.date} -> ${d.updated}`);
    expect(bad).toEqual([]);
  });
});
