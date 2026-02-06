/**
 * AutoClosure Email Template
 * Sent when a case is automatically closed due to missed deadlines.
 *
 * Features:
 * - Urgent styling with red urgency bar
 * - Clear reason for closure
 * - Case details
 * - CTA to view case
 *
 * Phase: 24 (Notifications + Email)
 */

import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailButton, EmailHeader } from "./components";
import { labelStyle, valueStyle, detailsSectionStyle, ctaSectionStyle } from "./components/emailStyles";

export interface AutoClosureProps {
  /** Beneficiary name */
  beneficiaryName: string;
  /** Company/employer name */
  companyName: string;
  /** Type of deadline violation */
  violationType: string;
  /** Human-readable reason for closure */
  reason: string;
  /** When the case was closed */
  closedAt: string;
  /** URL to view the case */
  caseUrl: string;
  /** Case reference number */
  caseNumber?: string;
}

/**
 * Email template for auto-closure notifications.
 * Uses urgent styling to clearly communicate the case has been closed.
 */
export function AutoClosure({
  beneficiaryName,
  companyName,
  violationType,
  reason,
  closedAt,
  caseUrl,
  caseNumber,
}: AutoClosureProps) {
  const previewText = `Case Automatically Closed: ${beneficiaryName} at ${companyName}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader
        title="Case Automatically Closed"
        subtitle={caseNumber ? `Case #${caseNumber}` : undefined}
        urgency="urgent"
        icon="🚨"
      />

      <Section style={detailsSectionStyle}>
        <Text className="em-text-secondary" style={labelStyle}>Foreign Worker</Text>
        <Text className="em-text" style={valueStyle}>{beneficiaryName}</Text>

        <Text className="em-text-secondary" style={labelStyle}>Company</Text>
        <Text className="em-text" style={valueStyle}>{companyName}</Text>
      </Section>

      {/* Closure reason box */}
      <Section className="em-closure-box" style={styles.closureBox}>
        <Text className="em-closure-title" style={styles.closureTitle}>Closure Reason</Text>
        <Text style={styles.closureType}>{violationType}</Text>
        <Text className="em-closure-reason" style={styles.closureReason}>{reason}</Text>
      </Section>

      <Section style={styles.timestamp}>
        <Text className="em-text-secondary" style={styles.timestampText}>Closed on {closedAt}</Text>
      </Section>

      <Section className="em-info-box" style={styles.infoBox}>
        <Text className="em-info-text" style={styles.infoText}>
          This case was automatically closed because a critical deadline was
          missed. If this was in error, you can reopen the case from the case
          details page.
        </Text>
      </Section>

      <Section style={ctaSectionStyle}>
        <EmailButton href={caseUrl}>View Case Details</EmailButton>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  closureBox: {
    backgroundColor: "#fef2f2",
    padding: "20px",
    border: "2px solid #dc2626",
    marginBottom: "24px",
  },
  closureTitle: {
    color: "#991b1b",
    fontSize: "12px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 8px 0",
  },
  closureType: {
    color: "#dc2626",
    fontSize: "18px",
    fontWeight: "700" as const,
    margin: "0 0 8px 0",
  },
  closureReason: {
    color: "#7f1d1d",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0",
  },
  timestamp: {
    textAlign: "center" as const,
    marginBottom: "16px",
  },
  timestampText: {
    color: "#71717a",
    fontSize: "13px",
    margin: "0",
  },
  infoBox: {
    backgroundColor: "#f4f4f5",
    padding: "16px",
    border: "2px solid #e4e4e7",
    marginBottom: "24px",
  },
  infoText: {
    color: "#52525b",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0",
  },
} as const;

export default AutoClosure;
