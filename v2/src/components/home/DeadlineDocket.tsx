import { Fragment } from "react";

import { formatAsOfShort } from "@/lib/dolFormat";
import {
  calculateFilingWindowFromCase,
  calculateI140FilingDeadline,
  calculateJobOrderEnd,
  calculateNoticeOfFilingEnd,
  calculatePWDExpiration,
} from "@/lib/perm";
import { cn } from "@/lib/utils";
import { MS_PER_DAY } from "@/lib/time";

/**
 * One example case's docket: the dates an attorney types, and every deadline
 * the app works out from them, computed by the same central rules a tracked
 * case runs through. The dates are fixed so the figure never shows a stale
 * "days left".
 */

/** What the attorney enters. The Sunday ads fall on Sundays (a test checks). */
export const EXAMPLE_CASE = {
  pwdDeterminationDate: "2026-03-16",
  jobOrderStartDate: "2026-04-06",
  noticeOfFilingStartDate: "2026-04-06",
  sundayAdFirstDate: "2026-04-12",
  sundayAdSecondDate: "2026-04-19",
  certificationDate: "2027-05-17",
} as const;

export type DocketKind = "recruitment" | "window" | "expiry";

export interface DocketRow {
  date: string;
  what: string;
  rule: string;
  kind: DocketKind;
}

export interface Docket {
  entered: { label: string; date: string }[];
  computed: DocketRow[];
  /** Entered once DOL certifies the case. */
  certification: { entered: string; row: DocketRow };
  window: { opens: string; closes: string; isPwdLimited: boolean };
  firstRecruitment: string;
  lastRecruitment: string;
}

