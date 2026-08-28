/**
 * Double opt-in confirmation for a visa-bulletin movement alert.
 *
 * Mirrors QueueAlertConfirm: the one piece of real work beyond the button is
 * showing the series the reader picked, so a mis-click (EB2 instead of EB3,
 * India instead of worldwide) is visible before they confirm it.
 */
import { Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface BulletinAlertConfirmProps {
  /** "EB2 India", "EB3 all countries". */
  seriesLabel: string;
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
}

export function BulletinAlertConfirm({
  seriesLabel,
  confirmUrl,
}: BulletinAlertConfirmProps) {
  return (
    <EmailLayout
      previewText={`Confirm and we’ll email you when the cutoff for ${seriesLabel} moves.`}
      hideSettingsLink
      footerText={`This address was entered to be told when the State Department’s final-action cutoff for ${seriesLabel} moves. It isn’t confirmed yet, so nothing else will be sent.`}
    >
      <Section style={styles.stamp}>
        <Text style={styles.stampEyebrow}>Your series</Text>
        <Text style={styles.stampValue}>{seriesLabel}</Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        You asked to be told when the State Department&rsquo;s final-action
        cutoff for this series moves in a new visa bulletin. Confirm the alert
        and we&rsquo;ll email you when it does.
      </Text>

      <Section style={styles.cta}>
        <EmailButton href={confirmUrl} variant="primary">
          Confirm the alert
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        If you didn&rsquo;t ask for this, ignore it. Nothing will be sent.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  stamp: {
    marginBottom: "24px",
  },
  stampEyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    margin: "0 0 4px 0",
  },
  stampValue: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: "34px",
    margin: 0,
  },
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 24px 0",
  },
  cta: {
    marginBottom: "20px",
  },
  note: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
  },
} as const;
