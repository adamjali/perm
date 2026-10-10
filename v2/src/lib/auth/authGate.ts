/**
 * The limits on a POST to `/api/auth`, checked on the site's server before
 * Convex Auth sees the request.
 *
 * Convex Auth's middleware answers `/api/auth` itself, BEFORE it calls the
 * proxy's own handler (convexAuthNextjsMiddleware in node_modules/@convex-dev/
 * auth/dist/nextjs/server/index.js), so a check placed in that handler never
 * runs for a sign-in. Measured Oct 10 2026: production held no per-IP sign-in
 * row at all. src/proxy.ts runs this first instead.
 *
 * Two limits, both counted in Convex only for calls carrying the site's
 * server secret (convex/lib/serverDoor.ts), so a stranger can neither spend
 * another person's attempts nor block their address:
 * - per IP, every sign-in POST but a token refresh (`ip_auth`, 500 an hour);
 * - per email address, by the form's flow (login 20 in 15 minutes, codes 10
 *   in 15 minutes, resets 5 an hour; convex/authRateLimit.ts).
 *
 * Both fail open: a sign-in shouldn't break because a count couldn't be made.
 */
import { fetchMutation } from "convex/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { authAttemptFromBody, isTokenRefresh } from "@/lib/auth/authAttempt";
import { emailLimitText } from "@/lib/auth/rateLimitText";
import { getClientIp } from "@/lib/net/getClientIp";
import { addBreadcrumb } from "@/lib/sentry";
import { MS_PER_MINUTE } from "@/lib/time";
import { api } from "@convex/_generated/api";

function refusal(error: string, retryMs: number): NextResponse {
  return NextResponse.json({ error }, { status: 429, headers: { "Retry-After": String(Math.ceil(retryMs / 1000)) } });
}

function failedOpen(which: string, error: unknown) {
  // A breadcrumb, not captureError: a Convex outage would make every sign-in
  // an error report.
  addBreadcrumb({
    category: "middleware.rate_limit",
    message: `${which} check failed, falling open`,
    level: "warning",
    data: { error: error instanceof Error ? error.message : String(error) },
  });
}

/** A 429 for a POST to `/api/auth` that's over a limit, or null to let it through. */
export async function refuseAuthPost(request: NextRequest): Promise<NextResponse | null> {
  // A clone: Convex Auth reads the original body after this.
  const body: unknown = await request.clone().json().catch(() => null);
  if (isTokenRefresh(body)) return null;
  const serverSecret = process.env.API_SERVER_SECRET;

  // getClientIp() reads the address nginx set from Cloudflare's own header,
  // never a client-sent one. "unknown" only when none resolves (local dev);
  // Convex treats that as a per-request pass so unknown traffic shares no bucket.
  const ip = getClientIp(request) || "unknown";
  try {
    const check = await fetchMutation(api.authRateLimit.checkIpRateLimit, { ip, action: "ip_auth", serverSecret });
    if (!check.allowed) {
      const retryMs = check.retryAfterMs ?? 0;
      const retryMin = Math.ceil(retryMs / MS_PER_MINUTE);
      return refusal(
        check.message || `Too many requests from your IP. Please try again in ${retryMin} minute${retryMin === 1 ? "" : "s"}.`,
        retryMs,
      );
    }
  } catch (error) {
    failedOpen("ip_auth", error);
  }

  const attempt = authAttemptFromBody(body);
  if (!attempt) return null;
  try {
    const check = await fetchMutation(api.authRateLimit.checkAuthRateLimit, { ...attempt, serverSecret });
    if (!check.allowed) return refusal(emailLimitText(check.retryAfterMs ?? 0), check.retryAfterMs ?? 0);
  } catch (error) {
    failedOpen(attempt.action, error);
  }
  return null;
}
