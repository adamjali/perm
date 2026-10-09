/**
 * The PERM Tracker API from TypeScript or JavaScript (Node 18+, Deno, Bun,
 * browsers): a thin client over https://permtracker.app/v1.
 *
 *   import { PermTracker } from "permtracker";
 *   const pt = new PermTracker({ apiKey: process.env.PERMTRACKER_API_KEY });
 *   const { data } = await pt.case("G-100-26045-123456");
 *
 * Every method returns `{ data, meta, usage }`: the answer, where it came from
 * and when, and what the call left of the plan. A refusal throws
 * `PermTrackerError` with the API's own code and message, and `retryAfter`
 * when waiting fixes it.
 *
 * `verifyWebhook` checks a webhook delivery's signature (Standard Webhooks:
 * HMAC-SHA256 over "id.timestamp.body", keyed by the whsec_ secret).
 *
 * No dependencies. Keys go in the Authorization header, never the address.
 */

export const DEFAULT_BASE_URL = "https://permtracker.app/v1";
export const VERSION = "0.2.0";

export interface PermTrackerOptions {
  /** A pt_live_ key from Settings, under API keys (pt_test_ for the sandbox). Only `lookupEmployer` works without one. */
  apiKey?: string;
  baseUrl?: string;
  /** Milliseconds before a call is abandoned. Default 20,000. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** Where an answer came from and when it was true. */
export interface Meta {
  source: string;
  asOf: string | null;
  url?: string;
  [extra: string]: unknown;
}

/** What this call left of the plan, from the response's headers. */
export interface Usage {
  perMinute: number | null;
  remainingThisMinute: number | null;
  today: number | null;
  perDay: number | null;
  month: number | null;
  perMonth: number | null;
}

export interface Answer<T> {
  data: T;
  meta: Meta;
  usage: Usage;
}

export class PermTrackerError extends Error {
  readonly status: number;
  readonly code: string;
  /** Seconds to wait, when waiting fixes it (a rate limit, a check that failed). */
  readonly retryAfter: number | null;
  /** The page on permtracker.app that answers what the API couldn't, when there is one. */
  readonly url: string | null;
  constructor(status: number, code: string, message: string, retryAfter: number | null, url: string | null) {
    super(message);
    this.name = "PermTrackerError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.url = url;
  }
}

/** A case as the API returns it. Fields beyond these depend on the program. */
export interface CaseRecord {
  caseNumber: string;
  /** perm, pwd, lca or seasonal */
  program: string;
  programName: string;
  status: string | null;
  isFinal: boolean;
  filingDate: string | null;
  employer: string | null;
  jobTitle: string | null;
  /** The day our daily check last read DOL, YYYY-MM-DD. */
  statusCheckedOn: string | null;
  /** DOL's published decision, once its quarterly file carries the case. */
  decision: Record<string, unknown> | null;
  [field: string]: unknown;
}

export interface Estimate {
  kind: "date" | "no-date" | "none" | "decided";
  estimatedDate?: string;
  earliest?: string | null;
  latest?: string | null;
  model?: string;
  basis?: string;
  caveats?: string[];
  note?: string;
  [field: string]: unknown;
}

export interface SearchHit {
  slug: string;
  name: string;
  [field: string]: unknown;
}

export interface Me {
  key: { id: string; sandbox: boolean; scopes: string[]; expiresAt: string | null };
  /** The plan that applies now: Plus for every account while the paywall is off. */
  plan: {
    id: string;
    name: string;
    perMinute: number;
    perDay: number;
    perMonth: number;
    keys: number;
    sandboxKeys: number;
    exportRows: number;
    liveLookupsPerDay: number;
    webhookEndpoints: number;
    webhookWatches: number;
  };
  /** The account's own plan, which decides once the paywall is on. */
  accountPlan: { id: string; name: string };
  paywall: { enforced: boolean; note: string };
  usage: {
    today: number;
    thisMonth: number;
    remainingToday: number;
    remainingThisMonth: number;
    liveLookupsToday: number;
    liveLookupsRemainingToday: number;
    dayResetsInSeconds: number;
    monthResetsInSeconds: number;
  };
}

/** What can be exported: the case search, or an entity search. */
export type ExportKind = "cases" | "employers" | "law-firms" | "occupations";

export interface ExportPage {
  kind: ExportKind;
  rows: Record<string, unknown>[];
  count: number;
  /** The most rows the plan's export returns. */
  cap: number;
  /** True when more matched than the cap. */
  truncated: boolean;
  note?: string;
}

export interface CsvExport {
  csv: string;
  rows: number | null;
  cap: number | null;
  truncated: boolean;
  usage: Usage;
}

export const WEBHOOK_EVENTS = [
  "case.status_changed",
  "employer.moved",
  "bulletin.published",
  "queue.moved",
  "processing_times.updated",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secretHint: string;
  pausedAt: number | null;
  [field: string]: unknown;
}

export interface WebhookWatch {
  id: string;
  kind: "case" | "employer";
  target: string;
  [field: string]: unknown;
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  query?: Query;
  body?: unknown;
  needsKey?: boolean;
}

const CASE_RE = /^[A-Z]{1,2}(-[A-Z])?-\d{3}-\d{5}-\d{6}$/;

function num(h: Headers, name: string, part: 0 | 1 = 0): number | null {
  const raw = h.get(name);
  if (!raw) return null;
  const v = Number(raw.split("/")[part]);
  return Number.isFinite(v) ? v : null;
}

export function usageFrom(h: Headers): Usage {
  return {
    perMinute: num(h, "RateLimit-Limit"),
    remainingThisMinute: num(h, "RateLimit-Remaining"),
    today: num(h, "X-Calls-Today", 0),
    perDay: num(h, "X-Calls-Today", 1),
    month: num(h, "X-Calls-Month", 0),
    perMonth: num(h, "X-Calls-Month", 1),
  };
}

export class PermTracker {
  private readonly key: string | undefined;
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PermTrackerOptions = {}) {
    this.key = options.apiKey?.trim() || undefined;
    this.base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 20_000;
    const f = options.fetch ?? (globalThis.fetch as typeof fetch | undefined);
    if (!f) throw new Error("No fetch here: pass one in the options, or use Node 18 or later.");
    this.fetchImpl = f;
  }

