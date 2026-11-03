import Link from "next/link";

import { formatInt } from "@/lib/format";
import { shareSquares } from "@/lib/layoffDisclosures";
import { cn } from "@/lib/utils";

/**
 * The year's yes answers as 100 squares: one employer's against everyone
 * else's. A share of one company in a national count is the part a bar list
 * shows worst, since the top bar fills the scale and says nothing about the rest.
 *
 * The squares are decoration with a label (role="img"); the figures beside
 * them, and the ranked list under them, carry the numbers.
 */
export function LayoffShareGrid({
  topName,
  topSlug,
  topYes,
  totalYes,
  fyLabel,
  className,
}: {
  topName: string;
  topSlug: string | null;
  topYes: number;
  totalYes: number;
  /** "fiscal year 2026 so far". */
  fyLabel: string;
  className?: string;
}) {
  const { top } = shareSquares(topYes, totalYes);
  const squares = Array.from({ length: 100 }, (_, i) => i < top);
  const name = topSlug ? (
    <Link href={`/perm-employers/${topSlug}`} className="link">
      {topName}
    </Link>
  ) : (
    topName
  );
  return (
    <div className={cn("grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] [&>*]:min-w-0", className)}>
      <div
        role="img"
        aria-label={`${top} of every 100 applications that reported a layoff in ${fyLabel} were ${topName}'s.`}
        className="grid w-full max-w-[20rem] grid-cols-10 gap-[3px]"
      >
        {squares.map((isTop, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn("aspect-square border", isTop ? "border-foreground/70 bg-primary" : "border-data-info-ink bg-chart-blue")}
          />
        ))}
      </div>{" "}
      <div>
        <p className="font-heading text-5xl font-bold leading-none tabular-nums sm:text-6xl">
          {top} <span className="text-2xl font-bold sm:text-3xl">of every 100</span>
        </p>{" "}
        <p className="mt-3 max-w-md text-lg leading-relaxed">
          applications that reported a layoff in {fyLabel} were {name}&apos;s: {formatInt(topYes)} of{" "}
          {formatInt(totalYes)}.
        </p>{" "}
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3.5 w-3.5 border border-foreground/70 bg-primary" />{" "}
            {topName}
          </li>{" "}
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3.5 w-3.5 border border-data-info-ink bg-chart-blue" />{" "}
            Every other employer
          </li>{" "}
          <li className="text-muted-foreground">Each square is 1 in 100</li>
        </ul>
      </div>
    </div>
  );
}
