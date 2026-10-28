"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Fragment, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export interface StageCard {
  key: string;
  name: string;
  who: string;
  form: string;
  /** How long the step takes right now, from the live record where one exists. */
  howLong: string;
  /** Where that figure comes from, in a few words. */
  howLongNote?: string;
  what: string;
  watch: string;
  href: string;
  linkLabel: string;
}

/**
 * Pick a step: the six steps to a green card as tabs, each opening who files,
 * the form, how long it takes now, what happens and the one thing to watch
 * (Sabrina, Oct 27 2026, after H1BPerm's "pick a stage"). Every panel is in the
 * HTML, so search and the palette read all six; only the chosen one shows.
 */
export function StagePicker({ stages, initial = 0 }: { stages: StageCard[]; initial?: number }) {
  const [at, setAt] = useState(Math.min(Math.max(0, initial), stages.length - 1));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const go = (i: number) => {
    const n = (i + stages.length) % stages.length;
    setAt(n);
    tabs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") go(at + 1);
    else if (e.key === "ArrowLeft") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(stages.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="The steps to a green card"
        onKeyDown={onKey}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0"
      >
        {stages.map((s, i) => (
          <Fragment key={s.key}>
            <button
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`stage-tab-${s.key}`}
              aria-selected={i === at}
              aria-controls={`stage-panel-${s.key}`}
              tabIndex={i === at ? 0 : -1}
              onClick={() => setAt(i)}
              className={cn(
                "flex min-h-14 items-center gap-2.5 border-2 border-foreground px-3 py-2 text-left font-heading text-base font-bold transition-colors",
                i === at ? "bg-primary text-primary-foreground shadow-hard-sm" : "bg-card hover:bg-tint",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-7 shrink-0 place-items-center border-2 border-foreground text-sm",
                  i === at ? "bg-background text-foreground" : "bg-tint",
                )}
              >
                {i + 1}
              </span>{" "}
              <span className="min-w-0">{s.name}</span>
            </button>{" "}
          </Fragment>
        ))}
      </div>{" "}
      {stages.map((s, i) => (
        <section
          key={s.key}
          role="tabpanel"
          id={`stage-panel-${s.key}`}
          aria-labelledby={`stage-tab-${s.key}`}
          hidden={i !== at}
          className="object mt-4 p-5 sm:p-6"
        >
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-3 [&>*]:min-w-0">
            <div>
              <dt className="text-sm text-soft">How long now</dt>{" "}
              <dd className="mt-1 font-heading text-2xl font-bold leading-tight">{s.howLong}</dd>{" "}
              {s.howLongNote ? <dd className="mt-1 text-sm text-soft">{s.howLongNote}</dd> : null}
            </div>{" "}
            <div>
              <dt className="text-sm text-soft">Who files</dt>{" "}
              <dd className="mt-1 text-base font-semibold leading-snug">{s.who}</dd>
            </div>{" "}
            <div>
              <dt className="text-sm text-soft">The form, and where</dt>{" "}
              <dd className="mt-1 text-base font-semibold leading-snug">{s.form}</dd>
            </div>
          </dl>{" "}
          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 border-t-2 border-border pt-5 sm:grid-cols-2 [&>*]:min-w-0">
            <p className="text-base leading-relaxed">
              <span className="font-semibold">What happens. </span>
              {s.what}
            </p>{" "}
            <p className="border-l-4 border-data-warn pl-4 text-base leading-relaxed">
              <span className="font-semibold">Watch for. </span>
              {s.watch}
            </p>
          </div>{" "}
          <Link href={s.href} className="link mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold">
            {s.linkLabel} <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
          </Link>
        </section>
      ))}
    </div>
  );
}
