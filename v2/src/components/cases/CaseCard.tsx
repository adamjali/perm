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
import { useQuery } from "convex/react";
import { ArchiveIcon, ArrowCounterClockwiseIcon, CaretDownIcon, DotsThreeIcon, PencilSimpleIcon, StarIcon, TrashIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { getUrgencyFromDeadline } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { api } from "@convex/_generated/api";
import type { CaseCardData } from "@convex/lib/caseListTypes";
import {
  countShownDates,
  deadlineCountdownWords,
  formatClosureReasonLabel,
  formatCompactDate,
  formatDeadlineDate,
} from "./case-card.utils";
import { useCardMutations } from "./useCardMutations";
import { CaseBadges, CalendarSyncIndicator, CaseDates } from "./CaseCardParts";

interface CaseCardProps {
  case: CaseCardData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  onDeleteRequest?: (caseId: string, caseName: string) => void;
  onArchiveRequest?: (caseId: string, caseName: string) => void;
}

/** The countdown's colour: late or within a week in red, within a month in amber. */
const URGENCY_INK = { urgent: "text-destructive", soon: "text-data-warn-ink", normal: "text-foreground" } as const;

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
  const profile = useQuery(api.users.currentUserProfile);
  const urgency = !isClosed && c.nextDeadline ? getUrgencyFromDeadline(c.nextDeadline) : null;
  const dateCount = countShownDates(c.dates);
  const closedReason = formatClosureReasonLabel(c.closedReason);

  return (
    <article
      data-testid="case-card"
      className={cn(
        "manila relative mt-7 flex flex-col transition-colors",
        isSelected && "outline-4 outline-offset-2 outline-primary",
        isClosed && "manila-closed",
      )}
    >
      {/* The folder's tab: the case's stage, written where a file clerk would. */}
      <span className="manila-tab">
        <CaseStageBadge stage={c.caseStatus} />
      </span>
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
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{c.nextDeadlineLabel}</span>{" "}
              <span className="whitespace-nowrap text-muted-foreground">{formatDeadlineDate(c.nextDeadline)}</span>
            </span>{" "}
            <span className={cn("shrink-0 whitespace-nowrap font-semibold tabular-nums", urgency && URGENCY_INK[urgency])}>
              {deadlineCountdownWords(c.nextDeadline)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {isClosed || (c.progressStatus === "rfi_rfe" && (c.hasActiveRfi || c.hasActiveRfe)) ? null : (
            <ProgressStatusBadge status={c.progressStatus} />
          )}
          <CaseBadges
            duplicateOf={c.duplicateOf}
            isProfessionalOccupation={c.isProfessionalOccupation}
            hasActiveRfi={c.hasActiveRfi}
            hasActiveRfe={c.hasActiveRfe}
            isSample={c.isSample}
          />
          <span className="ml-auto">
            <CalendarSyncIndicator enabled={c.calendarSyncEnabled ?? false} isGoogleConnected={profile?.googleCalendarConnected ?? false} />
          </span>
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
