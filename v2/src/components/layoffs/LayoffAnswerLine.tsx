import Link from "next/link";

import { formatInt, formatShareOf } from "@/lib/format";
import { longDate } from "@/lib/employerStages";
import type { EmployerLayoffAnswer } from "@/lib/layoffDisclosures";
import { cn } from "@/lib/utils";

/**
 * One line on an employer's page: how many of its newest decided applications
 * told DOL of a layoff in the job's occupation (Form 9089, Section G, Item 12).
 * Shown only when it said yes at least once; the answers are the employer's own.
 */
export function LayoffAnswerLine({ answer, name, className }: { answer: EmployerLayoffAnswer; name: string; className?: string }) {
  const span =
    answer.from && answer.through ? ` decided from ${longDate(answer.from)} to ${longDate(answer.through)}` : ` decided in fiscal year ${answer.fy}`;
  return (
    <p className={cn("bg-tint px-4 py-3 text-base leading-relaxed", className)}>
      On its PERM applications{span}, {name} told DOL of a layoff in the job&apos;s occupation on{" "}
      <span className="font-bold tabular-nums">{formatInt(answer.yes)}</span> of {formatInt(answer.answered)} (
      {formatShareOf(answer.yes, answer.answered)}).{" "}
      <Link href="/perm-layoff-disclosures" className="link inline-flex min-h-11 items-center sm:min-h-0">
        Every employer&apos;s answers
      </Link>
    </p>
  );
}
