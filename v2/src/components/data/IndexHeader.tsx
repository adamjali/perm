import Link from "next/link";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The top of a list page: what the list is, its headline figures as cells,
 * and the search box beside them.
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

const COLUMNS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };

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
    <header className={cn("pt-10 sm:pt-12", className)}>
      <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,25rem)] lg:items-start">
        <div>
          <h1 className="font-heading text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h1>{" "}
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{lede}</p>{" "}
          {figures.length > 0 ? (
            <dl className={cn("mt-6 grid grid-cols-1 gap-px border border-border bg-border [&>*]:min-w-0", COLUMNS[figures.length])}>
              {figures.map((f) => (
                <div key={f.label} className="bg-card px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{f.label}{" "}</dt>{" "}
                  <dd className="mt-0.5 font-heading text-lg font-bold leading-snug [overflow-wrap:anywhere]">
                    {f.href ? (
                      <Link href={f.href} className="underline decoration-primary decoration-2 underline-offset-4 hover:text-primary">
                        {f.value}
                      </Link>
                    ) : (
                      f.value
                    )}{" "}
                  </dd>
                  {f.note ? <dd className="mt-0.5 text-sm text-muted-foreground">{f.note}{" "}</dd> : null}
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
 * page's code has loaded, and the address it lands on can be shared.
 */
export function IndexSearch({
  title,
  action,
  placeholder,
  note,
  footer,
  name = "q",
  button = "Search",
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
    <form
      method="get"
      action={action}
      role="search"
      className="border border-border bg-card p-5 sm:p-6"
    >
      <label htmlFor="index-search" className="font-heading text-xl font-bold leading-tight">
        {title}
      </label>{" "}
      {note ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{note}</p> : null}{" "}
      <div className="mt-4 flex gap-2">
        <input
          id="index-search"
          name={name}
          type="search"
          required
          minLength={2}
          autoComplete="off"
          placeholder={placeholder}
          className="min-h-11 min-w-0 flex-1 border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />{" "}
        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-border bg-primary px-4 font-bold text-primary-foreground transition-transform motion-reduce:transition-none"
        >
          <MagnifyingGlassIcon aria-hidden="true" className="size-4" weight="bold" />
          {button}
        </button>
      </div>{" "}
      {footer ? <div className="mt-4 border-t border-border pt-3 text-sm">{footer}</div> : null}
    </form>
  );
}
