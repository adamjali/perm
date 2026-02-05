/**
 * AdminEmail Template
 * Branded email template for admin-sent messages.
 *
 * Uses the shared EmailLayout for consistent PERM Tracker branding.
 * Renders plain text body with preserved line breaks and
 * optional greeting/sign-off for a professional appearance.
 */

import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailHeader, EmailButton } from "./components";

export interface AdminEmailProps {
  /** Recipient's name */
  recipientName: string;
  /** Email subject (used for preview text) */
  subject: string;
  /** Plain text body from the admin */
  body: string;
  /** URL to open the app */
  appUrl?: string;
}

/**
 * Email template for admin-sent messages.
 * Wraps admin's plain text in the branded PERM Tracker layout.
 */
export function AdminEmail({
  recipientName,
  subject,
  body,
  appUrl = "https://permtracker.app",
}: AdminEmailProps) {
  const previewText = `Message from PERM Tracker: ${subject}`;

  // Split body into paragraphs on double newlines, preserve single newlines within
  const paragraphs = body.split(/\n\n+/);

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader
        title={subject}
        subtitle="Message from PERM Tracker Admin"
        urgency="normal"
        icon="✉️"
      />

      {/* Greeting */}
      <Section style={styles.greetingSection}>
        <Text style={styles.greeting}>
          Hi {recipientName},
        </Text>
      </Section>

      {/* Body */}
      <Section style={styles.bodySection}>
        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={styles.bodyText}>
            {paragraph.split("\n").map((line, j, arr) => (
              <React.Fragment key={j}>
                {line}
                {j < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </Text>
        ))}
      </Section>

      <Hr style={styles.divider} />

      {/* Sign-off */}
      <Section style={styles.signOffSection}>
        <Text style={styles.signOff}>
          Best regards,
        </Text>
        <Text style={styles.signOffName}>
          The PERM Tracker Team
        </Text>
      </Section>

      {/* CTA */}
      <Section style={styles.ctaSection}>
        <EmailButton href={appUrl}>
          Open PERM Tracker
        </EmailButton>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  greetingSection: {
    marginBottom: "8px",
  },
  greeting: {
    color: "#18181b",
    fontSize: "16px",
    fontWeight: 500 as const,
    lineHeight: "24px",
    margin: "0",
  },
  bodySection: {
    marginBottom: "24px",
  },
  bodyText: {
    color: "#3f3f46",
    fontSize: "15px",
    fontWeight: 400 as const,
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  divider: {
    borderColor: "#e4e4e7",
    borderWidth: "1px",
    margin: "24px 0",
  },
  signOffSection: {
    marginBottom: "24px",
  },
  signOff: {
    color: "#71717a",
    fontSize: "14px",
    fontWeight: 400 as const,
    lineHeight: "20px",
    margin: "0",
  },
  signOffName: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: 600 as const,
    lineHeight: "20px",
    margin: "4px 0 0 0",
  },
  ctaSection: {
    textAlign: "center" as const,
    marginBottom: "8px",
  },
} as const;

export default AdminEmail;
