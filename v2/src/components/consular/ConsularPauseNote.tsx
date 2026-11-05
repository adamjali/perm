import { WarningCircleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { CSSProperties } from "react";

import { FinePrint } from "@/components/data/FinePrint";
import { CONSULAR_PAUSE, pauseActive, type ConsularPause } from "@/lib/consular/facts";
import { cn } from "@/lib/utils";
import { longDate } from "@convex/lib/months";

/**
 * The consular interview pause, dated, from the one hand-kept record (scripts/data/consular_facts.json).
 * Nothing renders once the record says interviews have resumed.
 *
 * - `line`: one dated line wherever a green card date appears (the bulletin pages, the green card
 *   line tool, the featured guide, the planner's consulate route). A current priority date is an
 *   interview only once the consulate is scheduling again.
 * - `full`: the consulate pages' panel, with State's sworn words and what others reported, kept apart.
 */
/** Links on the warm tint are ink: the lime link ink reads 4.17:1 on it, under AA's 4.5. */
const INK_LINKS = { "--primary-text": "var(--foreground)" } as CSSProperties;

export function ConsularPauseNote({
  variant = "line",
  pause = CONSULAR_PAUSE,
  className,
}: {
  variant?: "line" | "full";
  pause?: ConsularPause;
  className?: string;
}) {
  if (!pauseActive(pause)) return null;
  const checked = longDate(pause.checked);
  if (variant === "line") {
    return (
      // A block, never a <p>: inside an article the prose rules reach into not-prose parts.
      <div role="note" style={INK_LINKS} className={cn("flex items-start gap-2 border-l-4 border-data-warn-ink bg-soft-warn px-4 py-3 text-base leading-relaxed", className)}>
        <WarningCircleIcon aria-hidden="true" weight="bold" className="mt-1 size-4 shrink-0 text-data-warn-ink" />{" "}
        <span>
          <span className="font-bold">Consulate interviews are paused at most posts.</span> State postponed immigrant visa
          interviews worldwide from {pause.sinceLabel} for new public charge training and has named no end date, so a
          current date abroad isn&apos;t an interview yet. An I-485 filed inside the US isn&apos;t part of this pause.{" "}
          <Link href="/consular-posts" className="link">
            Where each consulate stands
          </Link>{" "}
          <span className="text-sm text-muted-foreground">(checked {checked})</span>
        </span>
      </div>
    );
  }
  return (
    <section aria-labelledby="pause-status" style={INK_LINKS} className={cn("border-l-4 border-data-warn-ink bg-soft-warn p-5 sm:p-6", className)}>
      <h2 id="pause-status" className="flex items-center gap-2 font-heading text-xl font-bold">
        <WarningCircleIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 text-data-warn-ink" /> Interviews paused
        since {pause.sinceLabel}
      </h2>{" "}
      <p className="mt-3 max-w-3xl text-base leading-relaxed">{pause.summary}</p>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed">{pause.reinterviewsExempt}</p>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        How often consular officers have refused visas on public charge grounds, year by year, in State&apos;s own counts:{" "}
        <Link href="/visa-refusals#public-charge" className="link">
          visa refusals by ground
        </Link>
        .
      </p>{" "}
      <p className="mt-2 text-sm text-muted-foreground">Checked against the sources below on {checked}.</p>{" "}
      <FinePrint summary="What State has said under oath" className="mt-2">
        <ul className="space-y-3">
          {pause.sources.map((s) => (
            <li key={s.url} className="text-base leading-relaxed">
              <q>{s.quote}</q>{" "}
              <a href={s.url} className="link" target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>{" "}
            </li>
          ))}
        </ul>
      </FinePrint>{" "}
      {pause.reported.length ? (
        <FinePrint summary="What others have reported (State hasn't confirmed it)">
          <ul className="space-y-2">
            {pause.reported.map((r) => (
              <li key={r.url} className="text-base leading-relaxed">
                {r.says}{" "}
                <a href={r.url} className="link" target="_blank" rel="noopener noreferrer">
                  {r.label}
                </a>{" "}
              </li>
            ))}
          </ul>
        </FinePrint>
      ) : null}
    </section>
  );
}
