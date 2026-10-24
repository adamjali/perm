/**
 * The alert: DOL's status for one specific case has moved.
 *
 * ## The sentences this email is not allowed to get wrong
 *
 * It never predicts a decision, a date, or odds. Every number below is a count
 * over a population that is named next to it, with the date it was observed.
 * That constraint is what makes the email worth opening: a person who has
 * waited fourteen months has been told plenty of guesses already, and the only
 * thing we can offer that nobody else does is figures that are checkable.
 *
 * ## Whose record, and since when
 *
 * The status is DOL's, and the email says so. Its date is the day our sweep first saw DOL's record show the
 * status (`fetched_at`), worded "since at least": DOL's change can't be later than that day, and may be a little
 * earlier. Until Oct 24 2026 it printed a retired mirror's July stamp instead.
 *
 * `fromStatus` and `toStatus` both arrive as props and both are always present.
 * The sweep only sends when it has two known, different statuses, so this
 * template never has to render a half-transition, and it must never be given
 * one: a rail with an empty top stop would read as "your case started here".
 *
 * ## What it deliberately does not include
 *
 * A percentage anywhere near this reader's own case. The employer block gives
 * counts ("44 of 47 certified") rather than a rate, because a rate over n=47
 * reads as precision the sample cannot carry and a denominator you have to
 * work out is a denominator nobody works out.
 *
 * The RFI funnel, which is the one genuinely reassuring figure here, appears on
 * exactly one status. Pasting it into a denial would be grotesque, and
 * `showsRfiFunnel` in the vocabulary module is the single place that decides.
 *
 * @module
 */

import { Link, Section, Text } from "@react-email/components";
import {
  EmailButton,
  EmailLayout,
  EmailLinkList,
  FigureTable,
  StatusRail,
} from "./components";
import type { FigureRow } from "./components/FigureTable";
import { RatingRow } from "./components/RatingRow";
import { MONO_STACK, SANS_STACK } from "./components/QueueStamp";
import { SITE_URL } from "../../convex/lib/links";
import type { NextLink, NextSteps } from "../../convex/lib/alertNextSteps";

/** The public case page. The email's primary destination. */
export const CASE_PAGE_URL = `${SITE_URL}/perm-case-status`;

export interface CaseStatusChangedProps {
  /** DOL case number, normalised, e.g. "P-100-26125-868956". */
  caseNumber: string;
  /** The employer on the case, when the mirror carries one. */
  employerName?: string | null;
  /** The job title on the case, when the mirror carries one. */
  jobTitle?: string | null;

  /** The status the case has left. */
  fromStatus: string;
  /** The status the case is in now. */
  toStatus: string;
  /** Lime fill when the case is still live or ended certified, paper otherwise. */
  tone: "live" | "closed";
  /** One sourced sentence about the new status, or null when we cannot source one. */
  meaning?: string | null;
  /** True when this status is final, so the subscription retires itself. */
  isFinal: boolean;
  /**
   * The day DOL's record was first seen showing the new status, formatted, or null when unknown.
   *
   * A null renders its own sentence rather than being dropped: a missing date silently omitted reads as a fresh
   * observation.
   */
  observedAt?: string | null;

  /** Counts about where the case sits, already formatted. */
  contextRows: readonly FigureRow[];
  /** Provenance for `contextRows`. Names the source and the as-of date. */
  contextProvenance: string;

  /** The RFI outcome funnel, on RFI alerts only. */
  rfiRows?: readonly FigureRow[] | null;
  /** Provenance for `rfiRows`. */
  rfiProvenance?: string | null;

  /** The employer's own record in DOL's decided corpus, when we can match it. */
  employerRows?: readonly FigureRow[] | null;
  /** Provenance for `employerRows`. */
  employerProvenance?: string | null;
  /** Deep link to the employer's page, when one exists. */
  employerUrl?: string | null;

