#!/usr/bin/env node
/**
 * Build the browser extension: extension/dist/ (load it unpacked in Chrome)
 * and extension/permtracker-extension-<version>.zip (upload it to the Chrome
 * Web Store). Both are gitignored; this script makes them from the source.
 *
 *   node scripts/build_extension.mjs        # from v2/
 *
 * Bundled with esbuild, unminified so a store reviewer can read every line,
 * with no remote code: everything the extension runs is in the zip. The icons
 * are rendered from the site's own mark, public/icon.svg, never redrawn.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import sharp from "sharp";
import { zipSync } from "fflate";

const V2 = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(V2, "extension", "src");
const DIST = join(V2, "extension", "dist");

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "icons"), { recursive: true });

const common = {
  bundle: true,
  minify: false,
  legalComments: "none",
  target: ["chrome116"],
  charset: "utf8",
  logLevel: "warning",
};
await build({ ...common, entryPoints: [join(SRC, "background.ts")], outfile: join(DIST, "background.js"), format: "iife" });
await build({ ...common, entryPoints: [join(SRC, "content.ts")], outfile: join(DIST, "content.js"), format: "iife" });

// The manifest is built from the site table in extension/src, so it's read
// through esbuild rather than copied by hand.
const out = await build({ ...common, entryPoints: [join(SRC, "manifest.ts")], format: "esm", write: false, platform: "neutral" });
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
const manifest = mod.buildManifest();
writeFileSync(join(DIST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const svg = readFileSync(join(V2, "public", "icon.svg"));
for (const size of mod.ICON_SIZES) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(DIST, "icons", `icon-${size}.png`));
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}
const entries = Object.fromEntries(files(DIST).sort().map((f) => [relative(DIST, f), readFileSync(f)]));
// A fixed timestamp keeps the zip byte-identical from one build to the next.
const zip = zipSync(entries, { level: 9, mtime: new Date("2026-01-01T00:00:00Z") });
const zipPath = join(V2, "extension", `permtracker-extension-${manifest.version}.zip`);
writeFileSync(zipPath, zip);

for (const [name, data] of Object.entries(entries)) console.log(`  ${name.padEnd(22)} ${data.length.toLocaleString("en-US")} bytes`);
console.log(`built ${relative(V2, zipPath)} (${zip.length.toLocaleString("en-US")} bytes), manifest ${manifest.version}`);
