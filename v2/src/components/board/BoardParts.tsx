import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CaretDownIcon,
  EqualsIcon,
  FastForwardIcon,
  HourglassMediumIcon,
  LightningIcon,
  PauseIcon,
  RewindIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/ssr";
import { Fragment, type ReactNode } from "react";

import { ScrollBox } from "@/components/ui/scroll-box";
import type { BulletinMoveRow, LineFlow, Shift, StatusMove, StepStatus } from "@/lib/board";
import { CATEGORY_LABEL } from "@/lib/bulletinNext";
import { cn } from "@/lib/utils";
import { monthDay } from "@convex/lib/months";

/**
 * The board's parts (/today). Each answer is a picture first: the four steps on
 * one track, a ruler from where DOL's decisions fell to the day it made them,
 * the line's in and out as two bars, the day's decisions as one bar, every
 * waiting status as a tile, and the bulletin as a grid coloured by how each
 * cutoff moved. Words only name what a picture shows. Server components.
 */

const n = (x: number) => x.toLocaleString("en-US");

// ---------------------------------------------------------------------------
// The track: four stations, in the order a green card goes through them.
// ---------------------------------------------------------------------------

/**
 * The four steps in a row. On a wide screen a rail runs above them, one
 * numbered lime stop over each step, so the order reads as one line; on a
 * phone the steps stack and carry their own numbers.
 */
export function Track({ steps, children }: { steps: readonly string[]; children: ReactNode }) {
  return (
    <div>
      <div aria-hidden="true" className="relative mb-5 hidden grid-cols-4 gap-8 lg:grid">
        <span className="absolute left-[12.5%] right-[12.5%] top-1/2 h-1 -translate-y-1/2 bg-foreground" />
        {steps.map((name, i) => (
          <Fragment key={name}>
            <span className="relative grid place-items-center">
              <span className="grid size-10 place-items-center border-2 border-foreground bg-primary font-heading text-lg font-bold text-primary-foreground">
                {i + 1}
              </span>
            </span>{" "}
          </Fragment>
        ))}
      </div>{" "}
      <ol aria-label="The four steps, in order" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8 [&>*]:min-w-0">
        {children}
      </ol>
    </div>
  );
}

export function Station({
  step,
  name,
  lead,
  big,
  picture,
  shift,
  status,
  facts,
  href,
  linkLabel,
  controls,
  detail,
}: {
  step: number;
  name: string;
  /** What the big figure is, in a few words. */
  lead: string;
  big: string;
  /** The station's picture, the same height in every station. */
  picture: ReactNode;
  /** How it moved, coloured by direction. */
  shift?: Shift | null;
  /** The step's state as a status board says it: backlog shrinking, retrogressed. */
  status?: StepStatus | null;
  /** The figures behind the state, folded under it: the wait in days, the pace, the change. */
  facts?: readonly string[];
  href: string;
  linkLabel: string;
  /** Anything the reader changes in this step, under its picture. */
  controls?: ReactNode;
  /** The step's line in and out, under its picture. */
  detail?: ReactNode;
}) {
  return (
    <li className="object flex flex-col p-5">
      <p className="flex items-center gap-2 font-heading text-lg font-bold">
        {/* The rail above carries the numbers on a wide screen. */}
        <span className="grid size-8 shrink-0 place-items-center border-2 border-foreground bg-primary text-base text-primary-foreground lg:hidden">
          {step}
        </span>{" "}
        {name}
      </p>{" "}
      <p className="mt-3 text-sm text-soft">{lead}</p>{" "}
      <p className="font-heading text-[1.75rem] font-bold leading-tight tabular-nums">{big}</p>{" "}
      <div className="mt-5 h-24">{picture}</div>{" "}
      {controls}{" "}
      {detail}{" "}
      {/* The state and the link sit at the card's foot, so the four steps' lines align. */}
      <div className="mt-auto pt-3">
        {status || shift ? <StepState status={status ?? null} shift={shift ?? null} facts={facts} /> : null}{" "}
        <Link href={href} className="link inline-flex min-h-11 items-center gap-1 pt-1 text-sm font-semibold">
          {linkLabel} <ArrowRightIcon aria-hidden="true" className="size-4" weight="bold" />
        </Link>
      </div>
    </li>
  );
}

