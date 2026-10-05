/**
 * A /v1 endpoint that needs no key: the browser extension's employer lookup.
 *
 * An extension can't keep a secret (anyone can unzip it), so its calls carry
 * no key and share limits instead, the way assistants share the MCP server's:
 *
 * 1. the request's shape, checked before anything else and never counted;
 * 2. a minute limit per address (nginx's own per-address rate sits in front);
 * 3. a minute limit for every keyless caller together, per copy of the site;
 * 4. the read, counted under the anonymous account with the endpoint's name.
 *
 * Browsers on other websites can't read the answers: CORS allows only this
 * site and Chrome extensions, so a web page can't spend the shared pool. The
 * extension calls from its service worker, which its host permission already
 * lets through.
 */
import "server-only";

import { NextResponse } from "next/server";

import { SITE_URL } from "@/lib/constants/site";
import { getClientIp } from "@/lib/net/getClientIp";
import type { ReadResult } from "./reads";
import { apiError } from "./route";
import { ANONYMOUS_ACCOUNT, countCall, takeMinute } from "./usage";

/** Calls a minute from one address. A person browsing postings makes a few. */
export const KEYLESS_PER_ADDRESS_PER_MINUTE = 60;
/** Calls a minute from every keyless caller together, in one copy of the site. */
export const KEYLESS_POOL_PER_MINUTE = 1200;

const SITE_ORIGIN = new URL(SITE_URL).origin;
/** A Chrome extension's origin: 32 letters a to p. */
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return origin === SITE_ORIGIN || EXTENSION_ORIGIN.test(origin) ? origin : null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigin(origin);
  return allowed
    ? {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "X-PT-Extension",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

/** OPTIONS for a keyless endpoint. */
export function keylessOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

/** Wrap a parse and a read as the GET handler of a keyless endpoint. */
export function keylessGet<T>(
  bucket: string,
  parse: (url: URL) => Parsed<T>,
  read: (value: T) => Promise<ReadResult<unknown>>,
) {
  return async function GET(request: Request): Promise<NextResponse> {
    const cors = corsHeaders(request.headers.get("origin"));
    const url = new URL(request.url);
    const parsed = parse(url);
    if (!parsed.ok) return apiError(400, "bad_request", parsed.message, { headers: cors });

    const ip = getClientIp(request);
    if (ip) {
      const mine = takeMinute(`${bucket}:ip:${ip}`, KEYLESS_PER_ADDRESS_PER_MINUTE);
      if (!mine.ok) {
        return apiError(
          429,
          "rate_limited",
          `This address has made ${KEYLESS_PER_ADDRESS_PER_MINUTE} lookups this minute. Try again in ${mine.reset} seconds.`,
          { retryAfter: mine.reset, headers: cors },
        );
      }
    }
    const pool = takeMinute(`${bucket}:pool`, KEYLESS_POOL_PER_MINUTE);
    if (!pool.ok) {
      return apiError(429, "busy", `PERM Tracker is answering many lookups at once. Try again in ${pool.reset} seconds.`, {
        retryAfter: pool.reset,
        headers: cors,
      });
    }

    let result: ReadResult<unknown>;
    try {
      result = await read(parsed.value);
    } catch (err) {
      console.error("[api] keyless read failed", url.pathname, err instanceof Error ? err.message : err);
      return apiError(500, "internal_error", "Something went wrong on our side. Try again shortly.", { headers: cors });
    }
    if (result.ok || result.status === 404) countCall(ANONYMOUS_ACCOUNT, bucket);
    if (!result.ok) return apiError(result.status, result.code, result.message, { url: result.url, headers: cors });
    return NextResponse.json(
      { data: result.data, meta: result.meta },
      {
        headers: {
          ...cors,
          // The answer changes at most nightly; a browser may reuse it for ten
          // minutes, and nothing in between stores it.
          "Cache-Control": "private, max-age=600",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  };
}
