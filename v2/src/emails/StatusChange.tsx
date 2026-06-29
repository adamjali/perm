/**
 * StatusChange Email Template
 * Sent when a case status changes (stage or progress status).
 *
 * Features:
 * - Visual status change indicator (from -> to)
 * - Case details
 * - CTA to view case
 * - Dark mode support via CSS classes
 *
 * Phase: 24 (Notifications + Email)
 */

import { Text, Section } from "@react-email/components";
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
        <Text className="em-text-secondary" style={labelStyle}>Foreign Worker</Text>
        <Text className="em-text" style={valueStyle}>{beneficiaryName}</Text>

        <Text className="em-text-secondary" style={labelStyle}>Company</Text>
        <Text className="em-text" style={valueStyle}>{companyName}</Text>
      </Section>

      {/* Status change indicator — table layout for reliable rendering (flex/gap is unsupported in Outlook) */}
      <Section className="em-status-box" style={styles.statusChange}>
        <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
          <tbody>
            <tr>
              <td style={styles.statusBox}>
                <Text className="em-text-secondary" style={styles.statusLabel}>Previous</Text>
                <Text className="em-status-prev" style={styles.statusValue}>{previousStatus}</Text>
              </td>
              <td style={styles.arrowCell}>
                <Text className="em-arrow" style={styles.arrow}>→</Text>
              </td>
              <td style={styles.statusBox}>
                <Text className="em-text-secondary" style={styles.statusLabel}>Current</Text>
                <Text className="em-status-new" style={styles.statusValueNew}>{newStatus}</Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={styles.timestamp}>
        <Text className="em-text-secondary" style={styles.timestampText}>Changed on {changedAt}</Text>
      </Section>

      <Section style={ctaSectionStyle}>
        <EmailButton href={caseUrl}>View Case Details</EmailButton>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  statusChange: {
    backgroundColor: "#f4f4f5",
    padding: "20px",
    border: "2px solid #e4e4e7",
    marginBottom: "24px",
  },
  statusBox: {
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    width: "44%",
  },
  arrowCell: {
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
    width: "12%",
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
    backgroundColor: "#fffffe",
    border: "2px solid #e4e4e7",
    display: "inline-block" as const,
  },
  statusValueNew: {
    color: "#18181b",
    fontSize: "14px",
    fontWeight: "700" as const,
    margin: "0",
    padding: "8px 16px",
    backgroundColor: "#dcfce7",
    border: "2px solid #22c55e",
    display: "inline-block" as const,
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

/** Preview props for React Email dev server. */
StatusChange.PreviewProps = {
  beneficiaryName: "A. Rivera",
  companyName: "Globex Corporation",
  previousStatus: "Recruitment",
  newStatus: "ETA-9089 Filed",
  changeType: "stage",
  changedAt: "June 28, 2026",
  caseUrl: "https://permtracker.app/cases/abc123",
  caseNumber: "PT-1042",
} satisfies StatusChangeProps;

export default StatusChange;
