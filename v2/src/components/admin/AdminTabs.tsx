"use client";

/**
 * The admin page's sections as tabs, so a growing page reads as four short
 * ones. The chosen tab lives in the URL hash (#alerts), so a reload or a
 * shared link lands on the same section. Arrow keys move between tabs, per
 * the WAI-ARIA tabs pattern.
 */

import { useRef, useState, type ReactNode } from "react";

export interface AdminTab {
  id: string;
  label: string;
  /** A count shown beside the label, when there is one worth seeing. */
  badge?: string | null;
  content: ReactNode;
}

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  // The hash is the starting tab, read in the initializer: reading it in an
  // effect painted Overview first and then jumped. Safe for hydration because
  // these tabs only ever mount in the browser, after the admin data loads
  // (the server renders the page's skeleton). The hash is a starting point,
  // not a live binding.
  const [active, setActive] = useState(() => {
    const fromHash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return tabs.some((t) => t.id === fromHash) ? fromHash : (tabs[0]?.id ?? "");
  });
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function choose(id: string, focus = false) {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    if (focus) refs.current[id]?.focus();
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    const n = tabs.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    choose(tabs[next]!.id, true);
  }

  return (
    <div>
      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-2 border-b-2 border-border pb-3">
        {tabs.map((t, i) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(t.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`inline-flex min-h-[44px] items-center gap-2 border-2 border-border px-4 text-sm font-bold transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 motion-reduce:transition-none ${
                selected ? "bg-foreground text-background shadow-hard-sm" : "bg-background hover:-translate-y-0.5"
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className={`px-1.5 text-sm tabular-nums ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="pt-6"
        >
          {t.id === active ? t.content : null}
        </div>
      ))}
    </div>
  );
}
