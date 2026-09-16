import Link from "next/link";

/**
 * The homepage FAQ, single-sourced: SIX questions, three per audience.
 *
 * This block has moved twice. The homepage carried eight questions, six
 * byte-identical to /faq, and Google picked /faq as the page for "what is PERM
 * Tracker" (the brand query moved there on 2026-08-27). The Sep 7 trim cut it
 * to three site-usage questions and moved every definitional one to /faq alone,
 * after which /faq KEPT the query, because it was now the only page whose first
 * answer defines the product. So on 2026-09-15 the four brand-defining
 * questions came here and left /faq (which keeps its process questions): three
 * for the person waiting, three for the practice, so the page that should own
 * the name answers what the name is for both audiences. One page answers each
 * question; `about-surfaces.test.ts` asserts the split in both directions.
 *
 * The questions used to exist twice in another sense too: a plain-text array in page.tsx
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
  // ---- for the person waiting ----
  {
    question: "What exactly does PERM Tracker do?",
    answer:
      "Two things, both free. For anyone waiting on a case: look up a PERM, prevailing wage or H-1B LCA number, pending ones included, see the federal record and where DOL's queue stands, get an email when the status changes, and search every filing by employer, law firm, state or occupation, with no account. For attorneys, paralegals and HR teams: a case-management app that computes every deadline per case, with reminders, calendar sync, import and encrypted client data.",
    rich: (
      <>
        Two things, both free. For anyone waiting on a case:{" "}
        <Link href="/perm-case-status" className={faqLink}>look up a PERM, prevailing wage or H-1B LCA number</Link>,
        pending ones included, see the federal record and where DOL&apos;s queue
        stands, get an email when the status changes, and search every filing by
        employer, law firm, state or occupation, with no account. For attorneys,
        paralegals and HR teams:{" "}
        <Link href="/for-attorneys" className={faqLink}>a case-management app</Link>{" "}
        that computes every deadline per case, with reminders, calendar sync,
        import and encrypted client data.
      </>
    ),
  },
  {
    question: "Is PERM Tracker really free?",
    answer:
      "Yes. No credit card and no case limit. Looking up a case, reading the data pages and setting an email alert need no account at all; managing your own caseload with computed deadlines takes a free account. Optional paid features may come later; the data, the lookup, the calculators and the core deadline tracking stay free.",
    rich: (
      <>
        Yes. No credit card and no case limit. Looking up a case, reading the
        data pages and setting an email alert need no account at all; managing
        your own caseload with computed deadlines takes a free account. Optional
        paid features may come later; the data, the lookup, the calculators and
        the core deadline tracking stay free.
      </>
    ),
  },
  {
    question: "Can I check my PERM status without an account?",
    answer:
      "Yes. Enter the case number on the homepage or on the case status page and it shows DOL's current status, when it was last seen, how many cases DOL is working ahead of yours, and an estimate when the data supports one. It takes all three DOL numbers: a PERM case (G- or A-), a prevailing wage request (P-), or an H-1B LCA (I-). From there you can set a free email alert for the next change.",
    rich: (
      <>
        Yes. Enter the case number on the homepage or on{" "}
        <Link href="/perm-case-status" className={faqLink}>the case status page</Link>{" "}
        and it shows DOL&apos;s current status, when it was last seen, how many
        cases DOL is working ahead of yours, and an estimate when the data
        supports one. It takes all three DOL numbers: a PERM case (G- or A-), a
        prevailing wage request (P-), or an H-1B LCA (I-). From there you can
        set a free email alert for the next change.
      </>
    ),
  },
  // ---- for the practice ----
  {
    question: "What does the case-management app do for attorneys and HR teams?",
    answer:
      "Enter a case's dates once and every deadline comes out computed under 20 CFR 656: prevailing wage expiration, recruitment clocks, the 30-180 day ETA 9089 filing window, audit and RFI response dates, and the I-140 filing cutoff. Change one date and the downstream dates recalculate. Email and push reminders run 1 to 30 days out with quiet hours and calendar sync, a Monday digest summarises the caseload, and an AI assistant answers questions over your own cases.",
    rich: (
      <>
        Enter a case&apos;s dates once and every deadline comes out computed
        under 20 CFR 656: prevailing wage expiration, recruitment clocks, the
        30-180 day ETA 9089 filing window, audit and RFI response dates, and the
        I-140 filing cutoff. Change one date and the downstream dates
        recalculate. Email and push reminders run 1 to 30 days out with quiet
        hours and calendar sync, a Monday digest summarises the caseload, and an
        AI assistant answers questions over your own cases.{" "}
        <Link href="/for-attorneys" className={faqLink}>How the software works &rarr;</Link>
      </>
    ),
  },
  {
    question: "Is my client data secure?",
    answer:
      "Yes. Case data is encrypted at rest with AES-256-GCM, sessions expire after 15 minutes of inactivity, and access is isolated per account: no other firm can see your cases. Privacy Mode hides sensitive fields during screen sharing. The public data pages carry no client data at all, only DOL's published records.",
    rich: (
      <>
        Yes. Case data is encrypted at rest with AES-256-GCM, sessions expire
        after 15 minutes of inactivity, and access is isolated per account: no
        other firm can see your cases. Privacy Mode hides sensitive fields during
        screen sharing. The public data pages carry no client data at all, only
        DOL&apos;s published records.{" "}
        <Link href="/security" className={faqLink}>Security details &rarr;</Link>
      </>
    ),
  },
  {
    question: "Can I import my existing cases?",
    answer:
      "Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard auto-maps your fields and validates data before import. You can also export your data at any time.",
    rich: (
      <>
        Yes. PERM Tracker supports CSV import for bulk uploads. The import wizard
        auto-maps your fields and validates data before import. You can also
        export your data at any time.
      </>
    ),
  },
];
