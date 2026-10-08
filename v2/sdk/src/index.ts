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
 * No dependencies. Keys go in the Authorization header, never the address.
 */

export const DEFAULT_BASE_URL = "https://permtracker.app/v1";
export const VERSION = "0.1.0";

export interface PermTrackerOptions {
  /** A pt_live_ key from Settings, under API keys. Only `lookupEmployer` works without one. */
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
  key: { id: string };
  plan: { id: string; name: string; perMinute: number; perDay: number; perMonth: number };
  usage: {
    today: number;
    thisMonth: number;
    remainingToday: number;
    remainingThisMonth: number;
    dayResetsInSeconds: number;
    monthResetsInSeconds: number;
  };
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
  async get<T>(path: string, query: Record<string, string | number | undefined> = {}, needsKey = true): Promise<Answer<T>> {
    if (needsKey && !this.key) {
      throw new PermTrackerError(401, "missing_key", "This call needs an API key. Make one free at permtracker.app, in Settings, under API keys.", null, null);
    }
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { Accept: "application/json", "User-Agent": `permtracker-js/${VERSION}` };
    if (this.key) headers.Authorization = `Bearer ${this.key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers, signal: ctrl.signal });
    } catch (err) {
      const timedOut = ctrl.signal.aborted;
      throw new PermTrackerError(0, timedOut ? "timeout" : "network_error",
        timedOut ? `No answer within ${Math.round(this.timeoutMs / 1000)} seconds.` : `Couldn't reach ${url.host}: ${(err as Error).message}`, null, null);
    } finally {
      clearTimeout(timer);
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok) {
      const e = (body as { error?: { code?: string; message?: string; retryAfter?: number; url?: string } } | null)?.error;
      const retry = e?.retryAfter ?? num(res.headers, "Retry-After");
      throw new PermTrackerError(res.status, e?.code ?? `http_${res.status}`, e?.message ?? `The API answered ${res.status}.`, retry ?? null, e?.url ?? null);
    }
    const b = body as { data?: T; meta?: Meta } | null;
    if (!b || !("data" in b)) throw new PermTrackerError(res.status, "bad_response", "The API's answer wasn't the expected JSON.", null, null);
    return { data: b.data as T, meta: (b.meta ?? { source: "", asOf: null }) as Meta, usage: usageFrom(res.headers) };
  }

  /** One case by number: PERM, prevailing wage, H-1B LCA, or H-2A, H-2B and CW-1. */
  case(caseNumber: string): Promise<Answer<CaseRecord>> {
    const n = caseNumber.trim().toUpperCase();
    if (!CASE_RE.test(n)) {
      return Promise.reject(new PermTrackerError(400, "bad_case_number", `"${caseNumber}" isn't a DOL case number (like G-100-26045-123456).`, null, null));
    }
    return this.get(`/cases/${encodeURIComponent(n)}`);
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

  /** Your key's plan, limits and use. Not counted. */
  me(): Promise<Answer<Me>> {
    return this.get("/me");
  }
}

export default PermTracker;
