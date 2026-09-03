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
      "Every figure comes from a government source with the date it was published: DOL's FLAG processing times and quarterly disclosure files, USCIS's I-140 counts, and the State Department's visa bulletin.",
    rich: (
      <>
        Every figure comes from a government source with the date it was
        published: DOL&apos;s FLAG processing times and quarterly disclosure
        files, USCIS&apos;s I-140 counts, and the State Department&apos;s visa
        bulletin.{" "}
        <Link href="/methodology" className={faqLink}>How the numbers are computed &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "What exactly does PERM Tracker do?",
    answer:
      "Two things, both free. If you're waiting: check any DOL case number for its live status and a decision estimate, whether it's a PERM case (G- or A-), a prevailing wage request (P-) or an H-1B LCA (I-), and get an email when the status changes. If you manage cases: enter the case dates once and every deadline is computed, with email and push reminders and Google Calendar sync.",
    rich: (
      <>
        Two things, both free. If you&apos;re waiting:{" "}
        <Link href="/perm-case-status" className={faqLink}>check any DOL case number</Link>{" "}
        for its live status and a decision estimate, whether it&apos;s a PERM case
        (G- or A-), a prevailing wage request (P-) or an H-1B LCA (I-), and get an
        email when the status changes. If you manage{" "}
        <Link href="/blog/what-is-perm-labor-certification" className={faqLink}>PERM labor certification</Link>{" "}
        cases: enter the case dates once and every deadline is computed, with
        email and push reminders and Google Calendar sync.{" "}
        <Link href="/guides/tracking-perm-deadlines" className={faqLink}>See how deadline tracking works &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "How is this different from using a spreadsheet?",
    answer:
      "Spreadsheets require manual deadline math, don’t send reminders, and break when regulations change. PERM Tracker computes 11 deadline types per case under 20 CFR 656, alerts you before each, and updates every downstream date when one changes.",
    rich: (
      <>
        <Link href="/guides/manual-vs-automated-tracking" className={faqLink}>Spreadsheets require manual deadline math</Link>, don&apos;t send reminders, and break when regulations change. PERM Tracker computes 11 deadline types per case under 20 CFR 656, alerts you before each, and updates every downstream date when one changes.
      </>
    ),
  },
  {
    question:
      "Is PERM Tracker really free?",
    answer:
      "Yes: no credit card, no case limit. We may add paid plans later, but the core deadline tracking stays free.",
    rich: "Yes: no credit card, no case limit. We may add paid plans later, but the core deadline tracking stays free.",
  },
  {
    question:
      "Is my client data secure?",
    answer:
      "Sensitive fields like employer FEIN are encrypted with AES-256-GCM. The database runs on Convex\u2019s SOC 2 Type II certified infrastructure on AWS. Cases are row-level isolated, so no other user can see them. Sessions expire after 15 minutes of inactivity.",
    rich: "Sensitive fields like employer FEIN are encrypted with AES-256-GCM. The database runs on Convex\u2019s SOC 2 Type II certified infrastructure on AWS. Cases are row-level isolated, so no other user can see them. Sessions expire after 15 minutes of inactivity.",
  },
  {
    question:
      "Can I import my existing cases?",
    answer:
      "Yes. CSV import for bulk uploads: the wizard auto-maps your fields and validates before importing. You can export at any time.",
    rich: (
      <>
        Yes. CSV import for bulk uploads: the wizard auto-maps your fields and validates before importing. You can export at any time.{" "}
        <Link href="/guides/getting-started" className={faqLink}>Getting started tutorial &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "What happens if DOL changes regulations?",
    answer:
      "We monitor DOL regulatory changes and update the calculations. Your existing cases are recalculated automatically, so there are no formulas to maintain.",
    rich: (
      <>
        We monitor DOL regulatory changes and update the calculations. Your existing cases are recalculated automatically, so there are no formulas to maintain.{" "}
        <Link href="/perm-processing-times" className={faqLink}>Current processing times &rarr;</Link>
      </>
    ),
  },
  {
    question:
      "What notifications can I configure?",
    answer:
      "Without an account, all double opt-in: an email when DOL's status changes on a case you watch (PERM, prevailing wage or H-1B LCA), when DOL's queue reaches your filing month (PERM or either prevailing-wage queue), or when the visa bulletin moves your cutoff. With an account: email and push reminders for each deadline type (PWD, recruitment, ETA 9089, I-140, RFI, RFE) at 1 to 30 days before, quiet hours, and a Monday digest.",
    rich: "Without an account, all double opt-in: an email when DOL's status changes on a case you watch (PERM, prevailing wage or H-1B LCA), when DOL's queue reaches your filing month (PERM or either prevailing-wage queue), or when the visa bulletin moves your cutoff. With an account: email and push reminders for each deadline type (PWD, recruitment, ETA 9089, I-140, RFI, RFE) at 1 to 30 days before, quiet hours, and a Monday digest.",
  },
];
