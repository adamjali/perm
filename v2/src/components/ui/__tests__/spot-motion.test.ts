import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { liftShare, nearestIndex, parsePoints, REACH, towardIndex } from "../spot-motion";

describe("nearestIndex", () => {
  it("picks the item nearest the pointer", () => {
    expect(nearestIndex([[0, 0], [10, 0], [20, 0]], [12, 3])).toBe(1);
    expect(nearestIndex([[0, 0], [10, 0], [20, 0]], [100, 0])).toBe(2);
  });
});

describe("towardIndex", () => {
  it("picks the item pointing nearest the pointer's direction", () => {
    const dirs = [[[1, 0]], [[0, 1]], [[-1, 0]]] as Array<Array<[number, number]>>;
    expect(towardIndex(dirs, [5, 1])).toBe(0);
    expect(towardIndex(dirs, [0.2, 4])).toBe(1);
    expect(towardIndex(dirs, [-3, -1])).toBe(2);
  });

  it("counts any of an item's directions (a wheel's spokes)", () => {
    const dirs = [[[1, 0], [-1, 0]], [[0, 1], [0, -1]]] as Array<Array<[number, number]>>;
    expect(towardIndex(dirs, [0, -2])).toBe(1);
  });

  it("chooses nothing with the pointer on the pivot", () => {
    expect(towardIndex([[[1, 0]]], [0, 0])).toBe(-1);
  });
});

describe("liftShare", () => {
  it("lifts fully on the picture, eases off, and lets go past its reach", () => {
    expect(liftShare(0)).toBe(1);
    expect(liftShare(REACH / 2)).toBeCloseTo(0.5, 5);
    expect(liftShare(REACH)).toBe(0);
    expect(liftShare(REACH * 2)).toBe(0);
  });
});

describe("parsePoints", () => {
  it("reads pairs and drops anything else", () => {
    expect(parsePoints("1 2;3.5 -4")).toEqual([[1, 2], [3.5, -4]]);
    expect(parsePoints("1;x y")).toEqual([]);
    expect(parsePoints(undefined)).toEqual([]);
  });
});

describe("fetching a picture", () => {
  it("asks whether the file changed, so a copy kept from before a picture had moving parts can't stop it reacting", () => {
    const src = readFileSync(join(process.cwd(), "src", "components", "ui", "spot-motion.tsx"), "utf8");
    expect(src).not.toMatch(/cache:\s*"force-cache"/);
    expect(src).toMatch(/cache:\s*"no-cache"/);
  });
});

describe("the pictures carry what the runtime reads", () => {
  const dir = join(process.cwd(), "public", "images", "spots");
  const files = readdirSync(dir).filter((f) => f.endsWith(".svg"));

  it("every picture names an act, and its parts match it", () => {
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const svg = readFileSync(join(dir, f), "utf8");
      const act = svg.match(/<svg[^>]*data-spot-act="([a-z-]+)"/)?.[1];
      expect(act, f).toMatch(/^(near|show-near|toward|show-toward|lift)$/);
      if (act === "lift") expect(svg, f).toContain("data-spot-lift=");
      else expect((svg.match(/data-spot-item=""/g) ?? []).length, f).toBeGreaterThan(1);
      if (act === "toward" || act === "show-toward") {
        expect(svg, f).toMatch(/<svg[^>]*data-pivot="[-\d.]+ [-\d.]+"/);
        expect(svg, f).toMatch(/data-dir="[-\d.]+ [-\d.]+/);
      }
      if (act?.startsWith("show-")) expect(svg, `${f} shows one item when still`).toMatch(/data-spot-item=""(?: data-dir="[^"]*")?>/);
    }
  });

  it("every rule in a picture's style is scoped to the picture, so a copy in the page restyles nothing else", () => {
    for (const f of files) {
      const svg = readFileSync(join(dir, f), "utf8");
      const id = svg.match(/<svg[^>]*\sid="([^"]+)"/)?.[1];
      const css = svg.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ?? "";
      const loose = css
        .split("\n")
        .filter((l) => /^[.#a-z[]/i.test(l) && l.includes("{") && !l.startsWith("@"))
        .flatMap((l) => l.slice(0, l.indexOf("{")).split(","))
        .map((sel) => sel.trim())
        .filter((sel) => sel && !sel.startsWith(`#${id}`));
      expect(loose, f).toEqual([]);
    }
  });
});
