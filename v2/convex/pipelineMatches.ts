/**
 * After DOL issues a PERM job's prevailing wage, look for the PERM.
 *
 * Someone watching a `P-100-` wage request hears from us when DOL issues the
 * wage; the step after it is the PERM application, which gets a number of its
 * own that nobody tells them. Once a day this looks, for every such watched
 * request, at the PERM applications DOL's record holds from the same employer
 * filed since the wage was issued, and tells the subscriber about any with the
 * same job title: once per PERM, three at most, and nothing at all when the
 * employer has filed more than three for that title (convex/lib/pipelineMatch.ts
 * has the rules and the measurement behind them).
 *
 * ## Where the data comes from
 *
 * The public mirror, read only, like every alert sweep here:
 *
 * - `pwd_case_status` for the request's employer slug and job title;
 * - `pwd_case_events` for the day DOL's record showed it final, falling back
 *   to `pwd_cases.decision_date` (DOL's file) for one the event log missed;
 * - `employer_page_map` for every spelling of the employer that leads to one
 *   page, so "Acme, Inc." and "ACME INC" are one employer;
 * - `perm_live_recent` for the PERMs, on its `(employer_slug, filing_date)`
 *   index. Every PERM filed since the last disclosure file is there, which is
 *   every PERM that could follow a wage issued this year.
 *
 * ## Sending
 *
 * One email per wage request per run, listing what's new, through
 * `deliverAlert` as kind "match", so the one-email-a-day bundling applies and
 * the case alert's own stop link (and the preference page) turns it off. Each
 * email claims one unit of the `pipelineMatch` pool before it's built. A PERM
 * is recorded in `permMatchNotices` only once the email is sent or queued, so
 * a failed send tries again tomorrow.
 *
 * @module convex/pipelineMatches
 */

import { v } from "convex/values";
import type { ReactElement } from "react";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { deliverAlert } from "./lib/alertDelivery";
import { BUDGETS, noteRefusal, windowFor } from "./lib/alertBudgets";
import { dayDolActed, isPermWageRequest } from "./lib/alertNextSteps";
import { createLogger } from "./lib/logging";
import { recordError } from "./lib/errorRecording";
import { actionUrl, SITE_URL } from "./lib/links";
import { longDate } from "./lib/months";
import { prefsLink } from "./lib/prefsLink";
import { placeholders, query, type Row } from "./lib/publicMirror";
import { checkRateLimit, recordRateLimitAttempt } from "./lib/rateLimit";
import { makeUnsubscribeToken } from "./lib/unsubscribeToken";
import { MATCH_CAP, pickCandidates, type PermCandidate } from "./lib/pipelineMatch";
import { MAX_CASES_PER_ADDRESS } from "./caseAlerts";
import { isProgramApproval } from "../src/lib/flagCaseNumber";
import { TEXT_LEGAL_LINE } from "./lib/textFooter";

const log = createLogger("PipelineMatches");

/** Watched wage requests one run looks at. Far above how many exist. */
const SUBSCRIPTIONS_READ = 2000;
/** Wage requests one run asks the mirror about; the rest wait a day. */
const REQUESTS_PER_RUN = 300;
/** PERM filings read per employer; the newest come first. */
const PERMS_READ = 200;

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

function str(v: Row[string] | undefined): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** The case page, and the same page at its alert form. */
export function casePageUrl(caseNumber: string): string {
  return `${SITE_URL}/perm-case-status?case=${encodeURIComponent(caseNumber)}`;
}

/** Confirmed, live subscriptions to a PERM job's wage request whose wage DOL has issued. */
export const issuedWageWatches = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({ _id: v.id("caseStatusAlerts"), email: v.string(), caseNumber: v.string() }),
  ),
  handler: async (ctx, args) => {
    const out: { _id: Id<"caseStatusAlerts">; email: string; caseNumber: string }[] = [];
    let read = 0;
    for await (const row of ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_alert_sweep", (q) => q.eq("unsubscribedAt", undefined).eq("caseClosedAt", undefined))) {
      if (++read > SUBSCRIPTIONS_READ) break;
      if (!row.confirmedAt || !isPermWageRequest(row.caseNumber)) continue;
      if (!row.lastSeenStatus || !isProgramApproval("pwd", row.lastSeenStatus)) continue;
      out.push({ _id: row._id, email: row.email, caseNumber: row.caseNumber });
      if (out.length >= args.limit) break;
    }
    return out;
  },
});

