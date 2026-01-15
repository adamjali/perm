
"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import SettingsLayout, {
  SettingsSectionType,
} from "@/components/settings/SettingsLayout";
import { SettingsUnsavedChangesProvider } from "@/components/settings/SettingsUnsavedChangesContext";
import DeadlineEnforcementToggle from "@/components/settings/DeadlineEnforcementToggle";
import ProfileSection from "@/components/settings/ProfileSection";
import NotificationPreferencesSection from "@/components/settings/NotificationPreferencesSection";
import QuietHoursSection from "@/components/settings/QuietHoursSection";
import CalendarSyncSection from "@/components/settings/CalendarSyncSection";
import SupportSection from "@/components/settings/SupportSection";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Valid tab values for URL param validation */
const VALID_TABS: SettingsSectionType[] = [
  "profile",
  "notifications",
  "quiet-hours",
  "calendar-sync",
  "auto-close",
  "support",
];

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function SettingsPageSkeleton() {
  return (
    <div className="space-y-8">
      {/* Page Header Skeleton */}
      <div>
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-5 w-64" variant="line" />
      </div>

      {/* Layout Skeleton */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Mobile tabs skeleton */}
        <div className="md:hidden flex gap-2 overflow-hidden pb-4 border-b-2 border-black/20 dark:border-white/20">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-24 flex-shrink-0" />
          ))}
        </div>

        {/* Desktop sidebar skeleton */}
        <div className="hidden md:flex flex-col gap-2 w-56">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION COMPONENTS
// ============================================================================

// All section components are now imported from @/components/settings/

function AutoCloseSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold mb-2">
          Deadline Enforcement
        </h2>
        <p className="text-muted-foreground text-sm">
          Configure automatic case closure based on expired deadlines.
        </p>
      </div>
      <DeadlineEnforcementToggle />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SettingsPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSigningOut } = useAuthContext();

  // Read tab from URL, validate, default to "profile"
  const tabParam = searchParams.get("tab");
  const activeSection: SettingsSectionType =
    tabParam && VALID_TABS.includes(tabParam as SettingsSectionType)
      ? (tabParam as SettingsSectionType)
      : "profile";

  // Update URL when tab changes (clean URL for default "profile" tab)
  const handleSectionChange = useCallback(
    (section: SettingsSectionType) => {
      if (section === "profile") {
        router.replace("/settings", { scroll: false });
      } else {
        router.replace(`/settings?tab=${section}`, { scroll: false });
      }
    },
    [router]
  );

  // Load user profile for settings that need it
  const profile = useQuery(
    api.users.currentUserProfile,
    isSigningOut ? "skip" : undefined
  );

  // Load current user for email
  const user = useQuery(
    api.users.currentUser,
    isSigningOut ? "skip" : undefined
  );

  // Show skeleton while loading
  if (profile === undefined || user === undefined) {
    return <SettingsPageSkeleton />;
  }

  // Render section content based on active section
  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <ProfileSection
            profile={{
              // Fall back to user.name from auth if profile.fullName not set
              fullName: profile?.fullName ?? user?.name,
              // Fall back to user.image from auth (Google profile photo)
              profilePhotoUrl: profile?.profilePhotoUrl ?? user?.image,
              timezone: profile?.timezone,
            }}
            userEmail={user?.email ?? ""}
          />
        );
      case "notifications":
        return (
          <NotificationPreferencesSection
            profile={{
              emailNotificationsEnabled: profile?.emailNotificationsEnabled,
              emailDeadlineReminders: profile?.emailDeadlineReminders,
              emailDeadlineReminderPwd: profile?.emailDeadlineReminderPwd,
              emailDeadlineReminderRecruitment: profile?.emailDeadlineReminderRecruitment,
              emailDeadlineReminderEta9089: profile?.emailDeadlineReminderEta9089,
              emailDeadlineReminderI140: profile?.emailDeadlineReminderI140,
              emailDeadlineReminderRfi: profile?.emailDeadlineReminderRfi,
              emailDeadlineReminderRfe: profile?.emailDeadlineReminderRfe,
              emailStatusUpdates: profile?.emailStatusUpdates,
              pushNotificationsEnabled: profile?.pushNotificationsEnabled,
              reminderDaysBefore: profile?.reminderDaysBefore,
              urgentDeadlineDays: profile?.urgentDeadlineDays,
            }}
            userEmail={user?.email ?? ""}
          />
        );
      case "quiet-hours":
        return (
          <QuietHoursSection
            profile={{
              quietHoursEnabled: profile?.quietHoursEnabled,
              quietHoursStart: profile?.quietHoursStart,
              quietHoursEnd: profile?.quietHoursEnd,
              timezone: profile?.timezone,
            }}
            onNavigateToProfile={() => handleSectionChange("profile")}
          />
        );
      case "calendar-sync":
        return (
          <CalendarSyncSection
            profile={{
              calendarSyncEnabled: profile?.calendarSyncEnabled,
              calendarSyncPwd: profile?.calendarSyncPwd,
              calendarSyncEta9089: profile?.calendarSyncEta9089,
              calendarSyncI140: profile?.calendarSyncI140,
              calendarSyncRfe: profile?.calendarSyncRfe,
              calendarSyncRfi: profile?.calendarSyncRfi,
              calendarSyncRecruitment: profile?.calendarSyncRecruitment,
              calendarSyncFilingWindow: profile?.calendarSyncFilingWindow,
              googleCalendarConnected: profile?.googleCalendarConnected,
              googleEmail: profile?.googleEmail,
            }}
          />
        );
      case "auto-close":
        return <AutoCloseSection />;
      case "support":
        return (
          <SupportSection
            profile={{
              deletedAt: profile?.deletedAt,
            }}
          />
        );
      default:
        return (
          <ProfileSection
            profile={{
              // Fall back to user.name from auth if profile.fullName not set
              fullName: profile?.fullName ?? user?.name,
              // Fall back to user.image from auth (Google profile photo)
              profilePhotoUrl: profile?.profilePhotoUrl ?? user?.image,
              timezone: profile?.timezone,
            }}
            userEmail={user?.email ?? ""}
          />
        );
    }
  };

  return (
    <SettingsUnsavedChangesProvider>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="font-heading text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account preferences
          </p>
        </div>

        {/* Settings Layout with Navigation */}
        <SettingsLayout
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        >
          {renderSectionContent()}
        </SettingsLayout>
      </div>
    </SettingsUnsavedChangesProvider>
  );
}
