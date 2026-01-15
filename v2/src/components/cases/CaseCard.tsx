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

import { useTransition, memo, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { toast } from "@/lib/toast";
import { MoreHorizontal, Trash2, Archive, RotateCcw, Eye, Loader2 } from "lucide-react";
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
  } = caseData;

  const isClosed = caseStatus === "closed";
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [navigatingTo, setNavigatingTo] = useState<"view" | "edit" | null>(null);

  const ui = useCardUI();
  const mutations = useCardMutations({
    caseId: _id,
    setTogglingFavorite: ui.setTogglingFavorite,
    setTogglingPinned: ui.setTogglingPinned,
    setReopening: ui.setReopening,
  });

  const userProfile = useQuery(api.users.currentUserProfile);
  const isGoogleConnected = userProfile?.googleCalendarConnected ?? false;

  const handleViewClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    setNavigatingTo("view");
    startNavigation(() => router.push(`/cases/${_id}`));
  };

  const handleEditClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    setNavigatingTo("edit");
    startNavigation(() => router.push(`/cases/${_id}/edit`));
  };

  const handleCardClick = async (): Promise<void> => {
    if (selectionMode || ui.isTogglingPinned) return;
    ui.triggerClickAnimation();
    await mutations.handlePinnedToggle();
  };

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const caseName = `${employerName} - ${beneficiaryIdentifier}`;
    if (onDeleteRequest) {
      onDeleteRequest(_id, caseName);
    } else {
      toast.info("Delete functionality not available");
    }
  };

  const handleArchive = (e: React.MouseEvent): void => {
    e.stopPropagation();
    const caseName = `${employerName} - ${beneficiaryIdentifier}`;
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
            className="size-5 border-2 border-[#1a472a] dark:border-[#2d5a3d] bg-white dark:bg-gray-800 data-[state=checked]:bg-[#1a472a] data-[state=checked]:border-[#1a472a] dark:data-[state=checked]:bg-[#2d5a3d] dark:data-[state=checked]:border-[#2d5a3d] data-[state=checked]:text-white"
            aria-label="Select case"
          />
        </div>
      )}

      {!selectionMode && (
        <PinIndicator isPinned={isPinned} isToggling={ui.isTogglingPinned} isClicking={ui.isClicking} />
      )}

      <div
        className={cn(
          "relative border-2 shadow-hard p-6 pt-10 min-h-[180px] transition-shadow duration-150 ease-out",
          isSelected && "ring-4 ring-primary",
          isClosed && "grayscale border-gray-400 dark:border-gray-600",
          !isClosed && "border-border",
          shouldExpand && !isClosed && "shadow-hard-lg"
        )}
        style={{ backgroundColor: isClosed ? "#E8E8E8" : "var(--manila)" }}
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
            <h3 className="font-heading font-bold text-lg leading-tight truncate text-black dark:text-black">
              {employerName}
            </h3>
            <p className="text-sm text-[#666666] truncate">{beneficiaryIdentifier}</p>
          </div>
          <CaseBadges
            duplicateOf={duplicateOf}
            isProfessionalOccupation={isProfessionalOccupation}
            hasActiveRfi={hasActiveRfi}
            hasActiveRfe={hasActiveRfe}
          />
        </div>

        {/* Meta Row: Deadline + Calendar */}
        <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {!isClosed && nextDeadline && nextDeadlineLabel ? (
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1",
                  urgency === "urgent" && "bg-red-100 dark:bg-red-900/30 border-2 border-red-600",
                  urgency === "soon" && "bg-orange-50 dark:bg-orange-900/20"
                )}
              >
                <div className={cn("w-2.5 h-2.5 shrink-0", urgencyDotColor)} />
                <span className={cn("text-sm font-mono text-black", urgency === "urgent" && "font-bold")}>
                  {nextDeadlineLabel} {formattedDeadline}
                </span>
              </div>
            ) : isClosed ? (
              <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                Closed{" "}
                {caseData.closedAt ? formatCompactDate(caseData.closedAt) : ""}
                {formatClosureReasonLabel(caseData.closedReason) && (
                  <> - {formatClosureReasonLabel(caseData.closedReason)}</>
                )}
              </span>
            ) : (
              <span className="text-sm text-[#666666]">No upcoming deadlines</span>
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
          className="flex items-center gap-2 mt-4 pt-4 border-t border-black/40 dark:border-white/40 relative z-10 -mx-6 -mb-6 px-6 pb-4"
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
        className="flex-1 text-xs bg-transparent border-2 border-gray-500 text-gray-600 hover:bg-gray-100 disabled:opacity-70"
        onClick={onViewClick}
        aria-label="View"
      >
        {isViewLoading ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <Eye className="size-3 mr-1.5" />}
        {isViewLoading ? "Loading..." : "View"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isReopening}
        className="text-xs bg-transparent border-2 border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-70"
        onClick={onReopenClick}
        aria-label="Reopen"
      >
        {isReopening ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <RotateCcw className="size-3 mr-1.5" />}
        {isReopening ? "Reopening..." : "Reopen"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs bg-transparent border-2 border-gray-500 text-gray-600 hover:bg-gray-100"
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
        className="flex-1 text-xs font-bold border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] disabled:opacity-70 disabled:shadow-none"
        onClick={onViewClick}
        aria-label="View"
      >
        {isViewLoading ? (
          <>
            <Loader2 className="size-3 mr-1.5 animate-spin" />
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
        className="text-xs bg-transparent border-2 border-black text-black hover:bg-black/10 disabled:opacity-70"
        onClick={onEditClick}
        aria-label="Edit"
      >
        {isEditLoading ? (
          <>
            <Loader2 className="size-3 mr-1.5 animate-spin" />
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
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDeleteClick} aria-label="Delete" className="cursor-pointer">
            <Trash2 className="size-4 mr-2" />
            Delete
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onArchiveClick} aria-label="Archive" className="cursor-pointer">
            <Archive className="size-4 mr-2" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
