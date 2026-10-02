/**
 * CaseCard Sub-Components
 * Extracted presentational components used by CaseCard.
 */

import { BookmarkIcon, CalendarCheckIcon, CalendarSlashIcon, CircleNotchIcon, PushPinIcon } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { countShownDates, formatCompactDate, getStageColorVar } from "./case-card.utils";
import type { CaseCardData } from "@convex/lib/caseListTypes";
import type { CaseStatus } from "@/lib/perm";

// ============================================================================
// FOLDER TAB
// ============================================================================

interface FolderTabProps {
  caseStatus: CaseStatus;
  isClosed: boolean;
}

export function FolderTab({ caseStatus, isClosed }: FolderTabProps) {
  const label = caseStatus === "eta9089" ? "ETA 9089" : caseStatus.toUpperCase();
  return (
    <div
      className={cn(
        "absolute -top-5 left-6 w-32 h-6 flex items-center justify-center z-10 border-2 border-b-0",
        isClosed ? "border-black/40" : "border-foreground"
      )}
      style={{
        backgroundColor: isClosed ? "var(--stage-closed)" : getStageColorVar(caseStatus),
        clipPath: "polygon(0 100%, 6px 0, calc(100% - 6px) 0, 100% 100%)",
      }}
    >
      <span
        className={cn(
          "font-mono text-sm font-bold uppercase tracking-wider",
          // Ink measured against each stage fill (black on the amber and teal).
          isClosed ? "text-black/60" : STAGE_VISUALS[caseStatus]?.onFill ?? "text-white"
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
        "absolute -top-6 right-6 z-0 flex items-start justify-center pt-0.5 cursor-pointer",
        // A second folder tab: manila with an ink frame, amber once starred.
        "w-10 h-12 border-2 border-b-0 border-black transition-all duration-150",
        "hover:-translate-y-2 active:-translate-y-1",
        "disabled:cursor-wait",
        isFavorite ? "bg-data-warn -translate-y-2" : "bg-manila-dark translate-y-0"
      )}
      style={{
        clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)",
      }}
      onClick={onToggle}
    >
      {isToggling ? (
        <CircleNotchIcon className="size-5 animate-spin text-black" />
      ) : (
        <BookmarkIcon className="size-5 text-black" weight={isFavorite ? "fill" : "bold"} />
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
 "bg-data-good text-black",
        "shadow-hard-sm border-2 border-black",
        "transform rotate-45",
        "transition-all duration-150",
        isClicking && "scale-90",
        isToggling && "opacity-70"
      )}
      aria-label={isToggling ? "Updating pin status" : "Card pinned open"}
    >
      {isToggling ? (
        <CircleNotchIcon className="w-3 h-3 -rotate-45 animate-spin" />
      ) : (
        <PushPinIcon className="w-3 h-3 -rotate-45" />
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
  isSample?: boolean;
}

export function CaseBadges({
  duplicateOf,
  isProfessionalOccupation,
  hasActiveRfi,
  hasActiveRfe,
  isSample,
}: CaseBadgesProps) {
  // Plain words, same chip shape as the progress status beside them. An open
  // RFI or RFE leads because it carries a response deadline.
  const chip = "text-sm border-2 border-black text-black";
  return (
    <>
      {hasActiveRfi && (
        <Badge variant="outline" className={cn(chip, "bg-urgency-urgent text-white")} title="A request for information is open">
          RFI open
        </Badge>
      )}
      {hasActiveRfe && (
        <Badge variant="outline" className={cn(chip, "bg-urgency-urgent text-white")} title="A request for evidence is open">
          RFE open
        </Badge>
      )}
      {duplicateOf && (
        <Badge variant="outline" className={cn(chip, "bg-data-warn")} title="Marked as a duplicate of another case">
          Duplicate
        </Badge>
      )}
      {isProfessionalOccupation && (
        <Badge variant="outline" className={cn(chip, "bg-white/70")} title="Professional occupation: the extra recruitment steps apply">
          Professional
        </Badge>
      )}
      {isSample && (
        <Badge variant="outline" className={cn(chip, "border-dashed border-black/50 bg-transparent text-black/70 shadow-none")} title="Sample case. Delete it anytime">
          Sample
        </Badge>
      )}
    </>
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
  // Account-level state, so it stays quiet on every card: one icon, the words
  // in its label and tooltip. It used to print "NOT CONNECTED" in amber caps
  // on every case.
  const label = isGoogleConnected ? "Syncing to Google Calendar" : "Calendar not connected";
  return (
    <div aria-label={label} title={isGoogleConnected ? "Synced to Google Calendar" : "Not synced: connect Google Calendar in Settings"} className="flex shrink-0 items-center gap-1 text-black/70">
      {isGoogleConnected ? (
        <>
          <CalendarCheckIcon className="size-5" weight="bold" aria-hidden="true" />
          <span className="text-sm font-bold text-black">Synced</span>
        </>
      ) : (
        <CalendarSlashIcon className="size-5" aria-hidden="true" />
      )}
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
      <span className="text-black/70">{label}:</span>{" "}
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
      <div className="font-mono font-bold text-sm uppercase text-black border-b border-black/30 pb-0.5 mb-1">
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
  id?: string;
  shouldExpand: boolean;
  /** Phones: opened by the card's "Show dates" row or by pinning. */
  openOnPhone?: boolean;
  isClosed: boolean;
  dates: CaseCardData["dates"];
  notes: string | undefined;
}

export function ExpandedContent({
  id,
  shouldExpand,
  openOnPhone = false,
  isClosed,
  dates,
  notes,
}: ExpandedContentProps) {
  // Desktop opens on hover or pin; phones on the card's "Show dates" row.
  const isExpanded = shouldExpand && !isClosed;
  // Nothing recorded yet: no band at all, rather than an empty strip.
  if (!notes && countShownDates(dates) === 0) return null;

  return (
    <div
      id={id}
      data-testid="expanded-content"
      className={cn(
        "overflow-hidden relative z-10 -mx-6 px-6 transition-all duration-150 ease-out motion-reduce:transition-none",
        // Phones: open only when the card's row (or a pin) opens it.
        // Desktop (md+): respect hover/pin state.
        isClosed
          ? "max-h-0 opacity-0 mt-0 pt-0 pb-0"
          : cn(
              openOnPhone ? "max-h-[500px] opacity-100 mt-0 pt-3 pb-6" : "max-h-0 opacity-0 mt-0 pt-0 pb-0",
              "md:max-h-0 md:opacity-0 md:mt-0 md:pt-0 md:pb-0",
            ),
        // Desktop expanded state override
        isExpanded && "md:max-h-[500px] md:opacity-100 md:mt-3 md:pt-3 md:pb-6"
      )}
      style={{
        backgroundColor: !isClosed ? "rgba(255,255,255,0.6)" : "transparent",
      }}
    >
      <div className="mb-3 hidden border-t border-dashed border-black/30 md:block" />
      <div className="space-y-2 text-sm text-black">
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
            { label: "Window opens", value: dates.etaWindowOpens },
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
          <div className="font-mono font-bold text-sm uppercase text-black border-b border-black/30 pb-0.5 mb-1">
            Notes
          </div>
          <div className="text-sm line-clamp-2 text-black" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} title={notes}>{notes}</div>
        </div>
      )}
    </div>
  );
}
