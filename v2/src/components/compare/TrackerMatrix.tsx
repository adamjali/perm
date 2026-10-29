import { Fragment } from "react";
import { CheckIcon, MinusIcon, QuestionIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import { GROUPS, ROWS, type Cell, type Mark, type Tracker } from "@/lib/compare/trackers";
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

/**
 * The columns' lists, in the order the trackers come: one header cell over each
 * run of trackers in the same list, and a heavy rule where a new list starts.
 */
function groupSpans(trackers: readonly Tracker[]): { key: string; label: string; span: number }[] {
  const spans: { key: string; label: string; span: number }[] = [];
  for (const t of trackers) {
    const last = spans[spans.length - 1];
    if (last && last.key === t.group) last.span += 1;
    else spans.push({ key: t.group, label: GROUPS.find((g) => g.key === t.group)?.label ?? t.group, span: 1 });
  }
  return spans;
}

export function TrackerMatrix({ trackers }: { trackers: readonly Tracker[] }) {
  // The key names only the marks the grid uses.
  const used = new Set(trackers.flatMap((t) => ROWS.map((r) => t.cells[r.key].mark)));
  const spans = groupSpans(trackers);
  /** The column that opens a list after the first gets the heavy rule. */
  const startsList = (i: number) => i > 0 && trackers[i]!.group !== trackers[i - 1]!.group;
  return (
    <figure>
      <ChartTips
        label="PERM trackers compared, question by question"
        scroll="scroll-box overflow-x-auto border-2 border-foreground bg-card"
      >
        {/* Wide enough for every site's column to hold its name on two lines; past
            the screen the grid scrolls in its own box, the question column held. */}
        <table className="w-full border-collapse text-left" style={{ minWidth: `${10 + trackers.length * 4.5}rem` }}>
          <caption className="sr-only">
            What each PERM tracker offers, read on each site&apos;s own pages{" "}
          </caption>
          <thead>
            {spans.length > 1 ? (
              <tr className="border-b border-border">
                <td className="sticky left-0 z-10 bg-card" />
                {spans.map((g, i) => (
                  <Fragment key={g.key}>
                    <th
                      scope="colgroup"
                      colSpan={g.span}
                      className={cn("px-3 pb-1 pt-3 text-left text-sm font-semibold text-soft", i > 0 && "border-l-2 border-foreground")}
                    >
                      {g.label}{" "}
                    </th>
                  </Fragment>
                ))}
              </tr>
            ) : null}
            <tr className="border-b-2 border-foreground">
              <th scope="col" className="sticky left-0 z-10 bg-card p-3 text-sm font-semibold text-soft">
                {/* A block of fixed width holds the question column open: with eleven sites
                    the table's own sizing squeezed every question onto three or four lines. */}
                <span className="block w-[7.5rem] sm:w-[11.5rem]">Question{" "}</span>
              </th>
              {trackers.map((t, i) => (
                <Fragment key={t.slug}>
                  <th
                    scope="col"
                    className={cn(
                      "p-3 text-center align-bottom text-sm font-bold leading-tight",
                      i === 0 && "bg-primary text-primary-foreground",
                      startsList(i) && "border-l-2 border-foreground",
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
                      <td className={cn("p-2 text-center", i === 0 && "bg-tint", startsList(i) && "border-l-2 border-foreground")}>
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
