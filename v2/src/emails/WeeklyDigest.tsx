/**
 * WeeklyDigest Email Template
 * Weekly summary email sent every Monday morning.
 *
 * Features:
 * - Stats overview (active cases, overdue, urgent)
 * - Grouped deadline sections (overdue, next 7 days, days 8-14)
 * - Recent case activity feed
 * - Empty state with encouraging message
 * - Neobrutalist design matching v2 aesthetic
 *
 * Urgency colors:
 * - overdue: #991B1B (dark red)
 * - urgent (1-7): #DC2626 (red)
 * - upcoming (8-14): #F97316 (orange)
 * - later (15+): #2563EB (blue)
 *
 * Phase: 25.1 (Weekly Digest Email)
 */

import { Text, Section, Link, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components";
import type { DigestContent, DigestDeadline, DigestCaseUpdate } from "../../convex/lib/digestHelpers";

export interface WeeklyDigestProps {
  /** Complete digest content built by digestHelpers */
  digestContent: DigestContent;
  /** Base URL for the app */
  baseUrl?: string;
  /** URL to manage notification settings */
  settingsUrl?: string;
}

/**
 * Weekly digest email template.
 * Displays case deadlines, activity, and stats in a neobrutalist design.
 */
export function WeeklyDigest({
  digestContent,
  baseUrl = "https://permtracker.app",
  settingsUrl = "https://permtracker.app/settings",
}: WeeklyDigestProps) {
  const {
    userName,
    weekStartDate,
    weekEndDate,
    stats,
    overdueDeadlines,
    next7DaysDeadlines,
    next14DaysDeadlines,
    recentCaseUpdates,
    isEmpty,
    emptyMessage,
  } = digestContent;

  // Format week dates for display
  const formatWeekDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00Z");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  const weekRange = `${formatWeekDate(weekStartDate)} - ${formatWeekDate(weekEndDate)}`;

  const previewText = isEmpty
    ? "Your weekly PERM case summary - All clear this week!"
    : `Your weekly PERM summary: ${stats.overdueCount} overdue, ${stats.urgentCount} urgent deadlines`;

  return (
    <EmailLayout previewText={previewText} settingsUrl={settingsUrl}>
      {/* Greeting */}
      <Section style={styles.greeting}>
        <Text style={styles.greetingText}>
          Good morning, {userName}!
        </Text>
        <Text style={styles.weekRange}>
          Week of {weekRange}
        </Text>
      </Section>

      {/* Stats Summary */}
      <Section style={styles.statsContainer}>
        <table width="100%" cellPadding="0" cellSpacing="0" style={styles.statsTable}>
          <tbody>
            <tr>
              <td style={styles.statCell}>
                <Text style={styles.statNumber}>{stats.totalActiveCases}</Text>
                <Text style={styles.statLabel}>Active Cases</Text>
              </td>
              <td style={getStatCellStyle(stats.overdueCount > 0 ? "#991B1B" : undefined)}>
                <Text style={styles.statNumber}>{stats.overdueCount}</Text>
                <Text style={styles.statLabel}>Overdue</Text>
              </td>
              <td style={getStatCellStyle(stats.urgentCount > 0 ? "#DC2626" : undefined)}>
                <Text style={styles.statNumber}>{stats.urgentCount}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </td>
              <td style={styles.statCell}>
                <Text style={styles.statNumber}>{stats.unreadNotificationCount}</Text>
                <Text style={styles.statLabel}>Unread</Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Empty State */}
      {isEmpty && (
        <Section style={styles.emptyState}>
          <Text style={styles.emptyIcon}>&#127881;</Text>
          <Text style={styles.emptyTitle}>All Clear!</Text>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
          <Section style={styles.ctaSection}>
            <Link href={`${baseUrl}/cases`} style={styles.ctaButton}>
              View Your Cases
            </Link>
          </Section>
        </Section>
      )}

      {/* Overdue Deadlines */}
      {overdueDeadlines.length > 0 && (
        <Section style={styles.deadlineSection}>
          <Section style={getDeadlineHeaderStyle("#991B1B")}>
            <Text style={styles.deadlineHeaderText}>
              &#128680; OVERDUE ({overdueDeadlines.length})
            </Text>
          </Section>
          {overdueDeadlines.map((deadline) => (
            <DeadlineRow
              key={`overdue-${deadline.caseId}-${deadline.deadlineType}`}
              deadline={deadline}
              baseUrl={baseUrl}
            />
          ))}
        </Section>
      )}

      {/* Next 7 Days */}
      {next7DaysDeadlines.length > 0 && (
        <Section style={styles.deadlineSection}>
          <Section style={getDeadlineHeaderStyle("#DC2626")}>
            <Text style={styles.deadlineHeaderText}>
              &#9888;&#65039; THIS WEEK ({next7DaysDeadlines.length})
            </Text>
          </Section>
          {next7DaysDeadlines.map((deadline) => (
            <DeadlineRow
              key={`week-${deadline.caseId}-${deadline.deadlineType}`}
              deadline={deadline}
              baseUrl={baseUrl}
            />
          ))}
        </Section>
      )}

      {/* Days 8-14 */}
      {next14DaysDeadlines.length > 0 && (
        <Section style={styles.deadlineSection}>
          <Section style={getDeadlineHeaderStyle("#F97316")}>
            <Text style={styles.deadlineHeaderText}>
              &#128197; NEXT WEEK ({next14DaysDeadlines.length})
            </Text>
          </Section>
          {next14DaysDeadlines.map((deadline) => (
            <DeadlineRow
              key={`next-${deadline.caseId}-${deadline.deadlineType}`}
              deadline={deadline}
              baseUrl={baseUrl}
            />
          ))}
        </Section>
      )}

      {/* Recent Activity */}
      {recentCaseUpdates.length > 0 && (
        <>
          <Hr style={styles.divider} />
          <Section style={styles.activitySection}>
            <Text style={styles.activityHeader}>Recent Activity</Text>
            {recentCaseUpdates.slice(0, 5).map((update) => (
              <ActivityRow
                key={`activity-${update.caseId}-${update.updatedAt}`}
                update={update}
                baseUrl={baseUrl}
              />
            ))}
            {recentCaseUpdates.length > 5 && (
              <Text style={styles.moreActivity}>
                +{recentCaseUpdates.length - 5} more updates
              </Text>
            )}
          </Section>
        </>
      )}

      {/* CTA */}
      {!isEmpty && (
        <Section style={styles.ctaSection}>
          <Link href={`${baseUrl}/cases`} style={styles.ctaButton}>
            View All Cases
          </Link>
        </Section>
      )}
    </EmailLayout>
  );
}

