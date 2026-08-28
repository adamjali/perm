/**
 * The alert itself: a series' final-action cutoff moved in a new bulletin.
 *
 * Before/now, from the State Department's own table, and nothing else. "C"
 * and "U" are expanded because they are opposites that read alike, and a
 * subscriber getting "C -> U" deserves to be told the category shut, in
 * words, not initials.
 */
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface BulletinMovedProps {
  /** "EB2 India". */
  seriesLabel: string;
  /** Bulletin month that changed it, "YYYY-MM". */
  bulletinMonth: string;
  /** Previous cutoff, already expanded to words where C/U. */
  fromCutoff: string;
  /** New cutoff, already expanded to words where C/U. */
  toCutoff: string;
  /** Absolute, purpose-scoped opt-out URL. Pairs with List-Unsubscribe. */
  unsubscribeUrl: string;
}

export function BulletinMoved({
  seriesLabel,
  bulletinMonth,
  fromCutoff,
  toCutoff,
  unsubscribeUrl,
}: BulletinMovedProps) {
  return (
    <EmailLayout
      previewText={`${seriesLabel}: ${fromCutoff} to ${toCutoff}.`}
      hideSettingsLink
      footerText={`You asked to be told when the final-action cutoff for ${seriesLabel} moves. These alerts repeat whenever it does.`}
      footerExtra={
        <Text className="em-text-secondary" style={styles.footerExtra}>
          <Link href={unsubscribeUrl} className="em-link" style={styles.footerLink}>
            Stop these alerts
          </Link>
        </Text>
      }
    >
      <Section style={styles.stamp}>
        <Text style={styles.stampEyebrow}>{seriesLabel} moved</Text>
        <Text style={styles.stampValue}>{toCutoff}</Text>
        <Text className="em-text-secondary" style={styles.provenance}>
          {bulletinMonth} visa bulletin, final action
        </Text>
      </Section>

      <Section className="em-card" style={styles.changeCard}>
        <Text style={styles.changeRow}>
          <span style={styles.changeLabel}>Before&nbsp;&nbsp;</span>
          {fromCutoff}
        </Text>
        <Text style={styles.changeRowLast}>
          <span style={styles.changeLabel}>Now&nbsp;&nbsp;</span>
          {toCutoff}
        </Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        This is the State Department&rsquo;s own published figure. It
        isn&rsquo;t advice and it isn&rsquo;t a prediction of your case.
      </Text>

      <Text className="em-text-secondary" style={styles.note}>
        The full board and 84 months of history:{" "}
        <Link
          href="https://permtracker.app/tools/priority-date-calculator"
          className="em-link"
          style={styles.footerLink}
        >
          permtracker.app/tools/priority-date-calculator
        </Link>
      </Text>
    </EmailLayout>
  );
}

const styles = {
  stamp: {
    marginBottom: "20px",
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
  provenance: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "6px 0 0 0",
  },
  changeCard: {
    padding: "14px 18px",
    marginBottom: "20px",
  },
  changeRow: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 4px 0",
  },
  changeRowLast: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: "24px",
    margin: 0,
  },
  changeLabel: {
    color: "#5A5A5A",
    fontSize: "12px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  },
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  },
  note: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
  },
  footerExtra: {
    fontSize: "13px",
    margin: "8px 0 0 0",
  },
  footerLink: {
    color: "#5A5A5A",
    textDecorationLine: "underline" as const,
  },
} as const;
