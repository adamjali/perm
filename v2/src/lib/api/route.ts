/**
 * The one way a /v1 endpoint answers: check the key, apply the plan's limits,
 * run the read, count the call, and say plainly what happened.
 *
 * ORDER, CHEAPEST FIRST: the key's shape and checksum (no I/O), the key itself
 * (Convex, cached a minute), the key's scope (memory), the minute limit
 * (memory), the day and month allowance (memory, re-read every 30 s), then
 * the read.
 *
 * A call is counted when it did its work: an answer or a "no such record".
 * A malformed request, a refusal and our own failure are not counted.
 *
 * A SANDBOX KEY (pt_test_) gets the same checks up to the minute limit, then
 * an answer from fixed sample data (./sandbox.ts): no read of the live records
 * and nothing counted, so it can't spend an allowance.
 *
 * Every refusal names the limit and when it lifts, in the body and in
 * Retry-After, the site's rule that no limit is silent.
 */
import "server-only";

import { NextResponse } from "next/server";

import { SITE_URL } from "@/lib/constants/site";
import { SCOPE_LABELS, hasScope, type ApiScope } from "@convex/lib/apiPlans";
import { authenticate, type ApiCaller } from "./auth";
import type { ReadResult } from "./reads";
import { sandboxAnswer } from "./sandbox";
import { checkAllowance, countCall, takeMinute } from "./usage";

export const DOCS_URL = `${SITE_URL}/developers`;

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
} as const;

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: { retryAfter?: number; url?: string; headers?: Record<string, string> } = {},
): NextResponse {
  const headers: Record<string, string> = { ...BASE_HEADERS, ...extra.headers };
  if (extra.retryAfter !== undefined) headers["Retry-After"] = String(extra.retryAfter);
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(extra.retryAfter !== undefined ? { retryAfter: extra.retryAfter } : {}),
        ...(extra.url ? { url: extra.url } : {}),
        docs: DOCS_URL,
      },
    },
    { status, headers },
  );
}

export type KeyCaller = Extract<ApiCaller, { kind: "key" }>;

export interface ApiContext {
  request: Request;
  url: URL;
  caller: KeyCaller;
}

export interface Admitted {
  caller: KeyCaller;
  rateHeaders: Record<string, string>;
  /** Calls used before this one; null for a sandbox key, whose calls aren't counted. */
  allowance: { today: number; month: number } | null;
}

/**
 * Everything before the work itself: the key, its scope, the minute limit and,
 * for a live key, the day and month. A refusal comes back as the response to
 * send.
 */
export async function admitKeyed(request: Request, scope: ApiScope = "read"): Promise<Admitted | NextResponse> {
  const auth = await authenticate(request);
  if (!auth.ok) {
    return auth.code === "key_check_failed"
      ? apiError(503, auth.code, auth.message, { retryAfter: 60 })
      : apiError(401, auth.code, auth.message);
  }
  if (auth.caller.kind !== "key") {
    return apiError(
      401,
      "missing_key",
      "This endpoint needs an API key. Make one free in Settings, under API keys, and send it as Authorization: Bearer <key>.",
    );
  }
  const caller = auth.caller;
  const plan = caller.plan;

  if (!hasScope(caller.scopes, scope)) {
    return apiError(
      403,
      "missing_scope",
      `This key can't do this: it needs the "${scope}" scope (${SCOPE_LABELS[scope]}). Make a key with it in Settings, under API keys.`,
    );
  }

  const minute = takeMinute(caller.keyId, plan.perMinute);
  const rateHeaders = {
    "RateLimit-Limit": String(plan.perMinute),
    "RateLimit-Remaining": String(minute.remaining),
    "RateLimit-Reset": String(minute.reset),
  };
  if (!minute.ok) {
    return apiError(
      429,
      "rate_limited",
      `The ${plan.label} plan allows ${plan.perMinute} calls a minute. Try again in ${minute.reset} seconds.`,
      { retryAfter: minute.reset, headers: rateHeaders },
    );
  }
  if (caller.sandbox) return { caller, rateHeaders, allowance: null };

  const allowance = await checkAllowance(caller.account, plan);
  if (!allowance.ok) {
    const which = allowance.which === "day" ? `${plan.perDay.toLocaleString("en-US")} calls a day` : `${plan.perMonth.toLocaleString("en-US")} calls a month`;
    const when = allowance.which === "day" ? "at midnight UTC" : "on the first of the month, UTC";
    return apiError(
      429,
      allowance.which === "day" ? "daily_limit" : "monthly_limit",
      `This account has used its ${which} on the ${plan.label} plan. It resets ${when}.`,
      { retryAfter: allowance.retryAfter, headers: rateHeaders },
    );
  }
  return { caller, rateHeaders, allowance: { today: allowance.today, month: allowance.month } };
}

/** Count a call that did its work, and the usage headers that say so. */
export function settle(admitted: Admitted, counted: boolean): Record<string, string> {
  const { caller, rateHeaders, allowance } = admitted;
  if (!allowance) return { ...rateHeaders, "X-Sandbox": "true" };
  if (counted) countCall(caller.account, caller.keyId);
  const plan = caller.plan;
  return {
    ...rateHeaders,
    "X-Calls-Today": `${allowance.today + (counted ? 1 : 0)}/${plan.perDay}`,
    "X-Calls-Month": `${allowance.month + (counted ? 1 : 0)}/${plan.perMonth}`,
  };
}

export interface ApiGetOptions<P extends Record<string, string>> {
  /** The scope the call needs; `read` by default, which every key holds. */
  scope?: ApiScope;
  /** A sandbox key's answer, when the shared sample answers by path don't fit. */
  sandbox?: (ctx: ApiContext, params: P) => Promise<ReadResult<unknown>> | ReadResult<unknown>;
}

export function readResponse(result: ReadResult<unknown>, headers: Record<string, string>): NextResponse {
  if (!result.ok) {
    return apiError(result.status, result.code, result.message, { url: result.url, headers });
  }
  return NextResponse.json({ data: result.data, meta: result.meta }, { headers: { ...BASE_HEADERS, ...headers } });
}

/** Wrap a read as a GET handler for a /v1 route. */
export function apiGet<P extends Record<string, string>>(
  run: (ctx: ApiContext, params: P) => Promise<ReadResult<unknown>>,
  opts: ApiGetOptions<P> = {},
) {
  return async function GET(request: Request, context: { params: Promise<P> }): Promise<NextResponse> {
    const admitted = await admitKeyed(request, opts.scope ?? "read");
    if (admitted instanceof NextResponse) return admitted;
    const url = new URL(request.url);
    const params = await context.params;
    const ctx = { request, url, caller: admitted.caller };

    let result: ReadResult<unknown>;
    try {
      result = admitted.caller.sandbox
        ? await (opts.sandbox ? opts.sandbox(ctx, params) : sandboxAnswer(url, params))
        : await run(ctx, params);
    } catch (err) {
      console.error("[api] read failed", url.pathname, err instanceof Error ? err.message : err);
      return apiError(500, "internal_error", "Something went wrong on our side. Nothing was counted. Try again shortly.");
    }
    return readResponse(result, settle(admitted, result.ok || result.status === 404));
  };
}
