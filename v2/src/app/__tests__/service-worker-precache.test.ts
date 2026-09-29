import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The service worker downloads its precache the moment a browser installs it,
 * on every visitor's connection. It had grown to 186 public files (18.5 MB) and
 * all 340 build chunks, for no offline benefit: documents are NetworkOnly in
 * sw.ts. It now precaches only the two icons a push notification shows
 * (Sep 29 2026). This keeps a new glob from quietly growing it back.
 */
const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

describe("the service worker precache", () => {
  it("names only plain files that exist, no folders or globs", () => {
    const m = config.match(/globPublicPatterns:\s*\[([^\]]*)\]/);
    expect(m, "globPublicPatterns not found in next.config.ts").not.toBeNull();
    const patterns = [...m![1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p, `${p} is a glob or a folder`).not.toMatch(/[*?!()[\]{}/]/);
      expect(existsSync(join(process.cwd(), "public", p)), `public/${p} does not exist`).toBe(true);
    }
  });

  it("leaves every build chunk out", () => {
    expect(config).toMatch(/exclude:\s*\[\s*\(\)\s*=>\s*true\s*\]/);
  });

  it("still precaches the icons the push handler shows", () => {
    const sw = readFileSync(join(process.cwd(), "src", "app", "sw.ts"), "utf8");
    for (const icon of ["/icon-192.png", "/badge-72.png"]) {
      expect(sw).toContain(icon);
      expect(config).toContain(`"${icon.slice(1)}"`);
    }
  });
});
