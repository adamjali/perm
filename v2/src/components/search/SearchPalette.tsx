"use client";

/**
 * The site-wide search palette: pages, tools, articles, and the live
 * employer / law-firm / occupation lookup, in one box.
 *
 * WHY IT EXISTS. The public surface is ~21,000 URLs deep and the tab strip
 * that navigates it is 15 flat chips; three different per-page search
 * patterns existed and nothing searched across them. This is the one box.
 *
 * A CASE NUMBER IS THE HIGHEST-INTENT QUERY and it is detected by SHAPE:
 * type one and the first action is the case-status lookup, exactly where the
 * hero's form goes. A "YYYY-MM" month routes to the timeline calculator's
 * prefill. Everything else filters the static index client-side while the
 * entity lookup queries the same `?q=` endpoint the index pages use,
 * debounced, three kinds in parallel.
 *
 * Mounted lazily by SiteSearch (dynamic import on first open), so the public
 * pages ship none of this until someone asks for it.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";

import { staticIndex } from "@/lib/search/siteIndex";
import { GROUPS } from "@/lib/siteMap";
import { fuzzyScore } from "@/lib/fuzzy";
import { useNameSuggestions } from "@/components/search/DidYouMean";
import { KIND_NOUN } from "@/lib/search/suggestTypes";
// The palette carried a byte-identical copy of this regex pair. One rule,
// one module: `caseNumberShape` is the client-side wide form (G- and A-, and
// by shape the P- and I- numbers that share the current layout).
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import type { EntityPayload } from "@/lib/entityPayload";
import { trackPaletteSelected } from "@/lib/funnelEvents";

export interface SearchArticle {
  title: string;
  href: string;
  kind: string;
}

interface EntityHit {
  name: string;
  href: string;
  total: number;
  kindLabel: string;
  /** "See every match" row: the kind's index page, filtered by the query. */
  more?: boolean;
}

