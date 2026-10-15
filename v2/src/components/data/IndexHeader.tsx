import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";

/**
 * The top of a list page: what the list is, its headline figures, and the
 * box that filters it beside them.
 *
 * Most people who open a list of sponsors, firms or jobs came to find one of
 * them, and the search used to sit thousands of pixels down, inside the
 * table's filters. The box here submits to the table's own anchor with `?q=`,
 * which the table reads on load (`queryFromUrl`), so the answer opens already
 * filtered with no script of its own.
 */

export interface IndexFigure {
  label: string;
  value: string;
  href?: string;
  note?: string;
}

export function IndexHeader({
  title,
  lede,
  figures = [],
  aside,
  className,
}: {
  title: string;
  lede: ReactNode;
  figures?: IndexFigure[];
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("pt-8 sm:pt-10", className)}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:items-start [&>*]:min-w-0">
        <div>
          <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>{" "}
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">{lede}</p>{" "}
          {figures.length > 0 ? (
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-5">
              {figures.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-sm font-semibold">{f.label}</dt>{" "}
                  <dd className="mt-1 font-heading text-2xl font-bold leading-tight tabular-nums [overflow-wrap:anywhere]">
                    {f.href ? (
                      <Link href={f.href} className="link">
                        {f.value}
                      </Link>
                    ) : (
                      f.value
                    )}
                  </dd>{" "}
                  {f.note ? <dd className="mt-0.5 text-sm text-soft">{f.note}</dd> : null}
                </div>
              ))}
            </dl>
          ) : null}
        </div>{" "}
        {aside ? <div>{aside}</div> : null}
      </div>
    </header>
  );
}

/**
 * A plain GET form into a list's table: no script, so it works before the
 * page's code has loaded, and the address it lands on can be shared. It
 * filters the list it sits on; the header's box is the site-wide search.
 */
export function IndexSearch({
  title,
  action,
  placeholder,
  note,
  footer,
  name = "q",
  button = "Filter",
}: {
  title: string;
  /** The list page and its table's anchor, e.g. "/perm-employers#all", or another page that reads the field. */
  action: string;
  /** The query field the receiving page reads: `q` for a list, `case` for the case page. */
  name?: string;
  button?: string;
  placeholder: string;
  note?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <form method="get" action={action} role="search" className="object p-5 sm:p-6">
      <label htmlFor="index-search" className="font-heading text-lg font-bold leading-tight">
        {title}
      </label>{" "}
      {note ? <p className="mt-1 text-sm leading-relaxed text-soft">{note}</p> : null}{" "}
      <div className="mt-3 flex gap-2">
        <input
          id="index-search"
          name={name}
          type="search"
          required
          minLength={2}
          autoComplete="off"
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 border border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />{" "}
        <button type="submit" className={buttonVariants({ size: "lg" })}>
          {button}
        </button>
      </div>{" "}
      {footer ? <div className="mt-3 text-sm">{footer}</div> : null}
    </form>
  );
}

/**
 * The case box on a program's list page: the one shared lookup, labelled for
 * that program's numbers, for someone who landed here holding one.
 */
export function IndexLookup({
  title,
  placeholder,
  note,
  source,
  searchHref = "/case-search",
  searchLabel = "Find a case by employer name",
}: {
  title: string;
  placeholder: string;
  note?: ReactNode;
  source: string;
  searchHref?: string;
  searchLabel?: string;
}) {
  return (
    <div className="object p-5 sm:p-6">
      <CaseLookupForm
        label={title}
        placeholder={placeholder}
        help={note ?? null}
        source={source}
        searchHref={searchHref}
        searchLabel={searchLabel}
      />
    </div>
  );
}
