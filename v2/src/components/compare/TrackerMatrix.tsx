import { Fragment } from "react";
import { CheckIcon, MinusIcon, QuestionIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import { ROWS, type Cell, type Mark, type Tracker } from "@/lib/compare/trackers";
import { cn } from "@/lib/utils";

/**
 * Every tracker against every question, as marks: the page's picture. A mark
 * is never colour alone: each has its own shape and its word for a screen
 * reader, and the key under the grid names all four. Hover, tap or the arrow
 * keys show what the mark rests on (`ChartTips`); the same evidence, with its
 * link, is in the list under the grid.
 */

export const MARK_WORD: Record<Mark, string> = {
  yes: "Yes",
  partial: "Partly",
  no: "No",
  unknown: "Couldn't check",
};

export function MarkIcon({ mark, className }: { mark: Mark; className?: string }) {
  const box = "inline-flex size-7 items-center justify-center border-2";
  if (mark === "yes")
    return (
      <span aria-hidden="true" className={cn(box, "border-foreground bg-primary text-primary-foreground", className)}>
        <CheckIcon weight="bold" className="size-4" />
      </span>
    );
  if (mark === "partial")
    return (
      <span aria-hidden="true" className={cn(box, "border-foreground bg-hatch text-input", className)}>
        <span className="size-2.5 bg-foreground" />
      </span>
    );
  if (mark === "no")
    return (
      <span aria-hidden="true" className={cn(box, "border-input bg-card text-soft", className)}>
        <MinusIcon weight="bold" className="size-4" />
      </span>
    );
  return (
    <span aria-hidden="true" className={cn(box, "border-dashed border-input bg-card text-muted-foreground", className)}>
      <QuestionIcon weight="bold" className="size-4" />
    </span>
  );
}

function tipFor(t: Tracker, label: string, c: Cell): string {
  return [`${t.name}: ${label}`, MARK_WORD[c.mark], c.note, c.evidence?.quote ? `"${c.evidence.quote}"` : null]
    .filter(Boolean)
    .join("\n");
}

export function TrackerMatrix({ trackers }: { trackers: readonly Tracker[] }) {
  // The key names only the marks the grid uses.
  const used = new Set(trackers.flatMap((t) => ROWS.map((r) => t.cells[r.key].mark)));
  return (
    <figure>
      <ChartTips
        label="PERM trackers compared, question by question"
        scroll="scroll-box overflow-x-auto border-2 border-foreground bg-card"
      >
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">
            What each PERM tracker offers, read on each site&apos;s own pages{" "}
          </caption>
          <thead>
            <tr className="border-b-2 border-foreground">
              <th scope="col" className="sticky left-0 z-10 w-[9.5rem] bg-card p-3 text-sm font-semibold text-soft sm:w-[15rem]">
                Question{" "}
              </th>
              {trackers.map((t, i) => (
                <Fragment key={t.slug}>
                  <th
                    scope="col"
                    className={cn(
                      "p-3 text-center align-bottom text-sm font-bold leading-tight",
                      i === 0 && "bg-primary text-primary-foreground",
                    )}
                  >
                    {t.name}{" "}
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-b-0">
                <th scope="row" className="sticky left-0 z-10 bg-card p-2.5 text-sm font-semibold leading-snug sm:p-3">
                  {/* A form code never breaks at its hyphen ("H-" then "2B"). */}
                  {r.label.replace(/-(?=\d)/g, "\u2011")}{" "}
                </th>
                {trackers.map((t, i) => {
                  const c = t.cells[r.key];
                  return (
                    <Fragment key={t.slug}>
                      <td className={cn("p-2 text-center", i === 0 && "bg-tint")}>
                        <span data-tip={tipFor(t, r.label, c)} className="inline-flex">
                          <MarkIcon mark={c.mark} />
                          <span className="sr-only">{MARK_WORD[c.mark]}{" "}</span>
                        </span>
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ChartTips>{" "}
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-soft">
        {(["yes", "partial", "no", "unknown"] as const).filter((m) => used.has(m)).map((m) => (
          <Fragment key={m}>
            <span className="inline-flex items-center gap-2">
              <MarkIcon mark={m} className="size-5" />
              {MARK_WORD[m]}
            </span>{" "}
          </Fragment>
        ))}
        <span className="sm:hidden">Swipe the grid to see all {trackers.length} sites. Tap a mark to see what it rests on.</span>{" "}
        <span className="hidden sm:inline">Point at or tap a mark to see what it rests on.</span>
      </figcaption>
    </figure>
  );
}
