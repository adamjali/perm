import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";
import { describe, expect, it } from "vitest";

import { TOPICS } from "@/lib/content/topics";

type Entry = { type: string; slug: string; meta: { title: string; category?: string } };

// Read the files directly: the shared unit pool can carry another file's fs mock.
function getAllPosts(type?: string): Entry[] {
  const types = type ? [type] : ["blog", "guides", "changelog"];
  return types.flatMap((t) =>
    readdirSync(join(process.cwd(), "content", t))
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => ({ type: t, slug: f.slice(0, -4), meta: matter(readFileSync(join(process.cwd(), "content", t, f), "utf8")).data as Entry["meta"] })),
  );
}

describe("article topics", () => {
  for (const type of ["guides", "blog"] as const) {
    it(`files every ${type} article under exactly one known topic, and leaves no topic empty`, () => {
      const posts = getAllPosts(type);
      expect(posts.length).toBeGreaterThan(10);
      const ids = new Set(TOPICS[type].map((t) => t.id));
      const unfiled = posts.filter((p) => !ids.has(p.meta.category ?? "")).map((p) => p.slug);
      expect(unfiled).toEqual([]);
      for (const t of TOPICS[type]) {
        expect(posts.some((p) => p.meta.category === t.id), `${type}: ${t.id} has no articles`).toBe(true);
      }
    });
  }

  it("files changelog entries as a release, a feature or a correction", () => {
    for (const p of getAllPosts("changelog")) {
      expect(["Release", "Feature", "Correction"]).toContain(p.meta.category);
    }
  });

  it("titles every article in sentence case, like every other heading on the site", () => {
    // A capital after the first word is allowed only on a word that is always
    // capitalised: an acronym, a form number, a proper name.
    const allowed = /^(PERM|PERMs|DOL|DOL's|USCIS|USCIS's|I-\d+J?|EB-\d|NIW|RFI|NORD|BALCA|LCA|LCAs|H-1B|H-2A|H-2B|CW-1|EAD|PWD|FLAG|OFLC|India|Emma|Supplement|J|Other|Workers|Tracker|API|US|January|February|March|April|May|June|July|August|September|October|November|December|2\.0|\d.*)$/;
    const offenders: string[] = [];
    for (const p of getAllPosts()) {
      // A new sentence after "?" or "." starts with a capital.
      for (const sentence of p.meta.title.split(/[.?]\s+/)) {
        const words = sentence.replace(/[():?,.]/g, " ").split(/\s+/).filter(Boolean);
        for (const w of words.slice(1)) {
          if (/^[A-Z]/.test(w) && !allowed.test(w)) offenders.push(`${p.type}/${p.slug}: ${w}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
