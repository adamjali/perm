"use client";

import { ArrowCounterClockwiseIcon, CaretDownIcon } from "@phosphor-icons/react";
import { useId, type ReactNode } from "react";

import type { DayRange, PlanStep, QueueDating, Span } from "@/lib/perm";

import { withTrack } from "./assumptions";
import { fromUnit, LENGTH_UNIT, rangeLabel, spanInUnit, type LengthKey } from "./format";
import { NumberBox } from "./NumberBox";

export interface StepEditor {
  /** Today's span for the step, in days; null where nothing measured supports one. */
  base: Span | null;
  /** The reader's own, in days. */
  own: Span | undefined;
  onChange: (span: Span | null) => void;
}

export interface QueueChoice {
  dating: QueueDating;
  on: boolean;
  onChange: (on: boolean) => void;
  /** What the step's end would be from DOL's plain wait instead. */
  plain: DayRange | null;
}

const TRACKS = [
  { key: "low", label: "Quick" },
  { key: "mid", label: "Typical" },
  { key: "high", label: "Slow" },
] as const;

/**
 * Every figure the plan assumes, in one fold: each step's quick, typical and slow length (where
 * it stands now and what the length rests on beside it), how a filed case is dated, and the
 * bulletin wait. Closed until the reader opens it or has changed something.
 */
export function ChangeFigures({
  open,
  onToggle,
  changes,
  onReset,
  steps,
  sideSteps,
  standing,
  sources,
  editors,
  queues,
  bulletin,
  today,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  changes: number;
  onReset: () => void;
  steps: PlanStep[];
  sideSteps: PlanStep[];
  standing: Partial<Record<PlanStep["key"], string>>;
  sources: Partial<Record<PlanStep["key"], string>>;
  editors: Partial<Record<LengthKey, StepEditor>>;
  queues: Partial<Record<"pwd" | "perm", QueueChoice>>;
  bulletin: ReactNode;
  today: string;
}) {
  const rows = [...steps, ...sideSteps].filter((s) => s.key !== "visa");
  return (
    <details id="figures" open={open} onToggle={(e) => onToggle(e.currentTarget.open)} className="group mt-14 scroll-mt-24 border-y-2 border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="font-heading text-2xl font-bold">Change the figures</span>{" "}
        {changes ? <span className="bg-soft-info px-2 text-sm">{changes} changed</span> : null}{" "}
        <CaretDownIcon aria-hidden="true" className="ml-auto size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" weight="bold" />
      </summary>{" "}
      <div className="pb-8">
        <p className="max-w-3xl text-base leading-relaxed text-soft">
          Every length starts at today&apos;s measured figure. Type your own to see what it does.
        </p>{" "}
        {changes ? (
          <button
            type="button"
            onClick={onReset}
            className="mt-4 inline-flex min-h-11 items-center gap-2 border-2 border-foreground bg-background px-4 font-semibold"
          >
            <ArrowCounterClockwiseIcon aria-hidden="true" className="size-4" /> Back to today&apos;s figures
          </button>
        ) : null}{" "}
        <ul className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2 [&>*]:min-w-0">
          {rows.map((s) => {
            const editor = editors[s.key as LengthKey];
            const queue = s.key === "pwd" || s.key === "perm" ? queues[s.key] : undefined;
            return (
              <li key={s.key}>
                <p className="font-semibold">{s.name}</p>{" "}
                <p className="text-sm leading-relaxed text-soft">{standing[s.key] ?? s.basis}</p>{" "}
                {s.known.end ? (
                  <p className="mt-2 text-sm">Your own date sets this step.</p>
                ) : (
                  <>
                    {queue ? <QueueSwitch queue={queue} today={today} /> : null}{" "}
                    {editor && !(queue && queue.on) ? <LengthBoxes k={s.key as LengthKey} editor={editor} /> : null}{" "}
                    {sources[s.key] ? <p className="mt-2 text-sm leading-relaxed text-soft">{sources[s.key]}.</p> : null}
                  </>
                )}{" "}
              </li>
            );
          })}
        </ul>{" "}
        {bulletin}
      </div>
    </details>
  );
}

/** A step's three lengths as number boxes: today's figures until the reader types their own. */
function LengthBoxes({ k, editor }: { k: LengthKey; editor: StepEditor }) {
  const id = useId();
  const unit = LENGTH_UNIT[k];
  const shown = editor.own ?? editor.base;
  const inUnit = shown ? spanInUnit(shown, unit) : null;
  return (
    <fieldset className="mt-2">
      <legend className="sr-only">How long it takes, in {unit}</legend>
      <div className="grid grid-cols-3 gap-3 [&>*]:min-w-0">
        {TRACKS.map((t) => (
          <NumberBox
            key={t.key}
            id={`${id}-${t.key}`}
            label={`${t.label}, ${unit}`}
            labelClassName="text-sm font-normal"
            value={inUnit ? inUnit[t.key] : null}
            placeholder="Not measured"
            step={unit === "days" ? 1 : 0.1}
            onChange={(v) => {
              // An emptied box keeps the step's lengths as they were; the link below puts today's back.
              if (v === null) return;
              const days = fromUnit(v, unit);
              editor.onChange(withTrack(shown ?? { low: days, mid: days, high: days }, t.key, days));
            }}
          />
        ))}
      </div>{" "}
      {editor.own ? (
        <button type="button" onClick={() => editor.onChange(null)} className="link inline-flex min-h-11 items-center text-sm">
          Today&apos;s figures for this step
        </button>
      ) : null}
    </fieldset>
  );
}

function QueueSwitch({ queue, today }: { queue: QueueChoice; today: string }) {
  const id = useId();
  const q = queue.dating;
  return (
    <fieldset className="mt-2">
      <legend className="sr-only">How it&apos;s dated</legend>
      <label htmlFor={`${id}-q`} className="flex min-h-11 items-center gap-3 text-sm">
        <input id={`${id}-q`} type="radio" name={`${id}-way`} checked={queue.on} onChange={() => queue.onChange(true)} className="size-5 shrink-0 accent-primary" />{" "}
        <span>
          {q.casesAhead.toLocaleString("en-US")} ahead of yours at {q.perDay} a day:{" "}
          <b className="font-semibold tabular-nums">{rangeLabel(q, today)}</b>
        </span>
      </label>{" "}
      <label htmlFor={`${id}-p`} className="flex min-h-11 items-center gap-3 text-sm">
        <input id={`${id}-p`} type="radio" name={`${id}-way`} checked={!queue.on} onChange={() => queue.onChange(false)} className="size-5 shrink-0 accent-primary" />{" "}
        <span>
          DOL&apos;s wait now{queue.plain ? ": " : ""}
          {queue.plain ? <b className="font-semibold tabular-nums">{rangeLabel(queue.plain, today)}</b> : null}
        </span>
      </label>
    </fieldset>
  );
}
