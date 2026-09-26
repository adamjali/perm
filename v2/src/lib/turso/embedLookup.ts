import "server-only";

import { EMBED_ALL_DAILY_LIVE, EMBED_SITE_DAILY_LIVE } from "@/lib/embeds";
import { lookupCase, normaliseLookupCaseNumber } from "./caseLookup";
import { discoverCase, fetchDolCase, underDailyBudget } from "./caseDiscovery";
import { exec, one } from "./client";
import type { FlagProgram } from "./flagCases";
import { lca } from "./lcaCases";
import { pwd } from "./pwdCases";

/**
 * The lookup behind `/embed/case-status`: ask DOL live, under a cap, and fall
 * back to our own stored record.
 *
 * WHY IT ASKS LIVE EVEN FOR A CASE WE HOLD. A site that embeds a lookup is
 * vouching for the answer on its own page, and our stored status is up to a
 * day old (the sweep re-reads every pending case nightly). So an embedded
 * lookup reads DOL's status right now, while this site's own lookup keeps
 * asking DOL only on a miss.
 *
 * WHAT A LIVE ANSWER NEVER DOES: overwrite a stored row. The nightly sweep
 * turns a status difference into an event, and that event is what sends case
 * alerts and feeds the RFI funnel. A lookup that wrote the new status first
 * would leave the sweep nothing to notice. A case we do NOT hold goes through
 * the ordinary discovery path instead, which records it (INSERT OR IGNORE)
 * so the sweep owns it from tomorrow, exactly as a lookup on this site does.
 *
 * THREE CAPS, cheapest first: this site's embeds per day, all embeds per day,
 * then the site-wide discovery budget every live ask already charges. The
 * first two share one `perm_docs` row per UTC day (`embed_live_<date>`, a JSON
 * map of site to count), so a caller inventing site names cannot grow the
 * table, and the all-sites count is charged before a site's own entry is
 * written, so the map holds at most EMBED_ALL_DAILY_LIVE entries. Any failure
 * of the counters falls back to the stored record: no counter, no live ask.
 */

export type EmbedProgram = "perm" | "pwd" | "lca";

export interface EmbedCaseAnswer {
  caseNumber: string;
  program: EmbedProgram;
  /** False when neither DOL (if asked) nor our record knows the number. */
  found: boolean;
  status: string | null;
  filingDate: string | null;
  decisionDate: string | null;
  employerName: string | null;
  jobTitle: string | null;
  /** "dol-now": read from DOL during this request. "stored": our record. */
  source: "dol-now" | "stored" | null;
  /** When the status shown was read (ISO). */
  checkedAt: string | null;
  /** This site's (or every site's) live checks for today were used up. */
  capped: boolean;
}

const FLAG: Record<"pwd" | "lca", FlagProgram> = { pwd, lca };

/** Which program a typed number belongs to. P- and I- first: the PERM shape accepts any letter. */
export function embedProgramOf(input: string): { program: EmbedProgram; caseNumber: string } | null {
  const p = pwd.normalise(input);
  if (p) return { program: "pwd", caseNumber: p };
  const l = lca.normalise(input);
  if (l) return { program: "lca", caseNumber: l };
  const g = normaliseLookupCaseNumber(input);
  return g ? { program: "perm", caseNumber: g } : null;
}