  /** Absolute link to this case on the public lookup page. */
  caseUrl: string;
  /** Absolute, purpose-scoped opt-out URL. Pairs with List-Unsubscribe. */
  unsubscribeUrl: string;
  /** The address's preference page, every alert it holds, as a magic link scoped by token. Optional for callers that predate it. */
  prefsUrl?: string;
  /**
   * The case page's timeline form, sent only when a PERM case has just been
   * CERTIFIED. After certification the public record stops: USCIS publishes
   * nothing per case, so the only way the next person learns how long the
   * I-140 and I-485 take is from people like this reader adding their dates.
   * Optional because mail already built by older callers must still render.
   */
  timelineUrl?: string | null;
  /**
   * The feedback page with its token, for the "how useful were these alerts"
   * row. Shown on the final email only, when the sender passes it; the page it
   * opens is what records the score, never the link itself.
   */
  ratingUrl?: string | null;
  /**
   * What comes next, on a final status: the step after this one and the alert
   * that helps with it (convex/lib/alertNextSteps.ts). Null on a status with
   * nothing honest to add.
   */
  next?: NextSteps | null;
  /**
   * The "Also on PERM Tracker" links after the employer's own page. Omitted by
   * older callers, which get the two links every alert carried before Oct 16
   * 2026; the sweep passes `alsoLinksFor`, which names DOL's PERM queue only
   * to someone still waiting in it.
   */
  alsoLinks?: readonly NextLink[];
}

