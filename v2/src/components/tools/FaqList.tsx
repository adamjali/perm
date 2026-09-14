import type { ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";

/**
 * Collapsible reference lists: the questions at the foot of a calculator page,
 * and any long run of term-and-definition entries.
 *
 * WHY COLLAPSE AT ALL. A sixteen-entry dictionary rendered open is a page you
 * scroll past rather than read: finding "NORD issued" means passing fifteen
 * definitions you did not want. Measured on `/perm-rfi-audit`, that one section
 * was over half the page's 3,411 rendered words - against 670 for a comparable
 * gov.uk service page and 2,087 for react.dev's documentation index.
 *
 * WHY IT COSTS NOTHING IN SEARCH. Native `<details>` keeps every word in the
 * DOM whether open or shut, so Google, Bing and the AI answer engines read the
 * whole thing either way - the same reason the footer's link columns collapse
 * on a phone. It is also keyboard-operable and screen-reader-correct for free,
 * works before hydration and with JavaScript off, and needs no library.
 *
 * TWO EXPORTS, ONE IMPLEMENTATION, AND THE SPLIT IS DELIBERATE. `FaqList`
 * answers are `string` because the pages that render them ALSO put them in
 * FAQPage structured data, and JSX in that field serialises to
 * `[object Object]` with nothing erroring. `DisclosureList` takes a ReactNode
 * body for everything that is not fed to a schema.
 */

interface ShellItem {
  /** The always-visible line. Also the key, so it must be unique in the list. */
  term: string;
  /** A short qualifier beside the term - a count, a deadline, a status. */
  hint?: string;
  body: ReactNode;
}

function DisclosureShell({
  items,
  openFirst,
  compact,
}: {
  items: readonly ShellItem[];
  openFirst: boolean;
  compact: boolean;
}) {
  return (
    <div className="mt-6 border-2 border-border bg-card shadow-hard">
      {items.map((item, i) => (
        <details
          key={item.term}
          open={openFirst && i === 0}
          className="group border-b-2 border-border last:border-b-0"
        >
          <summary
            className={
              "flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-details-marker]:hidden " +
              (compact
                ? "px-5 py-3 font-heading text-base font-bold sm:px-6"
                : "p-5 font-heading text-lg font-black sm:p-6")
            }
          >
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span>{item.term}</span>{" "}
              {item.hint ? (
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {item.hint}
                </span>
              ) : null}
            </span>{" "}
            <CaretDownIcon
              className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>{" "}
          <div
            className={
              "border-t-2 border-border/40 text-base leading-relaxed text-foreground/70 " +
              (compact
                ? "px-5 pb-4 pt-3 sm:px-6"
                : "px-5 pb-5 pt-4 sm:px-6 sm:pb-6")
            }
          >
            {item.body}
          </div>
        </details>
      ))}
    </div>
  );
}

export interface FaqItem {
  q: string;
  /** STRING, not ReactNode - this text is also emitted as FAQPage JSON-LD. */
  a: string;
}

export interface FaqListProps {
  items: readonly FaqItem[];
  /** Opens the first answer, so the band is not a row of shut doors. */
  openFirst?: boolean;
}

export function FaqList({ items, openFirst = true }: FaqListProps) {
  return (
    <DisclosureShell
      items={items.map((it) => ({ term: it.q, body: it.a }))}
      openFirst={openFirst}
      compact={false}
    />
  );
}

export interface DisclosureItem {
  term: string;
  hint?: string;
  body: ReactNode;
}

export interface DisclosureListProps {
  items: readonly DisclosureItem[];
  /**
   * Default FALSE, unlike the FAQ. A dictionary is arrived at with one term in
   * mind, so opening the first entry just reintroduces the wall this exists to
   * remove; an FAQ band of shut doors reads as empty, which is why that one
   * opens.
   */
  openFirst?: boolean;
}

export function DisclosureList({ items, openFirst = false }: DisclosureListProps) {
  return <DisclosureShell items={items} openFirst={openFirst} compact />;
}