/** What this address has already been told about, and which cases it already watches. */
export const toldAndWatched = internalQuery({
  args: { id: v.id("caseStatusAlerts"), email: v.string() },
  returns: v.object({ toldForRequest: v.number(), told: v.array(v.string()), watched: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const forRequest = await ctx.db
      .query("permMatchNotices")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", args.id))
      .take(MATCH_CAP * 4);
    const forAddress = await ctx.db
      .query("permMatchNotices")
      .withIndex("by_email_perm", (q) => q.eq("email", args.email))
      .take(MAX_CASES_PER_ADDRESS * MATCH_CAP);
    const watched = await ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(MAX_CASES_PER_ADDRESS);
    return {
      toldForRequest: forRequest.length,
      told: [...new Set(forAddress.map((r) => r.permCaseNumber))],
      watched: watched.filter((r) => r.unsubscribedAt === undefined).map((r) => r.caseNumber),
    };
  },
});

/** Claim up to `want` sends against the pool, as `claimAlertBudget` does for case alerts. */
export const claimMatchBudget = internalMutation({
  args: { want: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (args.want <= 0) return 0;
    const pool = windowFor("pipelineMatch");
    const state = await checkRateLimit(ctx, "all", BUDGETS.pipelineMatch.key, pool);
    if (!state.allowed) {
      await noteRefusal(ctx, "pipelineMatch", args.want);
      return 0;
    }
    const granted = Math.min(args.want, state.remaining + 1);
    await noteRefusal(ctx, "pipelineMatch", args.want - granted);
    for (let i = 0; i < granted; i++) {
      await recordRateLimitAttempt(ctx, "all", BUDGETS.pipelineMatch.key);
    }
    return granted;
  },
});

export const recordTold = internalMutation({
  args: {
    id: v.id("caseStatusAlerts"),
    email: v.string(),
    pwdCaseNumber: v.string(),
    cases: v.array(v.object({ caseNumber: v.string(), filingDate: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const c of args.cases) {
      const held = await ctx.db
        .query("permMatchNotices")
        .withIndex("by_email_perm", (q) => q.eq("email", args.email).eq("permCaseNumber", c.caseNumber))
        .first();
      if (held) continue;
      await ctx.db.insert("permMatchNotices", {
        subscriptionId: args.id,
        email: args.email,
        pwdCaseNumber: args.pwdCaseNumber,
        permCaseNumber: c.caseNumber,
        filingDate: c.filingDate,
        toldAt: now,
      });
    }
    return null;
  },
});

interface WageRequest {
  slug: string;
  employerName: string | null;
  jobTitle: string | null;
  /** The day DOL's record showed the wage issued, "YYYY-MM-DD". */
  issuedOn: string;
}

/** The employer, title and issue day of each wage request, in two round trips. */
async function wageRequests(caseNumbers: string[]): Promise<Map<string, WageRequest>> {
  const marks = placeholders(caseNumbers.length);
  const out = new Map<string, WageRequest>();
  if (!marks) return out;
  const [rows = [], events = []] = await query([
    {
      sql: `SELECT case_number, employer_slug, employer_name, job_title
              FROM pwd_case_status WHERE case_number IN (${marks})`,
      args: caseNumbers,
    },
    {
      sql: `SELECT case_number, max(changed_at) AS seen FROM pwd_case_events
             WHERE case_number IN (${marks}) AND to_final = 1 GROUP BY case_number`,
      args: caseNumbers,
    },
  ]);
  const seen = new Map(events.map((e) => [String(e.case_number), Number(e.seen)]));
  // DOL's file dates a decision the event log never saw (a case first read
  // already decided). The table may be absent on a fresh database.
  const filed = new Map<string, string>();
  const missing = caseNumbers.filter((n) => !(Number(seen.get(n)) > 0));
  const missingMarks = placeholders(missing.length);
  if (missingMarks) {
    try {
      const [decided = []] = await query([
        { sql: `SELECT case_number, decision_date FROM pwd_cases WHERE case_number IN (${missingMarks})`, args: missing },
      ]);
      for (const r of decided) {
        const d = str(r.decision_date);
        if (d) filed.set(String(r.case_number), d.slice(0, 10));
      }
    } catch (error) {
      log.error("pwd_cases unreadable; requests without an event wait", { error });
    }
  }
  for (const r of rows) {
    const caseNumber = String(r.case_number);
    const slug = str(r.employer_slug);
    const at = seen.get(caseNumber);
    const issuedOn = at && at > 0 ? dayDolActed(at) : filed.get(caseNumber);
    if (!slug || !issuedOn) continue;
    out.set(caseNumber, { slug, employerName: str(r.employer_name), jobTitle: str(r.job_title), issuedOn });
  }
  return out;
}

/**
 * The employer's PERM filings on or after `since`, every spelling of it
 * included. Falls back to its own slug when the page map can't be read.
 */
async function permsSince(slug: string, since: string): Promise<PermCandidate[]> {
  const toRows = (rows: Row[]): PermCandidate[] =>
    rows.flatMap((r) => {
      const caseNumber = str(r.case_number);
      const filingDate = str(r.filing_date);
      return caseNumber && filingDate
        ? [{ caseNumber, filingDate: filingDate.slice(0, 10), employerName: str(r.employer_name), jobTitle: str(r.job_title) }]
        : [];
    });
  try {
    const [rows = []] = await query([
      {
        // One SELECT (the mirror refuses anything else, a WITH included): the
        // page the request's spelling belongs to, every spelling of that
        // page, and the spelling itself when the map doesn't know it.
        sql: `SELECT case_number, filing_date, employer_name, job_title FROM perm_live_recent
               WHERE employer_slug IN (
                 SELECT source_slug FROM employer_page_map
                  WHERE page_slug = coalesce((SELECT page_slug FROM employer_page_map WHERE source_slug = ?), ?)
                 UNION SELECT coalesce((SELECT page_slug FROM employer_page_map WHERE source_slug = ?), ?)
                 UNION SELECT ?
               ) AND filing_date >= ?
               ORDER BY filing_date DESC LIMIT ${PERMS_READ}`,
        args: [slug, slug, slug, slug, slug, since],
      },
    ]);
    return toRows(rows);
  } catch (error) {
    log.error("page map unreadable; matching on the request's own slug", { error });
    const [rows = []] = await query([
      {
        sql: `SELECT case_number, filing_date, employer_name, job_title FROM perm_live_recent
               WHERE employer_slug = ? AND filing_date >= ? ORDER BY filing_date DESC LIMIT ${PERMS_READ}`,
        args: [slug, since],
      },
    ]);
    return toRows(rows);
  }
}

async function renderHtml(build: () => Promise<ReactElement>): Promise<string | undefined> {
  try {
    const { render } = await import("@react-email/render");
    return await render(await build());
  } catch (error) {
    log.error("match email render failed, sending text only", { error });
    return undefined;
  }
}

export const sweep = internalAction({
  args: {},
  returns: v.object({ looked: v.number(), sent: v.number(), queued: v.number(), failed: v.number() }),
  handler: async (ctx): Promise<{ looked: number; sent: number; queued: number; failed: number }> => {
    const watches = await ctx.runQuery(internal.pipelineMatches.issuedWageWatches, { limit: REQUESTS_PER_RUN });
    if (watches.length === 0) return { looked: 0, sent: 0, queued: 0, failed: 0 };

    const requests = await wageRequests([...new Set(watches.map((w) => w.caseNumber))]);
    const due: {
      watch: (typeof watches)[number];
      request: WageRequest;
      send: PermCandidate[];
    }[] = [];
    for (const watch of watches) {
      const request = requests.get(watch.caseNumber);
      if (!request) continue;
      const state = await ctx.runQuery(internal.pipelineMatches.toldAndWatched, { id: watch._id, email: watch.email });
      if (state.toldForRequest >= MATCH_CAP) continue;
      const rows = await permsSince(request.slug, request.issuedOn);
      const pick = pickCandidates({
        pwdTitle: request.jobTitle,
        since: request.issuedOn,
        rows,
        told: new Set(state.told),
        watched: new Set(state.watched),
        toldCount: state.toldForRequest,
      });
      if (pick.send.length > 0) due.push({ watch, request, send: pick.send });
    }
    if (due.length === 0) return { looked: watches.length, sent: 0, queued: 0, failed: 0 };

    const granted = await ctx.runMutation(internal.pipelineMatches.claimMatchBudget, { want: due.length });
    let sent = 0;
    let queued = 0;
    let failed = 0;
    for (const { watch, request, send } of due.slice(0, granted)) {
      try {
        const secret = unsubscribeSecret();
        const token = await makeUnsubscribeToken(watch.email, secret, "case-unsubscribe");
        const unsubscribeUrl = actionUrl("/case-alert/unsubscribe", token);
        const prefsUrl = await prefsLink(watch.email, secret, `case:${watch._id}`);
        const employerName = request.employerName ?? send[0]!.employerName ?? "The employer";
        const jobTitle = request.jobTitle ?? send[0]!.jobTitle ?? "the same job";
        const issuedOn = longDate(request.issuedOn) ?? request.issuedOn;
        const candidates = send.map((c) => ({
          caseNumber: c.caseNumber,
          employerName: c.employerName ?? employerName,
          jobTitle: c.jobTitle ?? jobTitle,
          filedOn: longDate(c.filingDate) ?? c.filingDate,
          caseUrl: casePageUrl(c.caseNumber),
          watchUrl: `${casePageUrl(c.caseNumber)}#watch`,
        }));
        const html = await renderHtml(async () => {
          const { PossiblePermMatch } = await import("../src/emails/PossiblePermMatch");
          return PossiblePermMatch({
            pwdCaseNumber: watch.caseNumber,
            employerName,
            jobTitle,
            issuedOn,
            candidates,
            unsubscribeUrl,
            prefsUrl,
          });
        });
        const one = candidates.length === 1;
        const result = await deliverAlert(ctx, {
          email: watch.email,
          kind: "match",
          ref: `match:${watch._id}`,
          subject: one ? "A PERM application that may be yours" : "PERM applications that may be yours",
          html,
          listUnsubscribe: unsubscribeUrl,
          summary: {
            title: candidates.map((c) => c.caseNumber).join(", "),
            line: `${employerName} filed ${one ? "a PERM" : `${candidates.length} PERMs`} for ${jobTitle} after your wage was issued`,
            url: candidates[0]!.caseUrl,
            tone: "neutral",
          },
          text: [
            `DOL issued the prevailing wage for ${watch.caseNumber} on ${issuedOn}. Since then, ${employerName} has filed ${
              one ? "a PERM application" : `${candidates.length} PERM applications`
            } for the same job title:`,
            "",
            ...candidates.flatMap((c) => [
              `  ${c.caseNumber}, filed ${c.filedOn}`,
              `  ${c.employerName}, ${c.jobTitle}`,
              `  Open it: ${c.caseUrl}`,
              `  Watch it: ${c.watchUrl}`,
              "",
            ]),
            "While a PERM is pending, DOL's record doesn't name the worker or say which wage request it uses (DOL names the wage request only once it decides the case), so we can't tell whether this is yours. What matches is the employer, the job title and a filing date after your wage. Your employer or attorney can confirm the case number.",
            "",
            `Stop these alerts: ${unsubscribeUrl}`,
            "",
            "PERM Tracker",
            TEXT_LEGAL_LINE,
          ].join("\n"),
        });
        if (result.status === "failed") {
          failed += 1;
          log.error("match send failed", { caseNumber: watch.caseNumber, error: result.error });
          continue;
        }
        await ctx.runMutation(internal.pipelineMatches.recordTold, {
          id: watch._id,
          email: watch.email,
          pwdCaseNumber: watch.caseNumber,
          cases: send.map((c) => ({ caseNumber: c.caseNumber, filingDate: c.filingDate })),
        });
        if (result.status === "sent") sent += 1;
        else queued += 1;
      } catch (error) {
        failed += 1;
        log.error("match send threw", { caseNumber: watch.caseNumber, error });
        await recordError(ctx, "action", "pipelineMatches.sweep", error);
      }
    }
    if (granted < due.length) {
      log.error("match budget held some back; they go tomorrow", { due: due.length, granted });
    }
    return { looked: watches.length, sent, queued, failed };
  },
});
