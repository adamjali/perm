/**
 * The one alert: DOL's queue has reached the subscriber's filing month.
 *
 * Two months sit on this page and the difference between them is the point. The
 * stamp carries DOL's published frontier; the box beneath carries the month the
 * reader signed up for. When the frontier has run past their month, that gap is
 * the most useful thing in the email, and a single-figure layout would hide it.
 *
 * ## What this email is not allowed to say
 *
 * Reaching a filing month is a queue position, not an outcome. The disclaimer
 * is load-bearing and is carried verbatim from the text part, which was written
 * against the same constraint: no claim here may go beyond what DOL published.
 * Every figure is a prop, so there is no literal in this file that can drift
 * away from the data.
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
  /** Absolute, purpose-scoped opt-out URL. Pairs with List-Unsubscribe. */
  unsubscribeUrl: string;
}

export function QueueReached({
  frontierMonth,
  filingMonth,
  asOf,
  unsubscribeUrl,
}: QueueReachedProps) {
  return (
    <EmailLayout
      previewText={`The Department of Labor's published figure, as of ${asOf}.`}
      hideSettingsLink
      footerText={`You asked to be told when the Department of Labor's PERM queue reached ${filingMonth}. This alert doesn't repeat.`}
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
      <QueueStamp eyebrow="Department of Labor" month={frontierMonth}>
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

      <Section className="em-card" style={styles.yours}>
        <Text className="qa-yours-label" style={styles.yoursLabel}>
          Your filing month
        </Text>
        <Text className="em-text" style={styles.yoursValue}>
          {filingMonth}
        </Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        Reaching your month means DOL is now adjudicating cases filed then. It
        isn&rsquo;t a decision on your case and it isn&rsquo;t a prediction of
        one.
      </Text>

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
          {
            href: "https://permtracker.app/tools/green-card-timeline",
            text: "Where PERM sits in the whole green card path",
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
     * is a standalone control on its own line, unlike the "Privacy | Terms"
     * links beside it which are inline inside a sentence, so the floor binds
     * here and not there.
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
