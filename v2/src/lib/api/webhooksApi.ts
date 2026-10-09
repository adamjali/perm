/**
 * The /v1 doors to an account's webhooks: endpoints (/v1/webhooks) and
 * watches (/v1/watches). A key needs the webhooks scope; the work is done in
 * Convex (convex/webhooks.ts), which takes the key's hash as proof of
 * possession and checks it again. A sandbox key can't change webhooks.
 *
 * Each call that did its work counts as one call. A request body is JSON of
 * at most 4 KB, read before anything else so a large one costs nothing.
 */
import "server-only";

import { fetchAction, fetchMutation } from "convex/nextjs";
import { NextResponse } from "next/server";

import { api } from "@convex/_generated/api";
import { WEBHOOK_EVENTS } from "@convex/lib/webhookSign";

import { admitKeyed, apiError, settle, type Admitted } from "./route";

const BODY_MAX = 4096;
const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } as const;

async function admitWebhooks(request: Request): Promise<Admitted | NextResponse> {
  const admitted = await admitKeyed(request, "webhooks");
  if (admitted instanceof NextResponse) return admitted;
  if (admitted.caller.sandbox) {
    return apiError(403, "sandbox_key", "Sandbox keys can't change webhooks. Use a live key, or send a test event from Settings.", {
      headers: admitted.rateHeaders,
    });
  }
  return admitted;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text().catch(() => "");
  if (text.length === 0 || text.length > BODY_MAX) return null;
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function answer(admitted: Admitted, status: number, data: unknown): NextResponse {
  return NextResponse.json({ data }, { status, headers: { ...HEADERS, ...settle(admitted, true) } });
}

function refused(admitted: Admitted, message: string): NextResponse {
  // Convex's own refusals: a plan's room, a bad address, a scope. Not counted.
  const status = /plan has|plan watches/.test(message) ? 403 : /scope|can't manage|Sandbox/.test(message) ? 403 : 400;
  return apiError(status, status === 403 ? "refused" : "bad_request", message, { headers: settle(admitted, false) });
}

async function guarded(admitted: Admitted, run: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await run();
  } catch (err) {
    console.error("[api] webhooks failed", err instanceof Error ? err.message : err);
    return apiError(500, "internal_error", "Something went wrong on our side. Nothing was counted. Try again shortly.", {
      headers: admitted.rateHeaders,
    });
  }
}

/** GET /v1/webhooks and GET /v1/watches: the account's endpoints and watches. */
export async function listWebhooks(request: Request): Promise<NextResponse> {
  const admitted = await admitWebhooks(request);
  if (admitted instanceof NextResponse) return admitted;
  return guarded(admitted, async () => {
    const r = await fetchMutation(api.webhooks.apiList, { keyHash: admitted.caller.keyHash });
    if (!r.ok) return refused(admitted, r.message);
    return answer(admitted, 200, { endpoints: r.endpoints, watches: r.watches, events: WEBHOOK_EVENTS });
  });
}

/** POST /v1/webhooks {url, events}: a new endpoint, its secret shown once. */
export async function createWebhook(request: Request): Promise<NextResponse> {
  const body = await readBody(request);
  if (!body) return apiError(400, "bad_request", 'Send JSON like {"url": "https://example.com/hooks", "events": ["case.status_changed"]}.');
  const url = typeof body.url === "string" ? body.url : "";
  const events = Array.isArray(body.events) ? body.events.filter((e): e is string => typeof e === "string").slice(0, 20) : [];
  if (!url || events.length === 0) return apiError(400, "bad_request", `Give a url and at least one event: ${WEBHOOK_EVENTS.join(", ")}.`);
  const admitted = await admitWebhooks(request);
  if (admitted instanceof NextResponse) return admitted;
  return guarded(admitted, async () => {
    const r = await fetchAction(api.webhooks.apiCreateEndpoint, { keyHash: admitted.caller.keyHash, url, events });
    if (!r.ok) return refused(admitted, r.message);
    return answer(admitted, 201, {
      id: r.id,
      secret: r.secret,
      note: "This is the only time the secret is shown. Use it to check each delivery's webhook-signature header.",
    });
  });
}

/** DELETE /v1/webhooks/{id}. */
export async function deleteWebhook(request: Request, id: string): Promise<NextResponse> {
  if (!/^[a-z0-9]{10,64}$/.test(id)) return apiError(400, "bad_request", "That isn't a webhook endpoint id.");
  const admitted = await admitWebhooks(request);
  if (admitted instanceof NextResponse) return admitted;
  return guarded(admitted, async () => {
    const r = await fetchMutation(api.webhooks.apiDeleteEndpoint, { keyHash: admitted.caller.keyHash, endpointId: id });
    if (!r.ok) return apiError(404, "not_found", r.message, { headers: settle(admitted, true) });
    return answer(admitted, 200, { deleted: id });
  });
}

/** POST /v1/watches {caseNumber} or {employer}: watch a case or an employer for the account's webhooks. */
export async function addWatch(request: Request): Promise<NextResponse> {
  const body = await readBody(request);
  const caseNumber = typeof body?.caseNumber === "string" ? body.caseNumber : null;
  const employer = typeof body?.employer === "string" ? body.employer : null;
  if (!body || (caseNumber === null) === (employer === null)) {
    return apiError(400, "bad_request", 'Send JSON with one of {"caseNumber": "G-100-26045-123456"} or {"employer": "google-llc"}.');
  }
  const admitted = await admitWebhooks(request);
  if (admitted instanceof NextResponse) return admitted;
  return guarded(admitted, async () => {
    const r = await fetchAction(api.webhooks.apiAddWatch, {
      keyHash: admitted.caller.keyHash,
      kind: caseNumber !== null ? "case" : "employer",
      target: (caseNumber ?? employer ?? "").slice(0, 130),
    });
    if (!r.ok) return refused(admitted, r.message);
    return answer(admitted, r.already ? 200 : 201, { id: r.id, already: r.already });
  });
}

/** DELETE /v1/watches/{target}?kind=case|employer (case by default). */
export async function removeWatch(request: Request, target: string): Promise<NextResponse> {
  const kind = new URL(request.url).searchParams.get("kind") ?? "case";
  if (kind !== "case" && kind !== "employer") return apiError(400, "bad_request", "kind must be case or employer.");
  if (target.length === 0 || target.length > 130) return apiError(400, "bad_request", "Name the case number or employer to stop watching.");
  const admitted = await admitWebhooks(request);
  if (admitted instanceof NextResponse) return admitted;
  return guarded(admitted, async () => {
    const r = await fetchMutation(api.webhooks.apiRemoveWatch, { keyHash: admitted.caller.keyHash, kind, target: decodeURIComponent(target) });
    if (!r.ok) return refused(admitted, r.message);
    if (!r.removed) return apiError(404, "not_found", "This account doesn't watch that.", { headers: settle(admitted, true) });
    return answer(admitted, 200, { removed: target });
  });
}
