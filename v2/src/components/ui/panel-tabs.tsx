"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";

export interface PanelTab {
  /** A stable id for the tab and its panel. */
  id: string;
  label: string;
  panel: ReactNode;
}

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash.slice(1);
const noHash = () => "";

/**
 * One row of choices over panels rendered on the server: every panel is in the HTML (search and screen
 * readers read all of them), the ones not picked are `hidden`. The pick is the site's lime choice.
 * WAI-ARIA's tabs pattern: left and right arrows, Home and End move between tabs.
 * A link can open a tab: `#<tab id>` (or `#<tab id>-tab`) picks it and brings the row into view, so
 * `/consular-posts#niv-k1` lands on the K-1 table.
 */
export function PanelTabs({ tabs, label, className }: { tabs: PanelTab[]; label: string; className?: string }) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const hash = useSyncExternalStore(subscribeHash, readHash, noHash);
  const fromHash = tabs.findIndex((t) => hash === t.id || hash === `${t.id}-tab`);
  // A new address picks its tab once; a click afterwards still moves freely.
  const [seenHash, setSeenHash] = useState("");
  if (hash !== seenHash) {
    setSeenHash(hash);
    if (fromHash >= 0) setActive(fromHash);
  }
  useEffect(() => {
    if (fromHash >= 0) box.current?.scrollIntoView({ block: "start" });
  }, [hash, fromHash]);

  function go(i: number) {
    const next = (i + tabs.length) % tabs.length;
    setActive(next);
    buttons.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => void> = {
      ArrowRight: () => go(active + 1),
      ArrowLeft: () => go(active - 1),
      Home: () => go(0),
      End: () => go(tabs.length - 1),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      move();
    }
  }

  return (
    <div ref={box} className={cn("scroll-mt-24", className)}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex flex-wrap gap-2">
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <Fragment key={t.id}>
              {" "}
              <button
                ref={(el) => {
                  buttons.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${t.id}-tab`}
                aria-selected={on}
                aria-controls={t.id}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(choiceVariants({ on }))}
              >
                {t.label}
              </button>
            </Fragment>
          );
        })}
      </div>{" "}
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={t.id} aria-labelledby={`${t.id}-tab`} hidden={i !== active} className="pt-5">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
