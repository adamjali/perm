"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

/**
 * CalendarSyncSection Component
 *
 * Google Calendar sync settings with master toggle and per-deadline-type toggles.
 * Includes Connect/Disconnect buttons for Google Calendar OAuth integration.
 *
 * Features:
 * - Google Calendar connection with OAuth flow
 * - Connect button (redirects to /api/google/connect)
 * - Disconnect button (POST to /api/google/disconnect, also clears events)
 * - "Sync All" button - sync all case deadlines to Google Calendar
 * - "Clear All Calendar Events" button - remove all PERM Tracker events from calendar
 * - Master calendar sync toggle that controls all sub-toggles
 * - Per-deadline-type toggles (7 types):
 *   - PWD Deadlines
 *   - ETA 9089 Filing Window
 *   - I-140 Deadlines
 *   - RFE Due Dates
 *   - RFI Due Dates
 *   - Recruitment Deadlines
 *   - Filing Window
 * - Disabled state when master toggle is OFF or not connected
 * - Toast notifications for success/error
 * - 2-column responsive grid for deadline type toggles
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./SettingsCard";
import { ArrowsClockwiseIcon as RefreshCw, TrashIcon as Trash2, XIcon } from "@phosphor-icons/react/ssr";
import { toast } from "@/lib/toast";
import { captureError } from "@/lib/sentry";

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarSyncSectionProps {
  profile: {
    calendarSyncEnabled?: boolean;
    calendarSyncPwd?: boolean;
    calendarSyncEta9089?: boolean;
    calendarSyncI140?: boolean;
    calendarSyncRfe?: boolean;
    calendarSyncRfi?: boolean;
    calendarSyncRecruitment?: boolean;
    calendarSyncFilingWindow?: boolean;
    googleCalendarConnected?: boolean;
    googleEmail?: string;
  };
}

// ============================================================================
// TOGGLE ROW COMPONENT
// ============================================================================

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** A setting and its switch. Off-limits rows stay readable, in muted ink. */
function ToggleRow({ id, label, description, checked, onCheckedChange, disabled = false }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 space-y-0.5">
        <Label htmlFor={id} className={cn("text-sm font-medium", disabled && "text-muted-foreground")}>
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/**
 * How far a long calendar job has got. Google gives no progress, so this is
 * an estimate from a measured pace per item, held under 95% until it ends.
 */
function SyncProgress({
  elapsedSeconds,
  msPerItem,
  total,
  minMs = 0,
  describe,
}: {
  elapsedSeconds: number;
  msPerItem: number;
  total: number;
  minMs?: number;
  describe: (doneEstimate: number) => string;
}) {
  const totalMs = Math.max(minMs, total * msPerItem);
  const elapsedMs = elapsedSeconds * 1000;
  const percent = totalMs > 0 ? Math.min(95, (elapsedMs / totalMs) * 100) : 0;
  const done = Math.min(total, Math.floor(elapsedMs / msPerItem));
  const remaining = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000));
  return (
    <div className="space-y-2">
      <div className="h-1.5 bg-muted" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-primary-text" style={{ width: `${percent}%` }} />
      </div>
      <p className="flex justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{describe(done)}</span>{" "}
        <span className="text-muted-foreground tabular-nums">
          {elapsedSeconds}s elapsed{remaining > 0 && `, about ${remaining}s left`}
        </span>
      </p>
    </div>
  );
}

// ============================================================================
// CONNECTION STATUS BADGE COMPONENT
// ============================================================================

interface ConnectionStatusBadgeProps {
  connected: boolean;
}

function ConnectionStatusBadge({ connected }: ConnectionStatusBadgeProps) {
  return connected ? <ToneBadge tone="good">Connected</ToneBadge> : <ToneBadge tone="flat">Not connected</ToneBadge>;
}

// ============================================================================
// DEADLINE TYPE CONFIG
// ============================================================================

/** Measured pace of a sync (one case) and a clear (one event, Google's 100ms
 * rate limit plus the call), and the shortest a clear is ever shown to take. */
