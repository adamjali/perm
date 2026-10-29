/**
 * EmailLayout Component
 * Shared layout wrapper for all PERM Tracker email templates.
 *
 * Features:
 * - Max-width 600px container
 * - Footer with settings + Privacy/Terms links
 * - Responsive design
 * - Dark mode support via @media (prefers-color-scheme: dark)
 * - All inline styles (email client compatibility)
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

import { LEGAL_NAME, POSTAL_ADDRESS } from "../../lib/constants/about";
import { SITE_URL } from "../../../convex/lib/links";
import { MAIL_LANG_TAG, type MailLang } from "../../lib/i18n/mailLang";
import { LAYOUT_TEXT } from "../i18n/layout";

export interface EmailLayoutProps {
  /** Preview text shown in email clients */
  previewText: string;
  /** Email content */
  children: React.ReactNode;
  /** Optional settings URL override */
  settingsUrl?: string;
  /** The settings link's text. Subscriber mail says "Email preferences" and points at the magic-link page. */
  settingsLabel?: string;
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
  /** The language the email is written in (src/lib/i18n/mailLang.ts). English when not given. */
  lang?: MailLang;
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
  /*
   * The page background lives on this class in BOTH themes, and must not also
   * be set inline on <Body>.
   *
   * `@react-email/body@0.3.0` renders `<body {...props} style={bodyStyle}>`
   * wrapping a table whose single `<td>` receives the FULL `style` object and
   * NO className. So an inline `backgroundColor` is copied onto that unclassed
   * `<td>`, which paints across the whole width on top of the body. The dark
   * `.em-body` rule then repaints an element nobody can see, and every footer
   * node keeps resolving against the light inline value: measured at 1.34,
   * 2.33 and 3.11:1 while the greys themselves were correct for #18181b.
   *
   * Setting it here instead leaves the `<td>` transparent, so the body's own
   * background shows through and one class drives both themes.
   */
  ".em-body { background-color: #f4f4f5; }",
  "@media (prefers-color-scheme: dark) {",
  // Layout
  "  .em-body { background-color: #18181b !important; }",
  "  .em-content { background-color: #27272a !important; border-color: #52525b !important; }",
  // The header stays the black band it is in light mode, edged so it sits on the dark body.
  "  .em-header { background-color: #000001 !important; border-color: #52525b !important; }",
  "  .em-logo-perm { color: #2ECC40 !important; }",
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
  // A good-news block is the solid lime with ink in both themes (ink on lime 9.8:1).
  "  .em-alert-green { background-color: #2ECC40 !important; border-color: #000001 !important; }",
  "  .em-alert-green-title { color: #000001 !important; }",
  "  .em-alert-green-text { color: #000001 !important; }",
  // Info boxes
  "  .em-info-box { background-color: #3f3f46 !important; border-color: #52525b !important; }",
  "  .em-info-text { color: #a1a1aa !important; }",
  // Support boxes
  "  .em-support-box { background-color: #422006 !important; border-color: #92400e !important; }",
  "  .em-support-text { color: #fbbf24 !important; }",
  "  .em-support-link { color: #fbbf24 !important; }",
  // Status change
  // Stats table
  "  .em-stat-cell { background-color: #27272a !important; border-color: #52525b !important; }",
  "  .em-stat-number { color: #fafafa !important; }",
  // Deadline rows
  "  .em-deadline-row { background-color: #27272a !important; border-color: #52525b !important; }",
  // Activity rows
  "  .em-activity-row { border-color: #3f3f46 !important; }",
  // Buttons
  "  .em-button { border-color: #52525b !important; }",
  "  .em-cta-button { background-color: #fafafa !important; color: #18181b !important; border-color: #52525b !important; }",
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
  /*
   * The hard offset is the brand device, and in dark mode it disappeared:
   * ink #000001 against the dark card #27272a measures 1.41:1. #78787E is
   * 3.39:1, clear of the 3:1 non-text floor, and still reads as a cast shadow
   * rather than a second border. The FILL stays lime with an ink label, which
   * must not invert (ink on lime 9.82:1, white on lime 2.14:1).
   */
  "  .qa-stamp { background-color: #2ECC40 !important; border-color: #000001 !important; box-shadow: 4px 4px 0 #78787E !important; }",
  "  .qa-stamp-value { color: #000001 !important; }",
  "  .em-link-strong { color: #fafafa !important; }",
  // Both queue button variants carry an ink label on a light fill, so the
  // generic .em-button dark rule above must not repaint them.
  "  .em-button-primary { background-color: #2ECC40 !important; color: #000001 !important; border-color: #000001 !important; }",
  "  .em-button-outline { background-color: #FAFAFA !important; color: #000001 !important; border-color: #000001 !important; }",
  // Footer copyright, on the body rather than a card. 5.18:1.
  "  .em-footer-muted { color: #8A8A93 !important; }",
  // The queue emails' filing-month box sits on .em-card (#3f3f46 in dark),
  // where the generic .em-text-secondary #a1a1aa measures 4.07:1.
  "  .qa-yours-label { color: #B4B4BC !important; }",
  /*
   * Case-status alert. Same problem the stamp's offset had and the same
   * answer: ink #000001 against the dark card #27272a is 1.41:1, so the rail
   * would simply vanish and take the whole device with it. #78787E is 3.39:1,
   * clear of the 3:1 non-text floor.
   */
  "  .cs-rail { border-left-color: #78787E !important; }",
  /*
   * BOTH blocks keep their light fills and their ink labels, and neither may
   * invert. The lime one is the 9.82:1 pairing that becomes 2.14:1 inverted.
   * The closed one is paper, and inverting it to a dark fill with a light
   * label would erase the only thing separating the two tones: the presence
   * or absence of the brand colour. Only the offset moves, for the contrast
   * reason above.
   */
  "  .cs-block-live { background-color: #2ECC40 !important; border-color: #000001 !important; box-shadow: 4px 4px 0 #78787E !important; }",
  "  .cs-block-closed { background-color: #FAFAFA !important; border-color: #000001 !important; box-shadow: 4px 4px 0 #78787E !important; }",
  "  .cs-block-value { color: #000001 !important; }",
  // The figure table sits directly on the card. #2A2A2A would be 1.36:1 there.
  "  .cs-fig-label { color: #D4D4D8 !important; }",
  "  .cs-fig-value { color: #FAFAFA !important; }",
  // The rating boxes stay paper-on-ink like the outline buttons.
  "  .rt-box { background-color: #FAFAFA !important; color: #000001 !important; border-color: #000001 !important; }",
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
  /*
   * 350px, not 480px.
   *
   * The step-down exists for viewports too narrow to fit the stamp on one
   * line. At 480 it fired on every modern phone (390-430px CSS), shipping a
   * 26px stamp and a narrower card to devices with room for the full 34px one.
   * Measured: the widest month is 287px in the worst-case fallback face, and a
   * 390px viewport leaves 390 - 40 - 64 - 48 = 238px... which it does not fit,
   * so the release below is what handles it: the month wraps at full size
   * rather than shrinking the whole card. Only genuinely tiny screens get the
   * padding and type step-down.
   */
  "@media only screen and (max-width: 350px) {",
  "  .em-container { padding: 12px !important; }",
  "  .em-content { padding: 20px !important; }",
  "  .qa-stamp { padding: 16px 14px !important; }",
  "  .qa-stamp-value { font-size: 26px !important; line-height: 30px !important; }",
  "  .cs-block-live, .cs-block-closed { padding: 14px 16px !important; }",
  "  .cs-block-value { font-size: 21px !important; line-height: 26px !important; }",
  "}",
  /*
   * Releasing the one-line pin is a SEPARATE, wider breakpoint from the size
   * step-down. A 390px phone has ~238px of stamp interior against a 287px
   * month, so it must be allowed to wrap; it does not need smaller type or a
   * tighter card to do that.
   */
  "@media only screen and (max-width: 600px) {",
  "  .qa-stamp-value { white-space: normal !important; }",
  // Same pin, same release, same reason. The status block is pinned so a
  // sibling spacer cannot size it to its longest word; below 600px the widest
  // status genuinely does not fit and must break rather than overflow.
  "  .cs-block-value { white-space: normal !important; }",
  "}",
].join("\n");

