"use client";

/**
 * PERM deadline calculator.
 *
 * The one tool here that is not a forecast. Everything on the other two pages
 * is a prediction over DOL's queue and is wrong by some margin every time;
 * these dates are 20 CFR 656 arithmetic, and a wrong one is a bug rather than
 * a miss.
 *
 * It runs the same functions the tracker itself runs. This directory is the
 * single source of truth for PERM date math precisely so a public calculator
 * and a paying user's case can never drift apart.
 */

import { useId, useMemo, useState } from "react";
import { CalendarCheck, TriangleAlert } from "lucide-react";

import {
  calculatePWDExpiration,
  calculateRecruitmentDeadlines,
  calculateETA9089Window,
} from "@/lib/perm";
import { formatAsOf } from "@/lib/dolFormat";
import { DateInput } from "@/components/forms/DateInput";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PermDeadlineCalculatorProps {
  className?: string;
}

interface Row {
  label: string;
  date: string;
  detail: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function PermDeadlineCalculator({ className }: PermDeadlineCalculatorProps) {
  const pwdId = useId();
  const recruitId = useId();
  const lastRecruitId = useId();

  const [pwdDate, setPwdDate] = useState("");
  const [firstRecruitment, setFirstRecruitment] = useState("");
  const [lastRecruitment, setLastRecruitment] = useState("");

  const result = useMemo(() => {
    if (!DATE_RE.test(pwdDate)) return null;
    try {
      const pwdExpiration = calculatePWDExpiration(pwdDate);
      const rows: Row[] = [
        {
          label: "Prevailing wage determination expires",
          date: pwdExpiration,
          detail:
            "20 CFR 656.40(c). Recruitment has to be under way before this date or the determination has to be requested again.",
        },
      ];

      if (DATE_RE.test(firstRecruitment)) {
        const deadlines = calculateRecruitmentDeadlines(firstRecruitment, pwdExpiration);
        rows.push(
          {
            label: "Notice of filing must be posted by",
            date: deadlines.notice_of_filing_deadline,
            detail: "Ten consecutive business days, and it has to finish inside the recruitment window.",
          },
          {
            label: "State job order must start by",
            date: deadlines.job_order_start_deadline,
            detail: "Thirty days minimum, run through the state workforce agency.",
          },
          {
            label: "First Sunday advertisement by",
            date: deadlines.first_sunday_ad_deadline,
            detail: "Two Sunday print advertisements are required, in a paper of general circulation.",
          },
        );

        // The window opens 30 days after the LAST recruitment step and closes
        // 180 days after the FIRST. Passing the first date for both, as an
        // earlier version did, silently reports an "opens" date that is only
        // correct when recruitment happened to be a single day long.
        const closes = calculateETA9089Window(
          new Date(`${firstRecruitment}T00:00:00Z`),
          new Date(`${firstRecruitment}T00:00:00Z`),
        ).closes
          .toISOString()
          .slice(0, 10);

        if (DATE_RE.test(lastRecruitment)) {
          const opens = calculateETA9089Window(
            new Date(`${firstRecruitment}T00:00:00Z`),
            new Date(`${lastRecruitment}T00:00:00Z`),
          ).opens
            .toISOString()
            .slice(0, 10);
          rows.push({
            label: "ETA-9089 filing window opens",
            date: opens,
            detail:
              "Thirty days after the last recruitment step, the quiet period. Filing before this is an automatic denial.",
          });
        }

        rows.push({
          label: "ETA-9089 filing window closes",
          date: closes,
          detail:
            "One hundred and eighty days after the first recruitment step. Recruitment older than this cannot support a filing.",
        });
      }

      return rows;
    } catch {
      // A malformed date reaches here rather than crashing the page. The inputs
      // are date pickers, so this is the paste-a-bad-value path.
      return null;
    }
  }, [pwdDate, firstRecruitment, lastRecruitment]);

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        {/* The icon sits beside the heading only. Wrapping the copy in
            the icon flex indented it 36px against the form below, which
            reads as the inputs sticking out to the left. */}
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            Your PERM deadlines
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          These are not estimates. Every date below is fixed arithmetic on
          the prevailing wage determination under 20 CFR 656.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={pwdId} className="text-sm font-bold">
              Prevailing wage determination date
            </Label>
            {/* The shared DateInput, not a raw <input type="date">. It carries
                min-w-0 on the control and its wrapper, which is what stops a
                date field overflowing its grid track on iOS, where the
                intrinsic width is wider than on Blink. */}
            <DateInput
              id={pwdId}
              value={pwdDate}
              onChange={(e) => setPwdDate(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor={recruitId} className="text-sm font-bold">
              First recruitment step{" "}
              <span className="font-normal text-foreground/60">(optional)</span>
            </Label>
            {/* The shared DateInput, not a raw <input type="date">. It carries
                min-w-0 on the control and its wrapper, which is what stops a
                date field overflowing its grid track on iOS, where the
                intrinsic width is wider than on Blink. */}
            <DateInput
              id={recruitId}
              value={firstRecruitment}
              onChange={(e) => setFirstRecruitment(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor={lastRecruitId} className="text-sm font-bold">
              Last recruitment step{" "}
              <span className="font-normal text-foreground/60">(optional)</span>
            </Label>
            {/* The shared DateInput, not a raw <input type="date">. It carries
                min-w-0 on the control and its wrapper, which is what stops a
                date field overflowing its grid track on iOS, where the
                intrinsic width is wider than on Blink. */}
            <DateInput
              id={lastRecruitId}
              value={lastRecruitment}
              onChange={(e) => setLastRecruitment(e.target.value)}
              className="mt-2"
            />
            <p className="mt-2 text-sm text-foreground/60">
              Needed for the date the filing window opens.
            </p>
          </div>
        </div>
      </div>

      {result && result.length > 0 ? (
        <div className="divide-y-2 divide-border">
          {result.map((row) => (
            <div key={row.label} className="p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                {row.label}
              </p>{" "}
              <p className="mt-2 font-heading text-2xl font-black leading-none sm:text-3xl">
                {formatAsOf(row.date)}
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">{row.detail}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          <p className="text-base leading-relaxed text-foreground/70">
            Enter the prevailing wage determination date to see the dates it
            fixes. Add the first recruitment step for the full set.
          </p>
        </div>
      )}

      <div className="border-t-2 border-border bg-muted p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70"
            aria-hidden="true"
          />
          <p className="text-base leading-relaxed text-foreground/70">
            This works out the standard windows and is not legal advice.
            Professional roles need three additional recruitment steps beyond
            the ones listed here, and supervised recruitment runs on a different
            set of rules entirely.
          </p>
        </div>
      </div>
    </div>
  );
}
