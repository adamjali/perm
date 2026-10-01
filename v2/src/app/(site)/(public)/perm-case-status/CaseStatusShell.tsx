import Link from "next/link";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";

/**
 * The parts of /perm-case-status that its loading state and the page share,
 * so the two render identically: the frame, the heading, the lookup form and
 * the reservation the answer streams into. The loading state used to be a
 * narrower column (max-w-3xl against the page's max-w-5xl) with its own
 * shapes, so the page widened by 256px and then showed a second, different
 * skeleton before the answer.
 *
 * No server-only imports: loading.tsx renders the head from a client
 * component so it can fill the form with the number being looked up.
 */
export const CASE_STATUS_FRAME = "mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16";

/**
 * `loading` renders the title as a heading-role paragraph instead of an
 * `<h1>`. The loading state and its fallback stay in the streamed HTML, so
 * with three real `<h1>` tags a crawler reading the raw document saw the
 * page's heading three times (measured Oct 1 2026). It looks identical and
 * screen readers still announce a level-1 heading; only the page's own copy
 * is the `<h1>`.
 */
export function CaseStatusHead({ typed, loading = false }: { typed: string; loading?: boolean }) {
  const titleClass = "mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl";
  return (
    <>
      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            Data
          </Link>
        </p>{" "}
        {loading ? (
          <p role="heading" aria-level={1} className={titleClass}>
            Check a PERM case
          </p>
        ) : (
          <h1 className={titleClass}>Check a PERM case</h1>
        )}{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">
          A case number gets you the status in plain English, what the queue in
          front of it looks like, and the employer&apos;s own record. It will
          not get you a decision date, and the page says why. Prevailing wage
          (P-100-...) and LCA (I-200-...) numbers work here too, and any of the three can email you when DOL&apos;s status changes.
        </p>
      </header>

      <div className="mt-8 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <CaseLookupForm defaultValue={typed} />
      </div>
    </>
  );
}

/**
 * A reservation the size of the answer, not a spinner.
 *
 * The block it stands in for is tall, so a short placeholder would let the
 * FAQ jump up into view and back down again a second later.
 */
export function LookupSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
      <div className="h-40 border-2 border-border bg-muted" />
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="h-48 border-2 border-border bg-muted" />
        <div className="h-48 border-2 border-border bg-muted" />
      </div>
      <div className="mt-8 h-64 border-2 border-border bg-muted" />
    </div>
  );
}
