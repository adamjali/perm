import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { normaliseFlagCaseNumber, programNounWithArticle } from "@/lib/flagCaseNumber";

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
 * The page's heading names the program the typed number belongs to: a wage
 * request or an LCA looked up here isn't a PERM case. With nothing typed (or
 * nothing readable) it's the PERM lookup the page is named for.
 */
export function headingFor(typed: string): string {
  const ref = normaliseFlagCaseNumber(typed);
  return `Check ${programNounWithArticle(ref?.program ?? "perm")}`;
}

/**
 * The page's head. With nothing typed it's the title, one line on what the
 * page does, and the lookup box. With a case number it's the title alone, so
 * the answer is the first thing on the screen; the box moves to the end of the
 * result ("Check another case").
 *
 * `loading` renders the title as a heading-role paragraph instead of an
 * `<h1>`. The loading state and its fallback stay in the streamed HTML, so
 * with three real `<h1>` tags a crawler reading the raw document would see
 * the page's heading three times. It looks identical and screen readers still
 * announce a level-1 heading; only the page's own copy is the `<h1>`.
 */
export function CaseStatusHead({
  typed,
  loading = false,
  withBox = typed.trim() === "",
}: {
  typed: string;
  loading?: boolean;
  /** The lookup box under the title: on when nothing (or nothing usable) was typed. */
  withBox?: boolean;
}) {
  const titleClass = "font-heading text-4xl font-bold leading-tight sm:text-5xl";
  const title = headingFor(typed);
  return (
    <>
      <header>
        {loading ? (
          <p role="heading" aria-level={1} className={titleClass}>
            {title}
          </p>
        ) : (
          <h1 className={titleClass}>{title}</h1>
        )}{" "}
        {withBox ? (
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-soft">
            Its status in plain English, where it sits in DOL&apos;s queue, an estimated decision date, and an email
            when it changes. Wage request, LCA, H-2A, H-2B and CW-1 numbers work too.
          </p>
        ) : null}
      </header>{" "}
      {withBox ? (
        <div className="mt-8">
          <CaseLookupForm defaultValue={typed} source="case-page" />
        </div>
      ) : null}
    </>
  );
}

/** The lookup box again, at the end of a result. */
export function CheckAnother({ typed }: { typed: string }) {
  return (
    <section aria-labelledby="check-another" className="mt-12 border-t border-border pt-8 sm:mt-16">
      <h2 id="check-another" className="font-heading text-xl font-bold">
        Check another case
      </h2>{" "}
      <CaseLookupForm defaultValue={typed} source="case-page" label="Case number" help={null} className="mt-4" />
    </section>
  );
}

/** A bar standing in for a line of text, with the loading sweep. */
function Bar({ className }: { className: string }) {
  return <div className={`skeleton-pulse ${className}`} />;
}

/**
 * The answer's own shape while it loads, not a spinner: the answer panel (the
 * status, the estimated date and the email box), then the two sections that
 * follow it, in the order and at about the size CaseStatusResult draws them,
 * so nothing below jumps when the answer arrives. The tint is the real
 * panel's; only the text is stood in for, by bars that sweep.
 */
export function LookupSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="bg-foreground p-5 sm:p-8 border-2 shadow-hard border-border">
        <Bar className="h-7 w-48" />
        <div className="mt-4 max-w-3xl space-y-3">
          <Bar className="h-6 w-full" />
          <Bar className="h-6 w-11/12" />
          <Bar className="h-6 w-3/5" />
          {/* On a phone the sentence wraps to about six lines. */}
          <Bar className="h-6 w-full sm:hidden" />
          <Bar className="h-6 w-4/5 sm:hidden" />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-foreground/10 pt-6 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-2">
            <Bar className="h-4 w-36" />
            <Bar className="h-9 w-72 max-w-full" />
            <Bar className="h-4 w-40" />
          </div>
          <div className="space-y-2">
            <Bar className="h-5 w-72 max-w-full" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="h-12 min-w-0 flex-1 border border-input bg-card" />
              <Bar className="h-12 w-full sm:w-44" />
            </div>
            <Bar className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <Bar className="mt-5 h-4 w-3/4" />
      </div>

      {[0, 1].map((n) => (
        <div key={n} className="mt-12 border-t border-border pt-8 sm:mt-16">
          <Bar className="h-7 w-72 max-w-full" />
          <div className="mt-4 max-w-2xl space-y-2.5">
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-2/3" />
          </div>
          <div className="mt-6 space-y-3">
            <Bar className="h-5 w-full" />
            <Bar className="h-5 w-11/12" />
            <Bar className="h-5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
