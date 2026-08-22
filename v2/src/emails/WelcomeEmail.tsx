/**
 * WelcomeEmail Template
 * Sent after signup (post-verification / OAuth completion).
 *
 * Features:
 * - Green welcome banner with wave emoji
 * - 3 feature highlights with green square markers
 * - Tutorial + Guide links
 * - CTA button to create first case
 * - Senja review ask
 * - Personal sign-off (Sabrina S.)
 * - Dark mode support via CSS classes
 * - Neobrutalist design matching v2 aesthetic
 */

import { Text, Section, Link, Hr } from "@react-email/components";
import { EmailLayout } from "./components";
import { ctaSectionStyle } from "./components/emailStyles";

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
  baseUrl = "https://permtracker.app",
}: WelcomeEmailProps) {
  return (
    <EmailLayout previewText="PERM Tracker helps you manage and monitor your cases in one place.">
      {/* Welcome Banner */}
      <Section className="em-alert-green" style={styles.welcomeBanner}>
        <Text style={styles.waveEmoji}>&#128075;</Text>
        <Text className="em-alert-green-title" style={styles.welcomeTitle}>
          Welcome!
        </Text>
      </Section>

      {/* Greeting */}
      <Section style={styles.greeting}>
        <Text className="em-text" style={styles.greetingText}>
          Good Morning, {userName}!
        </Text>
        <Text className="em-text-body" style={styles.bodyText}>
          Welcome to PERM Tracker. We&apos;re glad you&apos;re here.
        </Text>
        <Text className="em-text-body" style={styles.bodyText}>
          PERM Tracker helps you manage and monitor your cases in one place.
          Here&apos;s what you can do right now:
        </Text>
      </Section>

      {/* Feature Highlights */}
      <Section style={styles.featuresSection}>
        {/* Feature 1 */}
        <Section className="em-card" style={styles.featureCard}>
          <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
            <tbody>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <Text style={styles.featureMarker}>&#9632;</Text>
                </td>
                <td style={styles.featureContent}>
                  <Text className="em-text" style={styles.featureTitle}>
                    Job Description Database
                  </Text>
                  <Text className="em-text-body" style={styles.featureDesc}>
                    Pull job descriptions from previous cases into new ones
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Feature 2 */}
        <Section className="em-card" style={styles.featureCard}>
          <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
            <tbody>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <Text style={styles.featureMarker}>&#9632;</Text>
                </td>
                <td style={styles.featureContent}>
                  <Text className="em-text" style={styles.featureTitle}>
                    Recruitment Results
                  </Text>
                  <Text className="em-text-body" style={styles.featureDesc}>
                    Get automated recruitment result summaries based on your inputs
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Feature 3 */}
        <Section className="em-card" style={styles.featureCard}>
          <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
            <tbody>
              <tr>
                <td style={styles.featureMarkerCell}>
                  <Text style={styles.featureMarker}>&#9632;</Text>
                </td>
                <td style={styles.featureContent}>
                  <Text className="em-text" style={styles.featureTitle}>
                    AI Assistant
                  </Text>
                  <Text className="em-text-body" style={styles.featureDesc}>
                    Ask AI to review your cases and help identify potential issues
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      </Section>

      {/* Tutorial / Guide Links */}
      <Section style={styles.linksSection}>
        <Text className="em-text-body" style={styles.bodyText}>
          Creating your first case takes less than one minute. Check out our{" "}
          <Link
            href={`${baseUrl}/tutorials/getting-started`}
            className="em-link-blue"
            style={styles.inlineLink}
          >
            Tutorial
          </Link>{" "}
          for a quick walkthrough, or browse our{" "}
          <Link
            href={`${baseUrl}/guides/ultimate-perm-guide-2026`}
            className="em-link-blue"
            style={styles.inlineLink}
          >
            Ultimate PERM Guide
          </Link>{" "}
          for tips and tricks.
        </Text>
      </Section>

      {/* CTA Button */}
      <Section style={ctaSectionStyle}>
        <Link
          href={`${baseUrl}/cases`}
          className="em-cta-button"
          style={styles.ctaButton}
        >
          Create Your First Case
        </Link>
      </Section>

      {/* Divider */}
      <Hr className="em-divider" style={styles.divider} />

      {/* Review Ask */}
      <Section style={styles.reviewSection}>
        <Text className="em-text-body" style={styles.bodyText}>
          We&apos;re constantly improving based on what immigration attorneys
          actually need. What features are working well? What would you like to
          see next?{" "}
          <Link
            href="https://senja.io/p/perm-tracker/r/FXAjpr"
            className="em-link-blue"
            style={styles.inlineLink}
          >
            Leave us a review
          </Link>{" "}
          or reply to this email. We read every message.
        </Text>
      </Section>

      {/* Sign-off */}
      <Section style={styles.signoff}>
        <Text className="em-text" style={styles.signoffName}>
          Sabrina S.
        </Text>
        <Text className="em-text-secondary" style={styles.signoffTeam}>
          PERM Tracker Team
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
    border: "3px solid #22c55e",
    marginBottom: "24px",
  },
  waveEmoji: {
    fontSize: "36px",
    margin: "0 0 8px 0",
    lineHeight: "1",
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
    border: "2px solid #e4e4e7",
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
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    border: "3px solid #000001",
    boxShadow: "4px 4px 0 #22c55e",
  },
  divider: {
    borderTop: "2px solid #e4e4e7",
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
    margin: "0 0 2px 0",
  },
  signoffTeam: {
    color: "#71717a",
    fontSize: "13px",
    fontWeight: "500" as const,
    margin: "0",
  },
} as const;

/** Preview props for React Email dev server. */
WelcomeEmail.PreviewProps = {
  userName: "Jordan",
  baseUrl: "https://permtracker.app",
} satisfies WelcomeEmailProps;

export default WelcomeEmail;
