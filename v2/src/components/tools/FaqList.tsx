import { CaretDown } from "@phosphor-icons/react/ssr";

/**
 * The questions at the foot of a calculator page.
 *
 * Was four stacked cards of prose, which is a whole screenful of text with
 * nothing to look at, and two of those in a row is where a page starts to feel
 * empty. Collapsed, the same content is a scannable list of the questions
 * themselves, which is also how someone actually uses an FAQ: they arrive with
 * one question, not four.
 *
 * Built on native `<details>` rather than a controlled component. It is
 * keyboard-operable and screen-reader-correct for free, it works with no
 * JavaScript, and the answers stay in the DOM whether open or shut, which
 * matters because each page emits FAQPage structured data and the two have to
 * agree.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqListProps {
  items: readonly FaqItem[];
  /** Opens the first answer, so the band is not a row of shut doors. */
  openFirst?: boolean;
}

export function FaqList({ items, openFirst = true }: FaqListProps) {
  return (
    <div className="mt-6 border-2 border-border bg-card shadow-hard">
      {items.map((item, i) => (
        <details
          key={item.q}
          open={openFirst && i === 0}
          className="group border-b-2 border-border last:border-b-0"
        >
          <summary
            className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 p-5 font-heading text-lg font-black transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-6 [&::-webkit-details-marker]:hidden"
          >
            {item.q}{" "}
            <CaretDown
              className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>{" "}
          <div className="border-t-2 border-border/40 px-5 pb-5 pt-4 text-base leading-relaxed text-foreground/70 sm:px-6 sm:pb-6">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
