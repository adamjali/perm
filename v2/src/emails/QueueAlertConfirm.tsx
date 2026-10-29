/**
 * Double opt-in confirmation for a DOL queue alert.
 *
 * One job: get one click. Everything else on the page is subordinate to the
 * confirm button, which is why this email carries NO onward links at all.
 *
 * It used to ship an "Also on PERM Tracker" list of two. Both of them lead out
 * of an opt-in the reader has not completed, and a confirmation is the one
 * email in the set with a conversion rate to protect. The links are not lost:
 * every one of them is in the alert this confirms.
 *
 * The stamp shows the month the reader typed, not a figure of ours. That is the
 * one piece of real work this email does beyond the button: a mistyped month
 * produces an alert that fires at the wrong time, and it is far cheaper to
 * catch here than a year later.
 *
 * @module
 */

import { Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout, QueueStamp } from "./components";
import { SANS_STACK } from "./components/QueueStamp";
import type { MailLang } from "../lib/i18n/mailLang";
import { QUEUE_CONFIRM_TEXT } from "./i18n/confirm";

export interface QueueAlertConfirmProps {
  /** Filing month, formatted for display (e.g. "September 2024"). */
  filingMonth: string;
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
  /**
   * Which DOL queue this alert watches, in prose ("PERM analyst-review
   * queue", "prevailing-wage queue (OEWS)"). Defaults to the PERM wording so
   * every existing caller and stored link keeps reading exactly as before.
   */
  queueName?: string;
  /** "filing month" for PERM, "submission month" for PWD. */
  monthNoun?: string;
  /**
   * True when the subscriber also ticked the product-news box, so the same
   * confirm click opts them into that as well.
   *
   * A plain sentence, never a link and never a second button: this email has
   * one job and everything on it is subordinate to the confirm button. But the
   * sentence has to be here, because a click that confirms two things is only
   * consent for the second if the email said so.
   */
  includesNews?: boolean;
  /** Whether this is the PERM queue (filing month) or a wage queue (submission month). */
  perm?: boolean;
  /** The reader’s language. English when not given. */
  lang?: MailLang;
}

export function QueueAlertConfirm({
  filingMonth,
  confirmUrl,
  queueName = "PERM queue",
  monthNoun,
  includesNews = false,
  perm = true,
  lang = "en",
}: QueueAlertConfirmProps) {
  const t = QUEUE_CONFIRM_TEXT[lang];
  const noun = monthNoun ?? t.monthNoun(perm);
  return (
    <EmailLayout
      lang={lang}
      previewText={t.preview(filingMonth)}
      hideSettingsLink
      footerText={t.footer(queueName, noun)}
    >
      <QueueStamp eyebrow={t.eyebrow(perm)} month={filingMonth} />

      <Text className="em-text-body" style={styles.body}>
        {t.body(queueName)}
      </Text>

      {includesNews ? (
        <Text className="em-text-secondary" style={styles.newsNote}>
          {t.news}
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
    lineHeight: "22px",
    margin: "0",
  },
} as const;

export default QueueAlertConfirm;
