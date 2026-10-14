/**
 * CaseCard Sub-Components
 * The quiet parts a case card and a case row share: the chips that need a
 * note, the calendar-sync mark and the dates list.
 */

import { CalendarCheckIcon, CalendarSlashIcon } from "@phosphor-icons/react/ssr";
import { Badge, ToneBadge } from "@/components/ui/badge";
import { countShownDates, formatCompactDate } from "./case-card.utils";
import type { CaseCardData } from "@convex/lib/caseListTypes";

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

/**
 * The chips that need saying: an open RFI or RFE first (it carries a response
 * deadline), then a duplicate, a professional occupation, the sample case.
 */
export function CaseBadges({ duplicateOf, isProfessionalOccupation, hasActiveRfi, hasActiveRfe, isSample }: CaseBadgesProps) {
  return (
    <>
      {hasActiveRfi && (
        <ToneBadge tone="bad" title="A request for information is open">
          RFI open
        </ToneBadge>
      )}
      {hasActiveRfe && (
        <ToneBadge tone="bad" title="A request for evidence is open">
          RFE open
        </ToneBadge>
      )}
      {duplicateOf && (
        <ToneBadge tone="warn" title="Marked as a duplicate of another case">
          Duplicate
        </ToneBadge>
      )}
      {isProfessionalOccupation && (
        <Badge className="font-normal" title="Professional occupation: the extra recruitment steps apply">
          Professional
        </Badge>
      )}
      {isSample && (
        <Badge className="border-dashed font-normal" title="Sample case. Delete it anytime">
          Sample
        </Badge>
      )}
    </>
  );
}

// ============================================================================
// CALENDAR SYNC INDICATOR
// ============================================================================

/**
 * Account-level state, so it stays quiet on every card: one icon, the words in
 * its label and tooltip.
 */
export function CalendarSyncIndicator({ enabled, isGoogleConnected }: { enabled: boolean; isGoogleConnected: boolean }) {
  if (!enabled) return null;
  const label = isGoogleConnected ? "Synced to Google Calendar" : "Not synced: connect Google Calendar in Settings";
  return (
    <span aria-label={label} title={label} className="inline-flex shrink-0 items-center text-muted-foreground">
      {isGoogleConnected ? (
        <CalendarCheckIcon className="size-5" aria-hidden="true" />
      ) : (
        <CalendarSlashIcon className="size-5" aria-hidden="true" />
      )}
    </span>
  );
}

// ============================================================================
// DATES
// ============================================================================

function DateSection({ title, dates }: { title: string; dates: Array<{ label: string; value: string | undefined }> }) {
  const shown = dates.filter((d): d is { label: string; value: string } => Boolean(d.value));
  if (shown.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>{" "}
      <dl className="mt-1 space-y-0.5 text-sm">
        {shown.map((d) => (
          <div key={d.label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{d.label}</dt>{" "}
            <dd className="tabular-nums">{formatCompactDate(d.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Every date the case carries, stage by stage, then its latest note. */
export function CaseDates({ dates, notes }: { dates: CaseCardData["dates"]; notes: string | undefined }) {
  if (!notes && countShownDates(dates) === 0) return null;
  return (
    <div data-testid="expanded-content" className="space-y-3">
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
      {notes ? (
        <div>
          <p className="text-sm font-semibold">Notes</p>{" "}
          <p className="mt-1 line-clamp-3 break-words text-sm text-soft" title={notes}>
            {notes}
          </p>
        </div>
      ) : null}
    </div>
  );
}