async function bump(key: string, field: string, now: Date): Promise<number> {
  const path = `$."${field}"`;
  await exec(
    `INSERT INTO perm_docs (key, json, computed_at) VALUES (?, json_set('{}', ?, 1), ?)
     ON CONFLICT(key) DO UPDATE SET
       json = json_set(json, ?, COALESCE(json_extract(json, ?), 0) + 1),
       computed_at = excluded.computed_at`,
    [key, path, now.getTime(), path, path],
  );
  const row = await one<{ n: number | string | null }>(
    `SELECT json_extract(json, ?) AS n FROM perm_docs WHERE key = ?`,
    [path, key],
  );
  const n = Number(row?.n);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * Count one live ask for `site` and say whether it may go ahead: "ok",
 * "capped" (a cap is spent), or "error" (the counter could not be written, so
 * nothing is asked; the answer is the stored record either way).
 * Increment-then-check, like the discovery budget: refused attempts count.
 */
export async function chargeEmbedLive(site: string, now: Date): Promise<"ok" | "capped" | "error"> {
  if (!/^[a-z0-9.-]+$/.test(site) || site === "all") return "error";
  const key = `embed_live_${now.toISOString().slice(0, 10)}`;
  try {
    if ((await bump(key, "all", now)) > EMBED_ALL_DAILY_LIVE) return "capped";
    return (await bump(key, site, now)) <= EMBED_SITE_DAILY_LIVE ? "ok" : "capped";
  } catch (e) {
    console.error("[embedLookup] counter failed:", e);
    return "error";
  }
}

interface Stored {
  status: string;
  filingDate: string | null;
  decisionDate: string | null;
  employerName: string | null;
  jobTitle: string | null;
  checkedAt: string | null;
}

async function readStored(program: EmbedProgram, cn: string): Promise<Stored | null> {
  if (program === "perm") {
    const r = await lookupCase(cn, { discover: false });
    if (r?.live) {
      return {
        status: r.live.status,
        filingDate: r.live.filingDate,
        decisionDate: r.decided?.decisionDate ?? null,
        employerName: r.live.employerName ?? r.decided?.employerName ?? null,
        jobTitle: r.live.jobTitle ?? r.decided?.jobTitle ?? null,
        checkedAt: r.live.lastCheckedAt,
      };
    }
    if (r?.decided) {
      return {
        status: r.decided.status,
        filingDate: r.decided.receivedDate,
        decisionDate: r.decided.decisionDate,
        employerName: r.decided.employerName,
        jobTitle: r.decided.jobTitle,
        checkedAt: null,
      };
    }
    return null;
  }
  const flag = FLAG[program];
  const live = await flag.lookup(cn, { discover: false });
  if (live) {
    return {
      status: live.status,
      filingDate: live.filingDate,
      decisionDate: null,
      employerName: live.employerName,
      jobTitle: live.jobTitle,
      checkedAt: live.lastCheckedAt,
    };
  }
  const dec = await flag.lookupDisclosed(cn);
  return dec
    ? {
        status: dec.status,
        filingDate: dec.receivedDate,
        decisionDate: dec.decisionDate,
        employerName: dec.employerName,
        jobTitle: dec.jobTitle,
        checkedAt: null,
      }
    : null;
}

export async function lookupForEmbed(
  input: string,
  site: string,
  now: Date = new Date(),
  f: typeof fetch = fetch,
): Promise<EmbedCaseAnswer | null> {
  const which = embedProgramOf(input);
  if (!which) return null;
  const { program, caseNumber } = which;
  const base = { caseNumber, program };

  const stored = await readStored(program, caseNumber).catch((e) => {
    console.error("[embedLookup] stored read failed:", e);
    return null;
  });
  const fromStored = (capped: boolean): EmbedCaseAnswer =>
    stored
      ? { ...base, found: true, ...stored, source: "stored", capped }
      : { ...base, found: false, status: null, filingDate: null, decisionDate: null, employerName: null, jobTitle: null, source: null, checkedAt: null, capped };

  const charge = await chargeEmbedLive(site, now);
  if (charge !== "ok") return fromStored(charge === "capped");

  if (stored) {
    // A case we hold: read DOL's status now, charge the site-wide budget,
    // and write nothing (see the header).
    const prefix = program === "perm" ? undefined : FLAG[program].config.budgetPrefix;
    const allowed = await underDailyBudget(now, prefix).catch(() => false);
    const rec = allowed ? await fetchDolCase(caseNumber, f) : null;
    if (!rec) return fromStored(false);
    return {
      ...base,
      found: true,
      status: rec.caseStatus,
      filingDate: stored.filingDate,
      decisionDate: stored.decisionDate,
      employerName: rec.employerName ?? stored.employerName,
      jobTitle: rec.jobTitle ?? stored.jobTitle,
      source: "dol-now",
      checkedAt: now.toISOString(),
      capped: false,
    };
  }

  // A case we don't hold: the ordinary discovery path, which charges the
  // site-wide budget, asks DOL, and records a hit.
  const found =
    program === "perm"
      ? await discoverCase(caseNumber, f, now).catch(() => null)
      : await FLAG[program].discover(caseNumber, f, now).catch(() => null);
  if (!found) return fromStored(false);
  return {
    ...base,
    found: true,
    status: found.status,
    filingDate: found.filingDate,
    decisionDate: null,
    employerName: found.employerName,
    jobTitle: found.jobTitle,
    source: "dol-now",
    checkedAt: found.lastCheckedAt,
    capped: false,
  };
}
