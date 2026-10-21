/**
 * The site's still pictures (scripts/spot-pictures/build.mjs): every file the manifest names
 * exists at its declared size and under the size cap, nothing stray sits beside them, every
 * picture is used, every use makes its alt decision, and the component loads one theme's file.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SPOT_PICTURES, type SpotPictureName } from "@/lib/spotPictures";
import { TOPICS } from "@/lib/content/topics";
import { SpotPicture } from "../spot-picture";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const CAP_BYTES = 240 * 1024;
const entries = Object.entries(SPOT_PICTURES) as [SpotPictureName, (typeof SPOT_PICTURES)[SpotPictureName]][];

function files(p: (typeof SPOT_PICTURES)[SpotPictureName]): string[] {
  return "light" in p ? [p.light, p.dark] : [p.dark];
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "__tests__") walk(full, out);
    } else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

describe("the picture files", () => {
  it("names a sane number of pictures", () => {
    expect(entries.length).toBeGreaterThanOrEqual(18);
  });

  it.each(entries)("%s: each file exists at its declared size, under the cap, with a name", (_, p) => {
    for (const file of files(p)) {
      const svg = readFileSync(path.join(PUBLIC, file), "utf8");
      expect(Buffer.byteLength(svg), file).toBeLessThanOrEqual(CAP_BYTES);
      const open = svg.slice(0, svg.indexOf(">") + 1);
      expect(open, file).toContain(`viewBox="0 0 ${p.width} ${p.height}"`);
      expect(open, file).toContain(`width="${p.width}"`);
      expect(open, file).toContain(`height="${p.height}"`);
      expect(open, file).toMatch(/role="img" aria-label="[^"]{12,}"/);
      // no motion: the site's calm rules keep self-running animation off
      expect(svg, file).not.toMatch(/class="am-/);
    }
  });

  it("keeps nothing in the folder the manifest doesn't name", () => {
    const named = new Set(entries.flatMap(([, p]) => files(p)).map((f) => path.basename(f)));
    const onDisk = readdirSync(path.join(PUBLIC, "images", "spots"));
    expect(onDisk.filter((f) => !named.has(f))).toEqual([]);
  });

  it("gives every topic a picture the manifest holds", () => {
    for (const list of Object.values(TOPICS)) for (const t of list) expect(SPOT_PICTURES, t.id).toHaveProperty(t.picture);
  });
});

describe("where the pictures are used", () => {
  const sources = walk(path.join(ROOT, "src")).map((f) => ({ f, src: readFileSync(f, "utf8") }));
  const uses = sources.flatMap(({ f, src }) => [...src.matchAll(/<SpotPicture\b([^>]*?)\/>/g)].map((m) => ({ f, attrs: m[1] })));

  it("finds the uses", () => {
    expect(uses.length).toBeGreaterThanOrEqual(7);
  });

  it("makes the alt decision at every use", () => {
    for (const { f, attrs } of uses) expect(attrs, path.relative(ROOT, f)).toMatch(/\balt=(""|"[^"]{12,}"|\{)/);
  });

  it("uses every picture somewhere", () => {
    const all = sources.map(({ src }) => src).join("\n");
    const topicPictures = new Set(Object.values(TOPICS).flatMap((l) => l.map((t) => t.picture)));
    for (const [name] of entries) {
      const used = topicPictures.has(name) || all.includes(`"${name}"`);
      expect(used, name).toBe(true);
    }
  });
});

describe("SpotPicture", () => {
  it("draws both themes' files, lazily, and hides a decorative one from screen readers", () => {
    const { container } = render(<SpotPicture name="topic-queue" alt="" className="w-24" />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.getAttribute("aria-hidden")).toBe("true");
    expect(wrap.className).toContain("w-24");
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual(["/images/spots/topic-queue-light.svg", "/images/spots/topic-queue-dark.svg"]);
    for (const img of imgs) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("decoding")).toBe("async");
      expect(img.getAttribute("width")).toBe("160");
      expect(img.getAttribute("alt")).toBe("");
    }
    // the other theme's file has no box, so the browser never fetches it
    expect(imgs[0]!.className).toContain("dark:hidden");
    expect(imgs[1]!.className).toMatch(/(^| )hidden( |$)/);
    expect(imgs[1]!.className).toContain("dark:block");
  });

  it("draws a dark band's picture once, and speaks a picture given words", () => {
    const { container } = render(<SpotPicture name="security-vault" alt="A cabinet of separate locked doors." />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.hasAttribute("aria-hidden")).toBe(false);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute("alt")).toBe("A cabinet of separate locked doors.");
  });
});
