/**
 * CaseCard Sub-Components
 * Extracted presentational components used by CaseCard.
 */

import { Bookmark, Calendar, AlertTriangle, Pin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCompactDate, getStageColorVar } from "./case-card.utils";
import type { CaseCardData } from "../../../convex/lib/caseListTypes";

// ============================================================================
// FOLDER TAB
// ============================================================================

interface FolderTabProps {
  caseStatus: string;
  isClosed: boolean;
}

export function FolderTab({ caseStatus, isClosed }: FolderTabProps) {
  const label = caseStatus === "eta9089" ? "ETA 9089" : caseStatus.toUpperCase();
  return (
    <div
      className={cn(
        "absolute -top-5 left-6 w-32 h-6 flex items-center justify-center z-10 border border-b-0",
        isClosed
          ? "border-gray-400 dark:border-gray-500"
          : "border-black dark:border-white"
      )}
      style={{
        backgroundColor: isClosed ? "#D4D4D4" : getStageColorVar(caseStatus),
        clipPath: "polygon(0 100%, 6px 0, calc(100% - 6px) 0, 100% 100%)",
      }}
    >
      <span
        className={cn(
          "font-mono text-xs font-bold uppercase tracking-wider",
          isClosed ? "text-gray-500" : "text-white dark:text-white"
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// FAVORITE BOOKMARK
// ============================================================================

interface FavoriteBookmarkProps {
  isFavorite: boolean;
  isToggling: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

export function FavoriteBookmark({
  isFavorite,
  isToggling,
  onToggle,
}: FavoriteBookmarkProps) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
      disabled={isToggling}
      className={cn(
        "absolute -top-6 right-6 z-0 flex items-center justify-center cursor-pointer",
        "w-10 h-12 border border-b-0 transition-all duration-150",
        "hover:-translate-y-2 hover:scale-105 active:scale-95 active:-translate-y-1",
        "disabled:opacity-70 disabled:cursor-wait",
        isFavorite
          ? "border-yellow-600 bg-yellow-400 -translate-y-2"
          : "border-gray-400 bg-gray-300 hover:bg-gray-400 translate-y-0"
      )}
      style={{
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)",
      }}
      onClick={onToggle}
    >
      {isToggling ? (
        <Loader2 className="w-4 h-4 mt-0.5 animate-spin text-yellow-700" />
      ) : (
        <Bookmark
          className={cn(
            "w-4 h-4 mt-0.5",
            isFavorite ? "text-yellow-800 fill-yellow-800" : "text-gray-600"
          )}
        />
      )}
    </button>
  );
}

// ============================================================================
// PIN INDICATOR
// ============================================================================

interface PinIndicatorProps {
  isPinned: boolean;
  isToggling: boolean;
  isClicking: boolean;
}

export function PinIndicator({
  isPinned,
  isToggling,
  isClicking,
}: PinIndicatorProps) {
  if (!isPinned && !isToggling) return null;
  return (
    <div
      className={cn(
        "absolute -top-1 left-2 z-30",
        "flex items-center justify-center",
        "w-6 h-6 rounded-full",
        "bg-green-700 text-white",
        "shadow-hard-sm border border-black",
        "transform rotate-45",
        "transition-all duration-150",
        isClicking && "scale-90",
        isToggling && "opacity-70"
      )}
      aria-label={isToggling ? "Updating pin status" : "Card pinned open"}
    >
      {isToggling ? (
        <Loader2 className="w-3 h-3 -rotate-45 animate-spin" />
      ) : (
        <Pin className="w-3 h-3 -rotate-45" />
      )}
    </div>
  );
}

// ============================================================================
// CASE BADGES
// ============================================================================

interface CaseBadgesProps {
  duplicateOf?: string;
  isProfessionalOccupation?: boolean;
  hasActiveRfi?: boolean;
  hasActiveRfe?: boolean;
}

export function CaseBadges({
  duplicateOf,
  isProfessionalOccupation,
  hasActiveRfi,
  hasActiveRfe,
}: CaseBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
      {duplicateOf && (
        <Badge
          variant="outline"
          className="text-[0.625rem] px-2 py-0.5 text-white border-black bg-orange-500 font-bold"
          title="This case was marked as a duplicate of another case"
        >
          DUP
        </Badge>
      )}
      {isProfessionalOccupation && (
        <Badge
          variant="outline"
          className="text-[0.625rem] px-2 py-0.5 bg-gray-200 text-black border-2 border-black font-bold"
        >
          PRO
        </Badge>
      )}
      {hasActiveRfi && (
        <Badge
          variant="outline"
          className="text-[0.625rem] px-2 py-0.5 text-white border-black bg-[var(--urgency-urgent)]"
        >
          RFI
        </Badge>
      )}
      {hasActiveRfe && (
        <Badge
          variant="outline"
          className="text-[0.625rem] px-2 py-0.5 text-white border-black bg-[var(--urgency-urgent)]"
        >
          RFE
        </Badge>
      )}
    </div>
  );
}

// ============================================================================
// CALENDAR SYNC INDICATOR
// ============================================================================

interface CalendarSyncIndicatorProps {
  enabled: boolean;
  isGoogleConnected: boolean;
}

export function CalendarSyncIndicator({
  enabled,
  isGoogleConnected,
}: CalendarSyncIndicatorProps) {
  if (!enabled) return null;
  return (
    <div
      aria-label={isGoogleConnected ? "Syncing to Google Calendar" : "Calendar not connected"}
      className="group/calendar relative flex items-center gap-1 cursor-default"
    >
      {isGoogleConnected ? (
        <>
          <Calendar className="w-4 h-4 text-black" />
          <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-black">
            Synced
          </span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="font-mono text-[0.625rem] font-bold uppercase tracking-wider text-amber-600">
            Not connected
          </span>
        </>
      )}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[0.625rem] font-mono font-bold bg-black text-white whitespace-nowrap opacity-0 group-hover/calendar:opacity-100 transition-opacity pointer-events-none">
        {isGoogleConnected ? "Google Calendar" : "Connect in Settings"}
      </span>
    </div>
  );
}

// ============================================================================
// DATE DISPLAY COMPONENTS
// ============================================================================

interface DateRowProps {
  label: string;
  value: string;
}

function DateRow({ label, value }: DateRowProps) {
  return (
    <div className="flex justify-between font-mono">
      <span className="text-[#666666]">{label}:</span>
      <span>{formatCompactDate(value)}</span>
    </div>
  );
}

interface DateSectionProps {
  title: string;
  dates: Array<{ label: string; value: string | undefined }>;
}

function DateSection({ title, dates }: DateSectionProps) {
  const validDates = dates.filter((d) => d.value);
  if (validDates.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="font-mono font-bold text-[0.625rem] uppercase text-black border-b border-black/30 pb-0.5 mb-1">
        {title}
      </div>
      {validDates.map((d) => (
        <DateRow key={d.label} label={d.label} value={d.value!} />
      ))}
    </div>
  );
}

// ============================================================================
// EXPANDED CONTENT
// ============================================================================

interface ExpandedContentProps {
  shouldExpand: boolean;
  isClosed: boolean;
  dates: CaseCardData["dates"];
  notes: string | undefined;
}

export function ExpandedContent({
  shouldExpand,
  isClosed,
  dates,
  notes,
}: ExpandedContentProps) {
  return (
    <div
      data-testid="expanded-content"
      className={cn(
        "overflow-hidden relative z-10 -mx-6 px-6 transition-all duration-150 ease-out",
        shouldExpand && !isClosed
          ? "max-h-[500px] opacity-100 mt-3 pt-3 pb-6"
          : "max-h-0 opacity-0 mt-0 pt-0 pb-0"
      )}
      style={{
        backgroundColor: shouldExpand && !isClosed ? "rgba(255,255,255,0.6)" : "transparent",
      }}
    >
      <div className="mb-3 border-t border-dashed border-black/30" />
      <div className="space-y-2 text-xs text-black">
        <DateSection
          title="PWD"
          dates={[
            { label: "Filed", value: dates.pwdFiled },
            { label: "Determined", value: dates.pwdDetermined },
            { label: "Expires", value: dates.pwdExpires },
          ]}
        />
        <DateSection
          title="Recruitment"
          dates={[
            { label: "Started", value: dates.recruitmentStart },
            { label: "Ended", value: dates.recruitmentEnd },
          ]}
        />
        <DateSection
          title="ETA 9089"
          dates={[
            { label: "Window Opens", value: dates.etaWindowOpens },
            { label: "Filed", value: dates.etaFiled },
            { label: "Certified", value: dates.etaCertified },
            { label: "Expires", value: dates.etaExpires },
          ]}
        />
        <DateSection
          title="I-140"
          dates={[
            { label: "Filed", value: dates.i140Filed },
            { label: "Approved", value: dates.i140Approved },
          ]}
        />
      </div>
      {notes && (
        <div className="mt-3 pt-3 border-t border-black/30">
          <div className="font-mono font-bold text-[0.625rem] uppercase text-black border-b border-black/30 pb-0.5 mb-1">
            Notes
          </div>
          <div className="text-xs line-clamp-2 text-black">{notes}</div>
        </div>
      )}
    </div>
  );
}
