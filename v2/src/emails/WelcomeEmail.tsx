/**
 * WelcomeEmail Template
 * Sent after signup (post-verification / OAuth completion).
 *
 * Features:
 * - Green welcome banner
 * - 3 feature highlights with green square markers
 * - Guide links, and a line for anyone waiting on a case of their own
 * - CTA button to create first case
 * - Senja review ask
 * - A team sign-off
 * - Dark mode support via CSS classes
 * - Neobrutalist design matching v2 aesthetic
 */

import { Text, Section, Link, Hr } from "@react-email/components";
import { EmailLayout } from "./components";
import { ctaSectionStyle } from "./components/emailStyles";
import { REVIEW_URL } from "../lib/constants/externalLinks";
import { SITE_URL } from "../../convex/lib/links";

export interface WelcomeEmailProps {
  /** User's display name */
  userName: string;
  /** Base URL for the app */
  baseUrl?: string;
}

/**
 * Welcome email template sent to new users after signup.
 */
export function WelcomeEmail({
  userName,
  baseUrl = SITE_URL,
}: WelcomeEmailProps) {
  return (
    <EmailLayout
      previewText="Your account is ready: every PERM deadline on your cases, worked out in one place."
      footerText="You're receiving this email because a PERM Tracker account was created with this address."
      hideSettingsLink
    >
      {/* Welcome Banner */}
      <Section className="em-alert-green" style={styles.welcomeBanner}>
        <Text className="em-alert-green-title" style={styles.welcomeTitle}>
          Welcome to PERM Tracker
        </Text>
      </Section>

      {/* Greeting */}
      <Section style={styles.greeting}>
        <Text className="em-text" style={styles.greetingText}>
          Hi {userName},
        </Text>
        <Text className="em-text-body" style={styles.bodyText}>
          Your account is ready. It keeps every PERM case in one place and works out each
          deadline from the dates you enter. Here&apos;s what it does from your first case:
        </Text>
      </Section>

      {/* Feature Highlights */}
      <Section style={styles.featuresSection}>
        <Section className="em-card" style={styles.featureCard}>
          <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
            <tbody>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <Text style={styles.featureMarker}>&#9632;</Text>
                </td>
                <td style={styles.featureContent}>
                  <Text className="em-text" style={styles.featureTitle}>
                    Every deadline, worked out
                  </Text>
                  <Text className="em-text-body" style={styles.featureDesc}>
                    Wage expiration, the recruitment clocks, the ETA 9089 filing window and the I-140 cutoff, with reminders before each one
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
        <Section className="em-card" style={styles.featureCard}>
          <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
            <tbody>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <Text style={styles.featureMarker}>&#9632;</Text>
                </td>
                <td style={styles.featureContent}>
                  <Text className="em-text" style={styles.featureTitle}>
                    Job descriptions you can reuse
                  </Text>
                  <Text className="em-text-body" style={styles.featureDesc}>
                    Pull a job description from an earlier case into a new one
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
        <Section className="em-card" style={styles.featureCard}>
          <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
            <tbody>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <Text style={styles.featureMarker}>&#9632;</Text>
                </td>
                <td style={styles.featureContent}>
                  <Text className="em-text" style={styles.featureTitle}>
                    An assistant for your caseload
                  </Text>
                  <Text className="em-text-body" style={styles.featureDesc}>
                    Ask it to review your cases and point out what needs attention
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      </Section>

      {/* Guide links */}
      <Section style={styles.linksSection}>
        <Text className="em-text-body" style={styles.bodyText}>
          <Link
            href={`${baseUrl}/guides/getting-started`}
            className="em-link-blue"
            style={styles.inlineLink}
          >
            Getting started with PERM Tracker
          </Link>{" "}
          walks through a first case, and{" "}
          <Link
            href={`${baseUrl}/guides/ultimate-perm-guide-2026`}
            className="em-link-blue"
            style={styles.inlineLink}
          >
            the PERM guide for 2026
          </Link>{" "}
          covers the whole process.
        </Text>
        {/* The other half of the site, for anyone who signed up while waiting on their own case. */}
        <Text className="em-text-body" style={styles.bodyText}>
          Waiting on a case of your own? You don&apos;t need the app for that:{" "}
          <Link
            href={`${baseUrl}/perm-case-status`}
            className="em-link-blue"
            style={styles.inlineLink}
          >
            look up its case number
          </Link>{" "}
          for DOL&apos;s status and an estimate, and get an email when it changes.
        </Text>
      </Section>

      {/* CTA Button */}
      <Section style={ctaSectionStyle}>
        <Link
          href={`${baseUrl}/cases`}
          className="em-cta-button"
          style={styles.ctaButton}
        >
          Create your first case
        </Link>
      </Section>

      {/* Divider */}
      <Hr className="em-divider" style={styles.divider} />

      {/* Review Ask */}
      <Section style={styles.reviewSection}>
        <Text className="em-text-body" style={styles.bodyText}>
          PERM Tracker changes with what people tell us. What&apos;s working,
          and what would you like next?{" "}
          <Link
            href={REVIEW_URL}
            className="em-link-blue"
            style={styles.inlineLink}
          >
            Leave us a review
          </Link>{" "}
          or reply to this email. We read every message.
        </Text>
      </Section>

      {/* Sign-off: the team, like the articles' bylines (owner's call, Oct 2 2026). */}
      <Section style={styles.signoff}>
        <Text className="em-text" style={styles.signoffName}>
          The PERM Tracker team
        </Text>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  welcomeBanner: {
    textAlign: "center" as const,
    padding: "24px 20px 20px",
    backgroundColor: "#f0fdf4",
    border: "1px solid #22c55e",
    marginBottom: "24px",
  },
  welcomeTitle: {
    color: "#166534",
    fontSize: "28px",
    fontWeight: "800" as const,
    letterSpacing: "-0.02em",
    margin: "0",
  },
  greeting: {
    marginBottom: "8px",
  },
  greetingText: {
    color: "#18181b",
    fontSize: "20px",
    fontWeight: "700" as const,
    margin: "0 0 12px 0",
  },
  bodyText: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  featuresSection: {
    marginBottom: "8px",
  },
  featureCard: {
    backgroundColor: "#fafafa",
    border: "1px solid #e4e4e7",
    padding: "16px",
    marginBottom: "10px",
  },
  featureMarkerCell: {
    width: "28px",
    verticalAlign: "top" as const,
    paddingTop: "2px",
  },
  featureMarker: {
    color: "#22c55e",
    fontSize: "14px",
    margin: "0",
    lineHeight: "22px",
  },
  featureContent: {
    verticalAlign: "top" as const,
  },
  featureTitle: {
    color: "#18181b",
    fontSize: "15px",
    fontWeight: "700" as const,
    margin: "0 0 4px 0",
    lineHeight: "22px",
  },
  featureDesc: {
    color: "#52525b",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0",
  },
  linksSection: {
    marginBottom: "0",
  },
  inlineLink: {
    color: "#2563eb",
    fontWeight: "600" as const,
    textDecoration: "underline",
  },
  ctaButton: {
    display: "inline-block" as const,
    backgroundColor: "#18181b",
    color: "#fffffe",
    padding: "14px 32px",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    border: "1px solid #e4e4e7",
  },
  divider: {
    borderTop: "1px solid #e4e4e7",
    margin: "24px 0",
  },
  reviewSection: {
    marginBottom: "24px",
  },
  signoff: {
    marginTop: "8px",
  },
  signoffName: {
    color: "#18181b",
    fontSize: "15px",
    fontWeight: "700" as const,
    margin: "0",
  },
} as const;

/** Preview props for React Email dev server. */
WelcomeEmail.PreviewProps = {
  userName: "Jordan",
  baseUrl: SITE_URL,
} satisfies WelcomeEmailProps;

