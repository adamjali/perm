/**
 * WelcomeEmail Template
 * Sent after signup (post-verification / OAuth completion).
 *
 * Features:
 * - A plain heading (no banner: owner, Oct 15 2026, lime or dark, never the
 *   pale highlighter green)
 * - The three things it does, on one black panel with lime markers
 * - Guide links, and a line for anyone waiting on a case of their own
 * - CTA button to create first case
 * - Senja review ask
 * - A team sign-off
 * - Dark mode support via CSS classes
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
      <Text className="em-text-secondary" style={styles.eyebrow}>Welcome to PERM Tracker</Text>
      <Text className="em-text" style={styles.heading}>{`Hi ${userName}, your account is ready.`}</Text>
      <Text className="em-text-body" style={styles.bodyText}>
        It keeps every PERM case in one place and works out each deadline from the dates you enter.
      </Text>

      {/* What it does, on a black panel: dark in every client, white and lime on it. */}
      <Section style={styles.panel}>
        <Text style={styles.panelLabel}>From your first case</Text>
        <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
          <tbody>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <div style={styles.featureMarker}>&nbsp;</div>
                </td>
                <td style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Every deadline, worked out</Text>
                  <Text style={styles.featureDesc}>Wage expiration, the recruitment clocks, the ETA 9089 filing window and the I-140 cutoff, with reminders before each one</Text>
                </td>
              </tr>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <div style={styles.featureMarker}>&nbsp;</div>
                </td>
                <td style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Job descriptions you can reuse</Text>
                  <Text style={styles.featureDesc}>Pull a job description from an earlier case into a new one</Text>
                </td>
              </tr>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <div style={styles.featureMarker}>&nbsp;</div>
                </td>
                <td style={styles.featureContent}>
                  <Text style={styles.featureTitle}>An assistant for your caseload</Text>
                  <Text style={styles.featureDesc}>Ask it to review your cases and point out what needs attention</Text>
                </td>
              </tr>
          </tbody>
        </table>
      </Section>

      {/* The main action right after what it does. */}
      <Section style={ctaSectionStyle}>
        <Link
          href={`${baseUrl}/cases/new`}
          className="em-button-primary"
          style={styles.ctaButton}
        >
          Create your first case
        </Link>
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
  eyebrow: {
    color: "#5A5A5A",
    fontSize: "14px",
    fontWeight: "700" as const,
    lineHeight: "18px",
    margin: "0 0 6px 0",
  },
  heading: {
    color: "#141414",
    fontSize: "26px",
    fontWeight: "700" as const,
    lineHeight: "32px",
    letterSpacing: "-0.01em",
    margin: "0 0 12px 0",
  },
  bodyText: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  // Black in every client: white on it is 21:1, the lime 10.7:1.
  panel: {
    backgroundColor: "#000001",
    border: "2px solid #000001",
    padding: "20px 20px 8px 20px",
    margin: "8px 0 24px 0",
  },
  panelLabel: {
    color: "#2ECC40",
    fontSize: "14px",
    fontWeight: "700" as const,
    lineHeight: "18px",
    margin: "0 0 14px 0",
  },
  featureMarkerCell: {
    width: "26px",
    verticalAlign: "top" as const,
    paddingTop: "5px",
  },
  // A lime square drawn as a box, not a glyph, so no font can swap it.
  featureMarker: {
    width: "12px",
    height: "12px",
    lineHeight: "12px",
    fontSize: "1px",
    backgroundColor: "#2ECC40",
  },
  featureContent: {
    verticalAlign: "top" as const,
    paddingBottom: "14px",
  },
  featureTitle: {
    color: "#fffffe",
    fontSize: "15px",
    fontWeight: "700" as const,
    margin: "0 0 2px 0",
    lineHeight: "22px",
  },
  featureDesc: {
    color: "#D4D4D8",
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
    backgroundColor: "#2ECC40",
    color: "#000001",
    padding: "14px 32px",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    border: "2px solid #000001",
  },
  divider: {
    borderTop: "2px solid #000001",
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

