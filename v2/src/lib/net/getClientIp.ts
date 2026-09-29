/**
 * Trusted client-IP extraction.
 *
 * Single source of truth for resolving a request's client IP across route
 * handlers and proxy.ts; both receive a Web `Request`.
 *
 * The site runs behind Cloudflare, whose tunnel is the only thing that reaches
 * nginx on the server. nginx takes the visitor's address from Cloudflare's own
 * `CF-Connecting-IP` (trusted only from the tunnel on 127.0.0.1) and OVERWRITES
 * both `X-Real-IP` and `X-Forwarded-For` with it, so neither header can carry a
 * value the client sent (scripts/oracle/nginx/permtracker.conf). Reading them
 * here is therefore safe in production. In local dev nothing sets them and the
 * result is `undefined`, which the rate limiters treat as fail-open.
 *
 * @module lib/net/getClientIp
 */

/**
 * Resolve the trusted client IP for a request.
 *
 * @param request - Any Web `Request` (route handler `Request` or `NextRequest`).
 * @returns The client IP, or `undefined` when none is available.
 */
export function getClientIp(request: Request): string | undefined {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;

  // nginx writes the same single address here; the first hop is taken only in
  // case something between nginx and the app ever appends one.
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || undefined;
}
