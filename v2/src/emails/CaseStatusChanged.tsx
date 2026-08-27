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
 * It says "we saw this change", never "DOL changed this on". Our mirror records
 * when WE observed a move. DOL does not publish when it made one, and the gap
 * between those two facts can be days.
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
import { MONO_STACK, SANS_STACK } from "./components/QueueStamp";

/** The public case page. The email's primary destination. */
export const CASE_PAGE_URL = "https://permtracker.app/perm-case-status";

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
  contextRows,
  contextProvenance,
  rfiRows = null,
  rfiProvenance = null,
  employerRows = null,
  employerProvenance = null,
  employerUrl = null,
  caseUrl,
  unsubscribeUrl,
}: CaseStatusChangedProps) {
  // Three figure groups in one email is a spec sheet. When the RFI funnel is
  // showing it is the more useful of the two, so the employer record stands
  // down rather than both being crammed in.
  const showEmployer =
    employerRows !== null && employerRows.length > 0 && rfiRows === null;

  return (
    <EmailLayout
      previewText={`${caseNumber}${employerName ? ` at ${employerName}` : ""}, as of our latest check.`}
      hideSettingsLink
      footerText={
        isFinal
          ? `You asked to be told when DOL's status for ${caseNumber} changed. It has reached a final status, so this is the last alert for this case.`
          : `You asked to be told when DOL's status for ${caseNumber} changed. We'll email you again if it moves again, and we stop once it's decided.`
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
      ) : (
        <Text className="em-text-body" style={styles.body}>
          DOL doesn&rsquo;t publish what this status means, and we&rsquo;re not
          going to guess at it. The counts below are what we can say.
        </Text>
      )}

      <Text className="em-text-secondary" style={styles.caveat}>
        This is the status our mirror read on its latest check. It isn&rsquo;t a
        decision on your case and it isn&rsquo;t a prediction of one.
      </Text>

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
        <EmailButton href={caseUrl} variant="outline">
          Open this case
        </EmailButton>
      </Section>

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
          {
            href: "https://permtracker.app/perm-processing-times",
            text: "The filing month DOL's queue has reached",
          },
          {
            href: "https://permtracker.app/methodology",
            text: "Where every figure in this email comes from",
          },
        ]}
      />
    </EmailLayout>
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
  footerExtra: {
    color: "#5F5F67",
    fontSize: "12px",
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
    "DOL has asked the employer for more documentation. The response window is 30 days from receipt and it is strict.",
  isFinal: false,
  contextRows: [
    { label: "Cases now at this status", value: "906" },
    { label: "Filed the same month as yours", value: "8,172" },
    { label: "Of those, still pending", value: "7,899" },
    { label: "Pending cases filed earlier", value: "63,603" },
  ],
  contextProvenance:
    "Our mirror of DOL per-case status, 412,865 cases, as of August 26, 2026.",
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
  caseUrl: "https://permtracker.app/perm-case-status?case=P-100-26125-868956",
  unsubscribeUrl:
    "https://example.convex.site/case-alert/unsubscribe?token=abc",
} satisfies CaseStatusChangedProps;

export default CaseStatusChanged;
