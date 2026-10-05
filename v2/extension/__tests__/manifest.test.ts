import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SITES } from "../src/extract";
import { ICONS } from "../src/icons";
import { EXTENSION_SUMMARY, buildManifest } from "../src/manifest";

// Store review weighs every permission, and a broad one is the usual reason
// an extension is held. These hold the manifest to the fewest that work.

const manifest = buildManifest() as {
  permissions: string[];
  host_permissions: string[];
  content_scripts: { matches: string[] }[];
  description: string;
};

describe("the manifest", () => {
  it("asks for storage, activeTab and scripting only", () => {
    expect(manifest.permissions.sort()).toEqual(["activeTab", "scripting", "storage"]);
  });

  it("holds one host permission, permtracker.app", () => {
    expect(manifest.host_permissions).toEqual(["https://permtracker.app/*"]);
  });

  it("runs the content script on the listed job sites and nowhere else", () => {
    const matches = manifest.content_scripts.flatMap((c) => c.matches);
    expect(matches).toEqual(SITES.flatMap((s) => s.matches));
    for (const m of matches) {
      expect(m).toMatch(/^https:\/\//);
      expect(m).not.toMatch(/<all_urls>|^\*:|^https:\/\/\*\/|^https:\/\/\*\.com\//);
    }
    expect(JSON.stringify(manifest)).not.toContain("<all_urls>");
  });

  it("keeps the store's short description under 133 characters", () => {
    expect(EXTENSION_SUMMARY.length).toBeLessThanOrEqual(132);
    expect(manifest.description).toBe(EXTENSION_SUMMARY);
  });
});

describe("the panel's icons", () => {
  it("are Phosphor's own paths, copied from the installed package", () => {
    const def = readFileSync(join(__dirname, "../../node_modules/@phosphor-icons/react/dist/defs/X.es.js"), "utf8");
    const bold = /"bold",[\s\S]*?d: "([^"]+)"/.exec(def)?.[1];
    expect(bold).toBeTruthy();
    expect(ICONS.x).toBe(bold);
  });

  it("draws the brand mark from the site's own icon file", () => {
    const svg = readFileSync(join(__dirname, "../../public/icon.svg"), "utf8");
    const paths = [...svg.matchAll(/<path fill="#fff"(?: fill-rule="evenodd")? d="([^"]+)"/g)].map((m) => m[1]);
    expect(paths).toEqual([ICONS.markP, ICONS.markT]);
    expect(svg).toContain('rx="24" fill="#2ecc40"');
  });
});
