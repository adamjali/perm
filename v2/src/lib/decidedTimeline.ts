import { calculateFilingWindowFromCase, calculatePWDExpiration, type FilingWindow } from "@/lib/perm";
import { formatWage } from "@/lib/wageFormat";
import { daysBetween } from "@convex/lib/time";

import stepTable from "../../scripts/data/recruitment_steps.json";

/**
 * A decided PERM case's own dates, in order: its wage request, each recruitment step DOL's file
 * prints, the quiet period's end, the filing and the decision. Read from DOL's published file
 * (perm_cases) joined to the wage request the case names (pwd_cases); the quiet period's end and
 * the window's close come from the central filing-window rule, so the case page dates them the
 * way the app's deadlines do.
 */

export interface DecidedRecord {
  receivedDate: string | null;
  decisionDate: string | null;
  status: string | null;
  jobOrderStart: string | null;
  jobOrderEnd: string | null;
  paper1: string | null;
  ad1: string | null;
  paper2: string | null;
  ad2: string | null;
  /** DOL's additional steps as stored: JSON of step id -> [from, to]. */
  recrSteps: string | null;
  pwd: {
    number: string;
    filed: string | null;
    determined: string | null;
    level: string | null;
    wage: number | null;
    unit: string | null;
    /** DOL's printed validity end, where its file carries one. */
    expires: string | null;
  } | null;
}

export type TimelineTone = "pwd" | "recruitment" | "quiet" | "filed" | "certified" | "denied" | "withdrawn";

export interface TimelineStep {
  key: string;
  date: string;
  /** The last day, for a step that runs over days (the job order, an additional step). */
  until?: string;
  label: string;
  detail?: string;
  tone: TimelineTone;
}

export interface DecidedTimeline {
  steps: TimelineStep[];
  /** The first day the PERM could be filed: the last recruitment step plus the quiet period. */
  quietEnd: string | null;
  /** Days from the quiet period's end to the filing; null when either is missing. */
  filedAfterQuiet: number | null;
}

const STEP_LABEL: Record<string, string> = Object.fromEntries(
  (stepTable as { steps: { id: string; label: string }[] }).steps.map((s) => [s.id, s.label]),
);

const iso = (v: string | null | undefined): string | null => {
  const s = (v ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

function stepsOf(raw: string | null): [string, string, string | null][] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).flatMap(([id, span]) => {
      const from = Array.isArray(span) ? iso(span[0] as string) : null;
      return from ? [[id, from, Array.isArray(span) ? iso(span[1] as string) : null] as [string, string, string | null]] : [];
    });
  } catch {
    return [];
  }
}

function decidedTone(status: string): TimelineTone {
  const s = status.toUpperCase();
  if (s.startsWith("CERTIFIED")) return "certified";
  if (s.startsWith("WITHDRAWN")) return "withdrawn";
  return "denied";
}

const sentence = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

export function decidedTimeline(r: DecidedRecord): DecidedTimeline {
  const steps: TimelineStep[] = [];
  const add = (s: TimelineStep | null) => {
    if (s) steps.push(s);
  };
  const pwd = r.pwd;
  const determined = iso(pwd?.determined);
  if (pwd) {
    const filed = iso(pwd.filed);
    if (filed) add({ key: "pwd-filed", date: filed, label: "Wage request filed", detail: pwd.number, tone: "pwd" });
    if (determined) {
      const wage = formatWage(pwd.wage, pwd.unit);
      const level = pwd.level ? `Level ${pwd.level.replace(/^level\s*/i, "")}` : null;
      add({ key: "pwd-determined", date: determined, label: "Wage determined", detail: [level, wage].filter(Boolean).join(", ") || undefined, tone: "pwd" });
    }
  }
  const jobFrom = iso(r.jobOrderStart);
  if (jobFrom) add({ key: "job-order", date: jobFrom, until: iso(r.jobOrderEnd) ?? undefined, label: "Job order", tone: "recruitment" });
  const ad1 = iso(r.ad1);
  const ad2 = iso(r.ad2);
  if (ad1) add({ key: "ad1", date: ad1, label: ad2 ? "First Sunday ad" : "Sunday ad", detail: r.paper1 ?? undefined, tone: "recruitment" });
  if (ad2) add({ key: "ad2", date: ad2, label: "Second Sunday ad", detail: r.paper2 ?? r.paper1 ?? undefined, tone: "recruitment" });
  const extra = stepsOf(r.recrSteps);
  for (const [id, from, to] of extra) {
    add({ key: `step-${id}`, date: from, until: to ?? undefined, label: STEP_LABEL[id] ?? id.replace(/_/g, " "), tone: "recruitment" });
  }

  const window: FilingWindow | null = calculateFilingWindowFromCase({
    sundayAdFirstDate: ad1 ?? undefined,
    sundayAdSecondDate: ad2 ?? ad1 ?? undefined,
    jobOrderStartDate: jobFrom ?? undefined,
    jobOrderEndDate: iso(r.jobOrderEnd) ?? undefined,
    additionalRecruitmentMethods: extra.map(([, from, to]) => ({ startDate: from, endDate: to ?? undefined })),
    isProfessionalOccupation: extra.length > 0,
    pwdDeterminationDate: determined ?? undefined,
    pwdExpirationDate: iso(pwd?.expires) ?? (determined ? calculatePWDExpiration(determined) : undefined),
  });
  const quietEnd = window?.opens ?? null;
  if (quietEnd) add({ key: "quiet", date: quietEnd, label: "Quiet period ended", detail: "The first day the PERM could be filed", tone: "quiet" });

  const filed = iso(r.receivedDate);
  const filedAfterQuiet = filed && quietEnd ? daysBetween(quietEnd, filed) : null;
  if (filed) {
    add({
      key: "filed",
      date: filed,
      label: "PERM filed",
      detail: filedAfterQuiet !== null && filedAfterQuiet >= 0
        ? `${filedAfterQuiet === 0 ? "The day" : `${filedAfterQuiet} ${filedAfterQuiet === 1 ? "day" : "days"}`} after the quiet period ended`
        : undefined,
      tone: "filed",
    });
  }
  if (determined) {
    const expires = iso(pwd?.expires) ?? calculatePWDExpiration(determined);
    add({ key: "pwd-expires", date: expires, label: "Wage determination's last day", tone: "pwd" });
  }
  const decided = iso(r.decisionDate);
  if (decided && r.status) add({ key: "decided", date: decided, label: sentence(r.status), tone: decidedTone(r.status) });

  // Stable by date: on one day, the order the steps happen in (as added).
  const ordered = steps.map((s, i) => ({ s, i })).sort((a, b) => a.s.date.localeCompare(b.s.date) || a.i - b.i).map((x) => x.s);
  return { steps: ordered, quietEnd, filedAfterQuiet };
}
