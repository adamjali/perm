"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

import { rankFuzzy } from "@/lib/fuzzy";
import { shortDate } from "@convex/lib/months";

/**
 * One document for the search: prepared on the server, so the browser gets
 * strings and a flag rather than the Register's whole record.
 */
export interface PolicyItem {
  id: string;
  date: string;
  /** "Final rule", "Proposed rule", "Notice", "OFLC". */
  kind: string;
  title: string;
  url: string;
  agencies: string;
  /** Title, abstract, agencies and citation, lower-cased once. */
  text: string;
  commentsOpen: boolean;
}

export interface PolicyQuery {
  text: string;
  kind: string;
  year: string;
  openOnly: boolean;
}

export function filterPolicy(items: readonly PolicyItem[], q: PolicyQuery): PolicyItem[] {
  const words = q.text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(
    (i) =>
      (!q.kind || i.kind === q.kind) &&
      (!q.year || i.date.startsWith(q.year)) &&
      (!q.openOnly || i.commentsOpen) &&
      words.every((w) => i.text.includes(w)),
  );
}

// Every option's text ends in a space, INSIDE the option: a space between two
// options is a text node in a <select>, and without one the page's markup
// reads "AnyFinal rule" to anything that walks it. A browser strips an
// option's surrounding whitespace, so nothing shows.
const CONTROL =
  "mt-1 block w-full min-w-0 min-h-[44px] border border-input bg-card px-3 text-base font-medium focus-visible:ring-2 focus-visible:ring-primary";
const LABEL = "block text-sm font-bold";
/** "2026-09-11" to "Sep 11, 2026"; anything else prints as given. */
const day = (iso: string) => shortDate(iso) ?? iso;

/**
 * Search every document on the page, the Register's and OFLC's, including
 * the years of announcements folded away below. With nothing typed or chosen
 * the page renders as it always has; a search replaces the lists with the
 * matches, every one linking to where it was published.
 */
export function PolicySearch({ items, children }: { items: PolicyItem[]; children: ReactNode }) {
  const id = useId();
  const [q, setQ] = useState<PolicyQuery>({ text: "", kind: "", year: "", openOnly: false });
  const kinds = useMemo(() => [...new Set(items.map((i) => i.kind))].sort(), [items]);
  const years = useMemo(() => [...new Set(items.map((i) => i.date.slice(0, 4)))].sort().reverse(), [items]);
  const anyOpen = items.some((i) => i.commentsOpen);
  const active = q.text.trim() !== "" || q.kind !== "" || q.year !== "" || q.openOnly;
  const hits = useMemo(() => (active ? filterPolicy(items, q) : []), [items, q, active]);
  // No document holds every word: the closest titles instead, within the kind
  // and year chosen, so a misspelt word still finds the rule.
  const near = useMemo(() => {
    if (!active || hits.length > 0 || q.text.trim().length < 3) return [];
    const pool = filterPolicy(items, { ...q, text: "" });
    return rankFuzzy(q.text, pool, (i) => [i.title, i.agencies], { limit: 8 }).map((r) => r.item);
  }, [items, q, active, hits.length]);
  const list = hits.length > 0 ? hits : near;

  return (
    <>
      <section className="mt-12 object p-4 sm:p-5" aria-label="Search the documents">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
          <label className="block lg:col-span-2" htmlFor={`${id}-q`}>
            <span className={LABEL}>Search every document</span>{" "}
            <input
              id={`${id}-q`}
              type="search"
              value={q.text}
              maxLength={120}
              autoComplete="off"
              placeholder="e.g. prevailing wage, H-1B fee"
              onChange={(e) => setQ({ ...q, text: e.target.value })}
              className={CONTROL}
            />
          </label>{" "}
          <label className="block" htmlFor={`${id}-kind`}>
            <span className={LABEL}>Kind</span>{" "}
            <select id={`${id}-kind`} value={q.kind} onChange={(e) => setQ({ ...q, kind: e.target.value })} className={CONTROL}>
              <option value="">{"Any "}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {`${k} `}
                </option>
              ))}
            </select>
          </label>{" "}
          <label className="block" htmlFor={`${id}-year`}>
            <span className={LABEL}>Year</span>{" "}
            <select id={`${id}-year`} value={q.year} onChange={(e) => setQ({ ...q, year: e.target.value })} className={CONTROL}>
              <option value="">{"Any "}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {`${y} `}
                </option>
              ))}
            </select>
          </label>
        </div>{" "}
        {anyOpen ? (
          <label className="mt-3 flex min-h-[44px] items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={q.openOnly}
              onChange={(e) => setQ({ ...q, openOnly: e.target.checked })}
              className="size-5 shrink-0 accent-foreground"
            />{" "}
            <span>Only documents open for comment today</span>
          </label>
        ) : null}
      </section>{" "}
      {active ? (
        <section className="mt-6">
          <p className="text-base text-soft" role="status">
            {hits.length > 0
              ? `${hits.length.toLocaleString("en-US")} of ${items.length.toLocaleString("en-US")} documents match, newest first.`
              : near.length > 0
                ? `No document holds \u201c${q.text.trim()}\u201d exactly. These are the closest.`
                : `None of the ${items.length.toLocaleString("en-US")} documents here match that.`}
          </p>{" "}
          {list.length > 0 ? (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {list.map((i) => (
                <li key={i.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
                  <span className="shrink-0 font-mono text-sm text-muted-foreground sm:w-32">{day(i.date)}{" "}</span>{" "}
                  <span className="shrink-0 font-mono text-sm font-bold sm:w-32">{i.kind}{" "}</span>{" "}
                  <span className="min-w-0">
                    <a href={i.url} rel="noopener" target="_blank" className="link">
                      {i.title}
                    </a>{" "}
                    {i.agencies ? <span className="block text-sm text-muted-foreground">{i.agencies}{" "}</span> : null}
                    {i.commentsOpen ? <span className="block text-sm font-bold">Open for comment{" "}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        children
      )}
    </>
  );
}
