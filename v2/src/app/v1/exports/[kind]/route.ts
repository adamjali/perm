import { NextResponse } from "next/server";

import { chargeExportRows, exportDayRefusal, exportRowsUsed } from "@/lib/api/exportQuota";
import { EXPORT_KINDS, exportCap, isExportKind, runExport, sandboxExport, type ExportResult } from "@/lib/api/exports";
import { admitKeyed, apiError, settle } from "@/lib/api/route";

export const dynamic = "force-dynamic";

/**
 * A search's whole answer as CSV or JSON: `cases` (the case search's
 * parameters), `employers`, `law-firms` or `occupations` (`q`). Needs the
 * export scope; the plan sets the rows per export (src/lib/api/exports.ts)
 * and per day (src/lib/api/exportQuota.ts).
 */
export async function GET(request: Request, context: { params: Promise<{ kind: string }> }): Promise<NextResponse> {
  const { kind } = await context.params;
  const url = new URL(request.url);
  // Shape checks before the key: a malformed request costs nothing.
  if (!isExportKind(kind)) {
    return apiError(404, "not_found", `Nothing to export by that name. Exports: ${EXPORT_KINDS.join(", ")}.`);
  }
  const format = url.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") return apiError(400, "bad_request", "format must be json or csv.");

  const admitted = await admitKeyed(request, "export");
  if (admitted instanceof NextResponse) return admitted;
  const { caller } = admitted;

  // The day's rows: what's left sizes this export, and none left refuses it
  // before anything is read or counted. Sandbox keys answer sample data.
  let plan = caller.plan;
  let rowsLeft: number | null = null;
  if (!caller.sandbox && plan.exportRowsPerDay > 0) {
    const used = await exportRowsUsed(caller.account);
    if (used === null) {
      return apiError(
        503,
        "export_unavailable",
        "We couldn't count today's export rows just now, so nothing was exported or counted. Try again in a minute.",
        { retryAfter: 60, headers: settle(admitted, false) },
      );
    }
    rowsLeft = plan.exportRowsPerDay - used;
    if (rowsLeft <= 0) {
      const r = exportDayRefusal(plan);
      return apiError(r.status, r.code, r.message, { retryAfter: r.retryAfter, headers: settle(admitted, false) });
    }
    if (rowsLeft < exportCap(plan)) plan = { ...plan, exportRows: rowsLeft };
  }

  let result: ExportResult;
  try {
    result = caller.sandbox ? sandboxExport(kind, plan) : await runExport(kind, url, plan);
  } catch (err) {
    console.error("[api] export failed", kind, err instanceof Error ? err.message : err);
    return apiError(500, "internal_error", "Something went wrong on our side. Nothing was counted. Try again shortly.");
  }
  const headers = settle(admitted, result.ok);
  if (!result.ok) return apiError(result.status, result.code, result.message, { headers });
  if (rowsLeft !== null) {
    await chargeExportRows(caller.account, result.rows.length);
    const leftAfter = Math.max(0, rowsLeft - result.rows.length);
    headers["X-Export-Rows-Left-Today"] = String(leftAfter);
    if (plan.exportRows < exportCap(caller.plan) && result.truncated) {
      const day = `This account had ${rowsLeft.toLocaleString("en-US")} export rows left today (${caller.plan.exportRowsPerDay.toLocaleString("en-US")} a day on ${caller.plan.label}), so this export holds that many.`;
      result = { ...result, note: result.note ? `${day} ${result.note}` : day };
    }
  }

  const exportHeaders = {
    "X-Export-Rows": String(result.rows.length),
    "X-Export-Cap": String(result.cap),
    "X-Export-Truncated": result.truncated ? "true" : "false",
  };
  if (format === "csv") {
    return new NextResponse(result.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="permtracker-${kind}.csv"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        ...headers,
        ...exportHeaders,
      },
    });
  }
  return NextResponse.json(
    {
      data: { kind, rows: result.rows, count: result.rows.length, cap: result.cap, truncated: result.truncated, note: result.note },
      meta: result.meta,
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers, ...exportHeaders } },
  );
}
