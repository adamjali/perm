"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

/**
 * QuietHoursSection Component
 *
 * Quiet hours configuration section for suppressing non-urgent notifications
 * during specified time ranges.
 *
 * Features:
 * - Master toggle (quietHoursEnabled) - when OFF, hides time pickers
 * - Time range picker with native HTML5 time inputs
 * - Stores times in 24h format (HH:MM), displays as 12h with AM/PM
 * - Read-only timezone display (from profile) with link to profile section
 * - Info box explaining urgent notifications bypass quiet hours
 * - Dirty state tracking for save button
 * - Toast notifications for success/error
 * - Neobrutalist styling matching ProfileSection
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "./SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
import { useSettingsSectionDirtyState } from "./SettingsUnsavedChangesContext";

// ============================================================================
// TYPES
// ============================================================================

export interface QuietHoursSectionProps {
  profile: {
    quietHoursEnabled?: boolean;
    quietHoursStart?: string; // HH:MM format (24h)
    quietHoursEnd?: string; // HH:MM format (24h)
    timezone?: string; // IANA timezone
  };
  /** Callback to navigate to profile section for timezone changes */
  onNavigateToProfile?: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert 24h time (HH:MM) to 12h format with AM/PM for display.
 *
 * @param time24 - Time in HH:MM format (24h)
 * @returns Time in "h:mm AM/PM" format or empty string if invalid
 *
 * @example
 * formatTime12h("14:30"); // "2:30 PM"
 * formatTime12h("09:00"); // "9:00 AM"
 * formatTime12h("00:00"); // "12:00 AM"
 */
