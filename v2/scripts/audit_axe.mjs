/**
 * axe-core over rendered pages, in both themes, to WCAG 2.2 AA.
 *
 *   node scripts/audit_axe.mjs <base-url> <path>... [--json out.json]
 *
 * One browser, one page at a time. Each page is checked in light and dark at
 * 1440 and at 390, since a phone layout can hide or crowd what a desktop one
 * doesn't. Prints each rule broken with how many elements and an example, and
 * exits 1 when anything is serious or critical. Run it against a dev server
 * on production data, never against production in bulk.
 *
 * axe can't judge everything: it skips contrast over images and gradients,
 * and says nothing about whether a label makes sense. A clean run is the
 * floor, not the verdict.
 */
import { chromium } from "playwright-core";
import { AxeBuilder } from "@axe-core/playwright";
import { writeFileSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWS = [
  { w: 1440, h: 900 },
  { w: 390, h: 844 },
];

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const jsonOut = jsonAt >= 0 ? args.splice(jsonAt, 2)[1] : null;
const [base, ...paths] = args;
if (!base || paths.length === 0) throw new Error("usage: audit_axe.mjs <base-url> <path>... [--json out.json]");

const results = [];
let serious = 0;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const path of paths) {
    for (const scheme of ["light", "dark"]) {
      for (const v of VIEWS) {
        const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, colorScheme: scheme, reducedMotion: "reduce" });
        const page = await ctx.newPage();
        const where = `${path} ${scheme} ${v.w}`;
        try {
          await page.goto(base + path, { waitUntil: "load", timeout: 300_000 });
          await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
          await page.waitForTimeout(1500);
          const r = await new AxeBuilder({ page }).withTags(TAGS).exclude("nextjs-portal").analyze();
          for (const x of r.violations) {
            if (x.impact === "serious" || x.impact === "critical") serious += 1;
            results.push({ where, rule: x.id, impact: x.impact, count: x.nodes.length, help: x.help, example: x.nodes[0]?.target?.join(" ") ?? "", why: x.nodes[0]?.failureSummary?.split("\n").slice(0, 2).join(" ") ?? "" });
          }
          console.log(`${r.violations.length === 0 ? "clean" : `${r.violations.length} rule(s)`}  ${where}`);
        } catch (e) {
          console.log(`FAIL  ${where}  ${String(e).slice(0, 100)}`);
          results.push({ where, rule: "load-failed", impact: "unknown", count: 0, help: String(e).slice(0, 200), example: "", why: "" });
        } finally {
          await ctx.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

const byRule = new Map();
for (const r of results) {
  const k = `${r.impact} ${r.rule}`;
  const e = byRule.get(k) ?? { ...r, pages: [] };
  e.pages.push(`${r.where} (${r.count})`);
  byRule.set(k, e);
}
console.log(`\n${results.length} finding(s) over ${paths.length} page(s), ${serious} serious or critical`);
for (const [k, e] of [...byRule].sort()) {
  console.log(`\n${k}: ${e.help}`);
  console.log(`  e.g. ${e.example}  ${e.why}`);
  for (const p of e.pages.slice(0, 8)) console.log(`  ${p}`);
  if (e.pages.length > 8) console.log(`  and ${e.pages.length - 8} more`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1));
process.exit(serious > 0 ? 1 : 0);