const SYNC_MS_PER_CASE = 150;
const CLEAR_MS_PER_EVENT = 200;
const CLEAR_MIN_MS = 3000;

const DEADLINE_TYPES = [
  {
    id: "calendarSyncPwd",
    label: "PWD deadlines",
    description: "PWD filing and expiration dates",
  },
  {
    id: "calendarSyncEta9089",
    label: "ETA 9089 filing window",
    description: "ETA 9089 filing window and certification dates",
  },
  {
    id: "calendarSyncI140",
    label: "I-140 deadlines",
    description: "I-140 filing deadlines (the ETA 9089 expiration date)",
  },
  {
    id: "calendarSyncRfe",
    label: "RFE due dates",
    description: "Request for Evidence response deadlines",
  },
  {
    id: "calendarSyncRfi",
    label: "RFI due dates",
    description: "Request for Information response deadlines",
  },
  {
    id: "calendarSyncRecruitment",
    label: "Recruitment deadlines",
    description: "Job order, Sunday ads, and recruitment end dates",
  },
  {
    id: "calendarSyncFilingWindow",
    label: "Filing window",
    description: "30-180 day filing window open/close dates",
  },
] as const;

type DeadlineTypeField = (typeof DEADLINE_TYPES)[number]["id"];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CalendarSyncSection({
  profile,
}: CalendarSyncSectionProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Local state for toggles (optimistic updates)
  const [masterEnabled, setMasterEnabled] = useState(
    profile.calendarSyncEnabled ?? true
  );
  const [deadlineToggles, setDeadlineToggles] = useState<Record<DeadlineTypeField, boolean>>({
    calendarSyncPwd: profile.calendarSyncPwd ?? true,
    calendarSyncEta9089: profile.calendarSyncEta9089 ?? true,
    calendarSyncI140: profile.calendarSyncI140 ?? true,
    calendarSyncRfe: profile.calendarSyncRfe ?? true,
    calendarSyncRfi: profile.calendarSyncRfi ?? true,
    calendarSyncRecruitment: profile.calendarSyncRecruitment ?? true,
    calendarSyncFilingWindow: profile.calendarSyncFilingWindow ?? true,
  });

  // Loading states for toggles
  const [isUpdatingMaster, setIsUpdatingMaster] = useState(false);
  const [updatingDeadlineId, setUpdatingDeadlineId] = useState<DeadlineTypeField | null>(null);

  // Connection loading states
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Sync All loading state
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ synced: number; total: number } | null>(null);
  const [syncElapsedSeconds, setSyncElapsedSeconds] = useState(0);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear All Events loading state
  const [isClearingEvents, setIsClearingEvents] = useState(false);
  const [clearProgress, setClearProgress] = useState<{ eventsDeleted: number; casesCleaned: number } | null>(null);
  const [clearElapsedSeconds, setClearElapsedSeconds] = useState(0);
  const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Connection status (read-only from profile)
  const isConnected = profile.googleCalendarConnected ?? false;
  const connectedEmail = profile.googleEmail;

  // Query case counts for progress UX
  const syncEligibleCount = useQuery(api.cases.getSyncEligibleCaseCount) ?? 0;
  const casesWithEvents = useQuery(api.cases.getCasesWithEventsCount) ?? { caseCount: 0, estimatedEventCount: 0 };

  // Handle OAuth callback query params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    const errorDetails = searchParams.get("error_details");

    if (connected === "true") {
      analytics.capture("calendar_sync_enabled");
      toast.success("Google Calendar connected");
      // Clean up URL params
      router.replace("/settings?tab=calendar-sync", { scroll: false });
    } else if (error) {
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        oauth_init_failed: "Failed to start Google sign-in. Please try again.",
        credentials_not_configured:
          "Google Calendar isn’t configured. Please contact support to set up calendar integration.",
        missing_env_vars:
          "Server configuration error. Google Calendar credentials are missing.",
        no_code: "Authorization was cancelled. Please try again.",
        state_mismatch:
          "Security validation failed. Please clear cookies and try again.",
        token_exchange_failed:
          "Failed to connect to Google. Please try again or check your Google account permissions.",
        store_tokens_failed:
          "Failed to save connection. Please try again.",
        no_user: "Please sign in first to connect your calendar.",
      };

      // Use specific error details if provided, otherwise use mapped message
      let message = errorMessages[error] || "Failed to connect Google Calendar";
      if (errorDetails) {
        message = decodeURIComponent(errorDetails);
      }

      toast.error(message, {
        duration: 6000, // Show longer for important errors
        description: error !== "no_code" ? `Error code: ${error}` : undefined,
      });

      // Clean up URL params
      router.replace("/settings?tab=calendar-sync", { scroll: false });
    }
  }, [searchParams, router]);

  // Update local state when profile changes
  useEffect(() => {
    setMasterEnabled(profile.calendarSyncEnabled ?? true);
    setDeadlineToggles({
      calendarSyncPwd: profile.calendarSyncPwd ?? true,
      calendarSyncEta9089: profile.calendarSyncEta9089 ?? true,
      calendarSyncI140: profile.calendarSyncI140 ?? true,
      calendarSyncRfe: profile.calendarSyncRfe ?? true,
      calendarSyncRfi: profile.calendarSyncRfi ?? true,
      calendarSyncRecruitment: profile.calendarSyncRecruitment ?? true,
      calendarSyncFilingWindow: profile.calendarSyncFilingWindow ?? true,
    });
  }, [
    profile.calendarSyncEnabled,
    profile.calendarSyncPwd,
    profile.calendarSyncEta9089,
    profile.calendarSyncI140,
    profile.calendarSyncRfe,
    profile.calendarSyncRfi,
    profile.calendarSyncRecruitment,
    profile.calendarSyncFilingWindow,
  ]);

  // Mutation for saving profile
  const updateProfile = useMutation(api.users.updateUserProfile);

  // Action for syncing all cases
  const syncAllCases = useAction(api.googleCalendarActions.syncAllCases);

  // Action for clearing all calendar events
  const clearAllEvents = useAction(api.googleCalendarActions.clearAllEvents);

  // Handle sync all cases with progress timer
  const handleSyncAll = useCallback(async () => {
    setIsSyncingAll(true);
    setSyncProgress(null);
    setSyncElapsedSeconds(0);

    // Start elapsed time counter for progress UX
    syncTimerRef.current = setInterval(() => {
      setSyncElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const result = await syncAllCases({});

      if (!result.success) {
        throw new Error(result.error || "Sync failed");
      }

      setSyncProgress({ synced: result.synced, total: result.total });

      if (result.total === 0) {
        toast.info("No cases to sync");
      } else if (result.failed === 0) {
        toast.success(`Synced ${result.synced} case${result.synced !== 1 ? "s" : ""} to calendar`);
      } else {
        toast.warning(
          `Synced ${result.synced}/${result.total} cases. ${result.failed} failed.`
        );
      }
    } catch (error) {
      console.error("Failed to sync all cases:", error);
      captureError(error, { operation: "syncAllCases" });
      toast.error(error instanceof Error ? error.message : "Failed to sync cases");
    } finally {
      // Clear timer
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      setIsSyncingAll(false);
    }
  }, [syncAllCases]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
      if (clearTimerRef.current) {
        clearInterval(clearTimerRef.current);
      }
    };
  }, []);

  // Handle clear all calendar events with progress timer
  const handleClearAllEvents = useCallback(async () => {
    setIsClearingEvents(true);
    setClearProgress(null);
    setClearElapsedSeconds(0);

    // Start elapsed time counter for progress UX
    clearTimerRef.current = setInterval(() => {
      setClearElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const result = await clearAllEvents({});

      if (!result.success) {
        throw new Error(result.error || "Failed to clear events");
      }

      setClearProgress({
        eventsDeleted: result.eventsDeleted,
        casesCleaned: result.casesCleaned,
      });

      if (result.eventsDeleted === 0) {
        toast.info("No calendar events to clear");
      } else {
        toast.success(
          `Cleared ${result.eventsDeleted} event${result.eventsDeleted !== 1 ? "s" : ""} from ${result.casesCleaned} case${result.casesCleaned !== 1 ? "s" : ""}`
        );
      }
    } catch (error) {
      console.error("Failed to clear calendar events:", error);
      captureError(error, { operation: "clearAllCalendarEvents" });
      toast.error(error instanceof Error ? error.message : "Failed to clear events");
    } finally {
      // Clear timer
      if (clearTimerRef.current) {
        clearInterval(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      setIsClearingEvents(false);
    }
  }, [clearAllEvents]);

  // Handle connect button click - redirect to OAuth
  const handleConnect = useCallback(() => {
    setIsConnecting(true);
    // Redirect to OAuth endpoint
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- an API route that redirects to Google's sign-in, so it needs a real navigation
    window.location.href = "/api/google/connect";
  }, []);

  // Handle disconnect button click
  const handleDisconnect = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      const data = await response.json();

      // Show detailed message about events cleared
      analytics.capture("calendar_sync_disabled");
      if (data.eventsCleared && data.eventsCleared.eventsDeleted > 0) {
        toast.success(
          `Google Calendar disconnected. ${data.eventsCleared.eventsDeleted} event${data.eventsCleared.eventsDeleted !== 1 ? "s" : ""} removed from calendar.`
        );
      } else {
        toast.success("Google Calendar disconnected");
      }

      // Clear local progress state
      setSyncProgress(null);
      setClearProgress(null);
    } catch (error) {
      console.error("Failed to disconnect Google Calendar:", error);
      captureError(error, { operation: "disconnectGoogleCalendar" });
      toast.error(error instanceof Error ? error.message : "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  }, []);

  // Handle master toggle change
  const handleMasterToggle = async (value: boolean) => {
    setMasterEnabled(value);
    setIsUpdatingMaster(true);

    try {
      await updateProfile({ calendarSyncEnabled: value });
      toast.success(
        value ? "Calendar sync enabled" : "Calendar sync disabled"
      );
    } catch (error) {
      // Revert on error
      setMasterEnabled(!value);
      console.error("Failed to update calendar sync:", error);
      captureError(error, { operation: "toggleCalendarSync" });
      toast.error("Couldn’t save your settings. Try again.");
    } finally {
      setIsUpdatingMaster(false);
    }
  };

  // Handle deadline type toggle change
  const handleDeadlineToggle = async (field: DeadlineTypeField, value: boolean) => {
    // Optimistic update
    setDeadlineToggles((prev) => ({ ...prev, [field]: value }));
    setUpdatingDeadlineId(field);

    try {
      await updateProfile({ [field]: value });
      toast.success("Settings updated");
    } catch (error) {
      // Revert on error
      setDeadlineToggles((prev) => ({ ...prev, [field]: !value }));
      console.error("Failed to update deadline sync setting:", error);
      captureError(error, { operation: "toggleDeadlineSync" });
      toast.error("Couldn’t save your settings. Try again.");
    } finally {
      setUpdatingDeadlineId(null);
    }
  };

  // Determine if sub-toggles should be disabled
  const subTogglesDisabled = !masterEnabled || !isConnected;

  const plural = (n: number, word: string) => `${n} ${word}${n !== 1 ? "s" : ""}`;

  return (
    <SettingsCard
      title="Google Calendar sync"
      description="Automatically sync case deadlines to your Google Calendar"
      headerRight={<ConnectionStatusBadge connected={isConnected} />}
    >
      {/* The connection, and the one action it needs */}
      <div className="flex flex-col gap-3 bg-tint p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Google Calendar</p>{" "}
          <p className="truncate text-sm text-muted-foreground">
            {isConnected
              ? connectedEmail || "Your calendar is connected and ready to sync"
              : "Connect your Google Calendar to enable syncing"}
          </p>
        </div>
        {isConnected ? (
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            loading={isDisconnecting}
            loadingText="Disconnecting..."
            className="text-destructive-text"
          >
            <XIcon className="size-4" aria-hidden="true" />
            Disconnect
          </Button>
        ) : (
          <Button onClick={handleConnect} disabled={isConnecting} loading={isConnecting} loadingText="Connecting...">
            Connect calendar
          </Button>
        )}
      </div>

      {isConnected && masterEnabled && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Sync all cases</p>{" "}
              <p className="text-sm text-muted-foreground">
                {isSyncingAll
                  ? `Syncing ${plural(syncEligibleCount, "case")} to calendar...`
                  : syncProgress
                    ? `Last sync: ${syncProgress.synced}/${syncProgress.total} cases synced`
                    : syncEligibleCount > 0
                      ? `${plural(syncEligibleCount, "case")} ready to sync`
                      : "Sync all case deadlines to your Google Calendar"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={isSyncingAll || syncEligibleCount === 0}
              loading={isSyncingAll}
              loadingText="Syncing..."
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Sync all
            </Button>
          </div>
          {isSyncingAll && (
            <SyncProgress
              elapsedSeconds={syncElapsedSeconds}
              msPerItem={SYNC_MS_PER_CASE}
              total={syncEligibleCount}
              describe={(done) => `${done} of ${syncEligibleCount} cases`}
            />
          )}
        </div>
      )}

      {isConnected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Clear all calendar events</p>{" "}
              <p className="text-sm text-muted-foreground">
                {isClearingEvents
                  ? `Removing ${plural(casesWithEvents.estimatedEventCount, "event")} from ${plural(casesWithEvents.caseCount, "case")}...`
                  : clearProgress
                    ? `Last cleared: ${plural(clearProgress.eventsDeleted, "event")} from ${plural(clearProgress.casesCleaned, "case")}`
                    : casesWithEvents.estimatedEventCount > 0
                      ? `${plural(casesWithEvents.estimatedEventCount, "event")} in ${plural(casesWithEvents.caseCount, "case")} synced`
                      : "Remove all PERM Tracker events from your Google Calendar"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleClearAllEvents}
              disabled={isClearingEvents || isSyncingAll}
              loading={isClearingEvents}
              loadingText="Clearing..."
              className="text-destructive-text"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Clear all
            </Button>
          </div>
          {isClearingEvents && (
            <SyncProgress
              elapsedSeconds={clearElapsedSeconds}
              msPerItem={CLEAR_MS_PER_EVENT}
              minMs={CLEAR_MIN_MS}
              total={casesWithEvents.estimatedEventCount}
              describe={(done) =>
                casesWithEvents.estimatedEventCount > 0
                  ? `About ${done} of ${casesWithEvents.estimatedEventCount} events from ${plural(casesWithEvents.caseCount, "case")}`
                  : "Processing..."
              }
            />
          )}
        </div>
      )}

      <div className="space-y-5 border-t border-border pt-5">
        <ToggleRow
          id="calendar-sync-enabled"
          label="Calendar sync"
          description="Enable syncing deadlines to Google Calendar"
          checked={masterEnabled}
          onCheckedChange={handleMasterToggle}
          disabled={isUpdatingMaster}
        />

        {!masterEnabled && (
          <p className="text-sm text-data-warn-ink">Calendar sync is turned off for all deadline types</p>
        )}
        {masterEnabled && !isConnected && (
          <p className="text-sm text-muted-foreground">Connect your Google Calendar to start syncing deadlines</p>
        )}

        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Deadline types to sync</p>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 [&>*]:min-w-0 md:grid-cols-2">
            {DEADLINE_TYPES.map((type) => (
              <ToggleRow
                key={type.id}
                id={type.id}
                label={type.label}
                description={type.description}
                checked={deadlineToggles[type.id]}
                onCheckedChange={(checked) => handleDeadlineToggle(type.id, checked)}
                disabled={subTogglesDisabled || updatingDeadlineId === type.id}
              />
            ))}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
