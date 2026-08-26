/**
 * The one alert: DOL's queue has reached the subscriber's filing month.
 *
 * ## The sentence this email is not allowed to get wrong
 *
 * An earlier version said "DOL is now adjudicating cases filed then" in every
 * case. That is true only when the frontier has landed exactly on the
 * subscriber's month. When it has run PAST them, which is the ordinary case
 * (`alreadyReached` fires on `filingMonth <= frontier`, so anyone subscribing
 * to an already-passed month is alerted immediately), it is false: DOL is
 * working the later month. An anxious applicant reads it as "my case is being
 * decided right now", which is the exact false hope this product exists not to
 * create. `monthsPast` selects the sentence.
 *
 * The reader's own filing month gets a block of its own ONLY when it differs
 * from the frontier. When the two are equal, a second block repeating the same
 * month is one more thing to relate for no information.
 *
 * Pace is a measurement and stays one. "The queue moved three months over the
 * last six" is arithmetic on two figures DOL published. Anything that turns
 * that into a date for this reader's case is banned, and `paceSentence` gives
 * the template nothing to build one from.
 *
 * Every figure arrives as a prop, so no literal in this file can drift away
 * from the data.
 *
 * @module
 */

import { Link, Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout, EmailLinkList, QueueStamp } from "./components";
import { MONO_STACK, SANS_STACK } from "./components/QueueStamp";

/** DOL's own processing-times page. The figure in the stamp comes from here. */
export const DOL_PROCESSING_TIMES_URL = "https://flag.dol.gov/processingtimes";

export interface QueueReachedProps {
  /** The month DOL's analyst-review queue has reached, formatted for display. */
  frontierMonth: string;
  /** The month this subscriber asked about, formatted for display. */
  filingMonth: string;
  /** DOL's as-of date for the frontier figure, formatted for display. */
  asOf: string;
  /**
   * Whole months the frontier sits beyond the subscriber's filing month.
   *
   * 0 means DOL has landed exactly on their month. Anything above 0 means it
   * has moved past, and changes what this email is allowed to claim.
   */
  monthsPast: number;
  /** One measured sentence about how fast the queue moved, or null. */
  paceLine?: string | null;
  /** Absolute, purpose-scoped opt-out URL. Pairs with List-Unsubscribe. */
  unsubscribeUrl: string;
}

export function QueueReached({
  frontierMonth,
  filingMonth,
  asOf,
  monthsPast,
  paceLine = null,
  unsubscribeUrl,
}: QueueReachedProps) {
  const hasMovedPast = monthsPast > 0;

  return (
    <EmailLayout
      previewText={`The Department of Labor’s published figure, as of ${asOf}.`}
      hideSettingsLink
      footerText={`You asked to be told when the Department of Labor’s PERM queue reached ${filingMonth}. This alert doesn’t repeat.`}
      footerExtra={
        <Text className="em-text-secondary" style={styles.footerExtra}>
          <Link
            href={unsubscribeUrl}
            className="em-link"
            style={styles.footerLink}
          >
            Remove this address
          </Link>
        </Text>
      }
    >
      {/*
        The eyebrow is the predicate, not a third attribution. "Department of
        Labor" here said who published the figure for the third time in one
        email, while the stamp itself said nothing about what the month means.
        "DOL has reached" plus the month is a sentence; the agency is still
        named by the source link directly beneath it.
      */}
      <QueueStamp eyebrow="DOL has reached" month={frontierMonth}>
        <Text className="em-text-secondary" style={styles.provenance}>
          Analyst review, as of {asOf}
        </Text>
        <Text style={styles.sourceLine}>
          <Link
            href={DOL_PROCESSING_TIMES_URL}
            className="em-text-secondary"
            style={styles.sourceLink}
          >
            flag.dol.gov/processingtimes
          </Link>
        </Text>
      </QueueStamp>

      {hasMovedPast ? (
        <Section className="em-card" style={styles.yours}>
          <Text className="qa-yours-label" style={styles.yoursLabel}>
            Your filing month
          </Text>
          <Text className="em-text" style={styles.yoursValue}>
            {filingMonth}
          </Text>
        </Section>
      ) : null}

      <Text className="em-text-body" style={styles.body}>
        {hasMovedPast
          ? `DOL has worked past ${filingMonth} and is now on ${frontierMonth}.`
          : `DOL is now adjudicating cases filed in ${filingMonth}.`}{" "}
        It isn&rsquo;t a decision on your case and it isn&rsquo;t a prediction of
        one.
      </Text>

      {paceLine ? (
        <Text className="em-text-secondary" style={styles.pace}>
          {paceLine}
        </Text>
      ) : null}

      <Section style={styles.cta}>
        <EmailButton
          href="https://permtracker.app/perm-processing-times"
          variant="outline"
        >
          See the current figures
        </EmailButton>
      </Section>

      <EmailLinkList
        label="Also on PERM Tracker"
        items={[
          {
            href: "https://permtracker.app/tools/perm-timeline-calculator",
            text: "The deadlines on your side of the process",
          },
          {
            href: "https://permtracker.app/perm-cases",
            text: "Every PERM decision DOL has published",
          },
        ]}
      />
    </EmailLayout>
  );
}

const styles = {
  provenance: {
    fontFamily: MONO_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "14px 0 0 0",
  },
  sourceLine: {
    margin: "2px 0 0 0",
  },
  sourceLink: {
    fontFamily: MONO_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    textDecoration: "underline",
  },
  yours: {
    backgroundColor: "#F5F5F5",
    border: "2px solid #000001",
    padding: "14px 16px",
    marginBottom: "28px",
  },
  yoursLabel: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    lineHeight: "16px",
    margin: "0 0 6px 0",
  },
  yoursValue: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "17px",
    fontWeight: 700 as const,
    lineHeight: "22px",
    margin: "0",
  },
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 20px 0",
  },
  pace: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 24px 0",
  },
  cta: {
    marginBottom: "4px",
  },
  footerExtra: {
    color: "#5F5F67",
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLink: {
    // The same grey as the sibling footer links. Two near-identical greys in
    // one footer is how a palette starts reading as arbitrary.
    color: "#5F5F67",
    textDecoration: "underline",
    /*
     * Measured at 18px tall as plain inline text, under the 44px floor. This
     * is a standalone control on its own line, so the floor binds.
     *
     * `inline-block` plus padding is what makes the padding part of the hit
     * box. A taller `line-height` would not: the hit area of an inline
     * non-replaced element follows its font-size-derived content box, so the
     * link would still be 18px to a thumb while looking bigger.
     */
    display: "inline-block",
    padding: "13px 4px",
  },
} as const;

export default QueueReached;
