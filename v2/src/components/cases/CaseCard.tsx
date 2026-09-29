"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here (2026-09-01) rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx for the incident.

/**
 * CaseCard Component
 * Displays case information in manila folder metaphor with neobrutalist styling.
 *
 * Design:
 * - Manila folder tab with stage color extends ABOVE the card
 * - Paper texture overlay (subtle)
 * - Always visible: employer, position, badges, deadline with label, progress status
 * - Hover expansion: detailed dates, notes preview
 * - Checkbox positioned top-RIGHT when in selection mode
 * - Neobrutalist: 2px border, shadow-hard, zero border-radius
 * - Hover: lift + shadow-hard-lg + expand content
 */

import { memo, useMemo, useState } from "react";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useQuery } from "convex/react";
import { toast } from "@/lib/toast";
import { ArchiveIcon, ArrowCounterClockwiseIcon as RotateCcw, CaretDownIcon, CircleNotchIcon, DotsThreeIcon, EyeIcon, TrashIcon as Trash2 } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { getUrgencyFromDeadline } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { api } from "../../../convex/_generated/api";
import type { CaseCardData } from "../../../convex/lib/caseListTypes";
import { formatDeadlineDate, deadlineCountdown, formatClosureReasonLabel, formatCompactDate, countShownDates } from "./case-card.utils";
import { useCardUI } from "./useCardUI";
import { useCardMutations } from "./useCardMutations";
import {
  FolderTab,
  FavoriteBookmark,
  PinIndicator,
  CaseBadges,
  CalendarSyncIndicator,
  ExpandedContent,
} from "./CaseCardParts";

// ============================================================================
// TYPES
// ============================================================================

interface CaseCardProps {
  case: CaseCardData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  onDeleteRequest?: (caseId: string, caseName: string) => void;
  onArchiveRequest?: (caseId: string, caseName: string) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CaseCard = memo(function CaseCard({
  case: caseData,
  isSelected = false,
  onSelect,
  selectionMode = false,
  onDeleteRequest,
  onArchiveRequest,
}: CaseCardProps) {
  const {
    _id,
    employerName,
    beneficiaryIdentifier,
    positionTitle,
    caseStatus,
    progressStatus,
    nextDeadline,
    nextDeadlineLabel,
    isFavorite,
    isPinned,
    isProfessionalOccupation,
    hasActiveRfi,
    hasActiveRfe,
    calendarSyncEnabled,
    notes,
    dates,
    duplicateOf,
    isSample,
  } = caseData;

  const isClosed = caseStatus === "closed";
  const { isNavigating: isNavActive, targetPath, navigateTo } = useNavigationLoading();

  const ui = useCardUI();
  const mutations = useCardMutations({
    caseId: _id,
    setTogglingFavorite: ui.setTogglingFavorite,
    setTogglingPinned: ui.setTogglingPinned,
    setReopening: ui.setReopening,
  });

  const userProfile = useQuery(api.users.currentUserProfile);
  const isGoogleConnected = userProfile?.googleCalendarConnected ?? false;

  const viewPath = `/cases/${_id}`;
  const editPath = `/cases/${_id}/edit`;
  const isNavigating = isNavActive;
  const navigatingTo = targetPath === editPath ? "edit" as const : targetPath === viewPath ? "view" as const : null;

  const handleViewClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    navigateTo(viewPath);
  };

  const handleEditClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    navigateTo(editPath);
  };