const STATE_TEXT: Record<StepStatus["tone"], string> = {
  good: "text-data-good-ink",
  warn: "text-data-warn-ink",
  bad: "text-data-bad-ink",
  flat: "text-soft",
};
const STATE_TILE: Record<StepStatus["tone"], string> = {
  good: "bg-soft-good",
  warn: "bg-soft-wait",
  bad: "bg-soft-bad",
  flat: "bg-tint",
};
const STATE_ICON: Record<StepStatus["kind"], typeof TrendDownIcon> = {
  shrinking: TrendDownIcon,
  growing: TrendUpIcon,
  level: EqualsIcon,
  quicker: LightningIcon,
  slower: HourglassMediumIcon,
  steady: EqualsIcon,
  advancing: FastForwardIcon,
  retrogressed: RewindIcon,
  holding: PauseIcon,
};

/**
 * A step's state as one row (owner, Oct 27 2026: one line, the details folded, clean but
 * not bare text): an icon in its colour on a soft tile, the word, and the figure behind it.
 * What else moved, and the figures behind it, fold underneath.
 */
export function StepState({ status, shift, facts = [] }: { status: StepStatus | null; shift: Shift | null; facts?: readonly string[] }) {
  if (!status && !shift) return null;
  const tone = status?.tone ?? (shift?.tone === "good" ? "good" : shift?.tone === "bad" ? "bad" : "flat");
  const Icon = status ? STATE_ICON[status.kind] : shift?.tone === "good" ? FastForwardIcon : shift?.tone === "bad" ? RewindIcon : EqualsIcon;
  const word = status?.word ?? shift?.text ?? "";
  // The figure under the word: the state's own, or how far it moved.
  const figure = status?.detail ?? (status ? shift?.text : undefined);
  const more = [...(status?.detail && shift ? [shift.text] : []), ...facts];
  const row = (
    <>
      <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center", STATE_TILE[tone], STATE_TEXT[tone])}>
        <Icon weight="bold" className="size-5" />
      </span>{" "}
      <span className="min-w-0 leading-snug">
        <span className={cn("block font-heading font-bold", STATE_TEXT[tone])}>{word}</span>{" "}
        {figure ? <span className="block text-soft">{figure}</span> : null}
      </span>
    </>
  );
  if (!more.length) return <div className="flex min-h-11 items-center gap-3 py-1 text-sm">{row}</div>;
  return (
    <details className="group text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 py-1 [&::-webkit-details-marker]:hidden">
        {row}{" "}
        <CaretDownIcon aria-hidden="true" weight="bold" className="ml-auto size-4 shrink-0 text-soft transition-transform group-open:rotate-180" />
      </summary>{" "}
      <ul className="space-y-1 pb-1 pl-12 text-soft">
        {more.map((m) => (
          <li key={m}>{m} </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * One step's length as a bar from a lime square to an ink one, on a scale
 * every step on the track shares, so a three-month wait looks a sixth the
 * length of a nineteen-month one. The words sit on the bar; the two ends are
 * named on one line under it.
 */
export function WaitBar({
  days,
  scaleDays,
  from,
  to,
  words,
  label,
}: {
  days: number;
  scaleDays: number;
  /** What the lime end is ("Jul 21 filed"). */
  from: ReactNode;
  /** What the ink end is ("Oct 26 decided"). */
  to: ReactNode;
  words: string;
  label: string;
}) {
  const w = Math.min(100, Math.max(6, (days / scaleDays) * 100));
  const ticks = Math.round(scaleDays / 91.3);
  return (
    <figure className="flex h-full flex-col justify-end" aria-label={label}>
      <p className="font-heading text-lg font-bold">{words}</p>{" "}
      {/* The scale: quarters marked. */}
      <div className="relative mt-2 h-3.5 bg-tint">
        {Array.from({ length: ticks - 1 }, (_, i) => (
          <span key={i} className="absolute inset-y-0 w-0.5 bg-background" style={{ left: `${((i + 1) / ticks) * 100}%` }} />
        ))}
        <div className="absolute inset-y-0 left-0 bg-data-info-ink" style={{ width: `${w}%` }} />
        <span className="absolute -top-1 left-0 size-5 -translate-x-1/2 border-2 border-foreground bg-primary" />
        <span className="absolute -top-1 size-5 -translate-x-1/2 border-2 border-foreground bg-foreground" style={{ left: `${w}%` }} />
      </div>
      {/* One line from end to end: labels under the scale's ends would sit away
          from a short bar's own end. */}
      <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-1.5 text-sm text-soft">
        <span>{from}</span>{" "}
        <ArrowRightIcon aria-hidden="true" weight="bold" className="size-3.5 shrink-0" />{" "}
        <span>{to}</span>
      </figcaption>
    </figure>
  );
}

/**
 * A bulletin cutoff as what it means: a line of priority dates split at the
 * cutoff, green before it (current: those cases can go ahead) and blue after
 * it up to the bulletin's month (still waiting). A cutoff isn't a wait, so it
 * doesn't share the other steps' bar.
 */
export function CutoffLine({
  cutoff,
  bulletinMonth,
  label,
  note,
}: {
  cutoff: string;
  bulletinMonth: string;
  label: string;
  /** The line under the split, where the other steps name their ends. */
  note?: ReactNode;
}) {
  const c = Date.parse(`${cutoff}T12:00:00Z`);
  const end = Date.parse(`${bulletinMonth}-01T12:00:00Z`);
  // The line starts as far before the cutoff as a third of the waiting span, so both sides read.
  const start = c - (end - c) / 2;
  const at = Math.min(85, Math.max(15, ((c - start) / (end - start)) * 100));
  return (
    <figure className="flex h-full flex-col justify-end" aria-label={label}>
      <p className="flex justify-between text-sm font-bold">
        <span className="text-data-good-ink">← Current</span>{" "}
        <span className="text-data-info-ink">Waiting →</span>
      </p>{" "}
      <div className="relative mt-2 h-3.5">
        <div className="absolute inset-y-0 left-0 bg-data-good-ink" style={{ width: `${at}%` }} />
        <div className="absolute inset-y-0 right-0 bg-data-info-ink" style={{ left: `${at}%` }} />
        <span className="absolute -top-1 size-5 -translate-x-1/2 border-2 border-foreground bg-primary" style={{ left: `${at}%` }} />
      </div>
      {note ? <figcaption className="mt-2.5 text-sm text-soft">{note}</figcaption> : null}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// The lines' in and out.
// ---------------------------------------------------------------------------

/** Filed against decided over a window, as two bars on one scale, with the line's direction. */
/** What a line's in and out add up to, in words: "52,265 more received than completed". */
export function flowSentence(flow: LineFlow, labels: readonly [string, string] = ["filed", "decided"]): string {
  const [inWord, outWord] = labels.map((l) => l.toLowerCase());
  if (flow.trend === "level") return `About as many ${outWord} as ${inWord}`;
  return flow.change > 0 ? `${n(flow.change)} more ${inWord} than ${outWord}` : `${n(-flow.change)} more ${outWord} than ${inWord}`;
}

/**
 * A step's line in and out, small enough for its card: filed (or received)
 * against decided (or completed) on one scale, with the window under them. On
 * the board the state line below says what the pair adds up to; where nothing
 * below says it, `say` adds it to the window's line.
 */
export function FlowPair({
  flow,
  labels = ["Filed", "Decided"],
  period,
  say = false,
}: {
  flow: LineFlow & { from: string; to: string };
  /** The two bars' words: USCIS says received and completed. */
  labels?: [string, string];
  /** The window in words, where it isn't the last 30 days (a USCIS quarter). */
  period?: string;
  /** Add what the two add up to after the window. */
  say?: boolean;
}) {
  const max = Math.max(flow.filed, flow.decided, 1);
  const window = period ?? `${monthDay(flow.from)} to ${monthDay(flow.to)}`;
  return (
    <div className="mt-4">
      <dl className="space-y-2">
        {[
          { k: labels[0], v: flow.filed, fill: "bg-data-info-ink" },
          { k: labels[1], v: flow.decided, fill: "bg-data-good-ink" },
        ].map((r) => (
          <div key={r.k} className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-2">
            <dt className="text-sm font-semibold">{r.k}{" "}</dt>{" "}
            <dd className="h-3.5 bg-tint">
              <div className={cn("h-full", r.fill)} style={{ width: `${(r.v / max) * 100}%` }} />
            </dd>{" "}
            <dd className="text-right font-mono text-sm tabular-nums">{n(r.v)}{" "}</dd>
          </div>
        ))}
      </dl>{" "}
      <p className="mt-2 text-sm text-soft">
        {window}
        {say ? `: ${flowSentence(flow, labels)}` : null}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The day at DOL.
// ---------------------------------------------------------------------------

const DECIDED_FILL: Record<string, string> = {
  CERTIFIED: "bg-data-good-ink",
  DENIED: "bg-data-bad-ink",
  WITHDRAWN: "bg-data-purple-ink",
};
const DECIDED_WORDS: Record<string, string> = { CERTIFIED: "certified", DENIED: "denied", WITHDRAWN: "withdrawn" };

/** The day's decisions as one bar, split by outcome, with the total large. */
export function DecidedBar({ parts, dayLabel }: { parts: { status: string; n: number }[]; dayLabel: string }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) return null;
  return (
    <figure aria-label={`PERM cases DOL decided on ${dayLabel}`}>
      <p className="flex flex-wrap items-baseline gap-x-3 font-heading font-bold">
        <span className="text-5xl tabular-nums sm:text-6xl">{n(total)}</span>{" "}
        <span className="text-xl text-soft">decided on {dayLabel}</span>
      </p>{" "}
      <div className="mt-4 flex h-9 border-2 border-foreground">
        {parts.map((p) =>
          p.n ? (
            <div key={p.status} className={cn("h-full", DECIDED_FILL[p.status])} style={{ width: `${(p.n / total) * 100}%`, minWidth: "6px" }} />
          ) : null,
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-base">
        {parts.map((p) => (
          <Fragment key={p.status}>
            {" "}
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cn("size-3.5", DECIDED_FILL[p.status])} />
              <span className="font-mono font-semibold tabular-nums">{n(p.n)}</span> {DECIDED_WORDS[p.status]}
            </span>
          </Fragment>
        ))}
      </figcaption>
    </figure>
  );
}

const STATUS_WORDS: Record<string, string> = {
  "ANALYST REVIEW": "Analyst review",
  "APPLICATION ON HOLD": "On hold",
  "RFI ISSUED": "Asked for more information",
  "RECONSIDERATION APPEALS": "Reconsideration appeal",
  "BALCA APPEALS": "Board of appeals",
  "NORD ISSUED": "NORD issued",
  "PENDING AUDIT RESPONSE": "Audit response due",
  CERTIFIED: "Certified",
  DENIED: "Denied",
  WITHDRAWN: "Withdrawn by the employer",
};

/** A closed status's tile, in the site's status colours. */
const CLOSED_TILE: Record<string, string> = {
  CERTIFIED: "bg-soft-good",
  DENIED: "bg-soft-bad",
  WITHDRAWN: "bg-soft-purple",
};

/** A status's change: fewer waiting reads green, more reads amber; a closed status's new decisions are neither. */
function Change({ value, label, neutral = false }: { value: number; label: string; neutral?: boolean }) {
  const Icon = value > 0 ? ArrowUpIcon : value < 0 ? ArrowDownIcon : null;
  const tone = neutral ? "" : value < 0 ? "text-data-good-ink" : value > 0 ? "text-data-warn-ink" : "";
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", tone)}>
      <span className="text-soft">{label}</span>{" "}
      {Icon ? <Icon aria-hidden="true" weight="bold" className="size-4" /> : null}
      <span className="font-mono font-semibold tabular-nums">{value === 0 ? "same" : n(Math.abs(value))}</span>{" "}
      <span className="sr-only">{value > 0 ? "more" : value < 0 ? "fewer" : ""}</span>
    </span>
  );
}

/**
 * Every status as a tile: how many now, and how that changed. Waiting statuses lead with the ordinary
 * line, larger, and count their net change; `closed` statuses count the decisions that came in, in
 * their own colours, since a certification lapsing isn't a decision undone.
 */
export function StatusTiles({
  rows,
  dayLabel,
  closed = false,
}: {
  rows: { status: string; now: number | null; day: StatusMove | null; week: StatusMove | null }[];
  dayLabel: string;
  closed?: boolean;
}) {
  const changeOf = (m: StatusMove | null) => (closed ? (m?.in ?? 0) : (m?.net ?? 0));
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
      {rows.map((r, i) => (
        <Fragment key={r.status}>
          {" "}
          <li className={cn("flex flex-col p-4", closed ? (CLOSED_TILE[r.status] ?? "bg-tint") : "bg-tint", !closed && i === 0 && "col-span-2")}>
          <p className="text-sm font-semibold">{STATUS_WORDS[r.status] ?? r.status}</p>{" "}
          <p className={cn("mt-1 font-heading font-bold tabular-nums", i === 0 ? "text-5xl" : "text-3xl")}>
            {r.now === null ? "—" : n(r.now)}
          </p>{" "}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
            <Change value={changeOf(r.day)} label={dayLabel} neutral={closed} />{" "}
            <Change value={changeOf(r.week)} label="7 days" neutral={closed} />
          </p>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// The bulletin, coloured by how each cutoff moved.
// ---------------------------------------------------------------------------

const COUNTRY_WORDS: Record<string, string> = {
  worldwide: "Rest of world",
  china: "China",
  india: "India",
  mexico: "Mexico",
  philippines: "Philippines",
};

type Tone = "forward" | "back" | "same";
const toneOf = (kind: string): Tone =>
  kind === "advanced" || kind === "went-current" || kind === "opened"
    ? "forward"
    : kind === "retrogressed" || kind === "retrogressed-from-current" || kind === "shut"
      ? "back"
      : "same";
const TONE_CELL: Record<Tone, string> = { forward: "bg-soft-good", back: "bg-soft-bad", same: "bg-tint" };
const TONE_TEXT: Record<Tone, string> = { forward: "text-data-good-ink", back: "text-data-bad-ink", same: "text-soft" };

export function BulletinGrid({ rows, monthLabel }: { rows: BulletinMoveRow[]; monthLabel: string }) {
  const countries = rows[0]?.cells.map((c) => c.country) ?? [];
  return (
    <div>
      <ScrollBox label={`Final action dates in the ${monthLabel} visa bulletin`}>
        <table className="w-full min-w-[44rem] border-separate border-spacing-1.5 text-base">
          <caption className="sr-only">Final action dates in the {monthLabel} visa bulletin, and how each moved</caption>
          <thead>
            <tr className="text-left text-sm text-soft">
              <th scope="col" className="pb-1 pr-2 font-semibold">
                <span className="sr-only">Category</span>{" "}
              </th>
              {countries.map((c) => (
                <th key={c} scope="col" className="px-3 pb-1 font-semibold">
                  {COUNTRY_WORDS[c] ?? c}{" "}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.category}>
                <th scope="row" className="pr-2 text-left align-middle text-sm font-semibold">{CATEGORY_LABEL[r.category] ?? r.category}{" "}</th>
                {r.cells.map((c) => {
                  const tone = toneOf(c.kind);
                  return (
                    <td key={c.country} className={cn("px-3 py-2.5", TONE_CELL[tone])}>
                      <span className="block font-mono font-semibold tabular-nums">{c.latest}</span>{" "}
                      {c.move ? <span className={cn("block text-sm", TONE_TEXT[tone])}>{c.move}</span> : null}{" "}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollBox>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {(
          [
            ["forward", "Moved forward"],
            ["same", "Unchanged"],
            ["back", "Moved back"],
          ] as const
        ).map(([t, words]) => (
          <Fragment key={t}>
            {" "}
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cn("size-3.5 border border-foreground/30", TONE_CELL[t])} />
              {words}
            </span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
