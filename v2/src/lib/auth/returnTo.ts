/**
 * Where sign-in sends someone back to.
 *
 * A signed-out visitor who opens a page in the app (a link in an email to the review queue, a case, Settings)
 * is sent to sign-in with that page in `?next=`, and comes back to it once signed in, by password, by
 * Google or after verifying an emailed code. Until Nov 4 2026 every sign-in ended on the dashboard.
 *
 * The page's `#section` never reaches the server, so the proxy can't put it in `next`. Browsers keep it
 * across the redirect instead (RFC 9110 section 10.2.2: a Location with no fragment inherits the request's),
 * so the sign-in page reads its own hash and adds it back.
 *
 * Only a page on this site is ever a return address: a path starting with one slash, no scheme, host,
 * backslash, space or control character, at most MAX characters, and never a sign-in page or the API.
 * Anything else falls back to the dashboard, so `next` can't be used to send someone off the site.
 *
 * Plain module: the proxy (server), the sign-in pages and the app's guards (browser) share it.
 */

import { afterAuthPath, CARRIED_PARAM } from "@/lib/carriedCase";

export const RETURN_PARAM = "next";
/** The Google Calendar connect flow has sent `?redirect=` since before `next` existed. */
const LEGACY_PARAMS = ["redirect"];
const MAX = 512;
const BASE = "https://return.invalid";
const SECTION = /^#[A-Za-z0-9_-]{1,64}$/;
const NEVER = ["/login", "/signup", "/reset-password", "/start", "/api"];

export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > MAX) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  // Control characters are exactly what's refused.
  if (/[\\\s\u0000-\u001f\u007f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = url.pathname;
  if (NEVER.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  // An encoded line break (%0d%0a) decodes to a header split in any code that decodes the path again.
  if (/%0[0-9a-f]|%7f/i.test(raw)) return null;
  const section = SECTION.test(url.hash) ? url.hash : "";
  return `${path}${url.search}${section}`;
}

/** The return address in a sign-in page's own address, with the section the browser carried over. */
export function returnPathFrom(search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  const raw = [RETURN_PARAM, ...LEGACY_PARAMS].map((k) => params.get(k)).find((v) => v !== null) ?? null;
  const path = safeReturnPath(raw);
  if (!path) return null;
  if (path.includes("#") || !SECTION.test(hash)) return path;
  return `${path}${hash}`;
}

/** Where a finished sign-in or sign-up goes: the page that asked, else the calculator's dates or the dashboard. */
export function afterSignIn(
  kind: "signup" | "login",
  search: string = typeof window === "undefined" ? "" : window.location.search,
  hash: string = typeof window === "undefined" ? "" : window.location.hash,
): string {
  return returnPathFrom(search, hash) ?? afterAuthPath(kind, search);
}

/** The sign-in page for a signed-out visitor on `here` (path, query and section). */
export function loginHrefFor(here: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  const path = safeReturnPath(here);
  if (path) params.set(RETURN_PARAM, path);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/** The page the browser is on, as a return address. */
export function currentPage(): string {
  if (typeof window === "undefined") return "/";
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

/** A link between sign-in, sign-up and reset that keeps the return address and the calculator's dates. */
export function authPageHref(path: "/login" | "/signup" | "/reset-password", search: string, hash: string): string {
  const params = new URLSearchParams();
  const back = returnPathFrom(search, hash);
  if (back) params.set(RETURN_PARAM, back);
  const calc = new URLSearchParams(search).get(CARRIED_PARAM);
  if (calc) params.set(CARRIED_PARAM, calc);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
