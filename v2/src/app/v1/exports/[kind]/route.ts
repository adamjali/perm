import { NextResponse } from "next/server";

import { EXPORT_KINDS, isExportKind, runExport, sandboxExport, type ExportResult } from "@/lib/api/exports";
import { admitKeyed, apiError, settle } from "@/lib/api/route";

export const dynamic = "force-dynamic";

/**
 * A search's whole answer as CSV or JSON: `cases` (the case search's
 * parameters), `employers`, `law-firms` or `occupations` (`q`). Needs the
 * export scope; the plan sets the rows (src/lib/api/exports.ts).
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

  let result: ExportResult;
  try {
    result = caller.sandbox ? sandboxExport(kind, caller.plan) : await runExport(kind, url, caller.plan);
  } catch (err) {
    console.error("[api] export failed", kind, err instanceof Error ? err.message : err);
    return apiError(500, "internal_error", "Something went wrong on our side. Nothing was counted. Try again shortly.");
  }
  const headers = settle(admitted, result.ok);
  if (!result.ok) return apiError(result.status, result.code, result.message, { headers });

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
