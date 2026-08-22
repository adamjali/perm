/**
 * UpdateEmail Template
 * Product update + review request email for existing users.
 *
 * Structure: Short thanks → 2 feature highlights → Senja CTA
 * Designed for Resend Broadcasts with {{{RESEND_UNSUBSCRIBE_URL}}} placeholder.
 * Neobrutalist design matching v2 aesthetic.
 */

import { Text, Section, Link, Hr } from "@react-email/components";
import { EmailLayout } from "./components";
import { ctaSectionStyle } from "./components/emailStyles";

export interface UpdateEmailProps {
  /** Recipient's first name (from Resend contact, falls back to "there") */
  firstName?: string;
  /** Unsubscribe URL (injected by Resend Broadcasts) */
  unsubscribeUrl?: string;
}

export function UpdateEmail({
  firstName = "there",
  unsubscribeUrl = "{{{RESEND_UNSUBSCRIBE_URL}}}",
}: UpdateEmailProps) {
  return (
    <EmailLayout
      previewText="A quick update and a small ask from me."
      footerText="You're receiving this because you signed up for PERM Tracker."
      hideSettingsLink
    >
      {/* Greeting */}
      <Section style={styles.greeting}>
        <Text className="em-text" style={styles.greetingText}>
          Hey {firstName},
        </Text>
        <Text className="em-text-body" style={styles.bodyText}>
          Sabrina here, from the PERM Tracker team. I wanted to say thank you
          for being an early user. It genuinely means a lot. Every case
          you track helps us understand what attorneys actually need, and that
          shapes everything we build.
        </Text>
      </Section>

      {/* Divider */}
      <Hr className="em-divider" style={styles.divider} />

      {/* What's New */}
      <Section style={styles.updateSection}>
        <Text className="em-text" style={styles.sectionTitle}>
          What&apos;s new
        </Text>

        {/* Feature 1: Recruitment Results */}
        <Section style={styles.featureBlock}>
          <Text style={styles.featureMarker}>&#9632;</Text>
          <Text className="em-text" style={styles.featureTitle}>
            Recruitment Results in Case Overview
          </Text>
          <Text className="em-text-body" style={styles.featureDesc}>
            Your DOL-compliant recruitment summary now appears directly in the
            Overview tab once all recruitment steps are complete. Copy it, edit
            it, or revert to the auto-generated version in one click.
          </Text>
        </Section>

        {/* Feature 2: Click-to-Edit */}
        <Section style={styles.featureBlock}>
          <Text style={styles.featureMarker}>&#9632;</Text>
          <Text className="em-text" style={styles.featureTitle}>
            Click-to-Edit from Case Detail
          </Text>
          <Text className="em-text-body" style={styles.featureDesc}>
            Click any date or field in the case detail view and jump straight to
            the right section in the edit form. No more scrolling to find what
            you need.
          </Text>
        </Section>

        <Text className="em-text-body" style={styles.bodyTextSmall}>
          Plus: dark mode polish, mobile fixes, push notification improvements,
          and a full security audit under the hood.
        </Text>
      </Section>

      {/* Divider */}
      <Hr className="em-divider" style={styles.divider} />

      {/* Review Ask */}
      <Section style={styles.askSection}>
        <Text className="em-text" style={styles.sectionTitle}>
          A small ask
        </Text>
        <Text className="em-text-body" style={styles.bodyText}>
          If PERM Tracker has saved you time or made deadline tracking easier,
          we&apos;d love to hear about it. What&apos;s one thing that&apos;s been
          most useful for your practice?
        </Text>
      </Section>

      {/* CTA Button */}
      <Section style={ctaSectionStyle}>
        <Link
          href="https://senja.io/p/perm-tracker/r/FXAjpr"
          className="em-cta-button"
          style={styles.ctaButton}
        >
          Tell Us Your Thoughts
        </Link>
        <Text className="em-text-secondary" style={styles.ctaSubtext}>
          Takes about 2 minutes. Text or video, whatever&apos;s easier.
        </Text>
      </Section>

      {/* Sign-off */}
      <Section style={styles.signoff}>
        <Text className="em-text-body" style={styles.signoffNote}>
          Thanks again for being part of this. If you ever need anything, just
          reply to this email. We read every message.
        </Text>
        <Text className="em-text" style={styles.signoffName}>
          Sabrina S.
        </Text>
        <Text className="em-text-secondary" style={styles.signoffRole}>
          PERM Tracker Team
        </Text>
      </Section>

      {/* Divider */}
      <Hr className="em-divider" style={styles.divider} />

      {/* Compliance Footer */}
      <Section style={styles.complianceFooter}>
        <Text className="em-text-muted" style={styles.complianceText}>
          PERM Tracker &middot; Washington, DC 20001
          &middot; sabrina@permtracker.app
        </Text>
        <Text className="em-text-muted" style={styles.complianceText}>
          <Link href={unsubscribeUrl} style={styles.unsubLink}>
            Unsubscribe
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  greeting: {
    marginBottom: "8px",
  },
  greetingText: {
    color: "#18181b",
    fontSize: "18px",
    fontWeight: 600 as const,
    margin: "0 0 16px 0",
  },
  bodyText: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  bodyTextSmall: {
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "8px 0 0 0",
    fontStyle: "italic" as const,
  },
  divider: {
    borderColor: "#e4e4e7",
    borderWidth: "1px",
    margin: "24px 0",
  },
  updateSection: {
    marginBottom: "8px",
  },
  sectionTitle: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    margin: "0 0 16px 0",
  },
  featureBlock: {
    marginBottom: "20px",
    paddingLeft: "4px",
  },
  featureMarker: {
    color: "#2ECC40",
    fontSize: "10px",
    margin: "0 0 4px 0",
  },
  featureTitle: {
    color: "#18181b",
    fontSize: "15px",
    fontWeight: 600 as const,
    margin: "0 0 4px 0",
  },
  featureDesc: {
    color: "#52525b",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0",
  },
  askSection: {
    marginBottom: "8px",
  },
  ctaButton: {
    backgroundColor: "#2ECC40",
    color: "#ffffff",
    padding: "14px 32px",
    fontSize: "15px",
    fontWeight: 700 as const,
    textDecoration: "none",
    display: "inline-block",
    border: "3px solid #000000",
    boxShadow: "3px 3px 0 #000000",
  },
  ctaSubtext: {
    color: "#a1a1aa",
    fontSize: "12px",
    margin: "12px 0 0 0",
  },
  signoff: {
    marginTop: "8px",
  },
  signoffNote: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 20px 0",
  },
  signoffName: {
    color: "#18181b",
    fontSize: "16px",
    fontWeight: 700 as const,
    margin: "0 0 2px 0",
  },
  signoffRole: {
    color: "#71717a",
    fontSize: "13px",
    margin: "0",
  },
  complianceFooter: {
    textAlign: "center" as const,
    paddingTop: "8px",
  },
  complianceText: {
    color: "#a1a1aa",
    fontSize: "11px",
    lineHeight: "16px",
    margin: "0 0 6px 0",
  },
  unsubLink: {
    color: "#a1a1aa",
    textDecoration: "underline",
    fontSize: "11px",
  },
};

export default UpdateEmail;