/** A bare "YYYY-MM" reads as a filing month. */
function looksLikeMonth(q: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(q.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  return year >= 2020 && year <= 2035 && mo >= 1 && mo <= 12 ? m[0] : null;
}

const ENTITY_KINDS = [
  { kind: "employer", base: "/perm-employers", label: "Employer", plural: "employers" },
  { kind: "attorney", base: "/perm-attorneys", label: "Law firm", plural: "law firms" },
  { kind: "occupation", base: "/perm-wages", label: "Occupation", plural: "occupations" },
] as const;

/**
 * The site's own matcher in place of cmdk's, so a swapped or missing letter
 * ("proecssing", "visa buletin") still finds the page. cmdk's default only
 * forgives letters skipped, and shows nothing for a transposition.
 */
const PALETTE_MIN = 0.6;
function paletteFilter(value: string, search: string): number {
  const s = fuzzyScore(search, value);
  return s >= PALETTE_MIN ? s : 0;
}

/** One look for the palette's rows: a quiet grey for the row the keys are on. */
const ROW = "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2.5 text-base data-[selected=true]:bg-accent";
/** A row that acts on what was typed (a case number, a month, every filing). */
const ACTION_ROW = "cursor-pointer border-l-2 border-primary-text bg-tint px-3 py-3 text-base font-semibold data-[selected=true]:bg-accent";
const GROUP_HEADING = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground";
/** The page groups, in the order the Data menu has them. */
const PAGE_GROUPS = ["Go to", ...GROUPS, "Calculators", "Learn"] as const;

/** Rows per kind in the palette. The route says whether more match. */
const PALETTE_PER_KIND = 5;

export function SearchPalette({
  open,
  onOpenChange,
  articles,
  onReady,
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: SearchArticle[];
  /** Fired once this module has mounted, so the trigger can stop spinning. */
  onReady?: () => void;
  /** What was already typed in the header's box when the palette opened. */
  initialQuery?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = React.useState(initialQuery);
  // Each opening starts from what the box held at that moment.
  const [openedWith, setOpenedWith] = React.useState<string | null>(null);
  if (open && openedWith !== initialQuery) {
    setOpenedWith(initialQuery);
    setQuery(initialQuery);
  }
  if (!open && openedWith !== null) setOpenedWith(null);
  const [entityHits, setEntityHits] = React.useState<EntityHit[]>([]);
  const [searchingEntities, setSearchingEntities] = React.useState(false);
  // A FAILED LOOKUP IS NOT AN EMPTY ONE. Each kind used to `catch { return [] }`
  // on its own, so a dead network, a 500 and "no such employer" all rendered as
  // "Nothing matches" - the interface confidently reporting an answer it never
  // got. The count of kinds that threw is kept so the box can say which it is.
  const [entityError, setEntityError] = React.useState(false);

  // This module is loaded on the first open, so the trigger has been showing a
  // spinner since the click. Mounting is the moment that ends.
  React.useEffect(() => {
    onReady?.();
  }, [onReady]);

  // Inline arrow, not a bare `staticIndex` reference: `react-hooks/use-memo`
  // requires the first argument to be an inline function expression so the
  // compiler can see the computation it is memoizing. Behaviour is identical,
  // staticIndex takes no arguments.
  const pages = React.useMemo(() => staticIndex(), []);
  const caseNumber = normaliseCaseNumber(query);
  const month = looksLikeMonth(query);
  // The closest employer, firm and occupation names, asked for only once the
  // exact lookup has come back with none.
  const { suggestions } = useNameSuggestions(
    "all",
    query,
    !caseNumber && !month && !searchingEntities && !entityError && entityHits.length === 0 && query.trim().length >= 3,
  );

  /**
   * Going somewhere, with the palette staying up until it arrives.
   *
   * IT USED TO CLOSE FIRST AND PUSH SECOND. Every destination here is a real
   * navigation and several are slow (`/perm-case-status` asks DOL live and has
   * been measured at ~3.5s; an employer page is a cold server render), so the
   * reader pressed Enter, the palette vanished, and the page they were already
   * on sat there unchanged for seconds with nothing to say it had heard them.
   * That is the reported bug in its purest form: a click, then nothing.
   *
   * `startTransition` gives the pending flag React already has for this, and
   * the palette closes itself when the transition settles - whether that ends
   * on a new route or not, so a push that goes nowhere cannot strand it open.
   */
  const [navPending, startNav] = React.useTransition();
  const [navTarget, setNavTarget] = React.useState<string | null>(null);

  const go = React.useCallback(
    (href: string, label: string) => {
      trackPaletteSelected(href);
      setNavTarget(label);
      startNav(() => {
        router.push(href);
      });
    },
    [router],
  );

  React.useEffect(() => {
    if (navTarget === null || navPending) return;
    setNavTarget(null);
    setQuery("");
    onOpenChange(false);
  }, [navTarget, navPending, onOpenChange, pathname]);

  // Entity lookup, debounced. Three kinds in parallel against the same
  // cached `?q=` route the index pages use.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || caseNumber || month) {
      setEntityHits([]);
      // `setSearchingEntities(false)` HAS TO BE ON THIS PATH TOO. It was not,
      // and the flag is only ever set true by the branch below - so typing
      // "abc" and then deleting a character took the early return with the
      // flag still true, and the box said "Searching the corpus..." for the
      // rest of the session with nothing in flight. A stuck spinner is worse
      // than no spinner: it is a claim that never becomes false.
      setSearchingEntities(false);
      setEntityError(false);
      return;
    }
    let cancelled = false;
    setSearchingEntities(true);
    const t = setTimeout(async () => {
      const results = await Promise.all(
        ENTITY_KINDS.map(async ({ kind, base, label, plural }) => {
          try {
            const needle = q.slice(0, 120);
            const res = await fetch(
              `/api/perm-entities/${kind}?q=${encodeURIComponent(needle)}&limit=${PALETTE_PER_KIND}`,
            );
            if (!res.ok) return { rows: [] as EntityHit[], failed: true };
            const payload = (await res.json()) as EntityPayload;
            // A row without a slug has no page: String(null) would link "/null".
            const rows: EntityHit[] = payload.rows
              .slice(0, PALETTE_PER_KIND)
              .filter((r) => typeof r[0] === "string" && r[0] !== "")
              .map((r) => ({
                name: String(r[1]),
                href: `${base}/${String(r[0])}`,
                total: Number(r[3]) || 0,
                kindLabel: label,
              }));
            // Employers DOL hasn't published yet (23% of the employers held).
            // They were in the answer and the palette dropped them.
            for (const h of (payload.live ?? []).slice(0, 3)) {
              if (!h.slug) continue;
              rows.push({
                name: h.name,
                href: `/perm-employers/${h.slug}`,
                total: h.cases,
                kindLabel: "Employer, not published yet",
              });
            }
            if (payload.more || payload.liveMore) {
              rows.push({
                name: `Every ${plural.replace(/s$/, "")} matching \u201c${needle}\u201d`,
                href: `${base}?q=${encodeURIComponent(needle)}`,
                total: 0,
                kindLabel: label,
                more: true,
              });
            }
            return { rows, failed: false };
          } catch {
            return { rows: [] as EntityHit[], failed: true };
          }
        }),
      );
      if (!cancelled) {
        const rows = results.flatMap((r) => r.rows);
        setEntityHits(rows);
        // Only when EVERY kind failed. One kind erroring while the others
        // answer is a partial result, not an outage, and saying "the search
        // did not load" over a list of hits would be its own lie.
        setEntityError(rows.length === 0 && results.every((r) => r.failed));
        setSearchingEntities(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, caseNumber, month]);

  // Escape closes, Tab stays inside, and focus goes back where it came from.
  //
  // THE COMMENT THIS REPLACES SAID THE DIALOG ELEMENT HANDLED CONTAINMENT.
  // There is no dialog element: this is a plain `<div>` over the page, so Tab
  // walked straight out of the palette into the header and the article behind
  // it while the overlay stayed up - every one of those stops invisible under
  // the scrim. Keyboard operability is a floor here, not a nicety.
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      // cmdk keeps selection on the input and moves it with the arrow keys, so
      // in practice there are one or two stops; the wrap still has to exist or
      // the second Tab leaves.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      role="presentation"
    >
      <Command
        ref={panelRef}
        label="Search PERM Tracker"
        shouldFilter={true}
        filter={paletteFilter}
        role="dialog"
        aria-modal="true"
        aria-label="Search PERM Tracker"
        className="w-full max-w-xl border border-border bg-background text-foreground"
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          {navPending ? (
            <CircleNotchIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 animate-spin text-foreground motion-reduce:animate-none"
              weight="bold"
            />
          ) : (
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            /* MEASURED, NOT ESTIMATED. The old string was 60 characters and
               487.8px of real Inter at 16px; this input's box is 226px wide on
               a 320px phone and 266px on a 360px one, so two thirds of it was
               simply not on screen and the field stopped saying what it takes.
               This one is 214.5px, under the 220px floor `scripts/audit_
               placeholders.py` derives, so it fits every width. The full list
               is in the hint line below, which is where a list belongs. */
            placeholder="Name, page or case number"
            className="min-h-[52px] w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        {/* The persistent hint. It does not truncate, it does not disappear
            the moment you type, and it is the only place that can hold the
            whole list of what this box accepts. */}
        <p className="border-b border-border px-4 py-2 text-sm leading-snug text-muted-foreground">
          Employers, law firms, occupations, pages and articles. Paste a G-, A-,
          P-, I- or H- case number and it goes straight to the lookup.
        </p>
        {navTarget !== null ? (
          <p
            role="status"
            className="flex items-center gap-2 border-b border-border bg-tint px-4 py-2 text-sm font-bold"
          >
            <CircleNotchIcon
              aria-hidden="true"
              className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
              weight="bold"
            />{" "}
            <span>Opening {navTarget}…</span>
          </p>
        ) : null}
        <Command.List className="max-h-[55vh] overflow-y-auto p-2">
          {/* WHY THIS IS NOT INSIDE `Command.Empty`. It was, and `Command.Empty`
              renders only when NOTHING matches - but the static index almost
              always matches something, so the corpus lookup ran with no signal
              at all on exactly the queries it exists for. Typing an employer
              name showed a page list and no indication anything was still
              being fetched. */}
          {searchingEntities ? (
            <p
              role="status"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground"
            >
              <CircleNotchIcon
                aria-hidden="true"
                className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
                weight="bold"
              />{" "}
              <span>Searching employers, firms and occupations…</span>
            </p>
          ) : null}
          {entityError ? (
            <p role="status" className="px-3 py-2.5 text-sm text-soft">
              The corpus lookup didn&apos;t load, so employers, firms and
              occupations are missing from this list. The pages below still
              work.
            </p>
          ) : null}
          {caseNumber ? (
            <Command.Item
              value={`case ${caseNumber}`}
              onSelect={() => go(`/perm-case-status?case=${encodeURIComponent(caseNumber)}`, `case ${caseNumber}`)}
              className={ACTION_ROW}
            >
              Check case {caseNumber}: live status and estimate
            </Command.Item>
          ) : null}
          {month ? (
            <Command.Item
              value={`month ${month}`}
              onSelect={() =>
                go(
                  `/tools/perm-timeline-calculator?month=${encodeURIComponent(month)}`,
                  `cases filed ${month}`,
                )
              }
              className={ACTION_ROW}
            >
              Estimate for cases filed {month}
            </Command.Item>
          ) : null}

          <Command.Empty className="px-3 py-6 text-sm text-muted-foreground">
            {/* The searching and failure cases are stated above, once, for the
                whole list. Repeating "searching" here made an empty result and
                an in-flight one look the same. */}
            {searchingEntities
              ? null
              : `Nothing matches “${query.trim()}”. Try an employer, a law firm, a page name, or a case number.`}
          </Command.Empty>

          {suggestions.length > 0 ? (
            /* Kept on the list whatever the filter says: these are the
               closest names to a search that matched none exactly. */
            <Command.Group
              forceMount
              heading="Did you mean"
              className={GROUP_HEADING}
            >
              {suggestions.map((h) => (
                <Command.Item
                  forceMount
                  key={h.href}
                  value={`suggest ${h.name}`}
                  onSelect={() => go(h.href, h.name)}
                  className={ROW}
                >
                  <span className="min-w-0 truncate">{h.name}</span>{" "}
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {`${KIND_NOUN[h.kind]} · ${h.cases.toLocaleString("en-US")} ${h.cases === 1 ? "case" : "cases"}`}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          {entityHits.length > 0 ? (
            <Command.Group
              heading="In the data"
              className={GROUP_HEADING}
            >
              {entityHits.map((h) => (
                <Command.Item
                  key={h.href}
                  value={`${h.kindLabel} ${h.name}`}
                  onSelect={() => go(h.href, h.name)}
                  className={ROW}
                >
                  <span className="min-w-0 truncate">{h.name}</span>{" "}
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {h.more
                      ? "More than fit here"
                      : `${h.kindLabel} · ${h.total.toLocaleString("en-US")} ${h.total === 1 ? "case" : "cases"}`}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          {!caseNumber && !month && query.trim().length >= 2 ? (
            /* The bridge to the cross-program search. The entity rows below
               answer "who is this employer"; this one answers "what have they
               filed", across PERM, wage requests and LCAs at once, which no
               other row on this list covers. */
            <Command.Item
              value={`all programs ${query.trim()}`}
              onSelect={() =>
                go(
                  `/case-search?q=${encodeURIComponent(query.trim().slice(0, 120))}`,
                  `every filing by "${query.trim()}"`,
                )
              }
              className={ACTION_ROW}
            >
              All results for &ldquo;{query.trim()}&rdquo;
            </Command.Item>
          ) : null}
          {PAGE_GROUPS.map(
            (group) => (
              <Command.Group
                key={group}
                heading={group}
                className={GROUP_HEADING}
              >
                {pages
                  // Before anything is typed, only the main jobs show.
                  .filter((p) => p.group === group && (query.trim() !== "" || p.main))
                  .map((p) => (
                    <Command.Item
                      key={p.href}
                      value={`${p.label} ${p.keywords}`}
                      onSelect={() => go(p.href, p.label)}
                      className={ROW}
                    >
                      {p.label}
                    </Command.Item>
                  ))}
              </Command.Group>
            ),
          )}

          {articles.length > 0 ? (
            <Command.Group
              heading="Articles"
              className={GROUP_HEADING}
            >
              {articles.map((a) => (
                <Command.Item
                  key={a.href}
                  value={`${a.title} ${a.kind}`}
                  onSelect={() => go(a.href, a.title)}
                  className={ROW}
                >
                  <span className="min-w-0 truncate">{a.title}</span>{" "}
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {a.kind}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
        </Command.List>
        <div className="border-t border-border px-4 py-2 text-sm text-muted-foreground">
          Esc closes · Enter opens · a case number goes straight to the lookup
        </div>
      </Command>
    </div>
  );
}

export default SearchPalette;
