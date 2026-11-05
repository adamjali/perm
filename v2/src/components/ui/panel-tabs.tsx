"use client";

import { Fragment, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";

export interface PanelTab {
  /** A stable id for the tab and its panel. */
  id: string;
  label: string;
  panel: ReactNode;
}

/**
 * One row of choices over panels rendered on the server: every panel is in the HTML (search and screen
 * readers read all of them), the ones not picked are `hidden`. The pick is the site's lime choice.
 * WAI-ARIA's tabs pattern: left and right arrows, Home and End move between tabs.
 */
export function PanelTabs({ tabs, label, className }: { tabs: PanelTab[]; label: string; className?: string }) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

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
    <div className={className}>
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
