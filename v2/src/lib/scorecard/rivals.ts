import "server-only";

import type { NewPrediction, SampledCase } from "@/lib/turso/predictions";
import { rows } from "@/lib/turso/client";

/**
 * Rival predictions for a few of the day's sampled cases, for the PRIVATE
 * competitor scorecard on the admin page.
 *
 * WHAT IS ALLOWED, AND WHY. The owner approved a small daily sample from the
 * rivals' public prediction endpoints on 2026-09-26, using public DOL case
 * numbers only and never a subscriber's case. Both hosts used here allow it
 * (one site's robots.txt allows everything but its login and admin; the other
 * rival's prediction API sits on its own host with no robots.txt). A third
 * rival's site disallows its /api/, so it is never called: its PUBLISHED method
 * (month order, then employer A to Z, at its stated 616 a day) is re-run on our
 * own data instead and labelled as exactly that. Endpoints are configuration
 * (RIVAL_A_API, RIVAL_B_API), so no rival is named in this public repository.
 *
 * NAMED, NEVER SWALLOWED. A rival that changes its API shows up as a failure
 * count in the run's response, not as a rival that silently stopped being
 * compared.
 */

const UA = "permtracker-benchmark/1.0 (+https://permtracker.app)";
const TIMEOUT_MS = 10_000;
const SPACING_MS = 1_500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDate = (s: unknown): string | null =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const r = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const text = await r.text();
  // Unknown paths on one host answer with the app shell and a 200.
  if (/^\s*<!doctype/i.test(text)) throw new Error("got an HTML page, not JSON");
  return JSON.parse(text);
}

const initialOf = (name: string | null): string => {
  const ch = (name ?? "").toUpperCase().match(/[A-Z0-9]/);
  return ch ? ch[0] : "M";
};

async function rivalA(c: SampledCase): Promise<Omit<NewPrediction, "caseNumber" | "filingDate" | "status" | "program"> | null> {
  const url = process.env.RIVAL_A_API;
  if (!url) return null;
  const j = (await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submit_date: c.filingDate, employer_first_letter: initialOf(c.employerName) }),
  })) as { prediction?: Record<string, unknown> } & Record<string, unknown>;
  const p = (j.prediction ?? j) as Record<string, unknown>;
  const predicted = isoDate(p.estimated_completion_date);
  if (!predicted) throw new Error("no estimated_completion_date");
  // One-sided: they publish an upper bound and no lower one. Recording a null
  // lower bound keeps their band from being scored as two-sided.
  return { source: "rival-a", model: "rival", predicted, bandEarly: null, bandLate: null, casesAhead: null };
}

async function rivalB(c: SampledCase): Promise<Omit<NewPrediction, "caseNumber" | "filingDate" | "status" | "program"> | null> {
  const url = process.env.RIVAL_B_API;
  if (!url) return null;
  const j = (await fetchJson(`${url}?case_number=${encodeURIComponent(c.caseNumber)}`, {})) as {
    prediction?: Record<string, unknown>;
    queue_position?: unknown;
  };
  const p = j.prediction ?? {};
  const predicted = isoDate(p.estimated_date);
  if (!predicted) throw new Error("no estimated_date");
  return {
    source: "rival-b",
    model: "rival",
    predicted,
    bandEarly: isoDate(p.early_date),
    bandLate: isoDate(p.late_date),
    casesAhead: typeof j.queue_position === "number" ? j.queue_position : null,
  };
}

/** Rival C's published method, run on our data: month order, then A to Z, 616 a day. */
async function rivalC(
  c: SampledCase,
  today: string,
  pendingBefore: (month: string) => number,
): Promise<Omit<NewPrediction, "caseNumber" | "filingDate" | "status" | "program">> {
  const month = c.filingDate.slice(0, 7);
  // Every pending case in earlier months, from the census the caller already
  // holds (their method counts the whole pending pile, not only the line).
  const letters = await rows<{ l: string; n: number | string }>(
    `SELECT upper(substr(trim(employer_name), 1, 1)) AS l, COUNT(*) AS n FROM perm_case_status
      WHERE is_final = 0 AND filing_date >= ? AND filing_date < date(?, '+1 month')
      GROUP BY l`,
    [`${month}-01`, `${month}-01`],
  );
  const mine = initialOf(c.employerName);
  let within = 0;
  for (const x of letters) {
    if (x.l < mine) within += Number(x.n);
    else if (x.l === mine) within += Number(x.n) / 2;
  }
  const ahead = pendingBefore(month) + within;
  const days = Math.round(ahead / 616);
  const predicted = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return { source: "rival-c", model: "rival-method", predicted, bandEarly: null, bandLate: null, casesAhead: Math.round(ahead) };
}

export async function rivalPredictions(
  cases: readonly SampledCase[],
  today: string,
  pendingBefore: (month: string) => number,
): Promise<{ preds: NewPrediction[]; failures: string[] }> {
  const preds: NewPrediction[] = [];
  const failures: string[] = [];
  for (const c of cases) {
    const base = { caseNumber: c.caseNumber, filingDate: c.filingDate, status: c.status, program: "perm" as const };
    for (const [name, fn] of [
      ["rival-a", () => rivalA(c)],
      ["rival-b", () => rivalB(c)],
      ["rival-c", () => rivalC(c, today, pendingBefore)],
    ] as const) {
      try {
        const p = await fn();
        if (p) preds.push({ ...base, ...p });
      } catch (e) {
        failures.push(`${name} ${c.caseNumber}: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (name !== "rival-c") await sleep(SPACING_MS);
    }
  }
  return { preds, failures };
}