  const handleCardClick = async (): Promise<void> => {
    if (selectionMode || ui.isTogglingPinned) return;
    ui.triggerClickAnimation();
    await mutations.handlePinnedToggle();
  };

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const caseName = `${employerName} - ${positionTitle || beneficiaryIdentifier}`;
    if (onDeleteRequest) {
      onDeleteRequest(_id, caseName);
    } else {
      toast.info("Delete functionality not available");
    }
  };

  const handleArchive = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const caseName = `${employerName} - ${positionTitle || beneficiaryIdentifier}`;
    if (onArchiveRequest) {
      onArchiveRequest(_id, caseName);
    } else {
      toast.info("Archive functionality not available");
    }
  };

  const urgency = useMemo(
    () => (!isClosed && nextDeadline ? getUrgencyFromDeadline(nextDeadline) : null),
    [isClosed, nextDeadline]
  );
  const countdown = useMemo(() => (nextDeadline ? deadlineCountdown(nextDeadline) : null), [nextDeadline]);
  const deadlineDate = useMemo(() => (nextDeadline ? formatDeadlineDate(nextDeadline) : ""), [nextDeadline]);
  const shouldExpand = ui.isHovered || isPinned;

  // Phones have no hover, so the dates used to sit open on every card and the
  // list became one long scroll. There a card starts short and a row opens it;
  // a pinned card opens by itself, as on desktop.
  const [datesOpen, setDatesOpen] = useState(false);
  const openOnPhone = datesOpen || !!isPinned;
  const dateCount = countShownDates(dates);
  const hasDetails = !isClosed && (dateCount > 0 || !!notes);
  const detailsWhat = dateCount > 0 ? (notes ? "dates and notes" : "dates") : "notes";
  const detailsId = `case-details-${_id}`;

  return (
    <div
      data-testid="case-card"
      className={cn(
        "relative cursor-pointer mt-8 transition-all duration-150 ease-out",
        "hover:-translate-y-1",
        ui.isClicking && "translate-y-0.5 scale-[0.99]",
        isPinned && !ui.isClicking && "-translate-y-1"
      )}
      onClick={handleCardClick}
      onMouseEnter={ui.handleMouseEnter}
      onMouseLeave={ui.handleMouseLeave}
    >
      <FolderTab caseStatus={caseStatus} isClosed={isClosed} />
      <FavoriteBookmark
        isFavorite={isFavorite}
        isToggling={ui.isTogglingFavorite}
        onToggle={mutations.handleFavoriteToggle}
      />

      {selectionMode && (
        <div
          data-testid="selection-checkbox"
          className="absolute top-2 left-4 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect?.(_id)}
            className="size-5 border-2 border-border bg-white data-[state=checked]:border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            aria-label="Select case"
          />
        </div>
      )}

      {!selectionMode && (
        <PinIndicator isPinned={isPinned} isToggling={ui.isTogglingPinned} isClicking={ui.isClicking} />
      )}

      <div
        className={cn(
          // text-black at the ROOT: manila stays tan in both themes, so every
          // inheriting child (the date values in ExpandedContent measured
          // 2.16:1 in dark) must default to ink, not to --foreground.
          "relative border-2 shadow-hard p-6 pt-10 min-h-[180px] transition-shadow duration-150 ease-out text-black",
          isSelected && "ring-4 ring-primary",
          isClosed && "grayscale border-black/40",
          !isClosed && "border-border",
          shouldExpand && !isClosed && "shadow-hard-lg"
        )}
        // Always manila: the `grayscale` class above already renders a closed
        // card as a gray folder. The old var(--muted) swap put black text
        // on #1A1A1A in dark mode.
        style={{ backgroundColor: "var(--manila)" }}
      >
        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='5'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* The stage lives on the folder tab above; no side stripe repeating it. */}

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-lg leading-tight truncate text-black dark:text-black" title={employerName}>
              {employerName}
            </h3>{" "}
            <p className="text-sm text-black/70 truncate" title={positionTitle || beneficiaryIdentifier}>{positionTitle || beneficiaryIdentifier}</p>
          </div>
        </div>

        {/* Meta Row: Deadline + Calendar */}
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {!isClosed && nextDeadline && nextDeadlineLabel && countdown ? (
              // The countdown leads: the number of days in the urgency colour,
              // the deadline and its date beside it.
              <div className="flex min-h-[3.5rem] min-w-0 items-stretch border-2 border-black bg-white/60">
                <div
                  className={cn(
                    "flex min-w-[3.75rem] shrink-0 flex-col items-center justify-center border-r-2 border-black px-2 py-1",
                    urgency === "urgent" ? "bg-data-bad text-black" : urgency === "soon" ? "bg-data-warn text-black" : "bg-black text-white"
                  )}
                >
                  <span className="font-heading text-2xl font-black leading-none tabular-nums">{countdown.value}</span>{" "}
                  <span className="text-sm font-bold">{countdown.unit}</span>
                </div>{" "}
                <div className="flex min-w-0 flex-col justify-center px-2.5 py-1">
                  <span className="truncate font-heading text-sm font-bold" title={nextDeadlineLabel}>{nextDeadlineLabel}</span>{" "}
                  <span className="font-mono text-sm text-black/75">{deadlineDate}</span>
                </div>
              </div>
            ) : isClosed ? (
              <span className="truncate text-sm italic text-black/70" title={`Closed ${caseData.closedAt ? formatCompactDate(caseData.closedAt) : ""}${formatClosureReasonLabel(caseData.closedReason) ? ` - ${formatClosureReasonLabel(caseData.closedReason)}` : ""}`}>
                Closed{" "}
                {caseData.closedAt ? formatCompactDate(caseData.closedAt) : ""}
                {formatClosureReasonLabel(caseData.closedReason) && (
                  <> - {formatClosureReasonLabel(caseData.closedReason)}</>
                )}
              </span>
            ) : (
              // Same footprint as the countdown, so cards in a row line up.
              <span className="flex min-h-[3.5rem] items-center border-2 border-dashed border-black/40 px-3 text-sm font-semibold text-black/70">
                No upcoming deadlines
              </span>
            )}
          </div>
          <CalendarSyncIndicator enabled={calendarSyncEnabled ?? false} isGoogleConnected={isGoogleConnected} />
        </div>

        {/* Tags: where the case stands, then anything that needs a note */}
        <div className="mb-3 relative z-10 flex flex-wrap items-center gap-1.5">
          {!isClosed && <ProgressStatusBadge status={progressStatus} surface="paper" />}
          <CaseBadges
            duplicateOf={duplicateOf}
            isProfessionalOccupation={isProfessionalOccupation}
            hasActiveRfi={hasActiveRfi}
            hasActiveRfe={hasActiveRfe}
            isSample={isSample}
          />
        </div>

        {hasDetails && (
          <button
            type="button"
            className={cn(
              "md:hidden relative z-10 -mx-6 flex min-h-11 w-[calc(100%+3rem)] items-center justify-between gap-2",
              "border-t border-dashed border-black/30 px-6 text-sm font-bold text-black",
              "active:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black",
            )}
            aria-expanded={openOnPhone}
            aria-controls={detailsId}
            onClick={(e) => {
              e.stopPropagation();
              setDatesOpen((open) => !open);
            }}
          >
            <span>
              {openOnPhone ? `Hide ${detailsWhat}` : dateCount > 0 ? `Show dates (${dateCount})${notes ? " and notes" : ""}` : "Show notes"}
            </span>
            <CaretDownIcon
              className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", openOnPhone && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        )}

        <ExpandedContent
          id={detailsId}
          shouldExpand={shouldExpand}
          openOnPhone={openOnPhone}
          isClosed={isClosed}
          dates={dates}
          notes={notes}
        />

        {/* Action Buttons Row */}
        <div
          className="flex items-center gap-2 mt-4 pt-4 border-t border-black/40 relative z-10 -mx-6 -mb-6 px-6 pb-4"
          style={{ backgroundColor: "var(--manila-dark)" }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={ui.handleButtonAreaEnter}
          onMouseLeave={ui.handleButtonAreaLeave}
        >
          {isClosed ? (
            <ClosedCaseButtons
              isNavigating={isNavigating}
              navigatingTo={navigatingTo}
              isReopening={ui.isReopening}
              onViewClick={handleViewClick}
              onReopenClick={mutations.handleReopen}
              onDeleteClick={handleDelete}
            />
          ) : (
            <ActiveCaseButtons
              isNavigating={isNavigating}
              navigatingTo={navigatingTo}
              onViewClick={handleViewClick}
              onEditClick={handleEditClick}
              onDeleteClick={handleDelete}
              onArchiveClick={handleArchive}
              onMenuOpenChange={ui.setMenuOpen}
            />
          )}
        </div>
      </div>
    </div>
  );
});

