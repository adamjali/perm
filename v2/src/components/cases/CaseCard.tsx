"use client";

/**
 * CaseCard
 *
 * One case in the cases grid: its stage, employer and role, the next deadline
 * as one line, the chips that need saying, and its dates in a fold. The
 * employer's name is the card's link (it covers the card), so the whole card
 * opens the case; the star and the menu sit above it. In selection mode the
 * card selects instead.
 */

import { memo } from "react";
import Link from "next/link";
import { ArchiveIcon, ArrowCounterClockwiseIcon, CaretDownIcon, DotsThreeIcon, PencilSimpleIcon, StarIcon, TrashIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import type { CaseCardData } from "@convex/lib/caseListTypes";
import { countShownDates, formatClosureReasonLabel, formatCompactDate } from "./case-card.utils";
import { useCardMutations } from "./useCardMutations";
import { CaseBadges, CaseDates } from "./CaseCardParts";
import { DeadlineCountdown } from "./DeadlineCountdown";

interface CaseCardProps {
  case: CaseCardData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  onDeleteRequest?: (caseId: string, caseName: string) => void;
  onArchiveRequest?: (caseId: string, caseName: string) => void;
}

export const CaseCard = memo(function CaseCard({
  case: c,
  isSelected = false,
  onSelect,
  selectionMode = false,
  onDeleteRequest,
  onArchiveRequest,
}: CaseCardProps) {
  const isClosed = c.caseStatus === "closed";
  const role = c.positionTitle || c.beneficiaryIdentifier;
  const caseName = `${c.employerName} - ${role}`;
  const actions = useCardMutations(c._id);
  const stage = STAGE_VISUALS[c.caseStatus];
  const dateCount = countShownDates(c.dates);
  const closedReason = formatClosureReasonLabel(c.closedReason);

  return (
    <article
      data-testid="case-card"
      className={cn(
        "manila relative mt-7 flex flex-col",
        isSelected && "outline-4 outline-offset-2 outline-primary",
        isClosed && "manila-closed",
      )}
    >
      {/* Two sheets that rise out of the folder on hover (globals.css). */}
      <span className="manila-papers" aria-hidden="true">
        <span className="manila-sheet" />
        <span className="manila-sheet" />
      </span>
      {/* The folder's tab, in its stage's colour, so a row of folders reads
          by stage at a glance. */}
      <span className={cn("manila-tab", stage.fill, stage.onFill)}>{stage.label}</span>
      <div className="flex flex-1 flex-col gap-3 p-5 pt-4">
        {/* The controls sit in the corner, beside the name, not on a row of their own. */}
        <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
          <span className="flex items-center">
            {selectionMode ? (
              <Checkbox
                data-testid="selection-checkbox"
                checked={isSelected}
                onCheckedChange={() => onSelect?.(c._id)}
                className="relative z-10 size-5"
                aria-label={`Select ${c.employerName}`}
              />
            ) : null}
          </span>
          {selectionMode ? null : (
            <span className="relative z-10 flex items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={c.isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={c.isFavorite}
                disabled={actions.busy === "favorite"}
                onClick={actions.toggleFavorite}
              >
                <StarIcon weight={c.isFavorite ? "fill" : "regular"} className={cn(c.isFavorite && "text-data-warn-ink")} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More options">
                    <DotsThreeIcon weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isClosed ? (
                    <DropdownMenuItem onSelect={actions.reopen} disabled={actions.busy === "reopening"} aria-label="Reopen">
                      <ArrowCounterClockwiseIcon className="mr-2 size-4" />
                      Reopen
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href={`/cases/${c._id}/edit`} aria-label="Edit">
                          <PencilSimpleIcon className="mr-2 size-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onArchiveRequest?.(c._id, caseName)} aria-label="Archive">
                        <ArchiveIcon className="mr-2 size-4" />
                        Archive
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onSelect={() => onDeleteRequest?.(c._id, caseName)} aria-label="Delete">
                    <TrashIcon className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          )}
        </div>

        <div className="min-w-0 pr-20">
          <h3 className="truncate font-heading text-lg font-bold leading-tight" title={c.employerName}>
            {selectionMode ? (
              <button
                type="button"
                onClick={() => onSelect?.(c._id)}
                className="text-left after:absolute after:inset-0 focus-visible:outline-none"
              >
                {c.employerName}
              </button>
            ) : (
              <Link href={`/cases/${c._id}`} className="after:absolute after:inset-0 hover:text-primary-text focus-visible:outline-none">
                {c.employerName}
              </Link>
            )}
          </h3>{" "}
          <p className="truncate text-sm text-muted-foreground" title={role}>
            {role}
          </p>
        </div>

        {isClosed ? (
          <p className="text-sm text-muted-foreground">
            Closed{c.closedAt ? ` ${formatCompactDate(c.closedAt)}` : ""}
            {closedReason ? `: ${closedReason}` : ""}
          </p>
        ) : c.nextDeadline && c.nextDeadlineLabel ? (
          <DeadlineCountdown deadline={c.nextDeadline} label={c.nextDeadlineLabel} />
        ) : (
          // The countdown's footprint, so folders in a row line up.
          <p className="flex min-h-14 items-center border-2 border-dashed border-border px-3 text-sm font-semibold text-soft">
            No upcoming deadlines
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {isClosed || (c.progressStatus === "rfi_rfe" && (c.hasActiveRfi || c.hasActiveRfe)) ? null : (
            <ProgressStatusBadge status={c.progressStatus} />
          )}
          <CaseBadges duplicateOf={c.duplicateOf} hasActiveRfi={c.hasActiveRfi} hasActiveRfe={c.hasActiveRfe} isSample={c.isSample} />
        </div>
      </div>

      {!isClosed && (dateCount > 0 || c.notes) ? (
        <details
          className="group relative z-10 border-t-2 border-border"
          open={c.isPinned}
          onToggle={(e) => {
            // Keeping a case's dates open is remembered for that case.
            if ((e.currentTarget as HTMLDetailsElement).open !== c.isPinned) void actions.togglePinned();
          }}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-5 text-sm font-semibold hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {dateCount > 0 ? `Dates (${dateCount})${c.notes ? " and notes" : ""}` : "Notes"}
            <CaretDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-5 pb-5">
            <CaseDates dates={c.dates} notes={c.notes} />
          </div>
        </details>
      ) : null}
    </article>
  );
});

CaseCard.displayName = "CaseCard";
