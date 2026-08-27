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
 * A freshly filed case is not in the mirror yet, and that person is precisely
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

export interface CaseAlertConfirmProps {
  /** DOL case number, normalised, as the reader typed it. */
  caseNumber: string;
  /** The case's current status, or null when the mirror does not hold it. */
  currentStatus?: string | null;
  /** The employer on the case, when the mirror carries one. */
  employerName?: string | null;
  /** As-of date for the mirror, formatted for display. */
  asOf?: string | null;
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
}

export function CaseAlertConfirm({
  caseNumber,
  currentStatus = null,
  employerName = null,
  asOf = null,
  confirmUrl,
}: CaseAlertConfirmProps) {
  const known = currentStatus !== null;

  return (
    <EmailLayout
      previewText={
        known
          ? `Confirm and we'll email you when DOL's status for this case changes.`
          : `We don't hold this case number yet. Check it before you confirm.`
      }
      hideSettingsLink
      footerText="This address was entered to be told when a PERM case's status changes. It isn't confirmed yet, so nothing else will be sent."
    >
      <QueueStamp eyebrow="Your case number" month={caseNumber}>
        {known ? (
          <>
            <Text className="em-text-secondary" style={styles.provenance}>
              Currently {currentStatus}
              {employerName ? ` at ${employerName}` : ""}
            </Text>
            {asOf ? (
              <Text className="em-text-secondary" style={styles.provenance}>
                Our mirror of DOL per-case status, as of {asOf}
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="em-text-secondary" style={styles.provenance}>
            Not in our mirror yet
          </Text>
        )}
      </QueueStamp>

      {known ? (
        <Text className="em-text-body" style={styles.body}>
          If that&rsquo;s your case, confirm below and we&rsquo;ll email you
          every time DOL&rsquo;s status for it changes, until it&rsquo;s decided.
          If it isn&rsquo;t, ignore this and enter the number again.
        </Text>
      ) : (
        <Text className="em-text-body" style={styles.body}>
          We don&rsquo;t hold this case number yet, which is normal for a recent
          filing and is also what a typo looks like. Check it against your
          receipt first. Confirm and we&rsquo;ll start watching it, then email
          you the first time its status moves after that.
        </Text>
      )}

      <Section style={styles.cta}>
        <EmailButton href={confirmUrl} variant="primary">
          Confirm these alerts
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        If you didn&rsquo;t ask for this, ignore it. Nothing will be sent.
      </Text>
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

/** Preview props for the React Email dev server. */
CaseAlertConfirm.PreviewProps = {
  caseNumber: "P-100-26125-868956",
  currentStatus: "IN PROCESS",
  employerName: "Psomagen, Inc.",
  asOf: "August 26, 2026",
  confirmUrl: "https://example.convex.site/case-alert/confirm?token=abc",
} satisfies CaseAlertConfirmProps;

export default CaseAlertConfirm;
