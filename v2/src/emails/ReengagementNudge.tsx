/**
 * ReengagementNudge Email Template
 *
 * Sent once when a user goes inactive, a warm "your cases are still tracked,
 * here’s the way back in" nudge. If it’s ignored and the user stays inactive,
 * the weekly digest auto-suppresses server-side (the in-app banner explains how
 * to turn it back on). Weekly-only unsubscribe link is included.
 *
 * Matches the shared EmailLayout and greets like every
 * other account email ("Hi Name,").
 */

import { Text, Section, Link } from "@react-email/components";
import { EmailLayout } from "./components";
import { SITE_URL } from "../../convex/lib/links";

export interface ReengagementNudgeProps {
  /** First name (or display name) of the recipient. */
  userName: string;
  /** Number of active cases still being tracked (optional, for a concrete hook). */
  activeCaseCount?: number;
  baseUrl?: string;
  settingsUrl?: string;
  /** One-click unsubscribe URL (omit to hide the link). */
  unsubscribeUrl?: string;
}

export function ReengagementNudge({
  userName,
  activeCaseCount,
  baseUrl = SITE_URL,
  settingsUrl = `${SITE_URL}/settings`,
  unsubscribeUrl,
}: ReengagementNudgeProps) {
  const previewText = "Your PERM cases are still tracked, here’s a quick way back in.";

  const caseLine =
    activeCaseCount && activeCaseCount > 0
      ? `your ${activeCaseCount} PERM ${activeCaseCount === 1 ? "case is" : "cases are"} still being tracked, and we’re still watching every deadline for you.`
      : "your PERM cases are still being tracked, and we’re still watching every deadline for you.";

  return (
    <EmailLayout previewText={previewText} settingsUrl={settingsUrl}>
      <Section style={styles.intro}>
        <Text className="em-text" style={styles.greeting}>
          Hi {userName},
        </Text>
        <Text className="em-text-secondary" style={styles.lead}>
          It&#39;s been a while since you last checked in. Good news: {caseLine}
        </Text>
        <Text className="em-text-secondary" style={styles.lead}>
          Pick up right where you left off.
        </Text>
        <Text className="em-text-muted" style={styles.note}>
          If we don&#39;t hear from you, we&#39;ll pause your weekly case summary to keep your inbox clear. Your deadline reminders keep coming, and you can turn the summary back on anytime in settings.
        </Text>
      </Section>

      <Section style={styles.ctaSection}>
        <Link href={`${baseUrl}/dashboard`} className="em-button-primary" style={styles.ctaButton}>
          Open PERM Tracker
        </Link>
      </Section>

      {unsubscribeUrl && (
        <Section style={styles.unsubSection}>
          <Text className="em-text-muted" style={styles.unsubText}>
            Not tracking PERM cases anymore?{" "}
            <Link href={unsubscribeUrl} className="em-link" style={styles.unsubLink}>
              Unsubscribe from these emails
            </Link>
          </Text>
        </Section>
      )}
    </EmailLayout>
  );
}

const styles = {
  intro: { marginBottom: "24px" },
  greeting: {
    color: "#18181b",
    fontSize: "20px",
    fontWeight: "700" as const,
    margin: "0 0 12px 0",
  },
  lead: {
    color: "#71717a",
    fontSize: "15px",
    lineHeight: "23px",
    margin: "0 0 12px 0",
  },
  note: {
    color: "#a1a1aa",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "12px 0 0 0",
  },
  ctaSection: { textAlign: "center" as const, marginTop: "8px" },
  ctaButton: {
    backgroundColor: "#2ECC40",
    color: "#000001",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    padding: "14px 32px",
    border: "2px solid #000001",
    display: "inline-block",
  },
  unsubSection: { textAlign: "center" as const, marginTop: "20px", paddingTop: "8px" },
  unsubText: {
    color: "#a1a1aa",
    fontSize: "14px",
    lineHeight: "18px",
    margin: "0",
  },
  unsubLink: { color: "#71717a", textDecoration: "underline" },
} as const;

ReengagementNudge.PreviewProps = {
  userName: "Jake",
  activeCaseCount: 3,
  baseUrl: SITE_URL,
  settingsUrl: `${SITE_URL}/settings`,
  unsubscribeUrl: `${SITE_URL}/unsubscribe?token=SAMPLE`,
} satisfies ReengagementNudgeProps;

