import { CaretRightIcon } from "@phosphor-icons/react/ssr";

/**
 * A caveat that is available without being in the way.
 *
 * THE PROBLEM THIS SOLVES. This site's credibility comes from saying what each
 * figure cannot tell you and where it came from, and that discipline had grown
 * into paragraphs of standing prose under every number. Measured across the
 * non-article pages: 24,033 words. Most readers want the number; the ones who
 * are about to rely on it want the caveat, and they are not the same visit.
 *
 * WHY `<details>` AND NOT A TOOLTIP. The text stays in the DOM whether open or
 * shut, so Google and the AI answer engines still read every word of it, which
 * is the whole reason it is safe to collapse. It is keyboard-operable and
 * screen-reader-correct with no JavaScript, and it works before hydration. A
 * hover tooltip would hide the text from crawlers, from keyboards and from
 * every phone, which is most of the traffic.
 *
 * WHAT DOES NOT GO IN HERE. Anything that changes how a number should be READ
 * belongs above it, in the open. "These counts are a floor, not a total" is a
 * correction to the figure and stays visible. "Read in batches every 12 hours
 * from DOL's case-status search" is provenance, and belongs in here.
 */

export interface FinePrintProps {
  /** The line that is always visible. Name what is inside, don't tease it. */
  summary: string;
  children: React.ReactNode;
  className?: string;
}

export function FinePrint({ summary, children, className }: FinePrintProps) {
  return (
    <details className={"group " + (className ?? "")}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <CaretRightIcon
          className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          weight="bold"
          aria-hidden="true"
        />{" "}
        {summary}
      </summary>{" "}
      <div className="max-w-3xl pb-1 pl-5 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_a]:decoration-primary [&_a]:decoration-2 [&_a]:underline-offset-2 [&>*+*]:mt-2">
        {children}
      </div>
    </details>
  );
}
