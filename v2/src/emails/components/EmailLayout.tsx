/**
 * EmailLayout Component
 * Shared layout wrapper for all PERM Tracker email templates.
 *
 * Features:
 * - PERM Tracker branding (neobrutalist-inspired)
 * - Max-width 600px container
 * - Footer with settings + Privacy/Terms links
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
  /** Optional footer text override (default: notification-related text) */
  footerText?: string;
  /** Hide "Manage notification settings" link (for auth emails) */
  hideSettingsLink?: boolean;
  /**
   * Extra footer content above the copyright line.
   *
   * Exists for list mail that has to carry its own opt-out, where the
   * account-scoped "manage notification settings" link is meaningless. The
   * queue alerts use it for the unsubscribe that pairs with their
   * `List-Unsubscribe` header.
   */
  footerExtra?: React.ReactNode;
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
  "  .em-link { color: #d4d4d8 !important; }",
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
  "  .em-closure-type { color: #fca5a5 !important; }",
  // Colored banners & urgency sections (keep color bg, fix borders)
  "  .em-banner { border-color: #52525b !important; }",
  // White text on colored backgrounds (prevent inversion)
  "  .em-text-white { color: #fffffe !important; }",
  // Status change arrow
  "  .em-arrow { color: #4ade80 !important; }",
  // Days remaining indicators
  "  .em-days-warning { color: #fb923c !important; }",
  "  .em-days-overdue { color: #fca5a5 !important; }",
  // Date callout sections
  "  .em-date-callout { border-color: #52525b !important; }",
  // Queue-alert stamp. This one must NOT invert: the block is a solid brand
  // fill carrying an ink label, measured at 9.82:1. Inverted it becomes white
  // on lime, which is 2.14:1 and unreadable. The off-pure #000001 is the first
  // line of defence (clients tend to leave non-pure values alone); these rules
  // are the second.
  "  .qa-stamp { background-color: #2ECC40 !important; border-color: #000001 !important; }",
  "  .qa-stamp-value { color: #000001 !important; }",
  "  .em-link-strong { color: #fafafa !important; }",
  // Both queue button variants carry an ink label on a light fill, so the
  // generic .em-button dark rule above must not repaint them.
  "  .em-button-primary { background-color: #2ECC40 !important; color: #000001 !important; border-color: #000001 !important; box-shadow: 4px 4px 0 #000001 !important; }",
  "  .em-button-outline { background-color: #FAFAFA !important; color: #000001 !important; border-color: #000001 !important; box-shadow: 4px 4px 0 #000001 !important; }",
  // Footer copyright, on the body rather than a card. 5.18:1.
  "  .em-footer-muted { color: #8A8A93 !important; }",
  // The queue emails' filing-month box sits on .em-card (#3f3f46 in dark),
  // where the generic .em-text-secondary #a1a1aa measures 4.07:1.
  "  .qa-yours-label { color: #B4B4BC !important; }",
  "}",
].join("\n");

/**
 * Narrow-viewport overrides.
 *
 * Measured: "September 2024" in the stamp's mono face is 287px at 34px, which
 * clears the 448px available inside the card at 600px wide and does NOT clear
 * the ~168px left at a 320px viewport. So the stamp is pinned to one line at
 * desktop (see QueueStamp's `whiteSpace`) and released here, where the padding
 * and the type both step down and a long month wraps to a second line rather
 * than pushing the card into horizontal overflow.
 *
 * Outlook's Word engine ignores media queries, but Outlook desktop is never
 * 480px wide. The clients that are, honour these.
 */
const RESPONSIVE_STYLES = [
  "@media only screen and (max-width: 480px) {",
  "  .em-container { padding: 12px !important; }",
  "  .em-content { padding: 20px !important; }",
  "  .qa-stamp { padding: 16px 14px !important; }",
  "  .qa-stamp-value { font-size: 26px !important; line-height: 30px !important; white-space: normal !important; }",
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
  footerText,
  hideSettingsLink = false,
  footerExtra,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{DARK_MODE_STYLES}</style>
        <style>{RESPONSIVE_STYLES}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="em-body" style={styles.body}>
        <Container className="em-container" style={styles.container}>
          {/* Header */}
          <Section className="em-header" style={styles.header}>
            <Text style={styles.logo}>
              <span style={styles.logoPerm}>PERM</span>{" "}
              <span style={styles.logoTracker}> Tracker</span>
            </Text>
          </Section>

          {/* Main content */}
          <Section className="em-content" style={styles.content}>{children}</Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text className="em-text-secondary" style={styles.footerText}>
              {footerText || "You\u0027re receiving this email because you have notifications enabled for your PERM Tracker account."}
            </Text>
            <Text className="em-text-secondary" style={styles.footerLinks}>
              {!hideSettingsLink && (
                <>
                  <Link href={settingsUrl} className="em-link" style={styles.footerLink}>
                    Manage notification settings
                  </Link>
                  {" | "}
                </>
              )}
              <Link href="https://permtracker.app" className="em-link" style={styles.footerLink}>
                Open PERM Tracker
              </Link>
              {" | "}
              <Link href="https://permtracker.app/privacy" className="em-link" style={styles.footerLink}>
                Privacy Policy
              </Link>
              {" | "}
              <Link href="https://permtracker.app/terms" className="em-link" style={styles.footerLink}>
                Terms of Service
              </Link>
            </Text>
            {footerExtra}
            <Text className="em-footer-muted" style={styles.copyright}>
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
 * Email clients don’t support external CSS or most modern CSS features.
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
    // The brand lime from globals.css (`--primary`). This read #22c55e, a
    // Tailwind green that predates the token, so every email in this directory
    // was signing off in a colour the site does not use.
    color: "#2ECC40",
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
    // Measured on `.em-body` (#f4f4f5): the previous #71717a was 4.40:1, just
    // under the floor, and the copyright's #a1a1aa was 2.33:1. These are the
    // only footer-local styles, so this affects the footer of every template
    // and nothing else.
    color: "#5F5F67",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLinks: {
    color: "#5F5F67",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLink: {
    color: "#5F5F67",
    textDecoration: "underline",
  },
  copyright: {
    // Quieter than the links above it (5.76:1) and still over the floor.
    color: "#6B6B74",
    fontSize: "11px",
    lineHeight: "16px",
    margin: "0",
  },
} as const;

export default EmailLayout;
