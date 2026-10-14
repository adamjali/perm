"use client";

import * as React from "react";
import Link from "next/link";

import { KIND_NOUN, type NameSuggestion, type SuggestKind } from "@/lib/search/suggestTypes";
import { cn } from "@/lib/utils";

/**
 * "Did you mean" for any search that found nothing.
 *
 * Two halves. `useNameSuggestions` asks /api/suggest for the closest
 * employer, law firm or occupation names to a query, but only while the
 * search it backs has come up empty: a match found exactly needs no guess.
 * `DidYouMean` draws whichever suggestions a search has, from the server or
 * from a local `rankFuzzy`, the same way everywhere.
 */

const DEBOUNCE_MS = 250;
const WARMING_RETRY_MS = 4_000;

export function useNameSuggestions(
  kind: SuggestKind | "all",
  query: string,
  enabled: boolean,
): { suggestions: NameSuggestion[]; loading: boolean } {
  const [state, setState] = React.useState<{ key: string; suggestions: NameSuggestion[] }>({ key: "", suggestions: [] });
  const [loading, setLoading] = React.useState(false);
  const q = query.trim();
  const key = `${kind}|${q}`;
  const active = enabled && q.length >= 2 && q.length <= 80;

  React.useEffect(() => {
    if (!active) return;
    const ctl = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    const ask = (again: boolean) => {
      setLoading(true);
      fetch(`/api/suggest?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { suggestions?: NameSuggestion[]; warming?: string[] } | null) => {
          setState({ key, suggestions: d?.suggestions ?? [] });
          // The server's name list was still loading: ask once more shortly.
          if (again && (d?.warming?.length ?? 0) > 0 && (d?.suggestions?.length ?? 0) === 0) {
            retry = setTimeout(() => ask(false), WARMING_RETRY_MS);
          }
        })
        .catch(() => {
          // A suggestion is a courtesy: when it can't be had, the search's own
          // "nothing matches" stands on its own.
        })
        .finally(() => {
          if (!ctl.signal.aborted) setLoading(false);
        });
    };
    const t = setTimeout(() => ask(true), DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      clearTimeout(retry);
      ctl.abort();
    };
  }, [active, key, kind, q]);

  return { suggestions: active && state.key === key ? state.suggestions : [], loading: active && loading };
}

export interface Suggestion {
  label: string;
  /** A page to open. */
  href?: string;
  /** Or an action, such as running the search again with this name. */
  onPick?: () => void;
  /** A short note beside the label: the kind, a count. */
  note?: string;
}

/** The suggestions as a row of chips, or nothing when there are none. */
export function DidYouMean({
  suggestions,
  className,
  label = "Did you mean",
}: {
  suggestions: Suggestion[];
  className?: string;
  label?: string;
}) {
  if (suggestions.length === 0) return null;
  const chip =
    "inline-flex min-h-[44px] flex-wrap items-baseline gap-x-2 gap-y-0.5 border border-border bg-card px-3 py-2 text-left font-bold transition-colors hover:bg-tint";
  return (
    <div className={cn("text-base", className)} role="status">
      <p className="font-bold">{label}:</p>{" "}
      <ul className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <React.Fragment key={`${s.href ?? ""}|${s.label}`}>
            <li>
              {s.href ? (
                <Link href={s.href} className={chip}>
                  {s.label}
                  {s.note ? <span className="whitespace-nowrap text-sm font-normal text-muted-foreground">{` ${s.note}`}</span> : null}
                </Link>
              ) : (
                <button type="button" onClick={s.onPick} className={chip}>
                  {s.label}
                  {s.note ? <span className="whitespace-nowrap text-sm font-normal text-muted-foreground">{` ${s.note}`}</span> : null}
                </button>
              )}
            </li>{" "}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
}

/** Server suggestions as chips that open each page. */
export function nameSuggestionChips(list: NameSuggestion[], withKind = false): Suggestion[] {
  return list.map((s) => ({
    label: s.name,
    href: s.href,
    note: `${withKind ? `${KIND_NOUN[s.kind]}, ` : ""}${s.cases.toLocaleString("en-US")} ${s.cases === 1 ? "filing" : "filings"}`,
  }));
}
