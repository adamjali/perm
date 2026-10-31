import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { MAX_BODY, parseClientError } from "./parse";

/**
 * POST /api/client-error: an error screen's own report, sent with
 * navigator.sendBeacon before it reloads or redirects (parse.ts says why). It
 * goes to the server's log as one `[client-error]` line and to Sentry, grouped
 * by screen and message. Public, so it's bounded: 4 KB a report, and at most
 * PER_MINUTE a minute in each web copy; past that it answers 204 and drops it.
 */
const PER_MINUTE = 120;
let windowStart = 0;
let used = 0;

export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY) return new NextResponse(null, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: refused below.
  }
  const report = parseClientError(body);
  if (!report) return new NextResponse(null, { status: 400 });

  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    used = 0;
  }
  if (++used > PER_MINUTE) return new NextResponse(null, { status: 204 });

  const ua = (request.headers.get("user-agent") ?? "").slice(0, 200);
  console.error("[client-error]", JSON.stringify({ ...report, ua }));
  Sentry.captureMessage(`${report.boundary}: ${report.name}: ${report.message}`.slice(0, 300), {
    level: "error",
    tags: { component: report.boundary, outcome: report.outcome, ...(report.digest && { digest: report.digest }) },
    extra: { path: report.path, stack: report.stack, ua },
    fingerprint: ["client-error", report.boundary, report.message.slice(0, 120)],
  });
  return new NextResponse(null, { status: 204 });
}
