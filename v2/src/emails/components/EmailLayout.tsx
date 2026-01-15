/**
 * EmailLayout Component
 * Shared layout wrapper for all PERM Tracker email templates.
 *
 * Features:
 * - PERM Tracker branding (neobrutalist-inspired)
 * - Max-width 600px container
 * - Footer with settings link
 * - Responsive design
 * - All inline styles (email client compatibility)
 *
 * Phase: 24 (Notifications + Email)
 */

import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
} from "@react-email/components";
import * as React from "react";

export interface EmailLayoutProps {
  /** Preview text shown in email clients */
  previewText: string;
  /** Email content */
  children: React.ReactNode;
  /** Optional settings URL override */
  settingsUrl?: string;
}

/**
 * Shared email layout with PERM Tracker branding.
 * Wraps all email templates with consistent header, footer, and styling.
 */
export function EmailLayout({
  previewText,
  children,
  settingsUrl = "https://permtracker.app/settings",
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.logo}>
              <span style={styles.logoPerm}>PERM</span>
              <span style={styles.logoTracker}> Tracker</span>
            </Text>
          </Section>

          {/* Main content */}
          <Section style={styles.content}>{children}</Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You&apos;re receiving this email because you have notifications
              enabled for your PERM Tracker account.
            </Text>
            <Text style={styles.footerLinks}>
              <Link href={settingsUrl} style={styles.footerLink}>
                Manage notification settings
              </Link>
              {" | "}
              <Link href="https://permtracker.app" style={styles.footerLink}>
                Open PERM Tracker
              </Link>
            </Text>
            <Text style={styles.copyright}>
              &copy; {new Date().getFullYear()} PERM Tracker. All rights
              reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Inline styles for email client compatibility.
 * Email clients don't support external CSS or most modern CSS features.
 */
const styles = {
  body: {
    backgroundColor: "#f4f4f5",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    margin: "0",
    padding: "0",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
  },
  header: {
    backgroundColor: "#000000",
    padding: "24px 32px",
    borderBottom: "4px solid #000000",
  },
  logo: {
    margin: "0",
    fontSize: "24px",
    fontWeight: "700" as const,
    letterSpacing: "-0.02em",
  },
  logoPerm: {
    color: "#22c55e",
  },
  logoTracker: {
    color: "#ffffff",
  },
  content: {
    backgroundColor: "#ffffff",
    padding: "32px",
    border: "4px solid #000000",
    borderTop: "none",
  },
  footer: {
    padding: "24px 32px",
    textAlign: "center" as const,
  },
  footerText: {
    color: "#71717a",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLinks: {
    color: "#71717a",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLink: {
    color: "#18181b",
    textDecoration: "underline",
  },
  copyright: {
    color: "#a1a1aa",
    fontSize: "11px",
    lineHeight: "16px",
    margin: "0",
  },
} as const;

export default EmailLayout;
