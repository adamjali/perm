import { CaseLookupForm } from "@/components/tools/CaseLookupForm";

/**
 * The parts of /perm-case-status that its loading state and the page share,
 * so the two render identically: the frame, the heading, the lookup form and
 * the reservation the answer streams into. Two drawings of one page drift: a
 * loading state with its own column width and shapes makes the page widen and
 * then show a second, different skeleton before the answer.
 *
 * No server-only imports: loading.tsx renders the head from a client
 * component so it can fill the form with the number being looked up.
 */
export const CASE_STATUS_FRAME = "mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16";

/**
 * `loading` renders the title as a heading-role paragraph instead of an
 * `<h1>`. The loading state and its fallback stay in the streamed HTML, so
 * with three real `<h1>` tags a crawler reading the raw document would see
 * the page's heading three times. It looks identical and
 * screen readers still announce a level-1 heading; only the page's own copy
 * is the `<h1>`.
 */
export function CaseStatusHead({ typed, loading = false }: { typed: string; loading?: boolean }) {
  const titleClass = "font-heading text-4xl font-black leading-tight sm:text-5xl";
  return (
    <>
      <header>
        {loading ? (
          <p role="heading" aria-level={1} className={titleClass}>
            Check a PERM case
          </p>
        ) : (
          <h1 className={titleClass}>Check a PERM case</h1>
        )}{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">
          Its status in plain English, where it sits in DOL&apos;s queue, an
          estimated decision date, and an email when it changes. Wage request,
          LCA, H-2A, H-2B and CW-1 numbers work too.
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