/**
 * Shared email layout with PERM Tracker branding.
 * Wraps all email templates with consistent header, footer, and styling.
 */
export function EmailLayout({
  previewText,
  children,
  settingsUrl = `${SITE_URL}/settings`,
  settingsLabel,
  footerText,
  hideSettingsLink = false,
  footerExtra,
  lang = "en",
}: EmailLayoutProps) {
  const t = LAYOUT_TEXT[lang];
  return (
    <Html lang={MAIL_LANG_TAG[lang]}>
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
              <span className="em-logo-perm" style={styles.logoPerm}>PERM</span>{" "}
              <span className="em-text" style={styles.logoTracker}>Tracker</span>
            </Text>
          </Section>

          {/* Main content */}
          <Section className="em-content" style={styles.content}>{children}</Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text className="em-text-secondary" style={styles.footerText}>
              {footerText || t.defaultFooter}
            </Text>
            <Text className="em-text-secondary" style={styles.footerLinks}>
              {!hideSettingsLink && (
                <>
                  <Link href={settingsUrl} className="em-link" style={styles.footerLink}>
                    {settingsLabel ?? t.settings}
                  </Link>
                  {" "}
                </>
              )}
              <Link href={SITE_URL} className="em-link" style={styles.footerLink}>
                {t.open}
              </Link>
              {" "}
              <Link href={`${SITE_URL}/privacy`} className="em-link" style={styles.footerLink}>
                {t.privacy}
              </Link>
              {" "}
              <Link href={`${SITE_URL}/terms`} className="em-link" style={styles.footerLink}>
                {t.terms}
              </Link>
            </Text>
            {footerExtra}
            <Text className="em-footer-muted" style={styles.copyright}>
              {`${LEGAL_NAME}, ${POSTAL_ADDRESS}`}
            </Text>
            <Text className="em-footer-muted" style={styles.copyright}>
              &copy; {`${new Date().getFullYear()} ${LEGAL_NAME}. ${t.rights}`}
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
    // Deliberately no `backgroundColor`. See the .em-body note above: an inline
    // value here is copied onto an unclassed <td> that paints over the body and
    // defeats the dark-mode rule entirely.
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
  // A black band with the lime mark: the solid header the emails have always had.
  header: {
    backgroundColor: "#000001",
    padding: "22px 32px",
    border: "2px solid #000001",
  },
  logo: {
    margin: "0",
    fontSize: "24px",
    fontWeight: "700" as const,
    letterSpacing: "-0.02em",
  },
  logoPerm: {
    // The brand lime from globals.css (`--primary`): 10.7:1 on the black band.
    color: "#2ECC40",
  },
  logoTracker: {
    color: "#fffffe",
  },
  content: {
    backgroundColor: "#fffffe",
    padding: "32px",
    border: "2px solid #000001",
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
    fontSize: "14px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLinks: {
    color: "#5F5F67",
    fontSize: "14px",
    // Each link's own padded box (18px text + 26px) is the 44px row; a taller
    // line-height on top of it doubled the gap when the row wrapped on a phone.
    lineHeight: "18px",
    margin: "0 0 4px 0",
  },
  footerLink: {
    color: "#5F5F67",
    textDecoration: "underline",
    /*
     * Measured at an 18px box with a 9.8px gap to its neighbour, which misses
     * the 44px house floor AND WCAG 2.5.8's 24px spacing exception on the
     * horizontal axis. These sit three or four to a row, so they
     * are a genuine cluster of adjacent targets rather than links inside a
     * sentence.
     *
     * `inline-block` is what puts the padding inside the hit box: the hit area
     * of an inline non-replaced element follows its font-size-derived content
     * box, so a taller line-height alone would look bigger and still be 18px
     * to a thumb. 13px top and bottom takes the box to 44px; 10px each side
     * takes the horizontal pitch past 24px.
     */
    display: "inline-block",
    padding: "13px 10px",
    // A label breaks between links, never inside one; the padding is the separator.
    whiteSpace: "nowrap" as const,
  },
  copyright: {
    // Quieter than the links above it (5.76:1) and still over the floor.
    color: "#6B6B74",
    fontSize: "14px",
    lineHeight: "16px",
    margin: "0",
  },
} as const;