CaseCard.displayName = "CaseCard";

// ============================================================================
// ACTION BUTTON GROUPS
// ============================================================================

interface ClosedCaseButtonsProps {
  isNavigating: boolean;
  navigatingTo: "view" | "edit" | null;
  isReopening: boolean;
  onViewClick: (e: React.MouseEvent) => void;
  onReopenClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
}

function ClosedCaseButtons({
  isNavigating,
  navigatingTo,
  isReopening,
  onViewClick,
  onReopenClick,
  onDeleteClick,
}: ClosedCaseButtonsProps) {
  const isViewLoading = isNavigating && navigatingTo === "view";
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isViewLoading}
        className="flex-1 border-2 border-black/50 bg-transparent text-sm text-black/70 hover:bg-black/5 disabled:opacity-70"
        onClick={onViewClick}
        aria-label="View"
      >
        {isViewLoading ? <CircleNotchIcon className="size-3 mr-1.5 animate-spin" /> : <EyeIcon className="size-3 mr-1.5" />}
        {isViewLoading ? "Loading..." : "View"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isReopening}
        className="border-2 border-border bg-transparent text-sm text-primary hover:bg-black/5 disabled:opacity-70"
        onClick={onReopenClick}
        aria-label="Reopen"
      >
        {isReopening ? <CircleNotchIcon className="size-3 mr-1.5 animate-spin" /> : <RotateCcw className="size-3 mr-1.5" />}
        {isReopening ? "Reopening..." : "Reopen"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="border-2 border-black/50 bg-transparent text-sm text-black/70 hover:bg-black/5"
        onClick={onDeleteClick}
        aria-label="Delete"
      >
        <Trash2 className="size-3 mr-1.5" />
        Delete
      </Button>
    </>
  );
}

