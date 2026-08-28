import Link from "next/link";

/**
 * The homepage FAQ, single-sourced.
 *
 * These seven questions used to exist twice: a plain-text array in page.tsx
 * feeding the FAQPage structured data, and a JSX array in FAQSection feeding
 * the accordion. Google requires the schema text to match the visible text,
 * and two hand-maintained copies drift silently. One list now carries both
 * shapes: `answer` is the canonical plain text (schema), `rich` is the same
 * answer with inline links for the accordion. Editing a question or answer
 * here updates both consumers.
 */

const faqLink =
  "font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary";

export interface HomeFaqItem {
  question: string;
  /** Canonical plain text. This is what the FAQPage schema publishes. */
  answer: string;
  /** The same answer with inline links, for the visible accordion. */
  rich: React.ReactNode;
}

export const HOME_FAQS: HomeFaqItem[] = [
  {
    question:
      "Where do the numbers on the data pages come from?",
    answer:
      "Every figure comes from a government source with the date it was published: DOL's FLAG processing times, DOL's quarterly disclosure files, USCIS's quarterly I-140 counts, and the State Department's visa bulletin. The methodology page lists each source and its cadence, and explains why public estimators disagree with each other.",
    rich: (
      <>
        Every figure comes from a government source with the date it was
        published: DOL&apos;s FLAG processing times, DOL&apos;s quarterly
        disclosure files, USCIS&apos;s quarterly I-140 counts, and the State
        Department&apos;s visa bulletin.{" "}
        <Link href="/methodology" className={faqLink}>How the numbers are computed &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "What exactly does PERM Tracker do?",
    answer:
      "Two things, both free. For the person waiting: check any PERM case number for its live DOL status and a decision estimate, follow the queue with live data, and get an email when your case's status changes. For the person managing cases: enter the case dates once and every critical deadline is computed - PWD expiration, the 30-180 day ETA 9089 filing window, I-140 cutoffs - with email and push reminders and Google Calendar sync.",
    rich: (
      <>
        Two things, both free. For the person waiting:{" "}
        <Link href="/perm-case-status" className={faqLink}>check any PERM case number</Link>{" "}
        for its live DOL status and a decision estimate, follow the queue with
        live data, and get an email when the status changes. For the person
        managing{" "}
        <Link href="/blog/what-is-perm-labor-certification" className={faqLink}>PERM labor certification</Link>{" "}
        cases: enter the case dates once and every critical deadline is
        computed, with email and push reminders and Google Calendar sync.{" "}
        <Link href="/guides/tracking-perm-deadlines" className={faqLink}>See how deadline tracking works &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "How is this different from using a spreadsheet?",
    answer:
      "Spreadsheets require manual deadline math, don’t send reminders, and break when regulations change. PERM Tracker auto-calculates 11 deadline types per case based on DOL regulations (20 CFR 656), sends proactive alerts, validates compliance, and updates all downstream dates when one date changes.",
    rich: (
      <>
        <Link href="/guides/manual-vs-automated-tracking" className={faqLink}>Spreadsheets require manual deadline math</Link>, don&apos;t send reminders, and break when regulations change. PERM Tracker auto-calculates 11 deadline types per case based on DOL regulations (20 CFR 656), sends proactive alerts, validates compliance, and updates all downstream dates when one date changes.
      </>
    ),
  },
  {
    question:
      "Is PERM Tracker really free?",
    answer:
      "Yes, currently free, with no credit card and no case limit. We may introduce paid plans in the future, but the core deadline tracking will remain accessible.",
    rich: "Yes, currently free, with no credit card and no case limit. We may introduce paid plans in the future, but the core deadline tracking will remain accessible.",
  },
  {
    question:
      "Is my client data secure?",
    answer:
      "Sensitive fields like employer FEIN are encrypted with AES-256-GCM. The database runs on Convex\u2019s SOC 2 Type II certified infrastructure on AWS. Your cases are row-level isolated: no other user can see them. Sessions auto-expire after 15 minutes of inactivity.",
    rich: "Sensitive fields like employer FEIN are encrypted with AES-256-GCM. The database runs on Convex\u2019s SOC 2 Type II certified infrastructure on AWS. Your cases are row-level isolated: no other user can see them. Sessions auto-expire after 15 minutes of inactivity.",
  },
  {
    question:
      "Can I import my existing cases?",
    answer:
      "Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard auto-maps your fields and validates data before import. You can also export your data at any time.",
    rich: (
      <>
        Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard auto-maps your fields and validates data before import. You can also export your data at any time.{" "}
        <Link href="/guides/getting-started" className={faqLink}>Getting started tutorial &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "What happens if DOL changes regulations?",
    answer:
      "We monitor DOL regulatory changes and update the deadline calculations accordingly. When regulations change, your existing cases are recalculated automatically. You don’t need to manually update formulas or check for rule changes.",
    rich: (
      <>
        We monitor DOL regulatory changes and update the deadline calculations accordingly. When regulations change, your existing cases are recalculated automatically. You don&apos;t need to manually update formulas or check for rule changes.{" "}
        <Link href="/blog/perm-processing-times-2026" className={faqLink}>Current processing times &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "What notifications can I configure?",
    answer:
      "Without an account: an email when DOL's status for a case you watch changes, when DOL's queue reaches your filing month (PERM or either prevailing-wage queue), or when the visa bulletin moves your cutoff - all double opt-in. With an account: email and push reminders for each deadline type (PWD, recruitment, ETA 9089, I-140, RFI, RFE) at 1 to 30 days before, quiet hours, and a weekly Monday digest.",
    rich: "Without an account: an email when DOL's status for a case you watch changes, when DOL's queue reaches your filing month (PERM or either prevailing-wage queue), or when the visa bulletin moves your cutoff - all double opt-in. With an account: email and push reminders for each deadline type (PWD, recruitment, ETA 9089, I-140, RFI, RFE) at 1 to 30 days before, quiet hours, and a weekly Monday digest.",
  },
];
