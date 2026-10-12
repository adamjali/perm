/**
 * Bundle the mail Worker into dist/worker.js (one ES module, no dependencies).
 * Run from v2/: node workers/mail/build.mjs
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, "worker.mjs")],
  outfile: path.join(here, "dist", "worker.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  minify: true,
  legalComments: "none",
});
console.log("built", path.join(here, "dist", "worker.js"));
