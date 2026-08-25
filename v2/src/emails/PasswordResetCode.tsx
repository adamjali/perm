/**
 * PasswordResetCode Email Template
 * Sent when a user requests a password reset.
 *
 * Features:
 * - Large, prominent reset code display
 * - Neobrutalist code box with orange accent (distinguishes from verification)
 * - Expiry notice (10 minutes)
 * - Security disclaimer with stronger language
 * - App link
 * - Dark mode support via CSS classes
 */

import { Text, Section, Link } from "@react-email/components";
import { EmailLayout } from "./components";

export interface PasswordResetCodeProps {
  /** The OTP reset code */
  code: string;
  /** Base URL for the app */
  baseUrl?: string;
}

/**
 * Email template for password reset OTP codes.
 * Uses the shared EmailLayout for consistent PERM Tracker branding.
 */
export function PasswordResetCode({
  code,
  baseUrl = "https://permtracker.app",
}: PasswordResetCodeProps) {
  return (
    <EmailLayout
      previewText={`PERM Tracker: Your password reset code is ${code}`}
      footerText="You’re receiving this email because a password reset was requested for this email address."
      hideSettingsLink
    >
      {/* Header */}
      <Section style={styles.headerSection}>
        <Text className="em-text" style={styles.title}>
          Reset Your Password
        </Text>
        <Text className="em-text-body" style={styles.subtitle}>
          Enter this code to set a new password for your PERM Tracker account.
        </Text>
      </Section>

      {/* Code Box */}
      <Section style={styles.codeSection}>
        <Section className="em-card-bold" style={styles.codeBox}>
          <Text className="em-text-secondary" style={styles.codeLabel}>
            PASSWORD RESET CODE
          </Text>
          <Text className="em-text" style={styles.code}>
            {code}
          </Text>
        </Section>
      </Section>

      {/* Expiry Notice */}
      <Section style={styles.expirySection}>
        <Text className="em-text-secondary" style={styles.expiryText}>
          This code expires in <strong>10 minutes</strong>.
        </Text>
      </Section>

      {/* CTA Link */}
      <Section style={styles.ctaSection}>
        <Link
          href={`${baseUrl}/reset-password`}
          className="em-cta-button"
          style={styles.ctaButton}
        >
          Reset Password
        </Link>
      </Section>

      {/* Security Disclaimer */}
      <Section className="em-alert-yellow" style={styles.disclaimerBox}>
        <Text className="em-alert-yellow-text" style={styles.disclaimerText}>
          If you didn&apos;t request a password reset, please ignore this email.
          Your password will remain unchanged. If you&apos;re concerned about
          unauthorized access, contact{" "}
          <Link href="mailto:support@permtracker.app" className="em-alert-yellow-text" style={styles.supportLink}>
            support@permtracker.app
          </Link>
          .
        </Text>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  headerSection: {
    marginBottom: "24px",
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
  codeSection: {
    marginBottom: "20px",
  },
  codeBox: {
    backgroundColor: "#fff7ed",
    border: "3px solid #f97316",
    padding: "24px",
    textAlign: "center" as const,
  },
  codeLabel: {
    color: "#71717a",
    fontSize: "11px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    margin: "0 0 12px 0",
  },
  code: {
    color: "#18181b",
    fontSize: "36px",
    fontWeight: "800" as const,
    letterSpacing: "0.15em",
    fontFamily: "monospace, 'Courier New', Courier",
    margin: "0",
    lineHeight: "1",
  },
  expirySection: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  expiryText: {
    color: "#71717a",
    fontSize: "13px",
    margin: "0",
  },
  ctaSection: {
    textAlign: "center" as const,
    marginBottom: "24px",
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
  disclaimerBox: {
    backgroundColor: "#fef3c7",
    border: "2px solid #f59e0b",
    padding: "16px",
  },
  disclaimerText: {
    color: "#92400e",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0",
  },
  supportLink: {
    color: "#92400e",
    fontWeight: "600" as const,
    textDecoration: "underline",
  },
} as const;

/** Preview props for React Email dev server. */
PasswordResetCode.PreviewProps = {
  code: "729104",
  baseUrl: "https://permtracker.app",
} satisfies PasswordResetCodeProps;

export default PasswordResetCode;
