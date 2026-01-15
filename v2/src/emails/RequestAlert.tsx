/**
 * RequestAlert Email Template
 * Unified template for RFI (Request for Information) and RFE (Request for Evidence) alerts.
 *
 * Features:
 * - High urgency styling (both are time-sensitive)
 * - Request details and due date
 * - Days remaining indicator
 * - Type-specific context (DOL vs USCIS, 30 days vs variable)
 * - CTA to view case
 *
 * Phase: Code simplification
 */

import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailButton, EmailHeader } from "./components";
import {
  labelStyle,
  valueStyle,
  valueHighlightStyle,
  detailsSectionStyle,
  ctaSectionStyle,
  getUrgencyLevel,
  formatDaysRemaining,
} from "./components/emailStyles";

export interface RequestAlertProps {
  /** Type of request: RFI or RFE */
  requestType: "rfi" | "rfe";
  /** Beneficiary name */
  beneficiaryName: string;
  /** Company/employer name */
  companyName: string;
  /** Request due date in human-readable format */
  dueDate: string;
  /** Days until due date (negative = overdue) */
  daysRemaining: number;
  /** When the request was received */
  receivedDate: string;
  /** Type of alert: new request received or reminder */
  alertType: "new" | "reminder";
  /** URL to view the case */
  caseUrl: string;
  /** Case reference number */
  caseNumber?: string;
  /** Related I-140 filing date if applicable (RFE only) */
  i140FilingDate?: string;
}

/**
 * Email template for RFI/RFE alerts.
 * Consolidates common logic between the two request types.
 */
export function RequestAlert({
  requestType,
  beneficiaryName,
  companyName,
  dueDate,
  daysRemaining,
  receivedDate,
  alertType,
  caseUrl,
  caseNumber,
  i140FilingDate,
}: RequestAlertProps) {
  const isRfi = requestType === "rfi";
  const urgency = getUrgencyLevel(daysRemaining);

  const requestLabel = isRfi ? "RFI" : "RFE";
  const requestFullName = isRfi
    ? "Request for Information"
    : "Request for Evidence";
  const agency = isRfi ? "DOL" : "USCIS";
  const context = isRfi
    ? "the PERM application"
    : "the I-140 petition";

  const title = alertType === "new"
    ? `New ${requestLabel} Received`
    : `${requestLabel} Response Due Soon`;
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
        <Section style={styles.alertBox}>
          <Text style={styles.alertText}>
            A {requestFullName} has been received from {agency} regarding{" "}
            {context}. {isRfi ? "The response is due within 30 days of receipt." : "Timely response is critical."}
          </Text>
        </Section>
      )}

      <Section style={detailsSectionStyle}>
        <Text style={labelStyle}>Beneficiary</Text>
        <Text style={valueStyle}>{beneficiaryName}</Text>

        <Text style={labelStyle}>Company</Text>
        <Text style={valueStyle}>{companyName}</Text>

        {!isRfi && i140FilingDate && (
          <>
            <Text style={labelStyle}>I-140 Filing Date</Text>
            <Text style={valueStyle}>{i140FilingDate}</Text>
          </>
        )}

        <Text style={labelStyle}>{requestLabel} Received</Text>
        <Text style={valueStyle}>{receivedDate}</Text>

        <Text style={labelStyle}>Response Due</Text>
        <Text style={valueHighlightStyle}>{dueDate}</Text>

        <Text style={daysRemaining <= 0 ? styles.overdue : styles.daysRemaining}>
          {formatDaysRemaining(daysRemaining)}
        </Text>
      </Section>

      <Section style={ctaSectionStyle}>
        <EmailButton href={caseUrl} variant={urgency === 'overdue' ? "urgent" : "warning"}>
          View {requestLabel} Details
        </EmailButton>
      </Section>

      <Section style={styles.warning}>
        <Text style={styles.warningText}>
          ⚠️ {isRfi
            ? "Failure to respond to an RFI within 30 days may result in denial of the PERM application."
            : "Failure to respond to an RFE within the specified timeframe may result in denial of the I-140 petition and loss of the PERM labor certification priority date."}
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
    fontWeight: 500,
    margin: "0",
    lineHeight: "20px",
  },
  daysRemaining: {
    color: "#f97316",
    fontSize: "14px",
    fontWeight: 700,
    margin: "0 0 16px 0",
  },
  overdue: {
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: 700,
    margin: "0 0 16px 0",
    textTransform: "uppercase" as const,
  },
  warning: {
    backgroundColor: "#fef2f2",
    border: "2px solid #fecaca",
    padding: "12px 16px",
  },
  warningText: {
    color: "#991b1b",
    fontSize: "13px",
    fontWeight: 500,
    margin: "0",
    lineHeight: "18px",
  },
} as const;

export default RequestAlert;
