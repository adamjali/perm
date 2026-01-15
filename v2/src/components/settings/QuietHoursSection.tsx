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
 *
 * Phase: 25 (Settings & Preferences)
 * Created: 2025-12-31
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Moon, Clock, Globe, Check, Info, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";
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
      console.error("Failed to update quiet hours:", error);
      toast.error("Failed to update quiet hours. Please try again.");
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
      console.error("Failed to update quiet hours:", error);
      toast.error("Failed to update settings");
    } finally {
      setIsToggling(false);
    }
  };

  // Get timezone display
  const timezoneDisplay = getTimezoneFriendlyName(profile.timezone);

  return (
    <div
      className="bg-card border-2 border-black dark:border-white/20 p-6"
      style={{ boxShadow: "4px 4px 0px #000" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Moon className="w-5 h-5 text-foreground" />
        <h3 className="font-heading font-bold text-lg text-foreground">
          Quiet Hours
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Pause non-urgent notifications during specific hours
      </p>

      {/* Master Toggle */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label
              htmlFor="quiet-hours-enabled"
              className="text-sm font-medium flex items-center gap-2"
            >
              <Moon className="w-4 h-4 text-primary" />
              Enable Quiet Hours
            </Label>
            <p className="text-xs text-muted-foreground">
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

        {/* Time Range Section - Only show when enabled */}
        <AnimatePresence>
          {quietHoursEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Time Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Start Time */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="quiet-hours-start"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    Start Time
                  </Label>
                  <div className="relative">
                    <Input
                      id="quiet-hours-start"
                      type="time"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      className="w-full"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      {formatTime12h(quietHoursStart)}
                    </span>
                  </div>
                </div>

                {/* End Time */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="quiet-hours-end"
                    className="text-sm font-medium flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    End Time
                  </Label>
                  <div className="relative">
                    <Input
                      id="quiet-hours-end"
                      type="time"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      className="w-full"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      {formatTime12h(quietHoursEnd)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timezone Display (Read-only) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-2 border-border text-sm">
                <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">
                  Timezone: <strong className="text-foreground">{timezoneDisplay}</strong>
                </span>
                {onNavigateToProfile && (
                  <button
                    type="button"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium ml-auto"
                    onClick={onNavigateToProfile}
                  >
                    Change in Profile
                  </button>
                )}
              </div>

              {/* Info Box - Urgent notifications bypass */}
              <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 text-sm">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <span className="text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> Urgent notifications (overdue deadlines, critical alerts) will always be delivered, even during quiet hours.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warning when disabled */}
        <AnimatePresence>
          {!quietHoursEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 px-3 py-2 bg-muted border-2 border-border text-muted-foreground text-sm"
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                Quiet hours are disabled. You may receive notifications at any time.
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save Button - Only show when there are time changes (toggle saves immediately) */}
      <AnimatePresence>
        {quietHoursEnabled && isDirty && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-6 pt-6 border-t border-border flex items-center justify-between"
          >
            <div className="text-sm text-muted-foreground">
              <AnimatePresence mode="wait">
                {justSaved ? (
                  <motion.span
                    key="saved"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="text-primary flex items-center gap-1"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.span>
                    Saved!
                  </motion.span>
                ) : (
                  <motion.span
                    key="dirty"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="text-amber-600 dark:text-amber-400"
                  >
                    You have unsaved changes
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <Button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              loading={isSaving}
              loadingText="Saving..."
            >
              <Check className="w-4 h-4" />
              Save Changes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
