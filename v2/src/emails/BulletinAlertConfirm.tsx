/**
 * Double opt-in confirmation for a visa-bulletin movement alert.
 *
 * Mirrors QueueAlertConfirm: the one piece of real work beyond the button is
 * showing the series the reader picked, so a mis-click (EB2 instead of EB3,
 * India instead of worldwide) is visible before they confirm it.
 */
import { Section, Text } from "@react-email/components";
import type { MailLang } from "../lib/i18n/mailLang";
import { BULLETIN_CONFIRM_TEXT } from "./i18n/confirm";
import { EmailButton, EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface BulletinAlertConfirmProps {
  /** "EB2 India", "EB3 all countries". */
  seriesLabel: string;
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
  /**
   * True when the subscriber also ticked the product-news box, so the same
   * confirm click opts them into that as well.
   *
   * A plain sentence, never a link and never a second button: like its two
   * siblings this email carries no onward links and everything on it is
   * subordinate to the confirm button. But the sentence has to be here,
   * because a click that confirms two things is only consent for the second if
   * the email said so.
   */
  includesNews?: boolean;
  /** Optional, default off: links already in inboxes predate it. */
  includesNewsletter?: boolean;
  /** The reader’s language. English when not given. */
  lang?: MailLang;
}

export function BulletinAlertConfirm({
  seriesLabel,
  confirmUrl,
  includesNews = false,
  includesNewsletter = false,
  lang = "en",
}: BulletinAlertConfirmProps) {
  const t = BULLETIN_CONFIRM_TEXT[lang];
  return (
    <EmailLayout
      lang={lang}
      previewText={t.preview(seriesLabel)}
      hideSettingsLink
      footerText={t.footer(seriesLabel)}
    >
      <Section style={styles.stamp}>
        <Text className="em-text-secondary" style={styles.stampEyebrow}>{t.eyebrow}</Text>
        <Text className="em-text" style={styles.stampValue}>{seriesLabel}</Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        {t.body}
      </Text>

      {includesNews ? (
        <Text className="em-text-secondary" style={styles.newsNote}>
          {t.news}
        </Text>
      ) : null}
      {includesNewsletter ? (
        <Text className="em-text-secondary" style={styles.newsNote}>
          {t.newsletter}
        </Text>
      ) : null}

      <Section style={styles.cta}>
        <EmailButton href={confirmUrl} variant="primary">
          {t.button}
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        {t.ignore}
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
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 24px 0",
  },
  // Above the button, not below it: a reader who clicks straight away never
  // sees anything under the CTA, and this line has to be read before the click
  // rather than after it.
  newsNote: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 24px 0",
  },
  cta: {
    marginBottom: "20px",
  },
  note: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: 0,
  },
} as const;
