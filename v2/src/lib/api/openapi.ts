/**
 * The API's description, as OpenAPI 3.1. Served at /v1/openapi.json and read
 * by the /developers page for its endpoint list, so the docs and the spec are
 * one thing. A test holds every path here to a route file under src/app/v1
 * and every route file to a path here.
 */
import { API_PLANS } from "@convex/lib/apiPlans";
import { WEBHOOK_EVENTS } from "@convex/lib/webhookSign";

export interface EndpointDoc {
  path: string;
  /** GET unless said; one path can carry several methods, each its own entry. */
  method?: "GET" | "POST" | "DELETE";
  summary: string;
  /** One example call, path and query only. */
  example: string;
  params?: { name: string; in: "path" | "query"; required: boolean; description: string }[];
  /** Whether the call counts against the plan's allowance. */
  counted: boolean;
  /** Answered without a key, under shared limits (the browser extension's lookup). */
  keyless?: boolean;
  /** The scope a key needs beyond reading public records. */
  scope?: "export" | "live_lookup" | "webhooks";
  /** Its route gives a sandbox key its own answer rather than the shared samples. */
  sandboxOwn?: boolean;
  /** A POST's JSON body. */
  body?: { description: string; example: Record<string, unknown> };
}

export const API_BASE = "https://permtracker.app/v1";

