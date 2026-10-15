"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

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
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { analytics } from "@/lib/analytics";
import { useMutation } from "convex/react";
import { EASTERN_TIMEZONE } from "@/lib/time";
import { api } from "@convex/_generated/api";
import { FormField } from "@/components/forms/FormField";
import { Input } from "@/components/ui/input";
import { SelectInput, type SelectOption } from "@/components/forms/SelectInput";
import { SettingsCard } from "./SettingsCard";
import { Button } from "@/components/ui/button";
import { UserIcon } from "@phosphor-icons/react/ssr";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
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
    // Check if it’s a US timezone we support
    const isSupported = US_TIMEZONES.some((opt) => opt.value === tz);
    return isSupported ? tz : EASTERN_TIMEZONE; // Default to Eastern if unsupported
  } catch {
    return EASTERN_TIMEZONE;
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
      analytics.capture("profile_updated");
      toast.success("Profile updated");
      // Show success animation briefly
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t save your profile. Try again.",
        context: { operation: "updateProfile" },
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Determine if signed in with Google (check for Google profile photo URL pattern)
  const isGoogleSignIn = (() => {
    if (!profile.profilePhotoUrl) return false;
    try {
      const url = new URL(profile.profilePhotoUrl);
      return url.hostname.endsWith('.googleusercontent.com') || url.hostname === 'googleusercontent.com';
    } catch {
      return false;
    }
  })();

  const initials = getInitials(fullName || profile.fullName);

  return (
    <SettingsCard title="Profile information">
      {/* Photo, initials or a plain mark */}
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-tint text-foreground">
          {profile.profilePhotoUrl ? (
            <Image
              src={profile.profilePhotoUrl}
              alt={profile.fullName ?? "Profile"}
              width={64}
              height={64}
              className="size-full object-cover"
              unoptimized
            />
          ) : initials ? (
            <span className="font-heading text-xl font-bold">{initials}</span>
          ) : (
            <UserIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {profile.profilePhotoUrl
            ? "Profile photo from Google"
            : initials
              ? "Your initials are displayed"
              : "Add your name to show initials"}
        </p>
      </div>

      <div className="space-y-6">
        <FormField label="Full name" name="fullName">
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
          />
        </FormField>

        <FormField label="Email" name="email" hint="Email can’t be changed">
          <Input id="email" type="email" value={userEmail} disabled />
          {isGoogleSignIn && <p className="mt-2 text-sm text-muted-foreground">Signed in with Google</p>}
        </FormField>

        <FormField
          label="Timezone"
          name="timezone"
          hint="Used for deadline reminders and notifications"
        >
          <SelectInput
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            options={US_TIMEZONES}
          />
        </FormField>
      </div>

      {/* One save for the section, with its state beside it */}
      <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground" role="status">
          {justSaved ? (
            <span className="text-primary-text">Saved</span>
          ) : isDirty ? (
            <span className="text-data-warn-ink">You have unsaved changes</span>
          ) : (
            "All changes saved"
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
    </SettingsCard>
  );
}