export function CaseStatusChanged({
  caseNumber,
  employerName = null,
  jobTitle = null,
  fromStatus,
  toStatus,
  tone,
  meaning = null,
  isFinal,
  observedAt = null,
  contextRows,
  contextProvenance,
  rfiRows = null,
  rfiProvenance = null,
  employerRows = null,
  employerProvenance = null,
  employerUrl = null,
  caseUrl,
  unsubscribeUrl,
  prefsUrl,
  timelineUrl = null,
  ratingUrl = null,
  next = null,
  alsoLinks,
}: CaseStatusChangedProps) {
  // Three figure groups in one email is a spec sheet. When the RFI funnel is
  // showing it is the more useful of the two, so the employer record stands
  // down rather than both being crammed in.
  const showEmployer =
    employerRows !== null && employerRows.length > 0 && rfiRows === null;

  return (
    <EmailLayout
      previewText={
        // "Example Systems, Inc." already ends the sentence; a second period read "Inc..".
        `${caseNumber}${employerName ? ` at ${employerName}` : ""}`.replace(/\.?$/, ".") +
        (observedAt ? ` DOL\u2019s record has shown it since at least ${observedAt}.` : "")
      }
      hideSettingsLink={!prefsUrl}
      settingsUrl={prefsUrl}
      settingsLabel="Email preferences"
      footerText={
        isFinal
          ? `You asked to be told when DOL's status for ${caseNumber} changed. DOL has decided it; we'll keep watching for a year in case it's appealed or reopened, and email you only if it moves.`
          : `You asked to be told when DOL's status for ${caseNumber} changed. We'll email you again if it moves again.`
      }
      footerExtra={
        <Text className="em-text-secondary" style={styles.footerExtra}>
          <Link
            href={unsubscribeUrl}
            className="em-link"
            style={styles.footerLink}
          >
            Stop these alerts
          </Link>
        </Text>
      }
    >
      {/*
        The identity block, above the rail and quieter than it. The case number
        is how the reader knows which of their cases this is, not what the
        email is about, so it is set at reading size in the data face rather
        than as a headline.
      */}
      <Section style={styles.identity}>
        <Text className="em-text" style={styles.caseNumber}>
          {caseNumber}
        </Text>
        {employerName ? (
          <Text className="em-text-secondary" style={styles.employer}>
            {employerName}
            {jobTitle ? `, ${jobTitle}` : ""}
          </Text>
        ) : null}
      </Section>

      <StatusRail fromStatus={fromStatus} toStatus={toStatus} tone={tone} />

      {meaning ? (
        <Text className="em-text-body" style={styles.body}>
          {meaning}
        </Text>
      ) : next ? null : (
        // With "What comes next" below, the reader has the step that follows;
        // saying we won't guess at the status right above it read as a contradiction.
        <Text className="em-text-body" style={styles.body}>
          DOL doesn&rsquo;t publish what this status means, and we&rsquo;re not
          going to guess at it. The counts below are what we can say.
        </Text>
      )}

      <Text className="em-text-secondary" style={styles.caveat}>
        {observedAt
          ? `DOL\u2019s record has shown this status since at least ${observedAt}.`
          : "We don\u2019t have a date for when DOL\u2019s record first showed this status."}
        {/* A final status IS DOL's decision, so the disclaimer written for the
            statuses before one would contradict the email (fixed Oct 6 2026). */}
        {isFinal ? null : (
          <>
            {" "}
            It isn&rsquo;t a decision on your case and it isn&rsquo;t a prediction
            of one.
          </>
        )}
      </Text>

      {next ? <NextStepsBlock next={next} /> : null}

      {rfiRows && rfiRows.length > 0 ? (
        <>
          <FigureTable
            heading="RFIs that have since resolved"
            rows={rfiRows}
            provenance={rfiProvenance ?? ""}
          />
          <Text className="em-text-secondary" style={styles.caveatAfterTable}>
            That&rsquo;s a count of other cases and the population it came from.
            It says nothing about how yours resolves.
          </Text>
        </>
      ) : null}

      <FigureTable
        heading="Where this sits"
        rows={contextRows}
        provenance={contextProvenance}
      />

      {showEmployer && employerRows ? (
        <FigureTable
          heading="This employer in DOL's decided record"
          rows={employerRows}
          provenance={employerProvenance ?? ""}
        />
      ) : null}

      <Section style={styles.cta}>
        <EmailButton href={caseUrl} variant="primary">
          Open this case
        </EmailButton>
      </Section>

      {timelineUrl ? (
        <Section style={styles.ask}>
          <Text className="em-text-body" style={styles.body}>
            After certification the public record stops. USCIS doesn&rsquo;t
            publish the I-140 or the I-485 case by case, so the only way the
            next person learns how long they take is from people who went
            through them. When yours move, you can add the dates to this case.
            PERM Tracker checks your PERM dates against DOL, keeps the case
            number off the public board, and shows your timeline there only if
            you tick the box.
          </Text>
          <EmailButton href={timelineUrl} variant="outline">
            Add your dates when they come
          </EmailButton>
        </Section>
      ) : null}

      {isFinal && ratingUrl ? (
        <RatingRow question="How useful were these alerts?" baseUrl={ratingUrl} />
      ) : null}

      <EmailLinkList
        label="Also on PERM Tracker"
        items={[
          ...(showEmployer && employerUrl
            ? [
                {
                  href: employerUrl,
                  text: "Every PERM decision DOL has published for this employer",
                },
              ]
            : []),
          ...(alsoLinks ?? [
            {
              href: `${SITE_URL}/perm-processing-times`,
              text: "The filing month DOL's queue has reached",
            },
            {
              href: `${SITE_URL}/methodology`,
              text: "Where every figure in this email comes from",
            },
          ]),
        ]}
      />
    </EmailLayout>
  );
}

/**
 * The step after this one, set apart by a lime rule so it reads as the
 * email's second message rather than another table. One optional outline
 * button (the onward alert), then plain links.
 */
function NextStepsBlock({ next }: { next: NextSteps }) {
  return (
    <Section style={styles.next}>
      <Text className="em-text" style={styles.nextHeading}>
        What comes next
      </Text>
      {next.steps.map((s) => (
        <Text key={s.title} className="em-text-body" style={styles.nextStep}>
          <strong>{s.title}.</strong> {s.body}
        </Text>
      ))}
      {next.button ? (
        <Section style={styles.nextButton}>
          <EmailButton href={next.button.href} variant="outline">
            {next.button.text}
          </EmailButton>
        </Section>
      ) : null}
      {next.links.map((l) => (
        <Text key={l.href} style={styles.nextLinkRow}>
          <Link href={l.href} className="em-link-strong" style={styles.nextLink}>
            {l.text}
          </Link>
        </Text>
      ))}
    </Section>
  );
}