export function exampleDocket(): Docket {
  const c = EXAMPLE_CASE;
  const pwdExpirationDate = calculatePWDExpiration(c.pwdDeterminationDate);
  const jobOrderEndDate = calculateJobOrderEnd(c.jobOrderStartDate);
  const noticeOfFilingEndDate = calculateNoticeOfFilingEnd(c.noticeOfFilingStartDate);
  const window = calculateFilingWindowFromCase({
    sundayAdFirstDate: c.sundayAdFirstDate,
    sundayAdSecondDate: c.sundayAdSecondDate,
    jobOrderStartDate: c.jobOrderStartDate,
    jobOrderEndDate,
    noticeOfFilingStartDate: c.noticeOfFilingStartDate,
    noticeOfFilingEndDate,
    pwdExpirationDate,
    isProfessionalOccupation: false,
  });
  if (!window) throw new Error("example case: no filing window");

  const computed: DocketRow[] = [
    { date: noticeOfFilingEndDate, what: "Notice of filing can come down", rule: "656.10(d)", kind: "recruitment" },
    { date: jobOrderEndDate, what: "Job order can come down", rule: "656.17", kind: "recruitment" },
    { date: window.opens, what: "Filing window opens", rule: "656.17", kind: "window" },
    {
      date: window.closes,
      what: window.isPwdLimited ? "Filing window closes, at the wage expiry" : "Filing window closes",
      rule: window.isPwdLimited ? "656.40(c)" : "656.17",
      kind: "window",
    },
  ];
  // A capped window already shows the wage expiry as its close.
  if (!window.isPwdLimited) {
    computed.push({ date: pwdExpirationDate, what: "Wage determination expires", rule: "656.40(c)", kind: "expiry" });
  }
  computed.sort((a, b) => a.date.localeCompare(b.date));

  const firstRecruitment = [c.jobOrderStartDate, c.noticeOfFilingStartDate, c.sundayAdFirstDate].sort()[0]!;
  const lastRecruitment = [jobOrderEndDate, noticeOfFilingEndDate, c.sundayAdSecondDate].sort().at(-1)!;

  return {
    entered: [
      { label: "Wage determination", date: c.pwdDeterminationDate },
      { label: "Job order and notice posted", date: c.jobOrderStartDate },
      { label: "First Sunday ad", date: c.sundayAdFirstDate },
      { label: "Second Sunday ad", date: c.sundayAdSecondDate },
    ],
    computed,
    certification: {
      entered: c.certificationDate,
      row: {
        date: calculateI140FilingDeadline(c.certificationDate),
        what: "Last day to file the I-140",
        rule: "656.30(b)(1)",
        kind: "expiry",
      },
    },
    window: { opens: window.opens, closes: window.closes, isPwdLimited: window.isPwdLimited },
    firstRecruitment,
    lastRecruitment,
  };
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY;

const KIND_MARK: Record<DocketKind, string> = {
  recruitment: "bg-stage-recruitment",
  window: "bg-primary",
  expiry: "bg-data-warn",
};

function Row({ row }: { row: DocketRow }) {
  // The citation gets its own column once the card itself is wide enough,
  // whatever the screen: the card is laid over a picture at several widths.
  return (
    <li className="grid grid-cols-[6.5rem_1fr] items-baseline gap-x-3 py-2.5 @md:grid-cols-[7rem_1fr_auto]">
      <span className="font-mono text-sm font-bold tabular-nums">{formatAsOfShort(row.date)}</span>{" "}
      <span className="flex min-w-0 items-baseline gap-2 text-base leading-snug">
        <span aria-hidden="true" className={cn("relative top-[-1px] size-2.5 shrink-0 border border-border", KIND_MARK[row.kind])} />{" "}
        <span>{row.what}</span>
      </span>{" "}
      <span className="col-start-2 font-mono text-sm text-muted-foreground @md:col-start-auto">20 CFR {row.rule}</span>
    </li>
  );
}

/** The docket card. Server-rendered; nothing on it moves. */
export function DeadlineDocket({ className }: { className?: string }) {
  const d = exampleDocket();
  // The strip spans first recruitment to the window's close.
  const from = dayNumber(d.firstRecruitment);
  const span = dayNumber(d.window.closes) - from;
  const at = (iso: string) => `${((dayNumber(iso) - from) / span) * 100}%`;

  return (
    <figure className={cn("@container border-3 border-border bg-card shadow-hard-lg", className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b-3 border-border bg-foreground px-4 py-2.5 text-background dark:bg-muted dark:text-foreground">
        <span className="font-heading text-base font-black">Example case</span>{" "}
        <span className="text-sm opacity-80">computed by the app</span>
      </figcaption>

      <div className="p-4 @md:p-5">
        <p className="text-sm font-bold text-muted-foreground">You enter</p>{" "}
        <ul className="mt-2 flex flex-wrap gap-2">
          {d.entered.map((e) => (
            <Fragment key={e.label}>
              {" "}
              <li className="inline-flex items-baseline gap-2 border-2 border-border bg-background px-2.5 py-1.5 text-sm">
                <span className="text-muted-foreground">{e.label}</span>{" "}
                <span className="font-mono font-bold tabular-nums">{formatAsOfShort(e.date)}</span>
              </li>
            </Fragment>
          ))}
        </ul>{" "}
        <p className="mt-5 text-sm font-bold text-muted-foreground">It works out</p>{" "}
        <ol className="mt-1 divide-y divide-border/40">
          {d.computed.map((r) => (
            <Fragment key={r.what}>
              {" "}
              <Row row={r} />
            </Fragment>
          ))}
        </ol>

        {/* Recruitment, the 30-day wait, then the filing window, to scale. */}
        <div className="mt-4" aria-hidden="true">
          <div className="relative h-7 border-2 border-border bg-background">
            <div className="absolute inset-y-0 left-0 bg-stage-recruitment" style={{ width: at(d.lastRecruitment) }} />
            <div
              className="absolute inset-y-0 border-l-2 border-border bg-primary"
              style={{ left: at(d.window.opens), right: 0 }}
            />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 border border-border bg-stage-recruitment" /> Recruitment
            </li>{" "}
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 border border-border bg-background" /> 30-day wait
            </li>{" "}
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 border border-border bg-primary" /> Filing window
            </li>
          </ul>
        </div>

        <div className="mt-5 border-t-2 border-dashed border-border pt-4">
          <p className="text-sm font-bold text-muted-foreground">
            When DOL certifies it, you enter{" "}
            <span className="font-mono text-foreground tabular-nums">{formatAsOfShort(d.certification.entered)}</span>
          </p>{" "}
          <ol className="mt-1">
            <Row row={d.certification.row} />
          </ol>
        </div>
      </div>
    </figure>
  );
}
