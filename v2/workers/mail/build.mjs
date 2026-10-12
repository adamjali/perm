/**
 * Bundle the mail Worker into dist/worker.js (one ES module, postal-mime
 * inside). postal-mime comes from the tree the Resend package already brings,
 * so nothing extra is installed. Run from v2/: node workers/mail/build.mjs
 */
import { build } from "esbuild";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const fromResend = createRequire(require.resolve("resend"));
const postalRoot = path.dirname(path.dirname(fromResend.resolve("postal-mime")));

await build({
  entryPoints: [path.join(here, "worker.mjs")],
  outfile: path.join(here, "dist", "worker.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  mainFields: ["module", "main"],
  alias: { "postal-mime": postalRoot },
  minify: true,
  legalComments: "none",
});
console.log("built", path.join(here, "dist", "worker.js"));
