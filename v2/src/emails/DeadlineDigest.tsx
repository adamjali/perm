/**
 * DeadlineDigest Email Template
 *
 * Daily consolidated deadline digest. Replaces the old one-email-per-deadline
 * blast: a user whose cases have N deadlines hitting a reminder window today now
 * gets ONE email listing all of them, grouped by urgency.
 *
 * Matches the WeeklyDigest neobrutalist aesthetic (shared EmailLayout, urgency-
 * colored section banners, deadline rows). Unlike the weekly digest, this keeps a
 * "Coming up" (15+ days) section so the 14- and 30-day reminder intervals are
 * never dropped.
 *
 * Urgency colors:
 * - overdue:  #991B1B (dark red)
 * - urgent:   #DC2626 (red), 0-7 days
 * - upcoming: #C2410C (orange), 8-14 days
 * - later:    #2563EB (blue), 15+ days
 */

import { Text, Section, Link } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components";
import {
  formatDateForDisplay,
  formatRelativeDays,
  getUrgencyColor,
} from "../../convex/lib/digestHelpers";
import type { DeadlineDigestItem } from "../../convex/lib/reminderDigest";
import { SITE_URL } from "../../convex/lib/links";
import { urgencyHeadStyle, urgencyHeadText, urgencyRow, urgencyRowLast } from "./components/emailStyles";
import { deadlineDigestWords } from "../../convex/lib/deadlineDigestWords";

export interface DeadlineDigestProps {
  /** First name (or display name) of the recipient. */
  userName: string;
  /** The user's triggered deadlines for today, sorted most-urgent-first. */
  items: DeadlineDigestItem[];
  /** Base URL for the app. */
  baseUrl?: string;
  /** URL to manage notification settings. */
  settingsUrl?: string;
}

type Urgency = DeadlineDigestItem["urgency"];

/** Section order, label and banner colour, the WeeklyDigest's sections. The
 * colour carries the urgency; the label is in sentence case with no emoji. */
const SECTIONS: ReadonlyArray<{ key: Urgency; label: string; color: string }> = [
  { key: "overdue", label: "Overdue", color: "#991B1B" },
  { key: "urgent", label: "This week", color: "#DC2626" },
  { key: "upcoming", label: "Next week", color: "#C2410C" },
  { key: "later", label: "Coming up", color: "#2563EB" },
];

export function DeadlineDigest({
  userName,
  items,
  baseUrl = SITE_URL,
  settingsUrl = `${SITE_URL}/settings`,
}: DeadlineDigestProps) {
  const words = deadlineDigestWords(items.length, items.filter((i) => i.urgency === "overdue").length);
  const headline = words.headline;
  const previewText = words.preview;

  return (
    <EmailLayout previewText={previewText} settingsUrl={settingsUrl}>
      <Section style={styles.greeting}>
        <Text className="em-text" style={styles.greetingText}>
          Hi {userName},
        </Text>
        <Text className="em-text-secondary" style={styles.subhead}>
          {headline}. Here&#39;s everything across your cases, most urgent first.
        </Text>
      </Section>

      {SECTIONS.map(({ key, label, color }) => {
        const sectionItems = items.filter((i) => i.urgency === key);
        if (sectionItems.length === 0) return null;
        return (
          <Section key={key} style={styles.section}>
            <Section className="em-banner" style={urgencyHeadStyle(color)}>
              <Text className="em-text" style={urgencyHeadText}>
                {`${label} (${sectionItems.length})`}
              </Text>
            </Section>
            {sectionItems.map((item, i) => (
              <DeadlineRow
                key={`${item.caseId}-${item.deadlineType}`}
                item={item}
                baseUrl={baseUrl}
                last={i === sectionItems.length - 1}
              />
            ))}
          </Section>
        );
      })}

      <Section style={styles.ctaSection}>
        <Link href={`${baseUrl}/dashboard`} className="em-button-primary" style={styles.ctaButton}>
          View all cases
        </Link>
      </Section>
    </EmailLayout>
  );
}

