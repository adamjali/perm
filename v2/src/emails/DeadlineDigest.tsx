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
 * - urgent:   #DC2626 (red)      — 0-7 days
 * - upcoming: #F97316 (orange)   — 8-14 days
 * - later:    #2563EB (blue)     — 15+ days
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

/** Section order, severity emoji, and banner color — matches the WeeklyDigest section styling. */
const SECTIONS: ReadonlyArray<{ key: Urgency; label: string; icon: string; color: string }> = [
  { key: "overdue", label: "Overdue", icon: "🚨", color: "#991B1B" },
  { key: "urgent", label: "This week", icon: "⚠️", color: "#DC2626" },
  { key: "upcoming", label: "Next week", icon: "📅", color: "#F97316" },
  { key: "later", label: "Coming up", icon: "🗓️", color: "#2563EB" },
];

export function DeadlineDigest({
  userName,
  items,
  baseUrl = "https://permtracker.app",
  settingsUrl = "https://permtracker.app/settings",
}: DeadlineDigestProps) {
  const total = items.length;
  const overdueCount = items.filter((i) => i.urgency === "overdue").length;
  const plural = total !== 1 ? "s" : "";

  const headline =
    overdueCount > 0
      ? `${total} deadline${plural} need attention, ${overdueCount} overdue`
      : `${total} deadline${plural} need your attention`;

  const previewText =
    overdueCount > 0
      ? `${overdueCount} overdue and ${total} total PERM deadline${plural} need attention`
      : `${total} PERM deadline${plural} coming up`;

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

      {SECTIONS.map(({ key, label, icon, color }) => {
        const sectionItems = items.filter((i) => i.urgency === key);
        if (sectionItems.length === 0) return null;
        return (
          <Section key={key} style={styles.section}>
            <Section className="em-banner" style={getSectionHeaderStyle(color)}>
              <Text className="em-text-white" style={styles.sectionHeaderText}>
                {icon} {label.toUpperCase()} ({sectionItems.length})
              </Text>
            </Section>
            {sectionItems.map((item) => (
              <DeadlineRow
                key={`${item.caseId}-${item.deadlineType}`}
                item={item}
                baseUrl={baseUrl}
              />
            ))}
          </Section>
        );
      })}

      <Section style={styles.ctaSection}>
        <Link href={`${baseUrl}/dashboard`} className="em-cta-button" style={styles.ctaButton}>
          View all cases
        </Link>
      </Section>
    </EmailLayout>
  );
}

/** A single deadline row — beneficiary at employer, type, date, days-left, View. */
function DeadlineRow({ item, baseUrl }: { item: DeadlineDigestItem; baseUrl: string }) {
  const daysClass =
    item.urgency === "overdue" || item.urgency === "urgent"
      ? "em-days-overdue"
      : "em-days-warning";

  return (
    <Section className="em-deadline-row" style={styles.row}>
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

function getSectionHeaderStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    padding: "10px 16px",
    border: "3px solid #000001",
    borderBottom: "none",
  };
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
  sectionHeaderText: {
    color: "#fffffe",
    fontSize: "12px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    margin: "0",
  },
  row: {
    backgroundColor: "#fffffe",
    padding: "12px 16px",
    borderLeft: "3px solid #000001",
    borderRight: "3px solid #000001",
    borderBottom: "2px solid #e4e4e7",
  },
  rowContent: { verticalAlign: "top" as const, paddingRight: "12px" },
  caseName: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 2px 0",
  },
  deadlineType: { color: "#71717a", fontSize: "12px", margin: "0" },
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
  days: { fontSize: "12px", fontWeight: "700" as const, margin: "0" },
  actionCell: {
    verticalAlign: "middle" as const,
    textAlign: "right" as const,
    width: "50px",
  },
  viewLink: {
    color: "#2563eb",
    fontSize: "13px",
    fontWeight: "600" as const,
    textDecoration: "underline",
  },
  ctaSection: { textAlign: "center" as const, marginTop: "8px" },
  ctaButton: {
    backgroundColor: "#18181b",
    color: "#fffffe",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    padding: "14px 32px",
    border: "3px solid #000001",
    boxShadow: "4px 4px 0 #22c55e",
    display: "inline-block",
  },
} as const;

/** Preview props for React Email dev server. */
DeadlineDigest.PreviewProps = {
  userName: "Jake",
  baseUrl: "https://permtracker.app",
  settingsUrl: "https://permtracker.app/settings",
  items: [
    { caseId: "c1" as never, employerName: "Globex Corporation", beneficiaryIdentifier: "A. Rivera", deadlineType: "PWD Expiration", deadlineDate: "2026-06-27", daysUntil: -2, urgency: "overdue" },
    { caseId: "c2" as never, employerName: "Acme Inc", beneficiaryIdentifier: "B. Chen", deadlineType: "PWD Expiration", deadlineDate: "2026-06-30", daysUntil: 1, urgency: "urgent" },
    { caseId: "c3" as never, employerName: "Initech", beneficiaryIdentifier: "C. Okafor", deadlineType: "Filing Window Closes", deadlineDate: "2026-07-02", daysUntil: 3, urgency: "urgent" },
    { caseId: "c4" as never, employerName: "Umbrella LLC", beneficiaryIdentifier: "D. Santos", deadlineType: "RFI Response Due", deadlineDate: "2026-07-06", daysUntil: 7, urgency: "urgent" },
    { caseId: "c5" as never, employerName: "Stark Industries", beneficiaryIdentifier: "E. Müller", deadlineType: "I-140 Filing Deadline", deadlineDate: "2026-07-13", daysUntil: 14, urgency: "upcoming" },
    { caseId: "c6" as never, employerName: "Wayne Enterprises", beneficiaryIdentifier: "F. Adeyemi", deadlineType: "Recruitment Window Closes", deadlineDate: "2026-07-29", daysUntil: 30, urgency: "later" },
  ],
} satisfies DeadlineDigestProps;

export default DeadlineDigest;
