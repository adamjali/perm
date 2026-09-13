#!/usr/bin/env node
/**
 * What every public PERM estimator says today, for one filing date.
 *
 * WHY THIS EXISTS. "We match or beat permupdate" is a claim, and a claim about
 * accuracy is worth nothing unless it was written down BEFORE the outcome.
 * `src/lib/predictionLedger.ts` records ours; this captures theirs on the same
 * day, in the shape that file wants, so the three can be scored side by side
 * when DOL decides.
 *
 *   node scripts/capture_rival_predictions.mjs 2025-12-15 2026-03-16
 *   node scripts/capture_rival_predictions.mjs --letter C 2026-01-15
 *
 * SCOPE. Public, documented, read-only endpoints, one request per site per
 * date. Nothing here touches an admin or mutating route, and nothing is
 * submitted on anyone's behalf - a filing month is not personal data.
 *
 * OURS IS NOT COMPUTED HERE. The model lives in TypeScript behind a server
 * boundary and this repo has no TS runner for scripts; running a second copy
 * of the arithmetic in JavaScript is exactly how two estimators drift apart.
 * Take our figure from /perm-case-status or the calculator, which is the same
 * number a reader sees - that is the point of recording it.
 */

const PERMUPDATE = "https://perm-backend-production.up.railway.app/api/predictions/from-date";
const PERMTRACK = "https://permtrack.app/api/watchlist/predict";
const UA = "permtracker-benchmark/1.0 (+https://permtracker.app)";

const iso = (d) => d.toISOString().slice(0, 10);
const plus = (isoDate, days) =>
  iso(new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000));

async function permupdate(filed, letter) {
  const r = await fetch(PERMUPDATE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ submit_date: filed, employer_first_letter: letter }),
  });
  if (!r.ok) throw new Error(`permupdate HTTP ${r.status}`);
  const j = await r.json();
  const p = j.prediction ?? j;
  return {
    site: "permupdate",
    anchorIso: p.estimated_completion_date ?? null,
    // One-sided and upward only. Recording a null lower bound is deliberate:
    // scoring their band as two-sided would flatter them on every early call.
    upperIso: p.upper_bound_date ?? null,
    lowerIso: null,
    model:
      "cases ahead / 650 a day; upper bound is remaining x 1.15, and they publish no lower bound",
  };
}

async function permtrack(filed) {
  // THEIR DECISION PREDICTOR, not `/api/estimate`. That one answers a
  // different question - a risk grade plus percentiles over decided cases -
  // and reading `filed + p50` off it reports them as five to nine MONTHS
  // later than they actually say. Their real model is the same shape as
  // ours: cases ahead divided by a measured weekday/weekend pace.
  const r = await fetch(`${PERMTRACK}?filing_date=${filed}`, {
    headers: { "User-Agent": UA },
  });
  if (!r.ok) throw new Error(`permtrack HTTP ${r.status}`);
  const text = await r.text();
  // Unknown paths on this host return the SPA shell with a 200, so a status
  // code proves nothing here - the body has to be checked.
  if (/^\s*<!doctype/i.test(text)) throw new Error("permtrack: got the SPA shell, not JSON");
  const j = JSON.parse(text);
  const p = j.prediction ?? {};
  if (!p.estimated_date) throw new Error("permtrack: no estimated_date in response");
  return {
    site: "permtrack",
    anchorIso: p.estimated_date,
    upperIso: p.late_date ?? null,
    lowerIso: p.early_date ?? null,
    model:
      "cases ahead / their measured pace (weekday and weekend averaged onto the calendar), from /api/watchlist/predict - the same shape as ours",
  };
}

const args = process.argv.slice(2);
let letter = "M";
const li = args.indexOf("--letter");
if (li !== -1) {
  letter = args[li + 1] ?? "M";
  args.splice(li, 2);
}
const dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
if (dates.length === 0) {
  console.error("usage: capture_rival_predictions.mjs [--letter X] YYYY-MM-DD [...]");
  process.exit(2);
}

let failed = 0;
for (const filed of dates) {
  const out = [];
  for (const fn of [() => permupdate(filed, letter), () => permtrack(filed)]) {
    try {
      const v = await fn();
      if (!v.anchorIso) throw new Error("no anchor date in response");
      out.push(v);
    } catch (e) {
      // NAMED, NEVER SWALLOWED. A site that changed its API must show up as a
      // gap in the ledger rather than as a rival that silently stopped being
      // compared - which would quietly turn a three-way into a one-way.
      failed++;
      console.error(`  !! ${filed}: ${e.message}`);
    }
  }
  console.log(`\n  // filed ${filed}, captured ${iso(new Date())}, letter ${letter}`);
  console.log("  rivals: " + JSON.stringify(out, null, 2).replace(/\n/g, "\n  ") + ",");
}
process.exit(failed ? 1 : 0);
