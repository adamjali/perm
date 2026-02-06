/**
 * RfiAlert Email Template
 * Sent when an RFI (Request for Information) is received or due date approaches.
 *
 * Features:
 * - High urgency styling (RFIs are time-sensitive)
 * - RFI details and due date
 * - Days remaining indicator
 * - CTA to view case
 *
 * Phase: 24 (Notifications + Email)
 * Status: PLACEHOLDER - Implementation in Task 3
 */

import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailButton, EmailHeader } from "./components";

export interface RfiAlertProps {
  /** Beneficiary name */
  beneficiaryName: string;
  /** Company/employer name */
  companyName: string;
  /** RFI due date in human-readable format */
  dueDate: string;
  /** Days until due date (negative = overdue) */
  daysRemaining: number;
  /** When the RFI was received */
  receivedDate: string;
  /** Type of alert: new RFI received or reminder */
  alertType: "new" | "reminder";
  /** URL to view the case */
  caseUrl: string;
  /** Case reference number */
  caseNumber?: string;
}

/**
 * Email template for RFI (Request for Information) alerts.
 * RFIs have strict 30-day response windows - urgency is critical.
 */
export function RfiAlert({
  beneficiaryName,
  companyName,
  dueDate,
  daysRemaining,
  receivedDate,
  alertType,
  caseUrl,
  caseNumber,
}: RfiAlertProps) {
  const isOverdue = daysRemaining <= 0;
  const isUrgent = daysRemaining <= 7;
  const urgency = isOverdue ? "overdue" : isUrgent ? "urgent" : "high";

  const title =
    alertType === "new" ? "New RFI Received" : "RFI Response Due Soon";
  const previewText = `${title} - ${daysRemaining > 0 ? `${daysRemaining} days remaining` : "OVERDUE"} - ${beneficiaryName}`;

  return (
    <EmailLayout previewText={previewText}>
      <EmailHeader
        title={title}
        subtitle={caseNumber ? `Case #${caseNumber}` : undefined}
        urgency={urgency}
        icon={alertType === "new" ? "📬" : "⏰"}
      />

      {alertType === "new" && (
        <Section className="em-alert-yellow" style={styles.alertBox}>
          <Text className="em-alert-yellow-text" style={styles.alertText}>
            A Request for Information has been received from the DOL. The
            response is due within 30 days of receipt.
          </Text>
        </Section>
      )}

      <Section style={styles.details}>
        <Text className="em-text-secondary" style={styles.label}>Foreign Worker</Text>
        <Text className="em-text" style={styles.value}>{beneficiaryName}</Text>

        <Text className="em-text-secondary" style={styles.label}>Company</Text>
        <Text className="em-text" style={styles.value}>{companyName}</Text>

        <Text className="em-text-secondary" style={styles.label}>RFI Received</Text>
        <Text className="em-text" style={styles.value}>{receivedDate}</Text>

        <Text className="em-text-secondary" style={styles.label}>Response Due</Text>
        <Text className="em-text" style={styles.valueHighlight}>{dueDate}</Text>

        <Text className={isOverdue ? "em-days-overdue" : "em-days-warning"} style={isOverdue ? styles.overdue : styles.daysRemaining}>
          {daysRemaining > 0
            ? `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`
            : daysRemaining === 0
              ? "DUE TODAY - Immediate action required"
              : `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? "s" : ""} OVERDUE`}
        </Text>
      </Section>

      <Section style={styles.cta}>
        <EmailButton href={caseUrl} variant={isOverdue ? "urgent" : "warning"}>
          View RFI Details
        </EmailButton>
      </Section>

      <Section className="em-alert-red" style={styles.warning}>
        <Text className="em-alert-red-text" style={styles.warningText}>
          ⚠️ Failure to respond to an RFI within 30 days may result in denial of
          the PERM application.
        </Text>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  alertBox: {
    backgroundColor: "#fef3c7",
    border: "2px solid #f59e0b",
    padding: "16px",
    marginBottom: "24px",
  },
  alertText: {
    color: "#92400e",
    fontSize: "14px",
    fontWeight: "500" as const,
    margin: "0",
    lineHeight: "20px",
  },
  details: {
    marginBottom: "24px",
  },
  label: {
    color: "#71717a",
    fontSize: "12px",
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 4px 0",
  },
  value: {
    color: "#18181b",
    fontSize: "16px",
    fontWeight: "500" as const,
    margin: "0 0 16px 0",
  },
  valueHighlight: {
    color: "#18181b",
    fontSize: "18px",
    fontWeight: "700" as const,
    margin: "0 0 8px 0",
  },
  daysRemaining: {
    color: "#f97316",
    fontSize: "14px",
    fontWeight: "700" as const,
    margin: "0 0 16px 0",
  },
  overdue: {
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: "700" as const,
    margin: "0 0 16px 0",
    textTransform: "uppercase" as const,
  },
  cta: {
    textAlign: "center" as const,
    marginTop: "24px",
    marginBottom: "24px",
  },
  warning: {
    backgroundColor: "#fef2f2",
    border: "2px solid #fecaca",
    padding: "12px 16px",
  },
  warningText: {
    color: "#991b1b",
    fontSize: "13px",
    fontWeight: "500" as const,
    margin: "0",
    lineHeight: "18px",
  },
} as const;

export default RfiAlert;