function formatTime12h(time24: string | undefined): string {
  if (!time24) return "";

  const match = time24.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const hours = parseInt(match[1]!, 10);
  const minutes = match[2]!;

  if (hours < 0 || hours > 23) return "";

  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${hours12}:${minutes} ${period}`;
}

/**
 * Get a friendly timezone display name.
 *
 * @param timezone - IANA timezone (e.g., "America/New_York")
 * @returns Friendly name (e.g., "Eastern (ET)")
 */
function getTimezoneFriendlyName(timezone: string | undefined): string {
  const timezoneMap: Record<string, string> = {
    "America/New_York": "Eastern (ET)",
    "America/Chicago": "Central (CT)",
    "America/Denver": "Mountain (MT)",
    "America/Los_Angeles": "Pacific (PT)",
    "America/Anchorage": "Alaska (AKT)",
    "America/Honolulu": "Hawaii (HST)",
  };

  if (!timezone) return "Eastern (ET)";
  return timezoneMap[timezone] || timezone;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_QUIET_START = "22:00"; // 10:00 PM
const DEFAULT_QUIET_END = "08:00"; // 8:00 AM

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function QuietHoursSection({
  profile,
  onNavigateToProfile,
}: QuietHoursSectionProps) {
  // Local state for form fields
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    profile.quietHoursEnabled ?? false
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    profile.quietHoursStart ?? DEFAULT_QUIET_START
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    profile.quietHoursEnd ?? DEFAULT_QUIET_END
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Update local state when profile changes
  useEffect(() => {
    setQuietHoursEnabled(profile.quietHoursEnabled ?? false);
    setQuietHoursStart(profile.quietHoursStart ?? DEFAULT_QUIET_START);
    setQuietHoursEnd(profile.quietHoursEnd ?? DEFAULT_QUIET_END);
  }, [
    profile.quietHoursEnabled,
    profile.quietHoursStart,
    profile.quietHoursEnd,
  ]);

  // Mutation for saving profile
  const updateProfile = useMutation(api.users.updateUserProfile);

  // Track dirty state (only save changed fields)
  // Note: The enable toggle saves immediately, so only track time changes as "dirty"
  const isDirty = useMemo(() => {
    const startChanged =
      quietHoursStart !== (profile.quietHoursStart ?? DEFAULT_QUIET_START);
    const endChanged =
      quietHoursEnd !== (profile.quietHoursEnd ?? DEFAULT_QUIET_END);
    // Only consider dirty if quiet hours is enabled AND times have changed
    return quietHoursEnabled && (startChanged || endChanged);
  }, [
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    profile.quietHoursStart,
    profile.quietHoursEnd,
  ]);

  // Register dirty state with settings context for navigation warnings
  useSettingsSectionDirtyState("quiet-hours", isDirty);

  // Handle save
  const handleSave = async () => {
    if (!isDirty) return;

    setIsSaving(true);
    try {
      // Build update object with only changed fields
      const updates: {
        quietHoursEnabled?: boolean;
        quietHoursStart?: string;
        quietHoursEnd?: string;
      } = {};

      if (quietHoursEnabled !== (profile.quietHoursEnabled ?? false)) {
        updates.quietHoursEnabled = quietHoursEnabled;
      }
      if (
        quietHoursStart !== (profile.quietHoursStart ?? DEFAULT_QUIET_START)
      ) {
        updates.quietHoursStart = quietHoursStart;
      }
      if (quietHoursEnd !== (profile.quietHoursEnd ?? DEFAULT_QUIET_END)) {
        updates.quietHoursEnd = quietHoursEnd;
      }

      await updateProfile(updates);
      toast.success("Quiet hours settings updated");
      // Show success animation briefly
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t save quiet hours. Try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle toggle with optimistic update
  const handleToggle = async (enabled: boolean) => {
    const previousValue = quietHoursEnabled;
    setQuietHoursEnabled(enabled);
    setIsToggling(true);

    try {
      await updateProfile({ quietHoursEnabled: enabled });
      toast.success(
        enabled ? "Quiet hours enabled" : "Quiet hours disabled"
      );
    } catch (error) {
      // Revert on error
      setQuietHoursEnabled(previousValue);
      handleOperationError(error, {
        userMessage: "Couldn’t save your settings. Try again.",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Get timezone display
  const timezoneDisplay = getTimezoneFriendlyName(profile.timezone);

  return (
    <SettingsCard title="Quiet hours" description="Pause non-urgent notifications during specific hours">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-0.5">
          <Label htmlFor="quiet-hours-enabled" className="text-sm font-medium">
            Enable quiet hours
          </Label>
          <p className="text-sm text-muted-foreground">
            Suppress notifications during the specified time range
          </p>
        </div>
        <Switch
          id="quiet-hours-enabled"
          checked={quietHoursEnabled}
          onCheckedChange={handleToggle}
          disabled={isToggling}
        />
      </div>

      {quietHoursEnabled ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quiet-hours-start" className="text-sm font-medium">Start time</Label>
              <Input
                id="quiet-hours-start"
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
                className="w-full"
                aria-describedby="quiet-hours-start-12h"
              />
              <p id="quiet-hours-start-12h" className="text-sm text-muted-foreground">{formatTime12h(quietHoursStart)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet-hours-end" className="text-sm font-medium">End time</Label>
              <Input
                id="quiet-hours-end"
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
                className="w-full"
                aria-describedby="quiet-hours-end-12h"
              />
              <p id="quiet-hours-end-12h" className="text-sm text-muted-foreground">{formatTime12h(quietHoursEnd)}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Timezone: <span className="font-medium text-foreground">{timezoneDisplay}</span>
            {onNavigateToProfile && (
              <>
                {". "}
                <button type="button" className="link font-medium" onClick={onNavigateToProfile}>
                  Change in profile
                </button>
              </>
            )}
          </p>{" "}

          <p className="text-sm text-muted-foreground">
            Urgent notifications (overdue deadlines, critical alerts) still arrive during quiet hours.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Quiet hours are disabled. You may receive notifications at any time.
        </p>
      )}

      {/* The times save here; the switch saves on its own */}
      {quietHoursEnabled && (isDirty || justSaved) && (
        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <p className="text-sm" role="status">
            {justSaved ? (
              <span className="text-primary-text">Saved</span>
            ) : (
              <span className="text-data-warn-ink">You have unsaved changes</span>
            )}
          </p>
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            loading={isSaving}
            loadingText="Saving..."
          >
            Save changes
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}
