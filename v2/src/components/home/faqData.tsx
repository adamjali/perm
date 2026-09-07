import Link from "next/link";

/**
 * The homepage FAQ, single-sourced, and deliberately SHORT.
 *
 * Three questions, all about using the site. The homepage used to carry eight,
 * six of them byte-identical to /faq, and Google picked /faq as the page for
 * "what is PERM Tracker" (the brand query moved there on 2026-08-27). The
 * definitional answer now lives in the About block above this section and on
 * /about; the product questions (spreadsheets, client data, import, regulation
 * changes) live on /faq alone. One page answers each question.
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
      "Do I need an account, and is it free?",
    answer:
      "No account is needed to look up a case, search the data or set an email alert. Everything is free: no credit card, no case limit. Managing your own caseload with computed deadlines takes a free account. Paid plans may come later; the data, the lookup and the core deadline tracking stay free.",
    rich: (
      <>
        No account is needed to{" "}
        <Link href="/perm-case-status" className={faqLink}>look up a case</Link>,
        search the data or set an email alert. Everything is free: no credit
        card, no case limit. Managing your own caseload with computed deadlines
        takes a free account. Paid plans may come later; the data, the lookup
        and the core deadline tracking stay free.
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
