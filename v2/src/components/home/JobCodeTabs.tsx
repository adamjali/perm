"use client";

import { Fragment, useRef, useState, type KeyboardEvent } from "react";

import { AppWindow, type WindowShots } from "@/components/marketing/AppWindow";
import { cn } from "@/lib/utils";

export interface JobCodeStep {
  title: string;
  text: string;
  url: string;
  shots: WindowShots;
  alt: string;
}

/**
 * The job-code steps as tabs beside one app window: picking a step shows its capture, so three pictures take
 * one picture's room. A vertical tablist (WAI-ARIA's tabs pattern): arrow keys, Home and End move between
 * steps. Every panel is in the HTML; the ones not picked are `hidden`, so the window is as tall as the picture
 * shown (holding the tallest's room left a blank band under the shorter two).
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
      ArrowDown: () => go(active + 1),
      ArrowRight: () => go(active + 1),
      ArrowUp: () => go(active - 1),
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
    <div className="grid gap-10 [&>*]:min-w-0 lg:grid-cols-12 lg:items-start lg:gap-14">
      <div role="tablist" aria-label={label} aria-orientation="vertical" onKeyDown={onKeyDown} className="flex flex-col gap-3 lg:col-span-5">
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
                  "flex min-h-11 w-full items-start gap-4 border-2 px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "border-foreground bg-card shadow-hard" : "border-border/60 hover:border-foreground hover:bg-card",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 shrink-0 place-items-center border-2 border-foreground font-mono text-base font-bold",
                    on ? "bg-primary text-black" : "bg-background text-foreground",
                  )}
                >
                  {i + 1}
                </span>{" "}
                <span className="min-w-0">
                  <span className="block font-heading text-lg font-bold leading-snug">{s.title}</span>{" "}
                  {/* On a phone only the picked step says more, so the window stays near the steps. */}
                  <span className={cn("mt-1 text-base leading-relaxed text-soft", on ? "block" : "hidden lg:block")}>{s.text}</span>
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>{" "}
      <div className="lg:col-span-7">
        {steps.map((s, i) => (
          <div
            key={s.url + s.title}
            role="tabpanel"
            id={`job-code-panel-${i}`}
            aria-labelledby={`job-code-tab-${i}`}
            hidden={i !== active}
          >
            <AppWindow url={s.url} shots={s.shots} alt={s.alt} caption="Sample cases." />
          </div>
        ))}
      </div>
    </div>
  );
}