/**
 * Deadline row component.
 */
function DeadlineRow({
  deadline,
  baseUrl,
}: {
  deadline: DigestDeadline;
  baseUrl: string;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00Z");
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  const formatDays = (days: number) => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `in ${days}d`;
  };

  return (
    <Section style={styles.deadlineRow}>
      <table width="100%" cellPadding="0" cellSpacing="0">
        <tbody>
          <tr>
            <td style={styles.deadlineContent}>
              <Text style={styles.deadlineCaseName}>
                {deadline.beneficiaryIdentifier} at {deadline.employerName}
              </Text>
              <Text style={styles.deadlineType}>
                {deadline.deadlineType}
              </Text>
            </td>
            <td style={styles.deadlineDateCell}>
              <Text style={styles.deadlineDate}>
                {formatDate(deadline.deadlineDate)}
              </Text>
              <Text style={getDeadlineDaysStyle(deadline.urgency)}>
                {formatDays(deadline.daysUntil)}
              </Text>
            </td>
            <td style={styles.deadlineAction}>
              <Link
                href={`${baseUrl}/cases/${deadline.caseId}`}
                style={styles.viewLink}
              >
                View
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

/**
 * Activity row component.
 */
function ActivityRow({
  update,
  baseUrl: _baseUrl,
}: {
  update: DigestCaseUpdate;
  baseUrl: string;
}) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  };

  return (
    <Section style={styles.activityRow}>
      <table width="100%" cellPadding="0" cellSpacing="0">
        <tbody>
          <tr>
            <td style={styles.activityContent}>
              <Text style={styles.activityCase}>
                {update.beneficiaryIdentifier} at {update.employerName}
              </Text>
              <Text style={styles.activityChange}>
                {update.changeDescription}
              </Text>
            </td>
            <td style={styles.activityTime}>
              <Text style={styles.activityTimeText}>
                {formatTime(update.updatedAt)}
              </Text>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

/**
 * Get stat cell style with optional highlight color.
 */
function getStatCellStyle(highlightColor?: string): React.CSSProperties {
  return {
    ...styles.statCell,
    backgroundColor: highlightColor ? `${highlightColor}15` : undefined,
    borderBottom: highlightColor ? `3px solid ${highlightColor}` : "3px solid #e4e4e7",
  };
}

/**
 * Get deadline header style with urgency color.
 */
function getDeadlineHeaderStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    padding: "10px 16px",
    border: "3px solid #000000",
    borderBottom: "none",
  };
}

