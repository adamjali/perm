/**
 * Trusted client-IP extraction.
 *
 * Single source of truth for resolving a request's client IP across route
 * handlers AND proxy.ts/middleware, both receive a Web `Request`, which is all
 * `ipAddress()` needs.
 *
 * @module lib/net/getClientIp
 */

import { ipAddress } from '@vercel/functions';

/**
 * Resolve the trusted client IP for a request.
 *
 * On Vercel, the platform overwrites `x-forwarded-for` at its edge with the real
 * public client IP it observed (and rejects upstream-supplied values to prevent
 * spoofing). The official `@vercel/functions` `ipAddress()` helper reads those
 * Vercel-attested headers and is the version-stable way to get the IP, it
 * insulates us from header-name churn (Next.js 16 removed `request.ip`).
 *
 * Falls back to header parsing for local dev / non-Vercel runtimes only. Off
 * Vercel these headers are NOT trustworthy, but local dev has no real client IP
 * to protect anyway, so a best-effort value (or `undefined`) is acceptable.
 *
 * NOTE: If a proxy/CDN is ever placed IN FRONT of Vercel (e.g. Cloudflare),
 * `x-forwarded-for` becomes attacker-influenceable and only
 * `x-vercel-forwarded-for` stays Vercel-attested. In that case enable Vercel's
 * Trusted Proxy (Enterprise) feature rather than parsing XFF manually.
 *
 * @param request - Any Web `Request` (route handler `Request` or `NextRequest`).
 * @returns The client IP, or `undefined` when none is available.
 */
export function getClientIp(request: Request): string | undefined {
  // Primary: official helper, Vercel-attested.
  const fromHelper = ipAddress(request);
  if (fromHelper) return fromHelper;

  // Fallback for local dev / non-Vercel runtimes only.
  const vercelXff = request.headers.get('x-vercel-forwarded-for');
  if (vercelXff) return vercelXff.split(',')[0]?.trim() || undefined;

  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || undefined;

  return request.headers.get('x-real-ip') || undefined;
}
