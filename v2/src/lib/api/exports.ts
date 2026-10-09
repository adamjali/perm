/**
 * Exports: a search's whole answer, past one page, as CSV or JSON.
 *
 * `GET /v1/exports/{kind}`, where kind is `cases` (the site's case search,
 * same parameters and the same guards, src/lib/caseSearchRequest.ts) or
 * `employers`, `law-firms` and `occupations` (the name searches). A key needs
 * the `export` scope, and the plan sets the most rows one export may hold
 * (Plus 1,000; Free none). One export counts as one call.
 *
 * THE SAME ROWS THE SITE WOULD SHOW, NOT MORE. A case export runs the same
 * `unifiedSearch` the page does, capped at the plan's rows and never above
 * the site's own 1,000, so an export can't be a way to read the compilation
 * in bulk (the API terms and the site's Terms, section 4).
 *
 * A cell a spreadsheet would run as a formula is written as text, exactly as
 * the site's case-search CSV writes it (csvCell, src/lib/caseSearchCsv.ts).
 * When more matched than an export holds, the answer says so: in the JSON's
 * `truncated` and `note`, and in a CSV's X-Export-Truncated header.
 */
import "server-only";

import { casesToCsv, csvCell } from "@/lib/caseSearchCsv";
import { planCaseSearch } from "@/lib/caseSearchRequest";
import { SITE_URL } from "@/lib/constants/site";
import type { EntityKind } from "@/lib/entityPayload";
import { UNIFIED_MAX, unifiedSearch, type UnifiedCase } from "@/lib/turso/unifiedSearch";
import type { ApiPlan } from "@convex/lib/apiPlans";

import { searchEntities, type ApiMeta } from "./reads";
import { sandboxEntities, SANDBOX_CASES, SANDBOX_SOURCE } from "./sandbox";

export const EXPORT_KINDS = ["cases", "employers", "law-firms", "occupations"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(k: string): k is ExportKind {
  return (EXPORT_KINDS as readonly string[]).includes(k);
}

const ENTITY_KIND: Record<Exclude<ExportKind, "cases">, EntityKind> = {
  employers: "employer",
  "law-firms": "attorney",
  occupations: "occupation",
};

/** The columns of a name-search export, in order; a kind's own fields are blank for the others. */
export const ENTITY_CSV_COLUMNS = [
  "kind",
  "slug",
  "name",
  "rankByVolume",
  "publishedCases",
  "certified",
  "denied",
  "certifiedShare",
  "medianDaysToDecision",
  "filingsLast12Months",
  "occupationCode",
  "medianAnnualWage",
  "state",
  "url",
] as const;

export function entitiesToCsv(rows: readonly Record<string, unknown>[]): string {
  const lines = [ENTITY_CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(ENTITY_CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export type ExportResult =
  | {
      ok: true;
      kind: ExportKind;
      /** Rows for JSON; the CSV is built from the same rows. */
      rows: readonly (Record<string, unknown> | UnifiedCase)[];
      csv: string;
      cap: number;
      truncated: boolean;
      note: string | null;
      meta: ApiMeta;
    }
  | { ok: false; status: 400 | 403 | 404 | 429 | 503; code: string; message: string };

/** The most rows this plan's export may hold. 0 means none. */
export function exportCap(plan: ApiPlan): number {
  return Math.max(0, Math.min(plan.exportRows, UNIFIED_MAX));
}

function rowsLimit(url: URL, cap: number): number | null {
  const raw = url.searchParams.get("limit");
  if (raw === null || raw === "") return cap;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(n, cap);
}

/** Run an export for a live key. The caller has checked the scope. */
export async function runExport(kind: ExportKind, url: URL, plan: ApiPlan): Promise<ExportResult> {
  const cap = exportCap(plan);
  if (cap === 0) {
    return {
      ok: false,
      status: 403,
      code: "plan_feature",
      message: `Exports aren't on the ${plan.label} plan. The search endpoints answer up to 100 rows a call.`,
    };
  }
  const limit = rowsLimit(url, cap);
  if (limit === null) return { ok: false, status: 400, code: "bad_request", message: `limit must be a whole number from 1 to ${cap}.` };

  if (kind === "cases") {
    const p = new URLSearchParams(url.searchParams);
    p.set("limit", String(limit));
    p.delete("format");
    const plan2 = await planCaseSearch(p, { maxLimit: cap });
    if (plan2.kind === "bad") return { ok: false, status: 400, code: "bad_request", message: plan2.message };
    if (plan2.kind === "needsLead") {
      return {
        ok: false,
        status: 400,
        code: "bad_request",
        message: "An export needs an employer (q), case number, law firm, state, occupation or stage to search by.",
      };
    }
    const result = await unifiedSearch(plan2.args);
    const notes = [
      result.truncated ? `More cases matched than this export holds (${limit.toLocaleString("en-US")}); narrow the search to reach the rest.` : null,
      result.capped ? "A source hit its own row limit, so these are the newest of a larger set." : null,
      plan2.dropped.length ? `Filters this search can't carry were left out: ${plan2.dropped.join(", ")}.` : null,
    ].filter((x): x is string => x !== null);
    return {
      ok: true,
      kind,
      rows: result.rows,
      csv: casesToCsv(result.rows),
      cap,
      truncated: result.truncated || result.capped,
      note: notes.length ? notes.join(" ") : null,
      meta: {
        source: "U.S. Department of Labor, OFLC disclosure files (decided cases) and FLAG case status (pending)",
        asOf: null,
        url: `${SITE_URL}/case-search?${url.searchParams.toString()}`,
      },
    };
  }

  const q = url.searchParams.get("q") ?? "";
  const found = await searchEntities(ENTITY_KIND[kind], q, limit, cap);
  if (!found.ok) return found;
  const rows = found.data.results;
  return {
    ok: true,
    kind,
    rows,
    csv: entitiesToCsv(rows),
    cap,
    truncated: found.data.more,
    note: found.data.more ? `More matched than this export holds (${limit.toLocaleString("en-US")}); search with more of the name.` : null,
    meta: found.meta,
  };
}

/** A sandbox key's export: the samples, never the live records. */
export function sandboxExport(kind: ExportKind, plan: ApiPlan): ExportResult {
  const rows =
    kind === "cases"
      ? Object.values(SANDBOX_CASES)
      : sandboxEntities(ENTITY_KIND[kind]);
  const csv =
    kind === "cases"
      ? `${["caseNumber", "program", "status", "filingDate", "employer", "jobTitle"].join(",")}\r\n${rows
          .map((r) => ["caseNumber", "program", "status", "filingDate", "employer", "jobTitle"].map((c) => csvCell(r[c])).join(","))
          .join("\r\n")}\r\n`
      : entitiesToCsv(rows);
  return {
    ok: true,
    kind,
    rows,
    csv,
    cap: exportCap(plan) || UNIFIED_MAX,
    truncated: false,
    note: null,
    meta: { source: SANDBOX_SOURCE, asOf: "2026-10-01", url: `${SITE_URL}/developers#sandbox` },
  };
}
