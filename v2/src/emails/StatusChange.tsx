/**
 * StatusChange Email Template
 * Sent when a case's stage or progress changes in the app.
 *
 * The person and employer are the heading, then the change on the same rail
 * the DOL status alert uses (StatusRail): the old stage quiet above, the new
 * one as the solid lime block. No arrow glyph (a font dependency), no pale
 * green chip (owner, Oct 15 2026: lime or dark, never the highlighter green).
 */

import { Text, Section } from "@react-email/components";
import { EmailLayout, EmailButton } from "./components";
import { StatusRail } from "./components/StatusRail";
import { SANS_STACK } from "./components/QueueStamp";
import { ctaSectionStyle } from "./components/emailStyles";
import { SITE_URL } from "../../convex/lib/links";

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

/** A stage that ends the case takes the rail's closed block, not the lime. */
const ENDED = /\b(closed|denied|withdrawn|archived)\b/i;

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
  // A new case has no previous stage: it says so instead of "N/A to Created".
  const isNew = !previousStatus || previousStatus === "N/A";
  const previewText = isNew
    ? `New case: ${beneficiaryName} at ${companyName}, starting at ${newStatus}`
    : `${beneficiaryName} at ${companyName} moved from ${previousStatus} to ${newStatus}`;
  const title = isNew
    ? "New case added"
    : changeType === "stage" ? "Case stage updated" : "Case progress updated";

  return (
    <EmailLayout previewText={previewText}>
      <Text className="em-text-secondary" style={styles.eyebrow}>{title}</Text>
      <Text className="em-text" style={styles.heading}>{`${beneficiaryName} at ${companyName}`}</Text>
      {caseNumber ? (
        <Text className="em-text-secondary" style={styles.caseNumber}>{`Case #${caseNumber}`}</Text>
      ) : null}

      <Section style={styles.railWrap}>
        <StatusRail
          fromStatus={isNew ? undefined : previousStatus}
          toStatus={newStatus}
          tone={ENDED.test(newStatus) ? "closed" : "live"}
          nowLabel={isNew ? "Starting stage" : "Now"}
        />
      </Section>

      <Text className="em-text-secondary" style={styles.when}>{`${isNew ? "Added" : "Changed"} on ${changedAt}`}</Text>

      <Section style={ctaSectionStyle}>
        <EmailButton href={caseUrl}>View case</EmailButton>
      </Section>
    </EmailLayout>
  );
}

const styles = {
  eyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    fontWeight: 700 as const,
    lineHeight: "18px",
    margin: "0 0 6px 0",
  },
  heading: {
    fontFamily: SANS_STACK,
    color: "#141414",
    fontSize: "24px",
    fontWeight: 700 as const,
    lineHeight: "30px",
    margin: "0",
  },
  caseNumber: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "4px 0 0 0",
  },
  railWrap: {
    marginTop: "24px",
  },
  when: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 24px 0",
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
  caseUrl: `${SITE_URL}/cases/abc123`,
  caseNumber: "PT-1042",
} satisfies StatusChangeProps;
