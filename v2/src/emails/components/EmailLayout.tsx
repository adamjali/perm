/**
 * EmailLayout Component
 * Shared layout wrapper for all PERM Tracker email templates.
 *
 * Features:
 * - PERM Tracker branding (neobrutalist-inspired)
 * - Max-width 600px container
 * - Footer with settings link
 * - Responsive design
 * - Dark mode support via @media (prefers-color-scheme: dark)
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
 * Dark mode CSS overrides.
 * Uses @media (prefers-color-scheme: dark) with !important to override inline styles.
 * Supported by: Apple Mail, iOS Mail, Outlook (macOS), some Android clients.
 * Gmail ignores this (it auto-inverts, which is unavoidable).
 *
 * This is a static string literal - no user input, safe for inline style injection.
 */
const DARK_MODE_STYLES = [
  ":root { color-scheme: light dark; supported-color-schemes: light dark; }",
  "@media (prefers-color-scheme: dark) {",
  // Layout
  "  .em-body { background-color: #18181b !important; }",
  "  .em-content { background-color: #27272a !important; border-color: #52525b !important; }",
  "  .em-header { border-color: #52525b !important; }",
  // Text
  "  .em-text { color: #fafafa !important; }",
  "  .em-text-body { color: #d4d4d8 !important; }",
  "  .em-text-secondary { color: #a1a1aa !important; }",
  "  .em-text-muted { color: #71717a !important; }",
  // Links
  "  .em-link { color: #fafafa !important; }",
  "  .em-link-blue { color: #60a5fa !important; }",
  // Dividers
  "  .em-divider { border-color: #52525b !important; }",
  // Cards
  "  .em-card { background-color: #3f3f46 !important; border-color: #52525b !important; }",
  "  .em-card-bold { background-color: #3f3f46 !important; border-color: #52525b !important; }",
  // Alert - yellow
  "  .em-alert-yellow { background-color: #422006 !important; border-color: #b45309 !important; }",
  "  .em-alert-yellow-text { color: #fbbf24 !important; }",
  // Alert - red
  "  .em-alert-red { background-color: #450a0a !important; border-color: #b91c1c !important; }",
  "  .em-alert-red-text { color: #fca5a5 !important; }",
  // Alert - green
  "  .em-alert-green { background-color: #052e16 !important; border-color: #22c55e !important; }",
  "  .em-alert-green-title { color: #4ade80 !important; }",
  "  .em-alert-green-text { color: #86efac !important; }",
  // Info boxes
  "  .em-info-box { background-color: #3f3f46 !important; border-color: #52525b !important; }",
  "  .em-info-text { color: #a1a1aa !important; }",
  // Support boxes
  "  .em-support-box { background-color: #422006 !important; border-color: #92400e !important; }",
  "  .em-support-text { color: #fbbf24 !important; }",
  "  .em-support-link { color: #fbbf24 !important; }",
  // Status change
  "  .em-status-box { background-color: #3f3f46 !important; border-color: #52525b !important; }",
  "  .em-status-prev { background-color: #27272a !important; border-color: #52525b !important; color: #a1a1aa !important; }",
  "  .em-status-new { background-color: #052e16 !important; border-color: #22c55e !important; color: #fafafa !important; }",
  // Stats table
  "  .em-stat-cell { background-color: #27272a !important; border-color: #52525b !important; }",
  "  .em-stat-number { color: #fafafa !important; }",
  // Deadline rows
  "  .em-deadline-row { background-color: #27272a !important; border-color: #52525b !important; }",
  // Activity rows
  "  .em-activity-row { border-color: #3f3f46 !important; }",
  // Buttons
  "  .em-button { border-color: #52525b !important; box-shadow: 4px 4px 0 #3f3f46 !important; }",
  "  .em-cta-button { background-color: #fafafa !important; color: #18181b !important; border-color: #52525b !important; box-shadow: 4px 4px 0 #3f3f46 !important; }",
  // Closure
  "  .em-closure-box { background-color: #450a0a !important; border-color: #dc2626 !important; }",
  "  .em-closure-title { color: #fca5a5 !important; }",
  "  .em-closure-reason { color: #fecaca !important; }",
  "}",
].join("\n");

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
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{DARK_MODE_STYLES}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="em-body" style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section className="em-header" style={styles.header}>
            <Text style={styles.logo}>
              <span style={styles.logoPerm}>PERM</span>
              <span style={styles.logoTracker}> Tracker</span>
            </Text>
          </Section>

          {/* Main content */}
          <Section className="em-content" style={styles.content}>{children}</Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text className="em-text-secondary" style={styles.footerText}>
              You&apos;re receiving this email because you have notifications
              enabled for your PERM Tracker account.
            </Text>
            <Text className="em-text-secondary" style={styles.footerLinks}>
              <Link href={settingsUrl} className="em-link" style={styles.footerLink}>
                Manage notification settings
              </Link>
              {" | "}
              <Link href="https://permtracker.app" className="em-link" style={styles.footerLink}>
                Open PERM Tracker
              </Link>
            </Text>
            <Text className="em-text-muted" style={styles.copyright}>
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
    backgroundColor: "#000001",
    padding: "24px 32px",
    borderBottom: "4px solid #000001",
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
    color: "#fffffe",
  },
  content: {
    backgroundColor: "#fffffe",
    padding: "32px",
    border: "4px solid #000001",
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
