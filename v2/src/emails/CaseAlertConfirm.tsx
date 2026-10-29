/**
 * Double opt-in confirmation for a per-case status alert.
 *
 * One job: get one click. Like `QueueAlertConfirm`, it carries NO onward links,
 * because every one of them leads out of an opt-in the reader has not completed
 * and a confirmation is the one email in the set with a conversion rate to
 * protect. Nothing is lost: they are all in the alert this confirms.
 *
 * ## The real work this email does
 *
 * It echoes the case's CURRENT status and employer back. A mistyped case number
 * is otherwise undetectable: it looks exactly like a real subscription and
 * produces silence for a year. One line here catches it, and the employer name
 * is what catches it, because a person recognises their employer instantly and
 * cannot proofread an 18-character case number.
 *
 * Showing that status to an unconfirmed address is not a leak. The same case
 * number returns the same status on our own public lookup page with no login,
 * because DOL's per-case status is public record. This adds no access anyone
 * did not already have.
 *
 * ## The case we do not hold
 *
 * A freshly filed case is not in our records yet, and that person is precisely
 * the one who wants alerts most, so the subscription is allowed. What this
 * email must not do is promise an alert the moment it appears: our first sight
 * of a case cannot distinguish "it just arrived" from "it has been sitting in
 * this status for eight months and we only started watching now". So the copy
 * promises what the sweep actually does, which is to email on the first move
 * AFTER we start watching. A false alarm is how an alert product loses someone
 * permanently.
 *
 * @module
 */

import { Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout, QueueStamp } from "./components";
import { MONO_STACK, SANS_STACK } from "./components/QueueStamp";
import type { MailLang } from "../lib/i18n/mailLang";
import { CASE_CONFIRM_TEXT } from "./i18n/confirm";

export interface CaseAlertConfirmProps {
  /** DOL case number, normalised, as the reader typed it. */
  caseNumber: string;
  /** The case's current status, or null when the mirror does not hold it. */
  currentStatus?: string | null;
  /** The employer on the case, when the mirror carries one. */
  employerName?: string | null;
  /**
   * The day DOL's record was first seen showing the current status, formatted, or null when unknown. See the
   * note in `CaseStatusChanged`.
   */
  asOf?: string | null;
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
  /**
   * True when the subscriber also ticked the product-news box, so the same
   * confirm click opts them into that as well.
   *
   * A plain sentence, never a link and never a second button: this email
   * carries no onward links and everything on it is subordinate to the confirm
   * button. But the sentence has to be here, because a click that confirms two
   * things is only consent for the second if the email said so.
   */
  includesNews?: boolean;
  /** Optional, default off: links already in inboxes predate it. */
  includesNewsletter?: boolean;
  /**
   * What to call this filing, with its article: "a PERM case", "a prevailing
   * wage request", "an LCA". From `programNounWithArticle` at the call site.
   *
   * A prop rather than a constant because DOL's case-status endpoint serves
   * three programs and this email is sent for all of them. The subject line
   * and the text part were already program-correct; this footer was the one
   * string still saying "a PERM case" over a wage request, which is the kind
   * of wrong that makes a reader doubt the whole subscription.
   */
  nounWithArticle?: string;
  /** The reader's language (src/lib/i18n/mailLang.ts). English when not given. */
  lang?: MailLang;
}

export function CaseAlertConfirm({
  caseNumber,
  currentStatus = null,
  employerName = null,
  asOf = null,
  confirmUrl,
  includesNews = false,
  includesNewsletter = false,
  nounWithArticle = "a PERM case",
  lang = "en",
}: CaseAlertConfirmProps) {
  const known = currentStatus !== null;
  const t = CASE_CONFIRM_TEXT[lang];

  return (
    <EmailLayout
      lang={lang}
      previewText={known ? t.previewKnown : t.previewUnknown}
      hideSettingsLink
      footerText={t.footer(nounWithArticle)}
    >
      <QueueStamp eyebrow={t.eyebrow} month={caseNumber}>
        {known ? (
          <>
            <Text className="em-text-secondary" style={styles.provenance}>
              {t.currently(currentStatus ?? "", employerName)}
            </Text>
            <Text className="em-text-secondary" style={styles.provenance}>
              {asOf ? t.shownSince(asOf) : t.noDate}
            </Text>
          </>
        ) : (
          <Text className="em-text-secondary" style={styles.provenance}>
            {t.notInRecords}
          </Text>
        )}
      </QueueStamp>

      {known ? (
        <>
          <Text className="em-text-body" style={styles.body}>
            {t.bodyKnown}
          </Text>
          <Text className="em-text-secondary" style={styles.lag}>
            {t.lag}
          </Text>
        </>
      ) : (
        <Text className="em-text-body" style={styles.body}>
          {t.bodyUnknown}
        </Text>
      )}

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
  provenance: {
    fontFamily: MONO_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "14px 0 0 0",
  },
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 24px 0",
  },
  lag: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "15px",
    lineHeight: "24px",
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

/** Preview props for the React Email dev server. */
CaseAlertConfirm.PreviewProps = {
  caseNumber: "P-100-26125-868956",
  currentStatus: "IN PROCESS",
  employerName: "Psomagen, Inc.",
  asOf: "August 5, 2026",
  confirmUrl: "https://example.convex.site/case-alert/confirm?token=abc",
} satisfies CaseAlertConfirmProps;

export default CaseAlertConfirm;
