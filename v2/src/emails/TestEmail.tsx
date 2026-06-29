/**
 * TestEmail Template
 * Sent when a user clicks "Send test email" in notification settings.
 *
 * Features:
 * - Success confirmation with green badge
 * - Notification settings link
 * - Uses shared EmailLayout for consistent branding + dark mode
 */

import { Text, Section, Link } from "@react-email/components";
import { EmailLayout } from "./components";

export interface TestEmailProps {
  /** URL for notification settings */
  settingsUrl?: string;
}

/**
 * Email template confirming test email delivery works.
 * Uses the shared EmailLayout for consistent PERM Tracker branding.
 */
export function TestEmail({
  settingsUrl = "https://permtracker.app/settings/notifications",
}: TestEmailProps) {
  return (
    <EmailLayout
      previewText="PERM Tracker: Test email successful!"
      footerText="This is a test email from PERM Tracker. You received this because you requested a test email."
      hideSettingsLink
      settingsUrl={settingsUrl}
    >
      {/* Header */}
      <Section style={styles.headerSection}>
        <Text className="em-text" style={styles.title}>
          Test Email Successful!
        </Text>
        <Text className="em-text-body" style={styles.subtitle}>
          Your email notifications are working correctly. You will receive
          deadline reminders, status updates, and alerts at this email address.
        </Text>
      </Section>

      {/* Success Badge */}
      <Section style={styles.badgeSection}>
        <Section className="em-alert-green" style={styles.badgeBox}>
          <Text className="em-alert-green-text" style={styles.badgeText}>
            Email configuration verified
          </Text>
        </Section>
      </Section>

      {/* CTA Link */}
      <Section style={styles.ctaSection}>
        <Link
          href={settingsUrl}
          className="em-cta-button"
          style={styles.ctaButton}
        >
          Manage Notification Settings
        </Link>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  headerSection: {
    marginBottom: "24px",
    textAlign: "center" as const,
  },
  title: {
    color: "#18181b",
    fontSize: "22px",
    fontWeight: "700" as const,
    lineHeight: "28px",
    margin: "0 0 8px 0",
  },
  subtitle: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0",
  },
  badgeSection: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  badgeBox: {
    backgroundColor: "#dcfce7",
    border: "2px solid #22c55e",
    padding: "12px 20px",
    display: "inline-block" as const,
  },
  badgeText: {
    color: "#166534",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0",
  },
  ctaSection: {
    textAlign: "center" as const,
    marginBottom: "8px",
  },
  ctaButton: {
    display: "inline-block" as const,
    backgroundColor: "#18181b",
    color: "#fffffe",
    padding: "14px 32px",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    border: "3px solid #000001",
    boxShadow: "4px 4px 0 #22c55e",
  },
} as const;

/** Preview props for React Email dev server. */
TestEmail.PreviewProps = {
  settingsUrl: "https://permtracker.app/settings/notifications",
} satisfies TestEmailProps;

export default TestEmail;
