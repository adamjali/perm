"use client";

import { Fragment, useRef, useState, type KeyboardEvent } from "react";

import { AppWindow, type WindowShots } from "@/components/marketing/AppWindow";
import { cn } from "@/lib/utils";

export interface JobCodeStep {
  /** The step's name on the switch, a few words. */
  title: string;
  text: string;
  url: string;
  shots: WindowShots;
  alt: string;
}

/**
 * The job-code steps as one switch over one app window. All three choices sit in one
 * bar, and a single lime block slides under the picked one (the site's mark for a
 * pick), so the bar reads as a switch with the other positions open to press (owner,
 * Nov 2 2026: cards in a column, then a joined tab strip, didn't read as something you
 * switch). Picking a step shows its capture below, so three pictures take one
 * picture's room. WAI-ARIA's tabs pattern: left and right arrows, Home and End move
 * between steps. Every panel is in the HTML; the ones not picked are `hidden`.
 */
export function JobCodeTabs({ steps, label }: { steps: JobCodeStep[]; label: string }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function go(i: number) {
    const next = (i + steps.length) % steps.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => void> = {
      ArrowRight: () => go(active + 1),
      ArrowLeft: () => go(active - 1),
      Home: () => go(0),
      End: () => go(steps.length - 1),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      move();
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="relative grid border-2 border-foreground bg-tint p-1 [&>*]:min-w-0"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {/* The switch's block: one width of a choice, slid to the picked one. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 left-1 border-2 border-foreground bg-primary shadow-hard-sm transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `calc((100% - 0.5rem) / ${steps.length})`, transform: `translateX(${active * 100}%)` }}
        />
        {steps.map((s, i) => {
          const on = i === active;
          return (
            <Fragment key={s.url + s.title}>
              {" "}
              <button
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`job-code-tab-${i}`}
                aria-selected={on}
                aria-controls={`job-code-panel-${i}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  "relative flex min-h-12 items-center justify-center gap-2 px-2 py-2 text-center font-heading text-sm leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:text-base",
                  on ? "font-bold text-primary-foreground" : "font-semibold text-soft hover:bg-card hover:text-foreground",
                )}
              >
                <span aria-hidden="true" className="font-mono text-xs sm:text-sm">
                  {i + 1}
                </span>{" "}
                <span className="min-w-0">{s.title}</span>
              </button>
            </Fragment>
          );
        })}
      </div>{" "}
      {steps.map((s, i) => (
        <div
          key={s.url + s.title}
          role="tabpanel"
          id={`job-code-panel-${i}`}
          aria-labelledby={`job-code-tab-${i}`}
          hidden={i !== active}
          className="pt-5"
        >
          <p className="max-w-2xl text-base leading-relaxed">{s.text}</p>{" "}
          <AppWindow url={s.url} shots={s.shots} alt={s.alt} caption="Sample cases." className="mt-5" />
        </div>
      ))}
    </div>
  );
}
