
"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import SettingsLayout, {
  NAV_ITEMS,
  type SettingsSectionType,
} from "@/components/settings/SettingsLayout";
import { SettingsUnsavedChangesProvider } from "@/components/settings/SettingsUnsavedChangesContext";
import DeadlineEnforcementToggle from "@/components/settings/DeadlineEnforcementToggle";
import ProfileSection from "@/components/settings/ProfileSection";
import NotificationPreferencesSection from "@/components/settings/NotificationPreferencesSection";
import QuietHoursSection from "@/components/settings/QuietHoursSection";
import CalendarSyncSection from "@/components/settings/CalendarSyncSection";
import SupportSection from "@/components/settings/SupportSection";
import ApiKeysSection from "@/components/settings/ApiKeysSection";
import WebhooksSection from "@/components/settings/WebhooksSection";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeading } from "../components/PageHeading";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Valid tab values for URL param validation: the menu's own list */
const VALID_TABS: SettingsSectionType[] = NAV_ITEMS.map((item) => item.id);

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function SettingsPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeading title="Settings" />
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        {/* The menu: one row on a phone, a column from md up, one block per tab */}
        <div className="flex gap-2 overflow-hidden md:w-52 md:flex-col md:gap-1">
          {VALID_TABS.map((tab) => (
            <Skeleton key={tab} className="h-11 w-24 shrink-0 md:w-full" />
          ))}
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton variant="line" className="h-7 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
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

  // Extracted to local variable (React Compiler disabled; kept for SWC safety)
  const userEmail = user?.email ?? "";
  const userName = user?.name;
  const userImage = user?.image;
  const profileFullName = profile?.fullName;
  const profilePhotoUrl = profile?.profilePhotoUrl;

  // Show skeleton while loading
  if (profile === undefined || user === undefined) {
    return <SettingsPageSkeleton />;
  }

  // Render section content based on active section
  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
      default:
        return (
          <ProfileSection
            profile={{
              // Fall back to user.name from auth if profile.fullName not set
              fullName: profileFullName ?? userName,
              // Fall back to user.image from auth (Google profile photo)
              profilePhotoUrl: profilePhotoUrl ?? userImage,
              timezone: profile?.timezone,
            }}
            userEmail={userEmail}
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
            userEmail={userEmail}
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
        return <DeadlineEnforcementToggle />;
      case "api-keys":
        return (
          <>
            <ApiKeysSection />
            <WebhooksSection />
          </>
        );
      case "support":
        return (
          <SupportSection
            profile={{
              deletedAt: profile?.deletedAt,
            }}
          />
        );
    }
  };

  return (
    <SettingsUnsavedChangesProvider>
      <div data-tour="settings-page" className="space-y-8">
        <PageHeading title="Settings" />

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
