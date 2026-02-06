/**
 * AccountDeletionConfirm Email Template
 * Sent when a user requests account deletion.
 *
 * Features:
 * - 30-day grace period notice
 * - Clear deletion date
 * - Cancel instructions with CTA button
 * - Support link in footer
 *
 * Subject line: "Account Deletion Scheduled - PERM Tracker"
 *
 * Phase: 24 (Notifications + Email) - P1-01 Fix
 */

import { Text, Section, Link } from "@react-email/components";
import * as React from "react";
import { EmailLayout, EmailButton, EmailHeader } from "./components";

export interface AccountDeletionConfirmProps {
  /** User's display name or email */
  userName: string;
  /** Scheduled deletion date in human-readable format (e.g., "February 15, 2025") */
  deletionDate: string;
  /** URL to cancel the deletion (settings page) */
  cancelUrl: string;
  /** URL to contact support */
  supportUrl?: string;
  /** If true, renders "Account Deleted" variant (no cancel CTA, immediate messaging) */
  immediate?: boolean;
}

/**
 * Email template for account deletion confirmation.
 * Informs user of scheduled deletion and provides cancel option.
 */
export function AccountDeletionConfirm({
  userName,
  deletionDate,
  cancelUrl,
  supportUrl = "mailto:support@permtracker.app",
  immediate = false,
}: AccountDeletionConfirmProps) {
  const previewText = immediate
    ? "Your PERM Tracker account has been permanently deleted"
    : `Your PERM Tracker account is scheduled for deletion on ${deletionDate}`;

  return (
    <EmailLayout previewText={previewText}>
      {/* Warning Banner */}
      <Section style={immediate ? styles.bannerImmediate : styles.banner}>
        <Text style={styles.bannerText}>
          {immediate ? "Account Deleted" : "Account Deletion Scheduled"}
        </Text>
      </Section>

      {/* Main Header */}
      <EmailHeader
        title={immediate ? "Account Deleted" : "Account Deletion Request"}
        subtitle={
          immediate
            ? "Your account has been permanently deleted"
            : "We received your request to delete your account"
        }
        urgency="high"
      />

      {/* Details Card */}
      <Section style={styles.details}>
        <Section className="em-card-bold" style={styles.detailsCard}>
          <Text className="em-text" style={styles.greeting}>Hi {userName},</Text>

          {immediate ? (
            <>
              <Text className="em-text-body" style={styles.paragraph}>
                Your PERM Tracker account and all associated data have been
                permanently deleted as requested on:
              </Text>

              <Section style={styles.dateCalloutImmediate}>
                <Text style={styles.dateText}>{deletionDate}</Text>
              </Section>

              <Text className="em-text-body" style={styles.paragraph}>
                The following data has been permanently removed:
              </Text>

              <Text className="em-text-body" style={styles.listItem}>
                All PERM cases and related data
              </Text>
              <Text className="em-text-body" style={styles.listItem}>
                Notification preferences and history
              </Text>
              <Text className="em-text-body" style={styles.listItem}>
                Calendar sync settings
              </Text>
              <Text className="em-text-body" style={styles.listItem}>
                Your user profile
              </Text>
            </>
          ) : (
            <>
              <Text className="em-text-body" style={styles.paragraph}>
                We&apos;ve received your request to delete your PERM Tracker
                account. Your account and all associated data will be permanently
                deleted on:
              </Text>

              <Section style={styles.dateCallout}>
                <Text style={styles.dateText}>{deletionDate}</Text>
              </Section>

              <Text className="em-text-body" style={styles.paragraph}>
                <strong>What happens next:</strong>
              </Text>

              <Text className="em-text-body" style={styles.listItem}>
                You have <strong>30 days</strong> to cancel this request
              </Text>
              <Text className="em-text-body" style={styles.listItem}>
                Your account remains active during this period
              </Text>
              <Text className="em-text-body" style={styles.listItem}>
                All case data, settings, and history will be permanently deleted
              </Text>
              <Text className="em-text-body" style={styles.listItem}>
                This action cannot be undone after the deletion date
              </Text>
            </>
          )}
        </Section>
      </Section>

      {/* Cancel CTA - only for scheduled deletion */}
      {!immediate && (
        <Section style={styles.cta}>
          <Text className="em-text-secondary" style={styles.ctaText}>Changed your mind?</Text>
          <EmailButton href={cancelUrl} variant="default">
            Cancel Account Deletion
          </EmailButton>
        </Section>
      )}

      {/* Support Section */}
      <Section className="em-support-box" style={styles.support}>
        <Text className="em-support-text" style={styles.supportText}>
          If you didn&apos;t request this deletion, please{" "}
          <Link href={supportUrl} className="em-support-link" style={styles.supportLink}>
            contact support immediately
          </Link>
          .
        </Text>
      </Section>
    </EmailLayout>
  );
}

/**
 * Inline styles for email client compatibility.
 */
const styles = {
  banner: {
    backgroundColor: "#F97316", // Orange - high priority
    padding: "12px 16px",
    textAlign: "center" as const,
    marginBottom: "24px",
    border: "3px solid #000001",
  },
  bannerImmediate: {
    backgroundColor: "#DC2626", // Red - immediate/destructive
    padding: "12px 16px",
    textAlign: "center" as const,
    marginBottom: "24px",
    border: "3px solid #000001",
  },
  bannerText: {
    color: "#fffffe",
    fontSize: "16px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    margin: "0",
  },
  details: {
    marginBottom: "24px",
  },
  detailsCard: {
    backgroundColor: "#f4f4f5",
    padding: "20px",
    border: "3px solid #000001",
  },
  greeting: {
    color: "#18181b",
    fontSize: "18px",
    fontWeight: "600" as const,
    margin: "0 0 16px 0",
  },
  paragraph: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  dateCallout: {
    backgroundColor: "#F97316",
    padding: "16px",
    textAlign: "center" as const,
    border: "3px solid #000001",
    marginTop: "8px",
    marginBottom: "16px",
  },
  dateCalloutImmediate: {
    backgroundColor: "#DC2626",
    padding: "16px",
    textAlign: "center" as const,
    border: "3px solid #000001",
    marginTop: "8px",
    marginBottom: "16px",
  },
  dateText: {
    color: "#fffffe",
    fontSize: "20px",
    fontWeight: "700" as const,
    margin: "0",
  },
  listItem: {
    color: "#3f3f46",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 8px 0",
    paddingLeft: "16px",
  },
  cta: {
    textAlign: "center" as const,
    marginTop: "24px",
    marginBottom: "24px",
  },
  ctaText: {
    color: "#71717a",
    fontSize: "14px",
    margin: "0 0 12px 0",
  },
  support: {
    backgroundColor: "#fef3cd",
    padding: "16px",
    border: "2px solid #856404",
    marginTop: "24px",
  },
  supportText: {
    color: "#856404",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0",
  },
  supportLink: {
    color: "#856404",
    fontWeight: "600" as const,
    textDecoration: "underline",
  },
} as const;

export default AccountDeletionConfirm;
