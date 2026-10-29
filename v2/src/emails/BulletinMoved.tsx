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
import { SITE_URL } from "../../convex/lib/links";
import type { MailLang } from "../lib/i18n/mailLang";
import { BULLETIN_ALERT_TEXT } from "./i18n/alerts";
import { LAYOUT_TEXT } from "./i18n/layout";

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
  /** The address's preference page, every alert it holds, as a magic link scoped by token. Optional for callers that predate it. */
  prefsUrl?: string;
  /** The reader's language (src/lib/i18n/mailLang.ts). English when not given. */
  lang?: MailLang;
}

export function BulletinMoved({
  seriesLabel,
  bulletinMonth,
  fromCutoff,
  toCutoff,
  unsubscribeUrl,
  prefsUrl,
  lang = "en",
}: BulletinMovedProps) {
  const t = BULLETIN_ALERT_TEXT[lang];
  const L = LAYOUT_TEXT[lang];
  return (
    <EmailLayout
      previewText={t.previewText(seriesLabel, fromCutoff, toCutoff)}
      hideSettingsLink={!prefsUrl}
      settingsUrl={prefsUrl}
      settingsLabel={L.preferences}
      lang={lang}
      footerText={t.footerText(seriesLabel)}
      footerExtra={
        <Text className="em-text-secondary" style={styles.footerExtra}>
          <Link href={unsubscribeUrl} className="em-link" style={styles.footerLink}>
            {L.stopAlerts}
          </Link>
        </Text>
      }
    >
      <Section style={styles.stamp}>
        <Text className="em-text-secondary" style={styles.stampEyebrow}>{t.stampMoved(seriesLabel)}</Text>
        <Text className="em-text" style={styles.stampValue}>{toCutoff}</Text>
        <Text className="em-text-secondary" style={styles.provenance}>
          {t.provenance(bulletinMonth)}
        </Text>
      </Section>

      <Section className="em-card" style={styles.changeCard}>
        <Text className="em-text-body" style={styles.changeRow}>
          <span className="em-text-secondary" style={styles.changeLabel}>{t.before}&nbsp;&nbsp;</span>
          {fromCutoff}
        </Text>
        <Text className="em-text-body" style={styles.changeRowLast}>
          <span className="em-text-secondary" style={styles.changeLabel}>{t.now}&nbsp;&nbsp;</span>
          {toCutoff}
        </Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        {t.body}
      </Text>

      <Text className="em-text-secondary" style={styles.note}>
        {t.note}{" "}
        <Link
          href={`${SITE_URL}/tools/priority-date-calculator`}
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
    fontSize: "14px",
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
    fontSize: "14px",
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
    fontSize: "14px",
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
    fontSize: "14px",
    lineHeight: "20px",
    margin: 0,
  },
  footerExtra: {
    fontSize: "14px",
    margin: "8px 0 0 0",
  },
  footerLink: {
    color: "#5A5A5A",
    textDecorationLine: "underline" as const,
  },
} as const;