interface ActiveCaseButtonsProps {
  isNavigating: boolean;
  navigatingTo: "view" | "edit" | null;
  onViewClick: (e: React.MouseEvent) => void;
  onEditClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onArchiveClick: (e: React.MouseEvent) => void;
  onMenuOpenChange: (open: boolean) => void;
}

function ActiveCaseButtons({
  isNavigating,
  navigatingTo,
  onViewClick,
  onEditClick,
  onDeleteClick,
  onArchiveClick,
  onMenuOpenChange,
}: ActiveCaseButtonsProps) {
  const isViewLoading = isNavigating && navigatingTo === "view";
  const isEditLoading = isNavigating && navigatingTo === "edit";
  return (
    <>
      <Button
        variant="default"
        size="sm"
        disabled={isViewLoading}
        className="flex-1 text-sm font-bold border-black shadow-hard hover:shadow-hard-lg disabled:opacity-70 disabled:shadow-none"
        onClick={onViewClick}
        aria-label="View"
      >
        {isViewLoading ? (
          <>
            <CircleNotchIcon className="size-3 mr-1.5 animate-spin" />
            Loading...
          </>
        ) : (
          "View"
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isEditLoading}
        className="text-sm bg-transparent border-2 border-black text-black hover:bg-black/10 disabled:opacity-70"
        onClick={onEditClick}
        aria-label="Edit"
      >
        {isEditLoading ? (
          <>
            <CircleNotchIcon className="size-3 mr-1.5 animate-spin" />
            Loading...
          </>
        ) : (
          "Edit"
        )}
      </Button>
      <DropdownMenu onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-transparent border-2 border-black text-black hover:bg-black/10 cursor-pointer"
            aria-label="More options"
            onClick={(e) => e.stopPropagation()}
          >
            <DotsThreeIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDeleteClick} aria-label="Delete" className="cursor-pointer">
            <Trash2 className="size-4 mr-2" />
            Delete
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onArchiveClick} aria-label="Archive" className="cursor-pointer">
            <ArchiveIcon className="size-4 mr-2" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
