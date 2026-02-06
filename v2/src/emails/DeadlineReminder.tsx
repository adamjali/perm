/**
 * DeadlineReminder Email Template
 * Sent when a case deadline is approaching.
 *
 * Features:
 * - Urgency color bar based on days remaining (matching v1 logic)
 * - Case details (employer, beneficiary, deadline type)
 * - Clear deadline date and days remaining
 * - CTA to view case
 * - Settings link in footer
 * - Dark mode support via CSS classes
 *
 * Urgency thresholds (from v1):
 * - overdue (<=0): #991B1B (dark red)
 * - urgent (1-7): #DC2626 (red)
 * - high (8-14): #F97316 (orange)
 * - normal (15+): #2563EB (blue)
 *
 * Phase: 24 (Notifications + Email)
 */

import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailButton, EmailHeader } from "./components";
import {
  labelStyle,
  valueStyle,
  detailsSectionStyle,
  ctaSectionStyle,
  getUrgencyLevel,
  getUrgencyColor,
  getUrgencyIcon,
  formatDaysRemaining,
} from "./components/emailStyles";

export interface DeadlineReminderProps {
  /** Employer/company name */
  employerName: string;
  /** Beneficiary name */
  beneficiaryName: string;
  /** Type of deadline (human-readable: "PWD Expiration", "ETA 9089 Filing", etc.) */
  deadlineType: string;
  /** Deadline date in human-readable format (e.g., "January 15, 2025") */
  deadlineDate: string;
  /** Days until deadline (negative = overdue) */
  daysUntil: number;
  /** URL to view the case */
  caseUrl: string;
  /** URL to manage notification settings */
  settingsUrl?: string;
}

/**
 * Email template for deadline reminder notifications.
 * Urgency levels match v1:
 * - overdue (<=0 days): dark red
 * - urgent (1-7 days): red
 * - high (8-14 days): orange
 * - normal (15+ days): blue
 */
export function DeadlineReminder({
  employerName,
  beneficiaryName,
  deadlineType,
  deadlineDate,
  daysUntil,
  caseUrl,
  settingsUrl = "https://permtracker.app/settings",
}: DeadlineReminderProps) {
  const urgency = getUrgencyLevel(daysUntil);
  const urgencyColor = getUrgencyColor(daysUntil);
  const icon = getUrgencyIcon(urgency);

  const urgencyText = daysUntil <= 0
    ? 'OVERDUE'
    : daysUntil === 1
    ? 'Tomorrow'
    : daysUntil <= 7
    ? `${daysUntil} days - Urgent`
    : daysUntil <= 14
    ? `${daysUntil} days - High Priority`
    : `${daysUntil} days`;

  const previewText = daysUntil <= 0
    ? `OVERDUE: ${deadlineType} for ${employerName}`
    : daysUntil <= 7
    ? `Urgent: ${deadlineType} in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`
    : `Reminder: ${deadlineType} in ${daysUntil} days`;

  const buttonVariant = urgency === 'overdue' || urgency === 'urgent' ? 'urgent' : 'default';

  return (
    <EmailLayout previewText={previewText} settingsUrl={settingsUrl}>
      {/* Urgency Banner */}
      <Section style={getBannerStyle(urgencyColor)}>
        <Text style={styles.bannerText}>
          {icon} {urgencyText}
        </Text>
      </Section>

      {/* Main Header */}
      <EmailHeader
        title={`${deadlineType} Deadline`}
        subtitle={`${employerName} - ${beneficiaryName}`}
        urgency={urgency}
      />

      {/* Case Details */}
      <Section style={detailsSectionStyle}>
        <Section className="em-card-bold" style={styles.detailsCard}>
          <Text className="em-text-secondary" style={labelStyle}>Employer</Text>
          <Text className="em-text" style={valueStyle}>{employerName}</Text>

          <Text className="em-text-secondary" style={labelStyle}>Foreign Worker</Text>
          <Text className="em-text" style={valueStyle}>{beneficiaryName}</Text>

          <Text className="em-text-secondary" style={labelStyle}>Deadline Type</Text>
          <Text className="em-text" style={valueStyle}>{deadlineType}</Text>

          <Text className="em-text-secondary" style={labelStyle}>Deadline Date</Text>
          <Text className="em-text" style={styles.dateValue}>{deadlineDate}</Text>
        </Section>

        {/* Days Remaining Callout */}
        <Section style={getDaysCalloutStyle(urgencyColor)}>
          <Text style={styles.daysText}>{formatDaysRemaining(daysUntil)}</Text>
        </Section>
      </Section>

      {/* CTA Button */}
      <Section style={ctaSectionStyle}>
        <EmailButton href={caseUrl} variant={buttonVariant}>
          View Case Details
        </EmailButton>
      </Section>
    </EmailLayout>
  );
}

/**
 * Get banner style with urgency color.
 */
function getBannerStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    padding: "12px 16px",
    textAlign: "center" as const,
    marginBottom: "24px",
    border: "3px solid #000000",
  };
}

/**
 * Get days callout style with urgency color.
 */
function getDaysCalloutStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: color,
    padding: "16px",
    textAlign: "center" as const,
    border: "3px solid #000000",
    marginTop: "16px",
  };
}

/**
 * Inline styles for email client compatibility.
 */
const styles = {
  bannerText: {
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    margin: "0",
  },
  detailsCard: {
    backgroundColor: "#f4f4f5",
    padding: "20px",
    border: "3px solid #000000",
  },
  dateValue: {
    color: "#18181b",
    fontSize: "18px",
    fontWeight: "700" as const,
    margin: "0",
  },
  daysText: {
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0",
  },
} as const;

export default DeadlineReminder;
