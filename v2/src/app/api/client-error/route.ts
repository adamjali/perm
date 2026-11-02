import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { MAX_BODY, chunkFileOf, dplOf, groupingKey, parseClientError } from "./parse";

/**
 * POST /api/client-error: an error screen's own report, sent with
 * navigator.sendBeacon before it reloads or redirects (parse.ts says why). It
 * goes to the server's log as one `[client-error]` line and to Sentry, grouped
 * by screen and message. Public, so it's bounded: 4 KB a report, and at most
 * PER_MINUTE a minute in each web copy; past that it answers 204 and drops it.
 *
 * A build file that failed to download is checked against the server's own
 * copy. When the file is there (every one of the Nov 1 2026 reports), the
 * visitor's connection dropped it and the screen's reload cured it, so all of
 * them share one Sentry issue at warning level and alert nobody twice. A file
 * the server doesn't have is a real fault (a deploy pruned what a page still
 * uses) and stays an error of its own, unless the file belongs to an older build
 * than the live one: a page kept open or cached for weeks asks for files the
 * three-week prune has since removed, and the screen's reload loads the live
 * build. Those share one warning issue too (Nov 2 2026: a run-96 page on run 445).
 */
const PER_MINUTE = 120;

/** Where the server keeps every build's files (nginx's root for /_next/static/). */
const staticRoots = () => [
  join(process.env.PT_SHARED_ROOT || "/srv/permtracker/app/shared", "_next", "static"),
  join(process.cwd(), ".next", "static"),
];
const onServer = (file: string) => staticRoots().some((root) => existsSync(join(root, file)));
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
  const tags = { component: report.boundary, outcome: report.outcome, ...(report.digest && { digest: report.digest }) };
  const extra = { path: report.path, stack: report.stack, ua, message: report.message };
  const file = chunkFileOf(report.message);
  // Next bakes the live build's id into server code; a file stamped with another is an older page's.
  const live = process.env.NEXT_DEPLOYMENT_ID || null;
  const dpl = file ? dplOf(report.message) : null;
  if (file && onServer(file)) {
    Sentry.captureMessage("A build file didn't download on the visitor's connection (the server has it)", {
      level: "warning",
      tags: { ...tags, chunk: "on-server" },
      extra,
      fingerprint: ["client-error", "chunk-download"],
    });
  } else if (file && live && dpl && dpl !== live) {
    Sentry.captureMessage("An older build's file was asked for after it was pruned (the page reloads into the live build)", {
      level: "warning",
      tags: { ...tags, chunk: "old-build" },
      extra: { ...extra, dpl, live },
      fingerprint: ["client-error", "chunk-old-build"],
    });
  } else {
    Sentry.captureMessage(`${report.boundary}: ${report.name}: ${report.message}`.slice(0, 300), {
      level: "error",
      tags: file ? { ...tags, chunk: "not-on-server" } : tags,
      extra,
      fingerprint: ["client-error", report.boundary, groupingKey(report.message)],
    });
  }
  return new NextResponse(null, { status: 204 });
}
