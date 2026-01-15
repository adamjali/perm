/**
 * StatusChange Email Template
 * Sent when a case status changes (stage or progress status).
 *
 * Features:
 * - Visual status change indicator (from -> to)
 * - Case details
 * - CTA to view case
 *
 * Phase: 24 (Notifications + Email)
 * Status: PLACEHOLDER - Implementation in Task 2
 */

import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailButton, EmailHeader } from "./components";
import { labelStyle, valueStyle, detailsSectionStyle, ctaSectionStyle } from "./components/emailStyles";

export interface StatusChangeProps {
  /** Beneficiary name */
  beneficiaryName: string;
  /** Company/employer name */
  companyName: string;
  /** Previous status */
  previousStatus: string;
  /** New status */
  newStatus: string;
  /** Type of status change */
  changeType: "stage" | "progress";
  /** When the change occurred */
  changedAt: string;
  /** URL to view the case */
  caseUrl: string;
  /** Case reference number */
  caseNumber?: string;
}

/**
 * Email template for status change notifications.
 * Shows clear before/after status with visual indicator.
 */
export function StatusChange({
  beneficiaryName,
  companyName,
  previousStatus,
  newStatus,
  changeType,
  changedAt,
  caseUrl,
  caseNumber,
}: StatusChangeProps) {
  const previewText = `Case status changed: ${previousStatus} → ${newStatus} - ${beneficiaryName}`;
  const title =
    changeType === "stage" ? "Case Stage Updated" : "Case Progress Updated";

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader
        title={title}
        subtitle={caseNumber ? `Case #${caseNumber}` : undefined}
        urgency="normal"
        icon="📋"
      />

      <Section style={detailsSectionStyle}>
        <Text style={labelStyle}>Beneficiary</Text>
        <Text style={valueStyle}>{beneficiaryName}</Text>

        <Text style={labelStyle}>Company</Text>
        <Text style={valueStyle}>{companyName}</Text>
      </Section>

      {/* Status change indicator */}
      <Section style={styles.statusChange}>
        <div style={styles.statusBox}>
          <Text style={styles.statusLabel}>Previous</Text>
          <Text style={styles.statusValue}>{previousStatus}</Text>
        </div>
        <Text style={styles.arrow}>→</Text>
        <div style={styles.statusBox}>
          <Text style={styles.statusLabel}>Current</Text>
          <Text style={styles.statusValueNew}>{newStatus}</Text>
        </div>
      </Section>

      <Section style={styles.timestamp}>
        <Text style={styles.timestampText}>Changed on {changedAt}</Text>
      </Section>

      <Section style={ctaSectionStyle}>
        <EmailButton href={caseUrl}>View Case Details</EmailButton>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  statusChange: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: "16px",
    backgroundColor: "#f4f4f5",
    padding: "20px",
    border: "2px solid #e4e4e7",
    marginBottom: "24px",
  },
  statusBox: {
    textAlign: "center" as const,
  },
  statusLabel: {
    color: "#71717a",
    fontSize: "11px",
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    margin: "0 0 8px 0",
  },
  statusValue: {
    color: "#71717a",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0",
    padding: "8px 16px",
    backgroundColor: "#ffffff",
    border: "2px solid #e4e4e7",
  },
  statusValueNew: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "700" as const,
    margin: "0",
    padding: "8px 16px",
    backgroundColor: "#dcfce7",
    border: "2px solid #22c55e",
  },
  arrow: {
    fontSize: "24px",
    fontWeight: "700" as const,
    color: "#22c55e",
    margin: "0",
  },
  timestamp: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  timestampText: {
    color: "#71717a",
    fontSize: "13px",
    margin: "0",
  },
} as const;

export default StatusChange;
