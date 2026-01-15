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
 * - Neobrutalist styling matching ProfileSection
 * - 2-column responsive grid for deadline type toggles
 *
 * Phase: 25.1 (Calendar Sync)
 * Created: 2025-12-31
 * Updated: 2026-01-01 - Added OAuth connect/disconnect functionality
 * Updated: 2026-01-12 - Added "Clear All Calendar Events" button and disconnect clears events
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, Cloud, AlertTriangle, Check, Loader2, X, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

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
  icon?: React.ReactNode;
  indented?: boolean;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  icon,
  indented = false,
}: ToggleRowProps) {
  return (
    <div
      className={`flex items-center justify-between ${indented ? "ml-6 pl-4 border-l-2 border-border" : ""}`}
    >
      <div className="space-y-0.5 flex-1">
        <Label
          htmlFor={id}
          className={`text-sm font-medium flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}
        >
          {icon}
          {label}
        </Label>
        <p
          className={`text-xs text-muted-foreground ${disabled ? "opacity-50" : ""}`}
        >
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
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
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Connected
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Not Connected
    </span>
  );
}

// ============================================================================
// DEADLINE TYPE CONFIG
// ============================================================================

const DEADLINE_TYPES = [
  {
    id: "calendarSyncPwd",
    label: "PWD Deadlines",
    description: "PWD filing and expiration dates",
  },
  {
    id: "calendarSyncEta9089",
    label: "ETA 9089 Filing Window",
    description: "ETA 9089 filing window and certification dates",
  },
  {
    id: "calendarSyncI140",
    label: "I-140 Deadlines",
    description: "I-140 filing deadlines (180 days from certification)",
  },
  {
    id: "calendarSyncRfe",
    label: "RFE Due Dates",
    description: "Request for Evidence response deadlines",
  },
  {
    id: "calendarSyncRfi",
    label: "RFI Due Dates",
    description: "Request for Information response deadlines",
  },
  {
    id: "calendarSyncRecruitment",
    label: "Recruitment Deadlines",
    description: "Job order, Sunday ads, and recruitment end dates",
  },
  {
    id: "calendarSyncFilingWindow",
    label: "Filing Window",
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
      toast.success("Google Calendar connected successfully");
      // Clean up URL params
      router.replace("/settings?tab=calendar-sync", { scroll: false });
    } else if (error) {
      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        oauth_init_failed: "Failed to start Google sign-in. Please try again.",
        credentials_not_configured:
          "Google Calendar is not configured. Please contact support to set up calendar integration.",
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
      toast.error("Failed to update settings");
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
      toast.error("Failed to update settings");
    } finally {
      setUpdatingDeadlineId(null);
    }
  };

  // Determine if sub-toggles should be disabled
  const subTogglesDisabled = !masterEnabled || !isConnected;

  return (
    <div className="space-y-6">
      {/* Calendar Sync Section */}
      <div
        className="bg-card border-2 border-black dark:border-white/20 p-6"
        style={{ boxShadow: "4px 4px 0px #000" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-foreground" />
            <h3 className="font-heading font-bold text-lg text-foreground">
              Google Calendar Sync
            </h3>
          </div>
          <ConnectionStatusBadge connected={isConnected} />
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Automatically sync case deadlines to your Google Calendar
        </p>

        {/* Google Calendar Connection Status with Connect/Disconnect buttons */}
        <div
          className="flex items-center justify-between p-4 bg-muted/50 border-2 border-border mb-5"
          style={{ boxShadow: "2px 2px 0px rgba(0,0,0,0.1)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 border-2 ${
                isConnected
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                  : "bg-background border-border"
              }`}
            >
              <Cloud
                className={`w-5 h-5 ${
                  isConnected
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Google Calendar
              </p>
              <p className="text-xs text-muted-foreground">
                {isConnected
                  ? connectedEmail || "Your calendar is connected and ready to sync"
                  : "Connect your Google Calendar to enable syncing"}
              </p>
            </div>
          </div>

          {/* Connect/Disconnect Button */}
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="border-2 border-red-500 dark:border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 hover:border-red-600 dark:hover:border-red-400 transition-colors"
              style={{ boxShadow: "2px 2px 0px rgba(239,68,68,0.4)" }}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Disconnect
                </>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={isConnecting}
              className="border-2 border-black dark:border-white bg-primary hover:bg-primary/90 text-black font-semibold"
              style={{ boxShadow: "2px 2px 0px #000" }}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Connect Calendar
                </>
              )}
            </Button>
          )}
        </div>

        {/* Sync All Button - Only show when connected */}
        {isConnected && masterEnabled && (
          <div
            className="p-4 bg-muted/30 border-2 border-border mb-5 space-y-3"
            style={{ boxShadow: "2px 2px 0px rgba(0,0,0,0.1)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Sync All Cases
                </p>
                <p className="text-xs text-muted-foreground">
                  {isSyncingAll
                    ? `Syncing ${syncEligibleCount} case${syncEligibleCount !== 1 ? "s" : ""} to calendar...`
                    : syncProgress
                      ? `Last sync: ${syncProgress.synced}/${syncProgress.total} cases synced`
                      : syncEligibleCount > 0
                        ? `${syncEligibleCount} case${syncEligibleCount !== 1 ? "s" : ""} ready to sync`
                        : "Sync all case deadlines to your Google Calendar"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={isSyncingAll || syncEligibleCount === 0}
                className="border-2 border-emerald-500 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-600 dark:hover:border-emerald-400 transition-colors"
                style={{ boxShadow: "2px 2px 0px rgba(16,185,129,0.4)" }}
              >
                {isSyncingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync All
                  </>
                )}
              </Button>
            </div>

            {/* Progress indicator during sync */}
            <AnimatePresence>
              {isSyncingAll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  {/* Estimated progress calculation: ~150ms per case */}
                  {(() => {
                    const msPerCase = 150;
                    const totalEstimatedMs = syncEligibleCount * msPerCase;
                    const elapsedMs = syncElapsedSeconds * 1000;
                    const estimatedProgress = Math.min(95, (elapsedMs / totalEstimatedMs) * 100);
                    const estimatedCasesProcessed = Math.min(
                      syncEligibleCount,
                      Math.floor((syncElapsedSeconds * 1000) / msPerCase)
                    );
                    const remainingSeconds = Math.max(0, Math.ceil((totalEstimatedMs - elapsedMs) / 1000));

                    return (
                      <>
                        {/* Progress bar - neobrutalist with hard edges */}
                        <div className="relative h-3 bg-muted border-2 border-black dark:border-white/30 overflow-hidden">
                          {/* Background pulse */}
                          <motion.div
                            className="absolute inset-0 bg-primary/20 dark:bg-primary/30"
                            animate={{ opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          />
                          {/* Progress fill */}
                          <motion.div
                            className="absolute left-0 top-0 h-full bg-primary dark:bg-primary"
                            style={{ width: `${estimatedProgress}%` }}
                            transition={{ duration: 0.3, ease: "linear" }}
                          />
                          {/* Striped pattern overlay for visual interest */}
                          <div
                            className="absolute inset-0 opacity-20"
                            style={{
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)",
                            }}
                          />
                        </div>
                        {/* Progress text */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-medium">
                            {estimatedCasesProcessed} of {syncEligibleCount} cases
                          </span>
                          <span className="text-muted-foreground">
                            {syncElapsedSeconds}s elapsed
                            {remainingSeconds > 0 && ` • ~${remainingSeconds}s remaining`}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Clear All Calendar Events - Only show when connected */}
        {isConnected && (
          <div
            className="p-4 bg-muted/30 border-2 border-border mb-5 space-y-3"
            style={{ boxShadow: "2px 2px 0px rgba(0,0,0,0.1)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Clear All Calendar Events
                </p>
                <p className="text-xs text-muted-foreground">
                  {isClearingEvents
                    ? `Removing ${casesWithEvents.estimatedEventCount} event${casesWithEvents.estimatedEventCount !== 1 ? "s" : ""} from ${casesWithEvents.caseCount} case${casesWithEvents.caseCount !== 1 ? "s" : ""}...`
                    : clearProgress
                      ? `Last cleared: ${clearProgress.eventsDeleted} event${clearProgress.eventsDeleted !== 1 ? "s" : ""} from ${clearProgress.casesCleaned} case${clearProgress.casesCleaned !== 1 ? "s" : ""}`
                      : casesWithEvents.estimatedEventCount > 0
                        ? `${casesWithEvents.estimatedEventCount} event${casesWithEvents.estimatedEventCount !== 1 ? "s" : ""} in ${casesWithEvents.caseCount} case${casesWithEvents.caseCount !== 1 ? "s" : ""} synced`
                        : "Remove all PERM Tracker events from your Google Calendar"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllEvents}
                disabled={isClearingEvents || isSyncingAll}
                className="border-2 border-amber-500 dark:border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 hover:border-amber-600 dark:hover:border-amber-400 transition-colors"
                style={{ boxShadow: "2px 2px 0px rgba(245,158,11,0.4)" }}
              >
                {isClearingEvents ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All
                  </>
                )}
              </Button>
            </div>

            {/* Progress indicator during clear */}
            <AnimatePresence>
              {isClearingEvents && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  {/* Estimated progress calculation: ~200ms per event (100ms rate limit + API) */}
                  {(() => {
                    const msPerEvent = 200;
                    const totalEvents = casesWithEvents.estimatedEventCount;
                    const totalCases = casesWithEvents.caseCount;
                    const totalEstimatedMs = Math.max(3000, totalEvents * msPerEvent);
                    const elapsedMs = clearElapsedSeconds * 1000;
                    const estimatedProgress = Math.min(95, (elapsedMs / totalEstimatedMs) * 100);
                    const estimatedEventsProcessed = Math.min(
                      totalEvents,
                      Math.floor((clearElapsedSeconds * 1000) / msPerEvent)
                    );
                    const remainingSeconds = Math.max(0, Math.ceil((totalEstimatedMs - elapsedMs) / 1000));

                    return (
                      <>
                        {/* Progress bar - neobrutalist with hard edges */}
                        <div className="relative h-3 bg-muted border-2 border-black dark:border-white/30 overflow-hidden">
                          {/* Background pulse */}
                          <motion.div
                            className="absolute inset-0 bg-amber-500/20 dark:bg-amber-500/30"
                            animate={{ opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          />
                          {/* Progress fill */}
                          <motion.div
                            className="absolute left-0 top-0 h-full bg-amber-500"
                            style={{ width: `${estimatedProgress}%` }}
                            transition={{ duration: 0.3, ease: "linear" }}
                          />
                          {/* Striped pattern overlay */}
                          <div
                            className="absolute inset-0 opacity-20"
                            style={{
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.1) 4px, rgba(0,0,0,0.1) 8px)",
                            }}
                          />
                        </div>
                        {/* Progress text */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-foreground font-medium">
                            {totalEvents > 0
                              ? `~${estimatedEventsProcessed} of ${totalEvents} events from ${totalCases} case${totalCases !== 1 ? "s" : ""}`
                              : "Processing..."}
                          </span>
                          <span className="text-muted-foreground">
                            {clearElapsedSeconds}s elapsed
                            {remainingSeconds > 0 && ` • ~${remainingSeconds}s remaining`}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Toggle List */}
        <div className="space-y-5">
          {/* Master Toggle */}
          <ToggleRow
            id="calendar-sync-enabled"
            label="Calendar Sync"
            description="Enable syncing deadlines to Google Calendar"
            checked={masterEnabled}
            onCheckedChange={handleMasterToggle}
            disabled={isUpdatingMaster}
            icon={<Calendar className="w-4 h-4 text-primary" />}
          />

          {/* Warning when disabled */}
          <AnimatePresence>
            {!masterEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Calendar sync is turned off for all deadline types</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Not connected warning */}
          <AnimatePresence>
            {masterEnabled && !isConnected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2 px-3 py-2 bg-muted border-2 border-border text-muted-foreground text-sm"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Connect your Google Calendar to start syncing deadlines
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deadline Type Toggles - 2 column grid */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-4">
              Deadline Types to Sync
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEADLINE_TYPES.map((type) => (
                <div
                  key={type.id}
                  className={`p-3 border border-border bg-background ${subTogglesDisabled ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 flex-1 pr-3">
                      <Label
                        htmlFor={type.id}
                        className={`text-sm font-medium ${subTogglesDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {type.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                    <Switch
                      id={type.id}
                      checked={deadlineToggles[type.id]}
                      onCheckedChange={(checked) =>
                        handleDeadlineToggle(type.id, checked)
                      }
                      disabled={subTogglesDisabled || updatingDeadlineId === type.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
