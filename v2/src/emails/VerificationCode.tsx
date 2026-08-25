/**
 * VerificationCode Email Template
 * Sent when a user signs up or verifies their email via OTP.
 *
 * Features:
 * - Large, prominent verification code display
 * - Neobrutalist code box with green accent
 * - Expiry notice (10 minutes)
 * - Security disclaimer
 * - App link
 * - Dark mode support via CSS classes
 */

import { Text, Section, Link } from "@react-email/components";
import { EmailLayout } from "./components";

export interface VerificationCodeProps {
  /** The OTP verification code */
  code: string;
  /** Base URL for the app */
  baseUrl?: string;
}

/**
 * Email template for email verification OTP codes.
 * Uses the shared EmailLayout for consistent PERM Tracker branding.
 */
export function VerificationCode({
  code,
  baseUrl = "https://permtracker.app",
}: VerificationCodeProps) {
  return (
    <EmailLayout
      previewText={`PERM Tracker: Your verification code is ${code}`}
      footerText="You’re receiving this email because someone requested a verification code for this email address."
      hideSettingsLink
    >
      {/* Header */}
      <Section style={styles.headerSection}>
        <Text className="em-text" style={styles.title}>
          Verify Your Email
        </Text>
        <Text className="em-text-body" style={styles.subtitle}>
          Enter this code to complete your sign-in to PERM Tracker.
        </Text>
      </Section>

      {/* Code Box */}
      <Section style={styles.codeSection}>
        <Section className="em-card-bold" style={styles.codeBox}>
          <Text className="em-text-secondary" style={styles.codeLabel}>
            VERIFICATION CODE
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
          href={baseUrl}
          className="em-cta-button"
          style={styles.ctaButton}
        >
          Open PERM Tracker
        </Link>
      </Section>

      {/* Security Disclaimer */}
      <Section className="em-info-box" style={styles.disclaimerBox}>
        <Text className="em-info-text" style={styles.disclaimerText}>
          If you didn&apos;t request this code, you can safely ignore this
          email. Someone may have entered your email address by mistake.
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
    backgroundColor: "#f0fdf4",
    border: "3px solid #22c55e",
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
    backgroundColor: "#f4f4f5",
    padding: "16px",
    border: "2px solid #e4e4e7",
  },
  disclaimerText: {
    color: "#52525b",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0",
  },
} as const;

/** Preview props for React Email dev server. */
VerificationCode.PreviewProps = {
  code: "481605",
  baseUrl: "https://permtracker.app",
} satisfies VerificationCodeProps;

export default VerificationCode;
