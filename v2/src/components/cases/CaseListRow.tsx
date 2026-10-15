"use client";

/**
 * CaseListRow
 *
 * One case in the list view: the stage's dot, employer and role, the next
 * deadline and how long until it, and the progress chip. The employer's name
 * is the row's link and covers it; in selection mode the row selects.
 *
 * @module components/cases/CaseListRow
 */

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { formatDeadlineDate } from "./case-card.utils";
import { CountdownChip } from "./DeadlineCountdown";
import type { CaseCardData } from "@convex/lib/caseListTypes";

export interface CaseListRowProps {
  caseData: CaseCardData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
}

export const CaseListRow = memo(function CaseListRow({
  caseData: c,
  isSelected = false,
  onSelect,
  selectionMode = false,
}: CaseListRowProps) {
  const stage = STAGE_VISUALS[c.caseStatus];
  const open = c.caseStatus !== "closed" && c.nextDeadline;

  return (
    <div
      data-testid="case-list-row"
      className={cn(
        "relative flex min-h-16 items-center gap-3 border-b border-border py-3 pl-5 pr-4 transition-colors hover:bg-accent",
        isSelected && "bg-tint",
      )}
    >
      {selectionMode ? (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect?.(c._id)}
          className="relative z-10 shrink-0"
          aria-label={`Select ${c.employerName}`}
        />
      ) : null}
      {/* The stage's colour down the row's edge, as on the folder tabs. */}
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1.5", stage?.fill ?? "bg-muted")} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-semibold" title={c.employerName}>
          {selectionMode ? (
            <button type="button" onClick={() => onSelect?.(c._id)} className="truncate text-left after:absolute after:inset-0 focus-visible:outline-none">
              {c.employerName}
            </button>
          ) : (
            <Link href={`/cases/${c._id}`} className="truncate after:absolute after:inset-0 hover:text-primary-text focus-visible:outline-none">
              {c.employerName}
            </Link>
          )}
          {c.isSample ? <Badge className="shrink-0 border-dashed font-normal">Sample</Badge> : null}
        </p>{" "}
        <p className="truncate text-sm text-muted-foreground">
          {[c.positionTitle, stage?.label].filter(Boolean).join(" · ")}
        </p>
      </div>
      {open && c.nextDeadline ? (
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <p className="hidden max-w-56 text-right sm:block" title={c.nextDeadlineLabel}>
            <span className="block truncate font-semibold">{c.nextDeadlineLabel}</span>{" "}
            <span className="block font-mono text-soft">{formatDeadlineDate(c.nextDeadline)}</span>
          </p>{" "}
          <CountdownChip deadline={c.nextDeadline} />
        </div>
      ) : null}
      <div className="hidden shrink-0 md:block">
        <ProgressStatusBadge status={c.progressStatus} />
      </div>
    </div>
  );
});
