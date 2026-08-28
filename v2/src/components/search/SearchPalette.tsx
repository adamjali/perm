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
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { MagnifyingGlass } from "@phosphor-icons/react";

import {
  LEARN_NAV_LINKS,
  PUBLIC_NAV_LINKS,
  TOOL_NAV_LINKS,
} from "@/lib/constants/navigation";
import { SECTIONS } from "@/components/tools/DataNav";
import type { EntityPayload } from "@/lib/entityPayload";

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
}

/** Static destinations, built once from the same constants the navs use. */
function staticIndex(): { label: string; href: string; group: string; keywords: string }[] {
  const out: { label: string; href: string; group: string; keywords: string }[] = [];
  for (const l of PUBLIC_NAV_LINKS) {
    out.push({ label: l.label, href: l.href, group: "Go to", keywords: "" });
  }
  out.push({
    label: "Email preferences",
    href: "/email-preferences",
    group: "Go to",
    keywords: "unsubscribe alerts notifications",
  });
  for (const l of TOOL_NAV_LINKS) {
    out.push({
      label: l.label,
      href: l.href,
      group: "Timelines and calculators",
      keywords: "calculator estimate timeline predictor",
    });
  }
  for (const s of SECTIONS) {
    out.push({
      label: s.label,
      href: s.href,
      group: "Data",
      keywords: "data statistics queue",
    });
  }
  for (const l of LEARN_NAV_LINKS) {
    out.push({ label: l.label, href: l.href, group: "Learn", keywords: "" });
  }
  // De-dupe by href: the nav lists overlap on purpose (Data appears in both
  // PUBLIC_NAV_LINKS and SECTIONS), and two rows for one page read as a bug.
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.href) ? false : (seen.add(e.href), true)));
}

/** `G-100-24339-516453` / `A-23043-00641`, forgiving spaces and case. */
function looksLikeCaseNumber(q: string): string | null {
  const raw = q.trim().toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]-\d{3}-\d{5}-\d+$/.test(raw) || /^[A-Z]-\d{5}-\d{5}$/.test(raw)) {
    return raw;
  }
  return null;
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
  { kind: "employer", base: "/perm-employers", label: "Employer" },
  { kind: "attorney", base: "/perm-attorneys", label: "Law firm" },
  { kind: "occupation", base: "/perm-wages", label: "Occupation" },
] as const;

export function SearchPalette({
  open,
  onOpenChange,
  articles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  articles: SearchArticle[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [entityHits, setEntityHits] = React.useState<EntityHit[]>([]);
  const [searchingEntities, setSearchingEntities] = React.useState(false);

  const pages = React.useMemo(staticIndex, []);
  const caseNumber = looksLikeCaseNumber(query);
  const month = looksLikeMonth(query);

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      setQuery("");
      router.push(href);
    },
    [onOpenChange, router],
  );

  // Entity lookup, debounced. Three kinds in parallel against the same
  // cached `?q=` route the index pages use; a failed kind contributes
  // nothing rather than failing the box.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2 || caseNumber || month) {
      setEntityHits([]);
      return;
    }
    let cancelled = false;
    setSearchingEntities(true);
    const t = setTimeout(async () => {
      const results = await Promise.all(
        ENTITY_KINDS.map(async ({ kind, base, label }) => {
          try {
            const res = await fetch(
              `/api/perm-entities/${kind}?q=${encodeURIComponent(q.slice(0, 120))}`,
            );
            if (!res.ok) return [];
            const payload = (await res.json()) as EntityPayload;
            return payload.rows.slice(0, 5).map((r) => ({
              name: String(r[1]),
              href: `${base}/${String(r[0])}`,
              total: Number(r[3]) || 0,
              kindLabel: label,
            }));
          } catch {
            return [];
          }
        }),
      );
      if (!cancelled) {
        setEntityHits(results.flat());
        setSearchingEntities(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, caseNumber, month]);

  // Escape closes; the dialog element handles focus containment adequately
  // for a single-input surface.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        label="Search PERM Tracker"
        shouldFilter={true}
        className="w-full max-w-xl border-3 border-border bg-background text-foreground shadow-hard-lg"
      >
        <div className="flex items-center gap-2 border-b-2 border-border px-4">
          <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, employers, firms, or paste a case number"
            className="min-h-[52px] w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <Command.List className="max-h-[55vh] overflow-y-auto p-2">
          {caseNumber ? (
            <Command.Item
              value={`case ${caseNumber}`}
              onSelect={() => go(`/perm-case-status?case=${encodeURIComponent(caseNumber)}`)}
              className="cursor-pointer border-2 border-primary bg-primary/10 px-3 py-3 font-bold data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
            >
              Check case {caseNumber}: live status and estimate
            </Command.Item>
          ) : null}
          {month ? (
            <Command.Item
              value={`month ${month}`}
              onSelect={() =>
                go(`/tools/perm-timeline-calculator?month=${encodeURIComponent(month)}`)
              }
              className="cursor-pointer border-2 border-primary bg-primary/10 px-3 py-3 font-bold data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
            >
              Estimate for cases filed {month}
            </Command.Item>
          ) : null}

          <Command.Empty className="px-3 py-6 text-sm text-muted-foreground">
            {searchingEntities
              ? "Searching the corpus…"
              : "Nothing matches. Try an employer, a law firm, a page name, or a case number."}
          </Command.Empty>

          {entityHits.length > 0 ? (
            <Command.Group
              heading="In the data"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {entityHits.map((h) => (
                <Command.Item
                  key={h.href}
                  value={`${h.kindLabel} ${h.name}`}
                  onSelect={() => go(h.href)}
                  className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2.5 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                >
                  <span className="min-w-0 truncate font-semibold">{h.name}</span>{" "}
                  <span className="shrink-0 font-mono text-xs text-muted-foreground data-[selected=true]:text-primary-foreground/80">
                    {h.kindLabel} · {h.total.toLocaleString("en-US")} cases
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          {(["Go to", "Timelines and calculators", "Data", "Learn"] as const).map(
            (group) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {pages
                  .filter((p) => p.group === group)
                  .map((p) => (
                    <Command.Item
                      key={p.href}
                      value={`${p.label} ${p.keywords}`}
                      onSelect={() => go(p.href)}
                      className="cursor-pointer px-3 py-2.5 font-semibold data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
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
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {articles.map((a) => (
                <Command.Item
                  key={a.href}
                  value={`${a.title} ${a.kind}`}
                  onSelect={() => go(a.href)}
                  className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2.5 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground"
                >
                  <span className="min-w-0 truncate font-semibold">{a.title}</span>{" "}
                  <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground data-[selected=true]:text-primary-foreground/80">
                    {a.kind}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
        </Command.List>
        <div className="border-t-2 border-border px-4 py-2 font-mono text-xs text-muted-foreground">
          Esc closes · Enter opens · a case number goes straight to the lookup
        </div>
      </Command>
    </div>
  );
}

export default SearchPalette;
