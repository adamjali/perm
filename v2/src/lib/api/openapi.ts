/**
 * The API's description, as OpenAPI 3.1. Served at /v1/openapi.json and read
 * by the /developers page for its endpoint list, so the docs and the spec are
 * one thing. A test holds every path here to a route file under src/app/v1
 * and every route file to a path here.
 */
import { API_PLANS } from "@convex/lib/apiPlans";

export interface EndpointDoc {
  path: string;
  summary: string;
  /** One example call, path and query only. */
  example: string;
  params?: { name: string; in: "path" | "query"; required: boolean; description: string }[];
  /** Whether the call counts against the plan's allowance. */
  counted: boolean;
}

export const API_BASE = "https://permtracker.app/v1";

export const ENDPOINTS: EndpointDoc[] = [
  {
    path: "/cases/{caseNumber}",
    summary: "One case by number: its status, filing date, employer and, once decided, DOL's record. Covers PERM, prevailing wage, H-1B LCA and H-2A, H-2B and CW-1 (applications, job orders and wage requests); a seasonal case adds its workers, work period and worksite, and the job as DOL accepted it.",
    example: "/cases/G-100-26045-123456",
    params: [{ name: "caseNumber", in: "path", required: true, description: "As DOL prints it, e.g. G-100-26045-123456 or P-100-26045-123456." }],
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
    paths[e.path] = {
      get: {
        summary: e.summary,
        parameters: (e.params ?? []).map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          description: p.description,
          schema: { type: "string" },
        })),
        responses: {
          "200": {
            description: "The answer, with `meta.source`, `meta.asOf` and `meta.url` naming where it came from.",
            content: { "application/json": { schema: { type: "object", properties: { data: {}, meta: { type: "object" } } } } },
          },
          "400": { description: "The request isn't valid. Not counted.", content: { "application/json": { schema: ERROR_SCHEMA } } },
          "401": { description: "No key, or a key we don't recognise.", content: { "application/json": { schema: ERROR_SCHEMA } } },
          "404": { description: "No such record. Counted.", content: { "application/json": { schema: ERROR_SCHEMA } } },
          "429": { description: "A minute, day or month limit. Retry-After says when it lifts.", content: { "application/json": { schema: ERROR_SCHEMA } } },
        },
      },
    };
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
