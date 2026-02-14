/**
 * Sentry Health Check API Route
 *
 * Production-safe endpoint to verify Sentry is receiving events.
 * Protected by a secret header to prevent abuse.
 *
 * Usage:
 *   curl -H "x-sentry-check-secret: YOUR_SECRET" https://permtracker.app/api/sentry-check
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-sentry-check-secret");
  const expected = process.env.SENTRY_CHECK_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timestamp = new Date().toISOString();
  const testError = new Error("Sentry health check — this is a test event");

  const eventId = Sentry.captureException(testError, {
    tags: { "sentry-check": "true" },
    extra: {
      purpose: "health-check",
      timestamp,
      environment: process.env.NODE_ENV,
      hasDSN: !!process.env.SENTRY_DSN,
      hasPublicDSN: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
  });

  await Sentry.flush(3000);

  return NextResponse.json({
    status: "sent",
    eventId,
    timestamp,
    message: "Check Sentry dashboard for this event ID",
  });
}
