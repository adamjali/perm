/**
 * ProfileSection Component
 *
 * User profile settings section with editable name, read-only email,
 * and timezone selector.
 *
 * Features:
 * - Profile photo/initials display
 * - Editable full name field
 * - Read-only email with Google badge (if applicable)
 * - Timezone selector with common US timezones
 * - Dirty state tracking for save button
 * - Toast notifications for success/error
 * - Animated success feedback (checkmark pulse)
 *
 * Phase: 25 (Settings & Preferences)
 * Created: 2025-12-31
 * Updated: 2025-12-31 - Added Motion library animations
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/input";
import { SelectInput, type SelectOption } from "@/components/forms/SelectInput";
import { Button } from "@/components/ui/button";
import { User, Mail, Globe, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { useSettingsSectionDirtyState } from "./SettingsUnsavedChangesContext";

// ============================================================================
// TYPES
// ============================================================================

export interface ProfileSectionProps {
  profile: {
    fullName?: string;
    profilePhotoUrl?: string;
    timezone?: string;
  };
  userEmail: string;
}

// ============================================================================
// TIMEZONE OPTIONS
// ============================================================================

const US_TIMEZONES: SelectOption[] = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "America/Honolulu", label: "Hawaii (HST)" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get initials from a full name (e.g., "John Doe" -> "JD")
 * Returns null if no valid name is provided (caller should show icon fallback)
 */
function getInitials(name: string | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const firstPart = parts[0] ?? "";
  const lastPart = parts[parts.length - 1] ?? "";
  if (parts.length === 1) {
    return firstPart.charAt(0).toUpperCase();
  }
  return (firstPart.charAt(0) + lastPart.charAt(0)).toUpperCase();
}

/**
 * Get the browser's detected timezone
 */
function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Check if it's a US timezone we support
    const isSupported = US_TIMEZONES.some((opt) => opt.value === tz);
    return isSupported ? tz : "America/New_York"; // Default to Eastern if unsupported
  } catch {
    return "America/New_York";
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProfileSection({
  profile,
  userEmail,
}: ProfileSectionProps) {
  // Local state for form fields
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [timezone, setTimezone] = useState(
    profile.timezone ?? getBrowserTimezone()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Update local state when profile changes
  useEffect(() => {
    setFullName(profile.fullName ?? "");
    setTimezone(profile.timezone ?? getBrowserTimezone());
  }, [profile.fullName, profile.timezone]);

  // Mutation for saving profile
  const updateProfile = useMutation(api.users.updateUserProfile);

  // Track dirty state (only save changed fields)
  const isDirty = useMemo(() => {
    const nameChanged = fullName !== (profile.fullName ?? "");
    const timezoneChanged = timezone !== (profile.timezone ?? getBrowserTimezone());
    return nameChanged || timezoneChanged;
  }, [fullName, timezone, profile.fullName, profile.timezone]);

  // Register dirty state with settings context for navigation warnings
  useSettingsSectionDirtyState("profile", isDirty);

  // Handle save
  const handleSave = async () => {
    if (!isDirty) return;

    setIsSaving(true);
    try {
      // Build update object with only changed fields
      const updates: { fullName?: string; timezone?: string } = {};

      if (fullName !== (profile.fullName ?? "")) {
        updates.fullName = fullName;
      }
      if (timezone !== (profile.timezone ?? getBrowserTimezone())) {
        updates.timezone = timezone;
      }

      await updateProfile(updates);
      toast.success("Profile updated successfully");
      // Show success animation briefly
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if signed in with Google (check for Google profile photo URL pattern)
  const isGoogleSignIn = Boolean(
    profile.profilePhotoUrl?.includes("googleusercontent.com")
  );

  return (
    <div
      className="bg-card border-2 border-black dark:border-white/20 p-6"
      style={{ boxShadow: "4px 4px 0px #000" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <User className="w-5 h-5 text-foreground" />
        <h3 className="font-heading font-bold text-lg text-foreground">
          Profile Information
        </h3>
      </div>

      {/* Profile Photo / Initials / Default Icon */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-20 h-20 flex items-center justify-center border-2 border-black dark:border-white/30 bg-primary/10 text-primary overflow-hidden"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          {profile.profilePhotoUrl ? (
            <Image
              src={profile.profilePhotoUrl}
              alt={profile.fullName ?? "Profile"}
              width={80}
              height={80}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : getInitials(fullName || profile.fullName) ? (
            <span className="font-heading font-bold text-2xl">
              {getInitials(fullName || profile.fullName)}
            </span>
          ) : (
            <User className="w-10 h-10 text-primary/60" />
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {profile.profilePhotoUrl
              ? "Profile photo from Google"
              : getInitials(fullName || profile.fullName)
                ? "Your initials are displayed"
                : "Add your name to show initials"}
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Full Name */}
        <FormField label="Full Name" name="fullName">
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
          />
        </FormField>

        {/* Email (Read-only) */}
        <FormField label="Email" name="email" hint="Email cannot be changed">
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={userEmail}
              disabled
              className="pr-32"
            />
            {isGoogleSignIn && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                <Mail className="w-3 h-3" />
                <span>Signed in with Google</span>
              </div>
            )}
          </div>
        </FormField>

        {/* Timezone */}
        <FormField
          label="Timezone"
          name="timezone"
          hint="Used for deadline reminders and notifications"
        >
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <SelectInput
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={US_TIMEZONES}
              className="pl-10"
            />
          </div>
        </FormField>
      </div>

      {/* Save Button */}
      <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
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
            ) : isDirty ? (
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
            ) : (
              <motion.span
                key="clean"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                All changes saved
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
      </div>
    </div>
  );
}
