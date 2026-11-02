#!/usr/bin/env node
/**
 * Records the job-code answers the tour stories need, so the signed-in pictures show the SOC field, its card and
 * the suggested description with real figures and no network. For every SOC code and position title in the
 * sample firm (src/components/tour/tour-fixtures.json) it asks a running site for /api/soc?q=<title> and
 * /api/soc/<code>, and writes src/components/tour/soc-fixtures.json: request path to answer, keys sorted.
 *
 *   node scripts/record-soc-fixtures.mjs [base]     (base defaults to http://localhost:3000)
 *
 * Re-run it after re-recording the tour fixtures, or when a code's figures should be brought up to date.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const tour = fileURLToPath(new URL("../src/components/tour/tour-fixtures.json", import.meta.url));
const out = fileURLToPath(new URL("../src/components/tour/soc-fixtures.json", import.meta.url));

const text = readFileSync(tour, "utf8");
const codes = new Set([...text.matchAll(/"socCode":\s*"([^"]+)"/g)].map((m) => m[1].slice(0, 7)));
const titles = new Set([...text.matchAll(/"positionTitle":\s*"([^"]+)"/g)].map((m) => m[1].trim()));
const paths = [
  ...[...titles].map((t) => `/api/soc?q=${encodeURIComponent(t)}`),
  ...[...codes].map((c) => `/api/soc/${c}`),
].sort();

const answers = {};
for (const path of paths) {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  answers[path] = await res.json();
}
writeFileSync(out, JSON.stringify(answers, null, 2) + "\n");
console.log(`${paths.length} answers from ${base} (${codes.size} codes, ${titles.size} titles) -> ${out}`);
