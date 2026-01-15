/**
 * Settings Page
 * User settings and preferences with tabbed navigation.
 *
 * Sections:
 * - Profile: User profile information
 * - Notifications: Email/push notification preferences
 * - Quiet Hours: Do not disturb settings
 * - Calendar Sync: Google Calendar integration
 * - Auto-Close: Deadline enforcement settings
 * - Account: Account management
 * - Support: Help and support
 *
 * Phase: 25 (Settings & Preferences)
 * Updated: 2025-12-31
 */

import type { Metadata } from "next";
import { SettingsPageClient } from "./SettingsPageClient";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
