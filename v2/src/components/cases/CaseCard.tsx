/**
 * CaseCard Component
 * Displays case information in manila folder metaphor with neobrutalist styling.
 *
 * Design:
 * - Manila folder tab with stage color extends ABOVE the card
 * - Left color bar (6px) indicates stage
 * - Paper texture overlay (subtle)
 * - Always visible: employer, position, badges, deadline with label, progress status
 * - Hover expansion: detailed dates, notes preview
 * - Checkbox positioned top-RIGHT when in selection mode
 * - Neobrutalist: 2px border, shadow-hard, zero border-radius
 * - Hover: lift + shadow-hard-lg + expand content
 */

import { memo, useMemo } from "react";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useQuery } from "convex/react";
import { toast } from "@/lib/toast";
import { ArchiveIcon, ArrowCounterClockwiseIcon as RotateCcw, CircleNotchIcon, DotsThreeIcon, EyeIcon, TrashIcon as Trash2 } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { getUrgencyFromDeadline, getUrgencyDotClass } from "@/lib/status";
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
import { formatDeadline, formatClosureReasonLabel, getStageColorVar, formatCompactDate } from "./case-card.utils";
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
  const urgencyDotColor = useMemo(() => (urgency ? getUrgencyDotClass(urgency) : ""), [urgency]);
  const formattedDeadline = useMemo(
    () => (nextDeadline ? formatDeadline(nextDeadline) : ""),
    [nextDeadline]
  );
  const shouldExpand = ui.isHovered || isPinned;

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

        {/* Left color bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 z-20"
          style={{ backgroundColor: getStageColorVar(caseStatus) }}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3 relative z-10">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-lg leading-tight truncate text-black dark:text-black" title={employerName}>
              {employerName}
            </h3>{" "}
            <p className="text-sm text-black/70 truncate" title={positionTitle || beneficiaryIdentifier}>{positionTitle || beneficiaryIdentifier}</p>
          </div>
          <CaseBadges
            duplicateOf={duplicateOf}
            isProfessionalOccupation={isProfessionalOccupation}
            hasActiveRfi={hasActiveRfi}
            hasActiveRfe={hasActiveRfe}
            isSample={isSample}
          />
        </div>

        {/* Meta Row: Deadline + Calendar */}
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {!isClosed && nextDeadline && nextDeadlineLabel ? (
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1",
 urgency === "urgent" && "bg-data-bad/10 border-2 border-data-bad",
 urgency === "soon" && "bg-data-warn/8"
                )}
              >
                <div className={cn("w-2.5 h-2.5 shrink-0", urgencyDotColor)} />
                <span className={cn("text-sm font-mono text-black", urgency === "urgent" && "font-bold")}>
                  {nextDeadlineLabel} {formattedDeadline}
                </span>
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
              <span className="text-sm text-black/70">No upcoming deadlines</span>
            )}
          </div>
          <CalendarSyncIndicator enabled={calendarSyncEnabled ?? false} isGoogleConnected={isGoogleConnected} />
        </div>

        {/* Progress Status */}
        {!isClosed && (
          <div className="mb-3 relative z-10">
            <ProgressStatusBadge status={progressStatus} />
          </div>
        )}

        <ExpandedContent shouldExpand={shouldExpand} isClosed={isClosed} dates={dates} notes={notes} />

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