export const ENDPOINTS: EndpointDoc[] = [
  {
    path: "/cases/{caseNumber}",
    summary: "One case by number: its status, filing date, employer and, once decided, DOL's record. Covers PERM, prevailing wage, H-1B LCA and H-2A, H-2B and CW-1 (applications, job orders and wage requests); a seasonal case adds its workers, work period and worksite, and the job as DOL accepted it.",
    example: "/cases/G-100-26045-123456",
    params: [
      { name: "caseNumber", in: "path", required: true, description: "As DOL prints it, e.g. G-100-26045-123456 or P-100-26045-123456." },
      {
        name: "live",
        in: "query",
        required: false,
        description:
          "1 to ask DOL now when our records don't hold the number yet. Needs the live_lookup scope; Plus has 200 a day, and every account together 20,000.",
      },
    ],
    counted: true,
  },
  {
    path: "/estimate",
    summary: "When a pending PERM case is likely to be decided, with the range, the model and its caveats. An estimate, not a promise.",
    example: "/estimate?filed=2026-02-15",
    params: [
      { name: "case", in: "query", required: false, description: "A PERM case number. Its own status and filing date are used." },
      { name: "filed", in: "query", required: false, description: "A filing date, YYYY-MM-DD, for a case in analyst review." },
    ],
    counted: true,
  },
  {
    path: "/queue",
    summary: "DOL's processing times (the month each queue is working on, average days) and the pending PERM cases by filing month.",
    example: "/queue",
    counted: true,
  },
  {
    path: "/visa-bulletin",
    summary: "A visa bulletin's employment and family charts, as printed. The newest by default.",
    example: "/visa-bulletin?month=2026-10",
    params: [{ name: "month", in: "query", required: false, description: "YYYY-MM, back to 2005-06." }],
    counted: true,
  },
  {
    path: "/employers",
    summary: "Search employers by name. Each result carries its PERM record and its page's name for /employers/{slug}.",
    example: "/employers?q=acme",
    params: [
      { name: "q", in: "query", required: true, description: "2 to 120 characters of the name." },
      { name: "limit", in: "query", required: false, description: "Results to return, 1 to 100. Default 25." },
    ],
    counted: true,
  },
  {
    path: "/employers/{slug}",
    summary: "One employer's PERM record: cases, certified and denied, median days to decision, filings in the last 12 months, and how many of its cases are pending at DOL now, by stage.",
    example: "/employers/google-llc",
    params: [{ name: "slug", in: "path", required: true, description: "The name in its page's address, as search returns it." }],
    counted: true,
  },
  {
    path: "/law-firms",
    summary: "Search law firms by name.",
    example: "/law-firms?q=fragomen",
    params: [
      { name: "q", in: "query", required: true, description: "2 to 120 characters of the name." },
      { name: "limit", in: "query", required: false, description: "Results to return, 1 to 100. Default 25." },
    ],
    counted: true,
  },
  {
    path: "/law-firms/{slug}",
    summary: "One law firm's PERM record, and how many of its cases are pending at DOL now, by stage.",
    example: "/law-firms/fragomen-del-rey-bernsen-loewy-llp",
    params: [{ name: "slug", in: "path", required: true, description: "The name in its page's address, as search returns it." }],
    counted: true,
  },
  {
    path: "/occupations",
    summary: "Search occupations by title.",
    example: "/occupations?q=software",
    params: [
      { name: "q", in: "query", required: true, description: "2 to 120 characters of the title." },
      { name: "limit", in: "query", required: false, description: "Results to return, 1 to 100. Default 25." },
    ],
    counted: true,
  },
  {
    path: "/occupations/{slug}",
    summary: "One occupation's PERM record, with its SOC code and median offered wage.",
    example: "/occupations/software-developers",
    params: [{ name: "slug", in: "path", required: true, description: "The name in its page's address, as search returns it." }],
    counted: true,
  },
  {
    path: "/lookup/employer",
    summary: "The employer page a printed name belongs to (an exact match, a possible one with the matched name, or none), with its PERM decisions, certified share, pending cases, newest filing and H-1B LCAs. No key: it's what the browser extension calls, under shared limits of 60 calls a minute per address.",
    example: "/lookup/employer?name=Google",
    params: [{ name: "name", in: "query", required: true, description: "The employer's name as a job posting prints it, 2 to 120 characters." }],
    counted: false,
    keyless: true,
  },
  {
    path: "/exports/{kind}",
    summary:
      "A search's whole answer, past one page, as CSV (format=csv) or JSON: cases (the case search's parameters, such as q, firm, state, occupation, from, to, outcome), employers, law-firms or occupations (q). Needs the export scope; Plus exports up to 1,000 rows. Counted as one call.",
    example: "/exports/employers?q=acme&format=csv",
    params: [
      { name: "kind", in: "path", required: true, description: "cases, employers, law-firms or occupations." },
      { name: "q", in: "query", required: false, description: "The name to search (an employer for cases)." },
      { name: "format", in: "query", required: false, description: "json (the default) or csv." },
      { name: "limit", in: "query", required: false, description: "Rows to return, up to the plan's export cap." },
    ],
    counted: true,
    scope: "export",
    sandboxOwn: true,
  },
  {
    path: "/webhooks",
    summary:
      "This account's webhook endpoints (url, events, whether paused, the secret's last four characters) and watches. Needs the webhooks scope.",
    example: "/webhooks",
    counted: true,
    scope: "webhooks",
    sandboxOwn: true,
  },
  {
    path: "/webhooks",
    method: "POST",
    summary:
      "Add an endpoint: an https address and the events it wants. The answer carries the signing secret, the only time it's shown. Plus has 5 endpoints.",
    example: "/webhooks",
    counted: true,
    scope: "webhooks",
    sandboxOwn: true,
    body: {
      description: `url (public https) and events, any of: ${WEBHOOK_EVENTS.join(", ")}.`,
      example: { url: "https://example.com/hooks/perm", events: ["case.status_changed", "bulletin.published"] },
    },
  },
  {
    path: "/webhooks/{id}",
    method: "DELETE",
    summary: "Delete an endpoint and its delivery log.",
    example: "/webhooks/jd7abc123def456ghi789",
    params: [{ name: "id", in: "path", required: true, description: "The endpoint's id, from GET /webhooks." }],
    counted: true,
    scope: "webhooks",
    sandboxOwn: true,
  },
  {
    path: "/watches",
    summary: "The case numbers and employers this account's webhooks watch, with its endpoints. Needs the webhooks scope.",
    example: "/watches",
    counted: true,
    scope: "webhooks",
    sandboxOwn: true,
  },
  {
    path: "/watches",
    method: "POST",
    summary:
      "Watch a case number (case.status_changed when DOL's status for it changes) or an employer's page (employer.moved when DOL moves its cases as a group). Plus watches 100.",
    example: "/watches",
    counted: true,
    scope: "webhooks",
    sandboxOwn: true,
    body: {
      description: "One of caseNumber (as DOL prints it) or employer (its page's slug, from /employers).",
      example: { caseNumber: "G-100-26045-123456" },
    },
  },
  {
    path: "/watches/{target}",
    method: "DELETE",
    summary: "Stop watching a case number, or an employer with ?kind=employer.",
    example: "/watches/G-100-26045-123456",
    params: [
      { name: "target", in: "path", required: true, description: "The case number, or the employer's slug." },
      { name: "kind", in: "query", required: false, description: "case (the default) or employer." },
    ],
    counted: true,
    scope: "webhooks",
    sandboxOwn: true,
  },
  {
    path: "/me",
    summary: "Your key's plan, its limits and what you've used today and this month. Not counted.",
    example: "/me",
    counted: false,
  },
];

