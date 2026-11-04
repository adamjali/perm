"use client";

/**
 * The admin page's sections as tabs, so a growing page reads as four short
 * ones. The chosen tab is the URL hash (#alerts) and nothing else, so a reload,
 * a shared link, an emailed link that came through sign-in, Back and Forward,
 * and a second link followed while the page is open all land on the section
 * they name. Arrow keys move between tabs, per the WAI-ARIA tabs pattern.
 */

import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { choiceVariants } from "@/components/ui/choice";

export interface AdminTab {
  id: string;
  label: string;
  /** A count shown beside the label, when there is one worth seeing. */
  badge?: string | null;
  content: ReactNode;
}

const TAB_EVENT = "pt:admin-tab";

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(TAB_EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(TAB_EVENT, onChange);
  };
}

const readHash = () => window.location.hash.slice(1);

export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  // Read from the address on every render and every hash change: read once, a
  // link followed while the page was open, or an address that settled a moment
  // after the tabs mounted (a sign-in's navigation), left the old tab showing.
  // These tabs only mount in the browser, after the admin data loads.
  const fromHash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const active = tabs.some((t) => t.id === fromHash) ? fromHash : (tabs[0]?.id ?? "");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function choose(id: string, focus = false) {
    // replaceState fires no hashchange, so the store is told by hand.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
    window.dispatchEvent(new Event(TAB_EVENT));
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
      <div role="tablist" aria-label="Admin sections" className="flex flex-wrap gap-2">
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
              className={choiceVariants({ on: selected })}
            >
              {t.label}
              {t.badge ? <span className="text-muted-foreground tabular-nums"> {t.badge}</span> : null}
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