/** A single deadline row — beneficiary at employer, type, date, days-left, View. */
function DeadlineRow({ item, baseUrl, last }: { item: DeadlineDigestItem; baseUrl: string; last: boolean }) {
  const daysClass =
    item.urgency === "overdue" || item.urgency === "urgent"
      ? "em-days-overdue"
      : "em-days-warning";

  return (
    <Section className="em-deadline-row" style={last ? { ...urgencyRow, ...urgencyRowLast } : urgencyRow}>
      <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
        <tbody>
          <tr>
            <td style={styles.rowContent}>
              <Text className="em-text" style={styles.caseName}>
                {item.beneficiaryIdentifier} at {item.employerName}
              </Text>
              <Text className="em-text-secondary" style={styles.deadlineType}>
                {item.deadlineType}
              </Text>
            </td>
            <td style={styles.dateCell}>
              <Text className="em-text" style={styles.date}>
                {formatDateForDisplay(item.deadlineDate)}
              </Text>
              <Text className={daysClass} style={{ ...styles.days, color: getUrgencyColor(item.urgency) }}>
                {formatRelativeDays(item.daysUntil)}
              </Text>
            </td>
            <td style={styles.actionCell}>
              <Link href={`${baseUrl}/cases/${item.caseId}`} className="em-link-blue" style={styles.viewLink}>
                View
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

/** Inline styles (email-client compatible), matching the WeeklyDigest aesthetic. */
const styles = {
  greeting: { marginBottom: "24px" },
  greetingText: {
    color: "#18181b",
    fontSize: "20px",
    fontWeight: "700" as const,
    margin: "0 0 4px 0",
  },
  subhead: {
    color: "#71717a",
    fontSize: "14px",
    lineHeight: "21px",
    margin: "0",
  },
  section: { marginBottom: "24px" },
  rowContent: { verticalAlign: "top" as const, paddingRight: "12px" },
  caseName: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 2px 0",
  },
  deadlineType: { color: "#71717a", fontSize: "14px", margin: "0" },
  dateCell: {
    textAlign: "right" as const,
    verticalAlign: "top" as const,
    paddingRight: "12px",
  },
  date: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 2px 0",
  },
  days: { fontSize: "14px", fontWeight: "700" as const, margin: "0" },
  actionCell: {
    verticalAlign: "middle" as const,
    textAlign: "right" as const,
    width: "50px",
  },
  viewLink: {
    color: "#2563eb",
    fontSize: "14px",
    fontWeight: "600" as const,
    textDecoration: "underline",
  },
  ctaSection: { textAlign: "center" as const, marginTop: "8px" },
  // The email's one main action, in the site's main-button lime with ink.
  ctaButton: {
    backgroundColor: "#2ECC40",
    color: "#141414",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    padding: "14px 32px",
    border: "1px solid #141414",
    display: "inline-block",
  },
} as const;

/** Preview props for React Email dev server. */
DeadlineDigest.PreviewProps = {
  userName: "Jake",
  baseUrl: SITE_URL,
  settingsUrl: `${SITE_URL}/settings`,
  items: [
    { caseId: "c1" as never, employerName: "Globex Corporation", beneficiaryIdentifier: "A. Rivera", deadlineType: "PWD expiration", deadlineDate: "2026-06-27", daysUntil: -2, urgency: "overdue" },
    { caseId: "c2" as never, employerName: "Acme Inc", beneficiaryIdentifier: "B. Chen", deadlineType: "PWD expiration", deadlineDate: "2026-06-30", daysUntil: 1, urgency: "urgent" },
    { caseId: "c3" as never, employerName: "Initech", beneficiaryIdentifier: "C. Okafor", deadlineType: "ETA 9089 filing window closes", deadlineDate: "2026-07-02", daysUntil: 3, urgency: "urgent" },
    { caseId: "c4" as never, employerName: "Umbrella LLC", beneficiaryIdentifier: "D. Santos", deadlineType: "RFI response due", deadlineDate: "2026-07-06", daysUntil: 7, urgency: "urgent" },
    { caseId: "c5" as never, employerName: "Stark Industries", beneficiaryIdentifier: "E. Müller", deadlineType: "I-140 filing deadline", deadlineDate: "2026-07-13", daysUntil: 14, urgency: "upcoming" },
    { caseId: "c6" as never, employerName: "Wayne Enterprises", beneficiaryIdentifier: "F. Adeyemi", deadlineType: "Recruitment window closes", deadlineDate: "2026-07-29", daysUntil: 30, urgency: "later" },
  ],
} satisfies DeadlineDigestProps;
