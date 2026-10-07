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

/** A bar standing in for a line of text, with the loading sweep. */
function Bar({ className, ink = false }: { className: string; ink?: boolean }) {
  return <div className={`skeleton-pulse ${ink ? "skeleton-on-ink " : ""}${className}`} />;
}

/**
 * The answer's own shape while it loads, not a spinner: the answer card (the
 * ink panel with the status, the estimated date and the "Email me changes"
 * button), the estimate panel, the alert form and the record's two cards, in
 * the order and at about the size CaseStatusResult draws them (measured on a
 * pending case, Oct 7 2026: 602, 352, 943 and 688 px tall at 390 wide; 509,
 * 262, 597 and 551 at 768; 392, 262, 574 and 325 at 1440), so each card holds
 * its measured height at those widths. The frames are the real cards'; only
 * the text is stood in for, by bars that sweep (`.skeleton-pulse`).
 *
 * The block it stands in for is tall, so a short placeholder would let the
 * FAQ jump up into view and back down again a second later.
 */
export function LookupSkeleton() {
  const card = "border-2 border-border bg-card p-6 shadow-hard sm:p-8";
  return (
    <div aria-hidden="true">
      <div className="min-h-[602px] border-2 border-border bg-foreground p-6 shadow-hard sm:min-h-[509px] sm:p-8 lg:min-h-[392px]">
        <Bar ink className="h-8 w-28" />
        <div className="mt-4 max-w-3xl space-y-3">
          <Bar ink className="h-6 w-full" />
          <Bar ink className="h-6 w-11/12" />
          <Bar ink className="h-6 w-full sm:w-3/5" />
          {/* On a phone the real sentence wraps to about six lines. */}
          <Bar ink className="h-6 w-full sm:hidden" />
          <Bar ink className="h-6 w-4/5 sm:hidden" />
          <Bar ink className="h-6 w-1/2 sm:hidden" />
        </div>
        <div className="mt-6 flex flex-col gap-4 border-t border-background/25 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <Bar ink className="h-4 w-36" />
            <Bar ink className="h-9 w-64 max-w-full sm:w-80" />
            <Bar ink className="h-5 w-56 max-w-full" />
          </div>
          <Bar ink className="h-12 w-52 max-w-full border-2 border-background/40" />
        </div>
        <Bar ink className="mt-4 h-4 w-3/4" />
      </div>

      <div className={`mt-8 min-h-[352px] sm:min-h-[262px] ${card}`}>
        <Bar className="h-7 w-2/3" />
        <div className="mt-5 space-y-2.5">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-11/12" />
          <Bar className="h-4 w-1/2" />
        </div>
        <div className="mt-5 space-y-2.5">
          <Bar className="h-4 w-10/12" />
        </div>
        <Bar className="mt-6 h-5 w-48" />
      </div>

      <div className="mt-8 min-h-[655px] border-2 border-border bg-card p-5 shadow-hard sm:min-h-[369px] sm:p-6 lg:min-h-[346px]">
        <Bar className="h-4 w-36" />
        <div className="mt-4 max-w-2xl space-y-2.5">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-4/5" />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="h-12 min-w-0 flex-1 basis-56 border-2 border-border bg-background" />
          <Bar className="h-12 w-48 border-2 border-border" />
        </div>
        <div className="mt-5 space-y-3">
          <Bar className="h-4 w-3/4" />
          <Bar className="h-4 w-2/3" />
          <Bar className="h-4 w-5/6" />
        </div>
      </div>
      <div className="mt-4 min-h-[273px] border-2 border-border bg-card p-5 shadow-hard sm:min-h-[212px] sm:p-6">
        <Bar className="h-5 w-64 max-w-full" />
        <div className="mt-3 space-y-2.5">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-2/3" />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {[
          { size: "min-h-[295px] sm:min-h-[202px] lg:min-h-[325px]", rows: 3 },
          { size: "min-h-[369px] sm:min-h-[325px]", rows: 4 },
        ].map(({ size, rows }) => (
          <div key={size} className={`${size} ${card}`}>
            <Bar className="h-6 w-1/2" />
            <div className="mt-5 space-y-4">
              {Array.from({ length: rows }, (_, row) => (
                <div key={row} className="space-y-1.5">
                  <Bar className="h-3.5 w-24" />
                  <Bar className="h-5 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
