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
}

export function QueueAlertConfirm({
  filingMonth,
  confirmUrl,
  queueName = "PERM queue",
  monthNoun = "filing month",
}: QueueAlertConfirmProps) {
  return (
    <EmailLayout
      previewText={`Confirm and we’ll email you once, on the day DOL reaches ${filingMonth}.`}
      hideSettingsLink
      footerText={`This address was entered to be told when the Department of Labor’s ${queueName} reaches a ${monthNoun}. It isn’t confirmed yet, so nothing else will be sent.`}
    >
      <QueueStamp eyebrow={`Your ${monthNoun}`} month={filingMonth} />

      <Text className="em-text-body" style={styles.body}>
        You asked to be told when the Department of Labor&rsquo;s {queueName}{" "}
        reaches this month. Confirm the alert and we&rsquo;ll email you once, on
        the day it happens.
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
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0",
  },
} as const;

export default QueueAlertConfirm;