const ERROR_SCHEMA = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        retryAfter: { type: "integer" },
        url: { type: "string" },
        docs: { type: "string" },
      },
      required: ["code", "message"],
    },
  },
};

export function openApiDocument(): Record<string, unknown> {
  const free = API_PLANS.free;
  const paths: Record<string, unknown> = {};
  for (const e of ENDPOINTS) {
    const method = (e.method ?? "GET").toLowerCase();
    const errors: Record<string, unknown> = {
      "400": { description: "The request isn't valid. Not counted.", content: { "application/json": { schema: ERROR_SCHEMA } } },
      ...(e.keyless ? {} : { "401": { description: "No key, or a key we don't recognise.", content: { "application/json": { schema: ERROR_SCHEMA } } } }),
      ...(e.scope || e.method
        ? { "403": { description: "The key lacks the scope, or the plan lacks the feature. Not counted.", content: { "application/json": { schema: ERROR_SCHEMA } } } }
        : {}),
      "404": { description: "No such record. Counted.", content: { "application/json": { schema: ERROR_SCHEMA } } },
      "429": { description: "A minute, day or month limit. Retry-After says when it lifts.", content: { "application/json": { schema: ERROR_SCHEMA } } },
    };
    const op = {
      summary: e.summary,
      ...(e.scope ? { description: `Needs a key with the ${e.scope} scope.` } : {}),
      ...(e.keyless ? { security: [] } : {}),
      parameters: (e.params ?? []).map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required,
        description: p.description,
        schema: { type: "string" },
      })),
      ...(e.body
        ? {
            requestBody: {
              required: true,
              description: e.body.description,
              content: { "application/json": { schema: { type: "object" }, example: e.body.example } },
            },
          }
        : {}),
      responses: {
        "200": {
          description: "The answer, with `meta.source`, `meta.asOf` and `meta.url` naming where it came from.",
          content: { "application/json": { schema: { type: "object", properties: { data: {}, meta: { type: "object" } } } } },
        },
        ...errors,
      },
    };
    paths[e.path] = { ...((paths[e.path] as Record<string, unknown> | undefined) ?? {}), [method]: op };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "PERM Tracker API",
      version: "1.0.0",
      description:
        `Federal PERM, prevailing wage, H-1B and visa bulletin records, as JSON. Free plan: ${free.perMinute} calls a minute, ` +
        `${free.perDay} a day, ${free.perMonth.toLocaleString("en-US")} a month. Terms: https://permtracker.app/api-terms`,
      termsOfService: "https://permtracker.app/api-terms",
      contact: { email: "support@permtracker.app", url: "https://permtracker.app/developers" },
    },
    servers: [{ url: API_BASE }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Your key, pt_live_..., from Settings > API keys." } },
    },
    paths,
  };
}

/** The assistant tools at /mcp, for the docs. A test holds this list to the tools the server registers. */
export const MCP_TOOLS: { name: string; summary: string }[] = [
  { name: "lookup_case", summary: "One case by number, any of the four programs." },
  { name: "estimate_decision", summary: "When a pending PERM case is likely to be decided." },
  { name: "queue_status", summary: "DOL's processing times and the pending queue by filing month." },
  { name: "visa_bulletin", summary: "A visa bulletin's charts, the newest by default." },
  { name: "search_sponsors", summary: "Find an employer, law firm or occupation by name." },
  { name: "employer_profile", summary: "One employer's, law firm's or occupation's PERM record, and its cases pending at DOL now." },
];

export const MCP_URL = "https://permtracker.app/mcp";
