/**
 * The MCP server behind permtracker.app/mcp: the API's reads as tools an AI
 * assistant can call.
 *
 * Each tool calls the same function as its /v1 endpoint, so an answer in an
 * assistant and an answer from the API can't disagree. Every tool only reads.
 *
 * NO KEY NEEDED. Assistants connected by URL (Claude's custom connectors, for
 * one) can't send a header, and they arrive from their maker's own addresses,
 * so calls without a key share one pool per copy of the site. A key, in
 * clients that can send one (Claude Code, Cursor), gets its plan's own limits
 * and is counted like an API call.
 */
import "server-only";

import { McpServer, type AuthInfo } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { ApiCaller } from "./auth";
import { readBulletin, readCase, readEntity, readEstimate, readQueue, searchEntities, type ReadResult } from "./reads";
import { ANONYMOUS_ACCOUNT, checkAllowance, countCall, takeMinute } from "./usage";

/** Tool calls a minute from every caller without a key together, in one copy of the site. */
export const ANONYMOUS_PER_MINUTE = 300;

const KINDS = { employer: "employer", "law firm": "attorney", occupation: "occupation" } as const;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: "text", text: t }], ...(isError ? { isError } : {}) });

export function callerFromAuthInfo(authInfo: AuthInfo | undefined): ApiCaller {
  const c = authInfo?.extra?.caller as ApiCaller | undefined;
  return c && c.kind === "key" ? c : { kind: "anonymous" };
}

/** A refusal message, or null when the call may go ahead. */
async function admit(caller: ApiCaller): Promise<string | null> {
  if (caller.kind === "anonymous") {
    const m = takeMinute(`mcp:${ANONYMOUS_ACCOUNT}`, ANONYMOUS_PER_MINUTE);
    return m.ok
      ? null
      : `PERM Tracker is answering many assistants at once. Try again in ${m.reset} seconds, or connect with a free API key for your own limit (permtracker.app/developers).`;
  }
  const plan = caller.plan;
  const m = takeMinute(caller.keyId, plan.perMinute);
  if (!m.ok) return `Your ${plan.label} plan allows ${plan.perMinute} calls a minute. Try again in ${m.reset} seconds.`;
  const a = await checkAllowance(caller.account, plan);
  if (!a.ok) {
    return a.which === "day"
      ? `Your ${plan.label} plan's ${plan.perDay} calls today are used. They reset at midnight UTC.`
      : `Your ${plan.label} plan's ${plan.perMonth} calls this month are used. They reset on the first of the month, UTC.`;
  }
  return null;
}

/** Run a read under the caller's limits and turn its answer into tool output. */
async function answer(caller: ApiCaller, read: () => Promise<ReadResult<unknown>>): Promise<ToolResult> {
  const refused = await admit(caller);
  if (refused) return text(refused, true);
  let r: ReadResult<unknown>;
  try {
    r = await read();
  } catch (err) {
    console.error("[mcp] read failed", err instanceof Error ? err.message : err);
    return text("Something went wrong reading PERM Tracker's records. Try again shortly.", true);
  }
  if (r.ok || r.status === 404) {
    if (caller.kind === "key") countCall(caller.account, caller.keyId);
    else countCall(ANONYMOUS_ACCOUNT, "mcp");
  }
  if (!r.ok) return text(r.url ? `${r.message} ${r.url}` : r.message, r.status !== 404);
  // Source, date and page first, so an assistant has what it needs to cite.
  return text(
    JSON.stringify(
      { source: r.meta.source, asOf: r.meta.asOf, page: r.meta.url, data: r.data },
      null,
      1,
    ),
  );
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function buildMcpServer(caller: ApiCaller): McpServer {
  const server = new McpServer(
    { name: "permtracker", title: "PERM Tracker", version: "1.0.0", websiteUrl: "https://permtracker.app/developers" },
    {
      instructions:
        "Federal records on U.S. employment-based immigration: PERM labor certification, prevailing wage requests, " +
        "H-1B LCAs, DOL processing times and the State Department visa bulletin. Every answer names its source and " +
        "the page it came from; cite that page. Estimates are labelled as estimates, not promises.",
    },
  );

  server.registerTool(
    "lookup_case",
    {
      title: "Look up a case",
      description:
        "One DOL case by number: status, filing date, employer, job and, once decided, DOL's decided record. " +
        "PERM (G-100-...), prevailing wage (P-100-...), H-1B LCA (I-200-...) and H-2A/H-2B numbers.",
      inputSchema: z.object({ case_number: z.string().max(40).describe("As DOL prints it, e.g. G-100-26045-123456.") }),
      annotations: readOnly,
    },
    async ({ case_number }) => answer(caller, () => readCase(case_number)),
  );

  server.registerTool(
    "estimate_decision",
    {
      title: "Estimate a PERM decision date",
      description:
        "When a pending PERM case is likely to be decided, with a range, the model used and its caveats. " +
        "Pass a case number, or a filing date for a case in analyst review. An estimate, not a promise.",
      inputSchema: z.object({
        case_number: z.string().max(40).optional().describe("A PERM case number."),
        filed: z.string().max(10).optional().describe("Filing date, YYYY-MM-DD, when there's no case number."),
      }),
      annotations: readOnly,
    },
    async ({ case_number, filed }) => answer(caller, () => readEstimate({ caseNumber: case_number ?? null, filed: filed ?? null })),
  );

  server.registerTool(
    "queue_status",
    {
      title: "PERM and prevailing wage queues",
      description:
        "DOL's processing times today: the month each PERM and prevailing wage queue is working on, average days to " +
        "a decision, and how many PERM cases are pending from each filing month.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => answer(caller, () => readQueue()),
  );

  server.registerTool(
    "visa_bulletin",
    {
      title: "Visa bulletin",
      description:
        "A visa bulletin's employment and family final action and dates for filing charts, as printed. The newest by default; months back to June 2005.",
      inputSchema: z.object({ month: z.string().max(7).optional().describe("YYYY-MM. Leave out for the newest.") }),
      annotations: readOnly,
    },
    async ({ month }) => answer(caller, () => readBulletin(month ?? null)),
  );

  server.registerTool(
    "search_sponsors",
    {
      title: "Find an employer, law firm or occupation",
      description:
        "Search DOL's PERM records by name. Returns each match's record and the slug that employer_profile takes.",
      inputSchema: z.object({
        kind: z.enum(["employer", "law firm", "occupation"]),
        name: z.string().min(2).max(120),
      }),
      annotations: readOnly,
    },
    async ({ kind, name }) => answer(caller, () => searchEntities(KINDS[kind], name, 10)),
  );

  server.registerTool(
    "employer_profile",
    {
      title: "An employer's, law firm's or occupation's PERM record",
      description:
        "Cases in DOL's published files, certified and denied, median days to a decision, median offered wage and filings in the last 12 months. Find the slug with search_sponsors.",
      inputSchema: z.object({
        kind: z.enum(["employer", "law firm", "occupation"]),
        slug: z.string().max(120).describe("From search_sponsors, e.g. google-llc."),
      }),
      annotations: readOnly,
    },
    async ({ kind, slug }) => answer(caller, () => readEntity(KINDS[kind], slug)),
  );

  return server;
}