/**
 * Get deadline days style based on urgency.
 */
function getDeadlineDaysStyle(
  urgency: DigestDeadline["urgency"]
): React.CSSProperties {
  const colorMap = {
    overdue: "#991B1B",
    urgent: "#DC2626",
    upcoming: "#F97316",
    later: "#2563EB",
  };

  return {
    ...styles.deadlineDays,
    color: colorMap[urgency],
  };
}

/**
 * Inline styles for email client compatibility.
 */
const styles = {
  greeting: {
    marginBottom: "24px",
  },
  greetingText: {
    color: "#18181b",
    fontSize: "20px",
    fontWeight: "700" as const,
    margin: "0 0 4px 0",
  },
  weekRange: {
    color: "#71717a",
    fontSize: "14px",
    fontWeight: "500" as const,
    margin: "0",
  },
  statsContainer: {
    marginBottom: "24px",
  },
  statsTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    border: "3px solid #000000",
  },
  statCell: {
    padding: "16px 12px",
    textAlign: "center" as const,
    backgroundColor: "#fafafa",
    borderRight: "2px solid #e4e4e7",
    borderBottom: "3px solid #e4e4e7",
    verticalAlign: "top" as const,
  },
  statNumber: {
    color: "#18181b",
    fontSize: "24px",
    fontWeight: "800" as const,
    margin: "0 0 4px 0",
    lineHeight: "1",
  },
  statLabel: {
    color: "#71717a",
    fontSize: "11px",
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "40px 20px",
    backgroundColor: "#f0fdf4",
    border: "3px solid #22c55e",
    marginBottom: "24px",
  },
  emptyIcon: {
    fontSize: "48px",
    margin: "0 0 16px 0",
    lineHeight: "1",
  },
  emptyTitle: {
    color: "#166534",
    fontSize: "24px",
    fontWeight: "800" as const,
    margin: "0 0 8px 0",
  },
  emptyMessage: {
    color: "#15803d",
    fontSize: "16px",
    margin: "0",
  },
  deadlineSection: {
    marginBottom: "24px",
  },
  deadlineHeaderText: {
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    margin: "0",
  },
  deadlineRow: {
    backgroundColor: "#ffffff",
    padding: "12px 16px",
    borderLeft: "3px solid #000000",
    borderRight: "3px solid #000000",
    borderBottom: "2px solid #e4e4e7",
  },
  deadlineContent: {
    verticalAlign: "top" as const,
    paddingRight: "12px",
  },
  deadlineCaseName: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 2px 0",
  },
  deadlineType: {
    color: "#71717a",
    fontSize: "12px",
    margin: "0",
  },
  deadlineDateCell: {
    textAlign: "right" as const,
    verticalAlign: "top" as const,
    paddingRight: "12px",
  },
  deadlineDate: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 2px 0",
  },
  deadlineDays: {
    fontSize: "12px",
    fontWeight: "700" as const,
    margin: "0",
  },
  deadlineAction: {
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
  divider: {
    borderTop: "2px solid #e4e4e7",
    margin: "24px 0",
  },
  activitySection: {
    marginBottom: "24px",
  },
  activityHeader: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 16px 0",
  },
  activityRow: {
    padding: "10px 0",
    borderBottom: "1px solid #e4e4e7",
  },
  activityContent: {
    verticalAlign: "top" as const,
  },
  activityCase: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "500" as const,
    margin: "0 0 2px 0",
  },
  activityChange: {
    color: "#71717a",
    fontSize: "13px",
    margin: "0",
  },
  activityTime: {
    textAlign: "right" as const,
    verticalAlign: "top" as const,
  },
  activityTimeText: {
    color: "#a1a1aa",
    fontSize: "12px",
    margin: "0",
  },
  moreActivity: {
    color: "#71717a",
    fontSize: "13px",
    fontStyle: "italic" as const,
    margin: "12px 0 0 0",
  },
  ctaSection: {
    textAlign: "center" as const,
    marginTop: "24px",
  },
  ctaButton: {
    display: "inline-block",
    backgroundColor: "#18181b",
    color: "#ffffff",
    padding: "14px 28px",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    border: "3px solid #000000",
    boxShadow: "4px 4px 0 #000000",
  },
} as const;

export default WeeklyDigest;
