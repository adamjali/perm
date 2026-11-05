/**
 * One filing month as a picture someone can share: how much of it has a
 * decision, how the rest stands, and the day it was counted.
 *
 * It's a FACT, never a forecast: every figure is a count from DOL's own
 * case-status service as our sweep last read it, and the picture carries that
 * day. So it can travel (a chat, a forum, a group) without going stale in
 * silence, which is why the site's share cards may not carry a live figure and
 * this may: it's a dated reading, made fresh with the page.
 *
 * The parts are the month page's own status bar, so the page and the picture
 * can't count a month two ways. Pure, so the unit project holds it.
 */

import { ISO_MONTH_RE, monthYear, shortDate } from "@convex/lib/months";
import { formatInt, formatShareOf } from "@/lib/format";
import { WITHDRAWALS_LEAD, type MonthMakeup } from "@/lib/monthMakeup";

/** Where a group of cases stands, in the order a reader takes the bar in. */
export type MonthPartKey = "certified" | "denied" | "withdrawn" | "inLine" | "outside";

export interface MonthPart {
  key: MonthPartKey;
  count: number;
  /** Read after the count: "7,000 certified". */
  text: string;
}

/**
 * Decided first (certified, denied, withdrawn), then waiting (in DOL's line,
 * then outside it). Any other final status counts with certified, as a lapsed
 * certification is one. Empty parts are left out.
 */
export function monthParts(m: MonthMakeup): MonthPart[] {
  const parts: MonthPart[] = [
    { key: "certified", count: m.certified + m.otherDecided, text: "certified" },
    { key: "denied", count: m.denied, text: "denied" },
    { key: "withdrawn", count: m.withdrawn, text: "withdrawn by the employer" },
    { key: "inLine", count: m.inLine, text: "in DOL's line" },
    { key: "outside", count: m.outside, text: "on hold, at an RFI or on appeal" },
  ];
  return parts.filter((p) => p.count > 0);
}

export interface MonthShare {
  month: string;
  /** "February 2026" */
  label: string;
  /** The picture's heading. */
  title: string;
  /** The share decided, never a clean 0% or 100% the counts don't have. */
  share: string;
  /** The sentence the share stands for. */
  lead: string;
  /** The same counts in a few words, beside the share on the picture. */
  tally: string;
  parts: MonthPart[];
  /** Said only when withdrawals are most of what's decided. */
  note: string | null;
  /** Where DOL is, by our daily check, or null when the check can't say. */
  line: string | null;
  /** The day it was counted, and from what. */
  stamp: string;
  /** The page the picture comes from, as it's printed on it. */
  address: string;
  /** Everything the picture says, for anyone who can't see it. */
  alt: string;
}

export interface MonthShareInput {
  month: string;
  makeup: MonthMakeup;
  /** The census day the counts are from, `YYYY-MM-DD`. */
  asOf: string;
  /** Our daily check's reading of where DOL is, or null. */
  line: { month: string; asOf: string } | null;
}

export function buildMonthShare({ month, makeup: m, asOf, line }: MonthShareInput): MonthShare {
  const label = ISO_MONTH_RE.test(month) ? monthYear(month) : null;
  if (!label) throw new Error(`not a filing month: ${month}`);
  if (m.total <= 0) throw new Error(`no cases filed in ${month}`);
  const day = shortDate(asOf);
  if (!day) throw new Error(`not a day: ${asOf}`);

  const share = formatShareOf(m.decided, m.total);
  const parts = monthParts(m);
  const lineMonth = line ? monthYear(line.month) : null;

  return {
    month,
    label,
    title: `PERM applications filed in ${label}`,
    share,
    lead: leadSentence(m.decided, m.total, label),
    tally: `${formatInt(m.decided)} of ${formatInt(m.total)} ${m.decided === 1 ? "has" : "have"} a decision`,
    parts,
    note: withdrawalNote(m, month, line?.month ?? null),
    line: lineMonth ? `DOL is deciding cases filed in ${lineMonth}, by our daily check.` : null,
    stamp: `Counted ${day} from DOL's case-status service`,
    address: `permtracker.app/perm-queue/${month}`,
    alt: [
      `PERM applications filed in ${label}: ${share} have a decision, ${formatInt(m.decided)} of ${formatInt(m.total)}.`,
      `${parts.map((p) => `${formatInt(p.count)} ${p.text}`).join(", ")}.`,
      lineMonth ? `DOL is deciding cases filed in ${lineMonth}, by our daily check.` : "",
      `Counted ${day} from DOL's case-status service. permtracker.app`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function leadSentence(decided: number, total: number, label: string): string {
  if (total === 1) {
    return `The one PERM application filed in ${label} ${decided ? "has a decision" : "has no decision yet"}.`;
  }
  if (decided === 0) return `None of the ${formatInt(total)} PERM applications filed in ${label} has a decision yet.`;
  return `${formatInt(decided)} of the ${formatInt(total)} PERM applications filed in ${label} ${decided === 1 ? "has" : "have"} a decision.`;
}

/**
 * A month DOL hasn't reached still shows a few percent decided, and nearly all
 * of it is withdrawals. Said beside the share so a reader doesn't take it as
 * DOL at work; the month page says the same at the same threshold.
 */
function withdrawalNote(m: MonthMakeup, month: string, lineMonth: string | null): string | null {
  if (m.decided === 0 || m.withdrawn / m.decided < WITHDRAWALS_LEAD) return null;
  const which = m.withdrawn === m.decided ? `All ${formatInt(m.decided)} decided are` : `${formatInt(m.withdrawn)} of the ${formatInt(m.decided)} decided are`;
  const unreached = lineMonth !== null && lineMonth < month ? " DOL hasn't reached this month." : "";
  return `${which} withdrawals, which employers file.${unreached}`;
}
