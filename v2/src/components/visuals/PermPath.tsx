/**
 * The PERM path: the four working stages in filing order, drawn as linked
 * blocks in their stage colours. The app's recurring picture of where a case
 * is, used in onboarding (with a note per stage) and on the dashboard (with a
 * count per stage, each block linking to those cases).
 */
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";

import type { CaseStatus } from "@/lib/perm";
import { cn } from "@/lib/utils";
import { PERM_PATH, STAGE_VISUALS } from "@/components/status/stage-visuals";

export interface PermPathStep {
  stage: CaseStatus;
  /** A short line under the stage name. */
  note?: string;
  /** A count shown large in the block (dashboard). */
  count?: number;
  /** Makes the block a link. */
  href?: string;
}

interface PermPathProps {
  steps?: PermPathStep[];
  /** Emphasise one stage (a case's current one). */
  activeStage?: CaseStatus;
  className?: string;
  /** Accessible name for the list. */
  label?: string;
}

export function PermPath({
  steps = PERM_PATH.map((stage) => ({ stage })),
  activeStage,
  className,
  label = "The PERM path",
}: PermPathProps) {
  return (
    <ol aria-label={label} className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6", className)}>
      {steps.map((step, i) => (
        <li key={step.stage} className="relative flex min-w-0">
          <PathBlock step={step} index={i} active={activeStage === step.stage} />
          {i < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -right-[26px] z-10 hidden size-7 -translate-y-1/2 place-items-center border-2 border-border bg-background text-foreground sm:grid"
            >
              <ArrowRightIcon className="size-3.5" weight="bold" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function PathBlock({ step, index, active }: { step: PermPathStep; index: number; active: boolean }) {
  const v = STAGE_VISUALS[step.stage];
  return (
    <StatBlock
      fill={v.fill}
      onFill={v.onFill}
      icon={v.icon}
      marker={String(index + 1).padStart(2, "0")}
      label={v.label}
      count={step.count}
      note={step.note}
      href={step.href}
      active={active}
    />
  );
}

interface StatBlockProps {
  /** Header band fill and the ink that reads on it (see stage-visuals). */
  fill: string;
  onFill: string;
  icon: Icon;
  label: string;
  /** Small mono text at the left of the header band (a step number). */
  marker?: string;
  count?: number;
  note?: string;
  href?: string;
  active?: boolean;
}

/**
 * One block in the PERM path's material: a coloured header band with an icon,
 * the label, an optional big count and a note. Exported so outcome tiles
 * (complete, closed) are drawn the same way as the stages.
 */
export function StatBlock({ fill, onFill, icon: IconCmp, label, marker, count, note, href, active = false }: StatBlockProps) {
  const body = (
    <>
      <div className={cn("flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2", fill, onFill)}>
        <span className="font-mono text-sm font-bold tabular-nums">{marker}</span>
        <IconCmp className="size-5" weight="bold" aria-hidden="true" />
      </div>
      <div className="flex flex-1 flex-col px-3 py-3">
        <span className="font-heading text-base font-bold leading-tight">{label}</span>{" "}
        {count !== undefined && (
          <span className="mt-2 font-heading text-4xl font-black leading-none tabular-nums">{count}</span>
        )}{" "}
        {note && <span className="mt-1.5 text-sm leading-snug text-muted-foreground">{note}</span>}
      </div>
    </>
  );

  const frame = cn(
    "flex w-full min-w-0 flex-col border-2 border-border bg-card text-left",
    active ? "shadow-hard" : "shadow-hard-sm",
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          frame,
          "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-hard active:translate-y-0 active:shadow-none",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        )}
        aria-label={count !== undefined ? `${label}: ${count} ${count === 1 ? "case" : "cases"}` : label}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={frame} aria-current={active ? "step" : undefined}>
      {body}
    </div>
  );
}
