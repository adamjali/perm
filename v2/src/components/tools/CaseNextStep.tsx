import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { cn } from "@/lib/utils";

/**
 * The one next step for someone waiting on a case, on the pages they land on
 * before they reach the case page: an employer's page, a law firm's, an
 * article. Most of them came with one question (when is MY case decided), and
 * the answer is the case page, which gives DOL's live status, an estimated
 * date and an email alert when the status moves.
 *
 * It asks in the page's own terms ("Waiting on a case with Adobe Inc.?") and
 * offers a way in without the number, because many people waiting never saw
 * their receipt: the attorney filed it.
 */
export interface CaseNextStepProps {
  /** The question, in the page's own terms. */
  question: string;
  /** Where "Don't have the number?" goes. Defaults to the employer search. */
  searchHref?: string;
  searchLabel?: string;
  /** One more step this page offers, such as following the employer. */
  extra?: { href: string; label: string } | null;
  /** For the lookup event, so the funnel says which page sent the lookup. */
  source: string;
  /** "PERM" on PERM pages; "DOL" where the number may be a wage request or an LCA. */
  numberKind?: "PERM" | "DOL";
  className?: string;
}

export function CaseNextStep({
  question,
  searchHref,
  searchLabel,
  extra = null,
  source,
  numberKind = "PERM",
  className,
}: CaseNextStepProps) {
  return (
    <section
      aria-label="Check your case"
      className={cn("border-2 border-border bg-card p-5 shadow-hard sm:p-6", className)}
    >
      <h2 className="font-heading text-xl font-black leading-tight sm:text-2xl">{question}</h2>{" "}
      <p className="mt-1 max-w-2xl text-base leading-relaxed text-foreground/70">
        Its number gives DOL&apos;s live status, an estimated decision date and an email when it moves.
      </p>{" "}
      <CaseLookupForm
        className="mt-4"
        compact
        label={`Your ${numberKind} case number`}
        searchHref={searchHref}
        searchLabel={searchLabel}
        source={source}
      />{" "}
      {extra ? (
        <p className="mt-1 text-sm">
          <a
            href={extra.href}
            className="inline-flex min-h-[44px] items-center font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            {extra.label}
          </a>
        </p>
      ) : null}
    </section>
  );
}
