/**
 * RfeAlert Email Template
 * Sent when an RFE (Request for Evidence) is received or deadline approaches.
 *
 * Features:
 * - High urgency styling (RFEs are time-sensitive)
 * - RFE details and due date
 * - Days remaining indicator
 * - CTA to view case
 *
 * Phase: 24 (Notifications + Email)
 * Status: PLACEHOLDER - Implementation in Task 3
 */

import { Text, Section } from "@react-email/components";
import { EmailLayout, EmailButton, EmailHeader } from "./components";
import { labelStyle, valueStyle, valueHighlightStyle } from "./components/emailStyles";

export interface RfeAlertProps {
  /** Beneficiary name */
  beneficiaryName: string;
  /** Company/employer name */
  companyName: string;
  /** RFE due date in human-readable format */
  dueDate: string;
  /** Days until due date (negative = overdue) */
  daysRemaining: number;
  /** When the RFE was received */
  receivedDate: string;
  /** Type of alert: new RFE received or reminder */
  alertType: "new" | "reminder";
  /** URL to view the case */
  caseUrl: string;
  /** Case reference number */
  caseNumber?: string;
  /** Related I-140 filing date if applicable */
  i140FilingDate?: string;
}

/**
 * Email template for RFE (Request for Evidence) alerts.
 * RFEs typically have 30-87 day response windows depending on USCIS requirements.
 */
export function RfeAlert({
  beneficiaryName,
  companyName,
  dueDate,
  daysRemaining,
  receivedDate,
  alertType,
  caseUrl,
  caseNumber,
  i140FilingDate,
}: RfeAlertProps) {
  const isOverdue = daysRemaining <= 0;
  const isUrgent = daysRemaining <= 14;
  const urgency = isOverdue ? "overdue" : isUrgent ? "urgent" : "high";

  const title =
    alertType === "new" ? "New RFE Received" : "RFE Response Due Soon";
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
            A Request for Evidence has been received from USCIS regarding the
            I-140 petition. Timely response is critical.
          </Text>
        </Section>
      )}

      <Section style={styles.details}>
        <Text className="em-text-secondary" style={labelStyle}>Foreign Worker</Text>
        <Text className="em-text" style={valueStyle}>{beneficiaryName}</Text>

        <Text className="em-text-secondary" style={labelStyle}>Company</Text>
        <Text className="em-text" style={valueStyle}>{companyName}</Text>

        {i140FilingDate && (
          <>
            <Text className="em-text-secondary" style={labelStyle}>I-140 Filing Date</Text>
            <Text className="em-text" style={valueStyle}>{i140FilingDate}</Text>
          </>
        )}

        <Text className="em-text-secondary" style={labelStyle}>RFE Received</Text>
        <Text className="em-text" style={valueStyle}>{receivedDate}</Text>

        <Text className="em-text-secondary" style={labelStyle}>Response Due</Text>
        <Text className="em-text" style={valueHighlightStyle}>{dueDate}</Text>

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
          View RFE Details
        </EmailButton>
      </Section>

      <Section className="em-alert-red" style={styles.warning}>
        <Text className="em-alert-red-text" style={styles.warningText}>
          ⚠️ Failure to respond to an RFE within the specified timeframe may
          result in denial of the I-140 petition and loss of the PERM labor
          certification priority date.
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

/** Preview props for React Email dev server (new-RFE variant). */
RfeAlert.PreviewProps = {
  beneficiaryName: "B. Chen",
  companyName: "Acme Inc",
  dueDate: "August 12, 2026",
  daysRemaining: 12,
  receivedDate: "June 24, 2026",
  alertType: "new",
  caseUrl: "https://permtracker.app/cases/abc123",
  caseNumber: "PT-1042",
  i140FilingDate: "May 30, 2026",
} satisfies RfeAlertProps;

export default RfeAlert;