  /** GET a /v1 path. Exposed for endpoints this version doesn't wrap yet. */
  async get<T>(path: string, query: Query = {}, needsKey = true): Promise<Answer<T>> {
    return this.request<T>(path, { query, needsKey });
  }

  private async send(path: string, opts: RequestOptions, accept: string): Promise<Response> {
    if ((opts.needsKey ?? true) && !this.key) {
      throw new PermTrackerError(401, "missing_key", "This call needs an API key. Make one free at permtracker.app, in Settings, under API keys.", null, null);
    }
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { Accept: accept, "User-Agent": `permtracker-js/${VERSION}` };
    if (this.key) headers.Authorization = `Bearer ${this.key}`;
    const init: RequestInit = { method: opts.method ?? "GET", headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: ctrl.signal });
    } catch (err) {
      const timedOut = ctrl.signal.aborted;
      throw new PermTrackerError(0, timedOut ? "timeout" : "network_error",
        timedOut ? `No answer within ${Math.round(this.timeoutMs / 1000)} seconds.` : `Couldn't reach ${url.host}: ${(err as Error).message}`, null, null);
    } finally {
      clearTimeout(timer);
    }
  }

  private static async refusal(res: Response): Promise<PermTrackerError> {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const e = (body as { error?: { code?: string; message?: string; retryAfter?: number; url?: string } } | null)?.error;
    const retry = e?.retryAfter ?? num(res.headers, "Retry-After");
    return new PermTrackerError(res.status, e?.code ?? `http_${res.status}`, e?.message ?? `The API answered ${res.status}.`, retry ?? null, e?.url ?? null);
  }

  /** Any /v1 call that answers JSON: GET, POST with a JSON body, or DELETE. */
  async request<T>(path: string, opts: RequestOptions = {}): Promise<Answer<T>> {
    const res = await this.send(path, opts, "application/json");
    if (!res.ok) throw await PermTracker.refusal(res);
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const b = body as { data?: T; meta?: Meta } | null;
    if (!b || !("data" in b)) throw new PermTrackerError(res.status, "bad_response", "The API's answer wasn't the expected JSON.", null, null);
    return { data: b.data as T, meta: (b.meta ?? { source: "", asOf: null }) as Meta, usage: usageFrom(res.headers) };
  }

  /**
   * One case by number: PERM, prevailing wage, H-1B LCA, or H-2A, H-2B and
   * CW-1. With `live: true`, a number our records don't hold yet is asked of
   * DOL now (needs the live_lookup scope; the plan sets how many a day).
   */
  case(caseNumber: string, options: { live?: boolean } = {}): Promise<Answer<CaseRecord>> {
    const n = caseNumber.trim().toUpperCase();
    if (!CASE_RE.test(n)) {
      return Promise.reject(new PermTrackerError(400, "bad_case_number", `"${caseNumber}" isn't a DOL case number (like G-100-26045-123456).`, null, null));
    }
    return this.get(`/cases/${encodeURIComponent(n)}`, options.live ? { live: 1 } : {});
  }

  /** When a pending PERM case is likely to be decided: by case number, or by filing date. */
  estimate(by: { case: string } | { filed: string }): Promise<Answer<Estimate>> {
    return this.get("/estimate", "case" in by ? { case: by.case } : { filed: by.filed });
  }

  queue(): Promise<Answer<Record<string, unknown>>> {
    return this.get("/queue");
  }

  /** A visa bulletin's charts; the newest when `month` (YYYY-MM) is left out. */
  visaBulletin(month?: string): Promise<Answer<Record<string, unknown>>> {
    return this.get("/visa-bulletin", { month });
  }

  employers(q: string, limit?: number): Promise<Answer<SearchHit[]>> {
    return this.get("/employers", { q, limit });
  }

  employer(slug: string): Promise<Answer<Record<string, unknown>>> {
    return this.get(`/employers/${encodeURIComponent(slug)}`);
  }

  lawFirms(q: string, limit?: number): Promise<Answer<SearchHit[]>> {
    return this.get("/law-firms", { q, limit });
  }

  lawFirm(slug: string): Promise<Answer<Record<string, unknown>>> {
    return this.get(`/law-firms/${encodeURIComponent(slug)}`);
  }

  occupations(q: string, limit?: number): Promise<Answer<SearchHit[]>> {
    return this.get("/occupations", { q, limit });
  }

  occupation(slug: string): Promise<Answer<Record<string, unknown>>> {
    return this.get(`/occupations/${encodeURIComponent(slug)}`);
  }

  /** The employer page a printed name belongs to. No key needed. */
  lookupEmployer(name: string): Promise<Answer<Record<string, unknown>>> {
    return this.get("/lookup/employer", { name }, false);
  }

  /** Your key's scopes, the plan that applies, the paywall and what you've used. Not counted. */
  me(): Promise<Answer<Me>> {
    return this.get("/me");
  }

  /**
   * A search's whole answer, up to the plan's export rows, as JSON. `cases`
   * takes the case search's parameters; the others take `q`. One call.
   */
  export(kind: ExportKind, params: Query = {}): Promise<Answer<ExportPage>> {
    return this.get(`/exports/${kind}`, { ...params, format: "json" });
  }

  /** The same export as CSV text, with its row count and whether it was cut at the cap. */
  async exportCsv(kind: ExportKind, params: Query = {}): Promise<CsvExport> {
    const res = await this.send(`/exports/${kind}`, { query: { ...params, format: "csv" } }, "text/csv");
    if (!res.ok) throw await PermTracker.refusal(res);
    return {
      csv: await res.text(),
      rows: num(res.headers, "X-Export-Rows"),
      cap: num(res.headers, "X-Export-Cap"),
      truncated: res.headers.get("X-Export-Truncated") === "true",
      usage: usageFrom(res.headers),
    };
  }

  /** The account's webhook endpoints and watches. Needs the webhooks scope. */
  webhooks(): Promise<Answer<{ endpoints: WebhookEndpoint[]; watches: WebhookWatch[]; events: string[] }>> {
    return this.get("/webhooks");
  }

  /** A new endpoint. Its signing secret is in the answer, once: keep it. */
  createWebhook(endpoint: { url: string; events: readonly string[] }): Promise<Answer<{ id: string; secret: string; note?: string }>> {
    return this.request("/webhooks", { method: "POST", body: { url: endpoint.url, events: [...endpoint.events] } });
  }

  deleteWebhook(id: string): Promise<Answer<{ deleted: string }>> {
    return this.request(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  /** The account's watches (the same list `webhooks()` returns). */
  watches(): Promise<Answer<{ endpoints: WebhookEndpoint[]; watches: WebhookWatch[]; events: string[] }>> {
    return this.get("/watches");
  }

  /** Watch a case number or an employer's slug for case.status_changed and employer.moved. */
  watch(target: { caseNumber: string } | { employer: string }): Promise<Answer<{ id: string; already: boolean }>> {
    return this.request("/watches", { method: "POST", body: target });
  }

  unwatch(target: string, kind: "case" | "employer" = "case"): Promise<Answer<{ removed: string }>> {
    return this.request(`/watches/${encodeURIComponent(target)}`, { method: "DELETE", query: { kind } });
  }
}

/* ------------------------------------------------------------------ */
/* Checking a webhook delivery                                         */
/* ------------------------------------------------------------------ */

type HeaderBag = Headers | Record<string, string | string[] | undefined>;

function header(h: HeaderBag, name: string): string | undefined {
  if (typeof (h as Headers).get === "function") return (h as Headers).get(name) ?? undefined;
  const bag = h as Record<string, string | string[] | undefined>;
  const hit = Object.keys(bag).find((k) => k.toLowerCase() === name);
  const v = hit === undefined ? undefined : bag[hit];
  return Array.isArray(v) ? v[0] : v;
}

async function subtleCrypto(): Promise<SubtleCrypto> {
  const g = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto;
  if (g?.subtle) return g.subtle;
  // Node 18 keeps Web Crypto off the global object unless asked.
  const nodeCrypto = (await import("node:crypto")) as unknown as { webcrypto: { subtle: SubtleCrypto } };
  return nodeCrypto.webcrypto.subtle;
}

function base64Bytes(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Equal strings, compared in time that doesn't depend on where they differ. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when a delivery's signature matches `secret` (the whsec_ value shown
 * when the endpoint was made) and its timestamp is within
 * `toleranceSeconds` (300 by default) of now. Pass the RAW body, exactly as
 * it arrived: parsing and re-serialising JSON changes the bytes.
 */
export async function verifyWebhook(
  secret: string,
  headers: HeaderBag,
  rawBody: string,
  options: { toleranceSeconds?: number; now?: number } = {},
): Promise<boolean> {
  const id = header(headers, "webhook-id");
  const ts = header(headers, "webhook-timestamp");
  const sig = header(headers, "webhook-signature");
  if (!id || !ts || !sig || !secret.startsWith("whsec_")) return false;
  const seconds = Number(ts);
  if (!Number.isFinite(seconds)) return false;
  const now = (options.now ?? Date.now()) / 1000;
  if (Math.abs(now - seconds) > (options.toleranceSeconds ?? 300)) return false;
  const keyBytes = base64Bytes(secret.slice("whsec_".length));
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);
  const subtle = await subtleCrypto();
  const key = await subtle.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${rawBody}`));
  const want = bytesBase64(new Uint8Array(mac));
  // The header may carry several signatures, space-separated, during a secret's rotation.
  return sig.split(" ").some((part) => {
    const [version, value] = part.split(",");
    return version === "v1" && value !== undefined && sameText(value, want);
  });
}

export default PermTracker;