const styles = {
  identity: {
    marginBottom: "28px",
  },
  caseNumber: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "15px",
    fontWeight: 700 as const,
    letterSpacing: "0.02em",
    lineHeight: "20px",
    margin: "0",
  },
  employer: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "4px 0 0 0",
  },
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 16px 0",
  },
  caveat: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 4px 0",
  },
  caveatAfterTable: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "15px",
    lineHeight: "24px",
    // Clear of the provenance line above it. At 4px the two read as one block,
    // and they are two different claims: one says where the numbers came from,
    // the other says what they do not mean.
    margin: "18px 0 4px 0",
  },
  cta: {
    marginTop: "32px",
    marginBottom: "4px",
  },
  ask: {
    marginTop: "28px",
    marginBottom: "4px",
  },
  next: {
    margin: "8px 0 28px 0",
    padding: "4px 0 0 16px",
    borderLeft: "4px solid #2ECC40",
  },
  nextHeading: {
    fontFamily: SANS_STACK,
    color: "#000001",
    fontSize: "18px",
    fontWeight: 700 as const,
    lineHeight: "24px",
    margin: "0 0 10px 0",
  },
  nextStep: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "25px",
    margin: "0 0 12px 0",
  },
  nextButton: {
    margin: "4px 0 8px 0",
  },
  nextLinkRow: {
    margin: "0",
  },
  nextLink: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "15px",
    fontWeight: 600 as const,
    textDecorationLine: "underline" as const,
    // A standalone link on its own line: inline-block puts the padding inside
    // the hit box, so each one is a 44px tap target like the link list's.
    display: "inline-block",
    padding: "12px 0",
    lineHeight: "20px",
  },
  footerExtra: {
    color: "#5F5F67",
    fontSize: "14px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLink: {
    color: "#5F5F67",
    textDecoration: "underline",
    // 18px as plain inline text, under the 44px floor, and this is a
    // standalone control on its own line so the floor binds. `inline-block` is
    // what puts the padding inside the hit box: a taller line-height would look
    // bigger and still be 18px to a thumb.
    display: "inline-block",
    padding: "13px 4px",
  },
} as const;

/** Preview props for the React Email dev server. Real figures from the mirror. */
CaseStatusChanged.PreviewProps = {
  caseNumber: "P-100-26125-868956",
  employerName: "Psomagen, Inc.",
  jobTitle: "Senior Biomedical Laboratory Technologist",
  fromStatus: "IN PROCESS",
  toStatus: "RFI ISSUED",
  tone: "live",
  meaning:
    "DOL has asked the employer for more documentation. The deadline is the one printed on the RFI letter, because DOL doesn't publish a standard response window for these.",
  isFinal: false,
  observedAt: "August 5, 2026",
  contextRows: [
    { label: "Cases now at this status", value: "906" },
    { label: "Filed the same month as yours", value: "8,172" },
    { label: "Of those, still pending", value: "7,899" },
    { label: "Pending cases filed earlier", value: "63,603" },
  ],
  contextProvenance:
    "Counted from DOL's own case status, checked daily, as of August 26, 2026.",
  rfiRows: [
    { label: "Resolved RFIs observed", value: "2,151" },
    { label: "Of those, ended certified", value: "1,799" },
    { label: "Ended denied", value: "210" },
    { label: "Withdrawn", value: "142" },
  ],
  rfiProvenance:
    "Observed across 211,719 tracked cases. Underlying source: DOL case status on flag.dol.gov, as of August 26, 2026.",
  employerRows: null,
  employerProvenance: null,
  employerUrl: null,
  caseUrl: `${SITE_URL}/perm-case-status?case=P-100-26125-868956`,
  unsubscribeUrl:
    "https://example.convex.site/case-alert/unsubscribe?token=abc",
} satisfies CaseStatusChangedProps;

export default CaseStatusChanged;
