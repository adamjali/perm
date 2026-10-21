/**
 * What the visa bulletin figure shows, from the site's own bulletin archive: one employment line's
 * final action cutoff, bulletin by bulletin, and an example priority date measured against each
 * one with the central rule (estimatePriorityDate). A cutoff is one of three things (a date, C or
 * U), and a month the archive doesn't hold is a break, never a point to draw through. Pure: no
 * clock, no DOM, so the server's render and the browser's first render say the same thing.
 */
import { estimatePriorityDate, parseCutoff, type BulletinMonth, type ChartKind, type CountryKey, type Cutoff } from "@/lib/perm";
import { LINE_CATEGORY_SHORT, LINE_COUNTRY_SHORT } from "@/lib/bulletinLines";
import { MS_PER_DAY } from "@/lib/time";
import { MONTH_NAMES, longDate, monthFromIndex, monthIndex, monthYear, shortDate } from "@convex/lib/months";

export interface BulletinStep {
  /** The bulletin's month, `YYYY-MM`. */
  month: string;
  /** The cutoff as printed, or null when the archive holds none for this month. */
  cutoff: Cutoff | null;
  /** Whether the example priority date was current under this bulletin (the central rule). */
  exampleCurrent: boolean;
}

export interface BulletinRun {
  category: string;
  country: CountryKey;
  chart: ChartKind;
  /** "EB-2 India". */
  label: string;
  /** One step a calendar month, oldest first. */
  steps: BulletinStep[];
  /** The example priority date, ISO. */
  example: string;
  /** The rail's ends, ISO, each a January 1. */
  railFrom: string;
  railTo: string;
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY;
const isoOf = (day: number) => new Date(Math.round(day) * MS_PER_DAY).toISOString().slice(0, 10);
const dated = (c: Cutoff | null): c is { kind: "date"; iso: string } => c?.kind === "date";

/**
 * The run for one line, or null when there's nothing honest to draw: no bulletin for the line, or
 * no real cutoff date in the window (a line that was only C or U has no cutoff to show moving).
 */
export function buildBulletinRun(input: {
  bulletins: readonly BulletinMonth[];
  category?: string;
  country?: CountryKey;
  chart?: ChartKind;
  /** How many calendar months to show, ending at the newest bulletin that prints this line. */
  months?: number;
}): BulletinRun | null {
  const { bulletins, category = "EB2", country = "india", chart = "finalAction", months = 24 } = input;
  const byMonth = new Map<string, BulletinMonth>();
  for (const b of bulletins) byMonth.set(b.bulletinMonth, b);
  const cell = (b: BulletinMonth | undefined) => (b ? parseCutoff(b[chart]?.[category]?.[country]) : null);

  const printed = [...byMonth.keys()].filter((m) => cell(byMonth.get(m)) !== null).sort();
  const newest = printed[printed.length - 1];
  if (!newest) return null;
  const last = monthIndex(newest);
  const raw = Array.from({ length: months }, (_, i) => {
    const month = monthFromIndex(last - (months - 1) + i);
    const bulletin = byMonth.get(month);
    return { month, bulletin, cutoff: cell(bulletin) };
  });
  const dates = raw.map((s) => s.cutoff).filter(dated);
  if (dates.length === 0) return null;

  const example = pickExample(raw.map((s) => s.cutoff));
  const steps: BulletinStep[] = raw.map(({ month, bulletin, cutoff }) => ({
    month,
    cutoff,
    exampleCurrent:
      bulletin !== undefined && cutoff !== null
        ? estimatePriorityDate({ priorityDate: example, category, country, chart, bulletins: [bulletin] }).isCurrent
        : false,
  }));

  const years = [...dates.map((d) => d.iso), example].map((iso) => Number(iso.slice(0, 4)));
  return {
    category,
    country,
    chart,
    label: `${LINE_CATEGORY_SHORT[category] ?? category} ${LINE_COUNTRY_SHORT[country]}`,
    steps,
    example,
    railFrom: `${Math.min(...years)}-01-01`,
    railTo: `${Math.max(...years) + 1}-01-01`,
  };
}

/**
 * The example priority date: the middle of the window's largest step back, so the drawing shows a
 * date the cutoff passed and then left behind. With no step back, the middle of the window's
 * movement. Set on the first of its month, or the 15th if a cutoff falls on the first, so it never
 * sits exactly on a cutoff, where reading "earlier than" and "on or before" would disagree.
 */
export function pickExample(cutoffs: ReadonlyArray<Cutoff | null>): string {
  let from: string | null = null;
  let to: string | null = null;
  let widest = 0;
  for (let i = 1; i < cutoffs.length; i += 1) {
    const a = cutoffs[i - 1] ?? null;
    const b = cutoffs[i] ?? null;
    if (dated(a) && dated(b) && b.iso < a.iso && dayNumber(a.iso) - dayNumber(b.iso) > widest) {
      widest = dayNumber(a.iso) - dayNumber(b.iso);
      from = b.iso;
      to = a.iso;
    }
  }
  if (!from || !to) {
    const all = cutoffs.filter(dated).map((c) => c.iso).sort();
    from = all[0]!;
    to = all[all.length - 1]!;
  }
  const middle = isoOf((dayNumber(from) + dayNumber(to)) / 2);
  const onCutoff = new Set(cutoffs.filter(dated).map((c) => c.iso));
  const first = `${middle.slice(0, 7)}-01`;
  return onCutoff.has(first) ? `${middle.slice(0, 7)}-15` : first;
}

/** Where a date sits along the rail, 0 at its oldest end and 1 at its newest. */
export function railAt(run: BulletinRun, iso: string): number {
  const from = dayNumber(run.railFrom);
  const to = dayNumber(run.railTo);
  return Math.min(1, Math.max(0, (dayNumber(iso) - from) / (to - from)));
}

/**
 * The drawing's pose for one bulletin. `gate` and `strip` are rail fractions or null when there's
 * none to draw: Current has no gate and an open rail, Unavailable shuts the door and opens
 * nothing, and a month the archive doesn't hold draws neither (a break, not a position).
 */
export interface Pose {
  gate: number | null;
  strip: number | null;
  shut: number;
}

export function poseOf(run: BulletinRun, step: BulletinStep): Pose {
  const c = step.cutoff;
  if (!c) return { gate: null, strip: null, shut: 0 };
  if (c.kind === "current") return { gate: null, strip: 1, shut: 0 };
  if (c.kind === "unavailable") return { gate: null, strip: null, shut: 1 };
  const at = railAt(run, c.iso);
  return { gate: at, strip: at, shut: 0 };
}

export interface Frame {
  /** The gate's rail position and how far it's shown (0 lifted away, 1 standing). */
  gate: number;
  gateShown: number;
  /** The open strip's length along the rail and how far it's shown. */
  strip: number;
  stripShown: number;
  /** The door's shutter: 0 open, 1 shut. */
  shut: number;
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * The drawing `t` bulletins into the run (fractions are the move from one bulletin to the next).
 * A gate that exists on both sides slides; one that appears or goes is lifted in or out where it
 * stands, never slid in from a date it never had.
 */
export function frameAt(run: BulletinRun, t: number): Frame {
  const n = run.steps.length;
  const clamped = Math.min(n - 1, Math.max(0, t));
  const i = Math.floor(clamped);
  const e = ease(clamped - i);
  const a = poseOf(run, run.steps[i]!);
  const b = poseOf(run, run.steps[Math.min(n - 1, i + 1)]!);
  const mix = (x: number, y: number) => x + (y - x) * e;
  const either = (x: number | null, y: number | null) => (x !== null && y !== null ? mix(x, y) : (x ?? y ?? 0));
  return {
    gate: either(a.gate, b.gate),
    gateShown: mix(a.gate === null ? 0 : 1, b.gate === null ? 0 : 1),
    strip: either(a.strip, b.strip),
    stripShown: mix(a.strip === null ? 0 : 1, b.strip === null ? 0 : 1),
    shut: mix(a.shut, b.shut),
  };
}

/** The readout for one bulletin: the month, its cutoff, and whether the example date is current. */
export function readingAt(run: BulletinRun, index: number): string {
  const step = run.steps[Math.min(run.steps.length - 1, Math.max(0, Math.round(index)))]!;
  const month = monthYear(step.month);
  const c = step.cutoff;
  if (!c) return `The archive holds no ${run.label} cutoff for ${month}.`;
  if (c.kind === "current") return `${month} bulletin: Current. Every date is current.`;
  if (c.kind === "unavailable") return `${month} bulletin: Unavailable. No date is current.`;
  const example = shortDate(run.example);
  return `${month} bulletin: cutoff ${shortDate(c.iso)}. ${example} ${step.exampleCurrent ? "is current." : "waits."}`;
}

/** Index ranges of consecutive steps that satisfy `test`. */
function runsOf(steps: readonly BulletinStep[], test: (s: BulletinStep) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  steps.forEach((s, i) => {
    if (!test(s)) return;
    const prev = out[out.length - 1];
    if (prev && prev[1] === i - 1) prev[1] = i;
    else out.push([i, i]);
  });
  return out;
}

/** "in July 2026", "from July to September 2026", "from November 2025 to March 2026". */
function span(steps: readonly BulletinStep[], [a, b]: [number, number], single = "in"): string {
  const from = steps[a]!.month;
  const to = steps[b]!.month;
  if (a === b) return `${single} ${monthYear(from)}`;
  const start = from.slice(0, 4) === to.slice(0, 4) ? MONTH_NAMES[Number(from.slice(5, 7)) - 1] : monthYear(from);
  return `from ${start} to ${monthYear(to)}`;
}

/**
 * What happened in the window, in order, one sentence each: the example date becoming current,
 * every step back, every Unavailable or Current stretch and what reopened it, and every month the
 * archive doesn't hold. Read off the steps, so the caption can't say what the archive doesn't.
 */
export function eventsOf(run: BulletinRun): string[] {
  const { steps } = run;
  const events: Array<{ at: number; text: string }> = [];
  for (const r of runsOf(steps, (s) => s.cutoff?.kind === "unavailable")) {
    const after = steps[r[1] + 1];
    const reopened = after && dated(after.cutoff) ? ` The ${monthYear(after.month)} bulletin opened it again at ${longDate(after.cutoff.iso)}.` : "";
    events.push({ at: r[0], text: `${cap(span(steps, r))} the line was Unavailable. The door shut, and no date was current however early.${reopened}` });
  }
  for (const r of runsOf(steps, (s) => s.cutoff?.kind === "current")) {
    events.push({ at: r[0], text: `${cap(span(steps, r))} the line was Current, so every date was.` });
  }
  for (const r of runsOf(steps, (s) => s.cutoff === null)) {
    events.push({ at: r[0], text: `The archive holds no cutoff ${span(steps, r, "for")}, so the drawing shows none.` });
  }
  for (let i = 1; i < steps.length; i += 1) {
    const a = steps[i - 1]!.cutoff;
    const b = steps[i]!.cutoff;
    if (dated(a) && dated(b) && b.iso < a.iso) {
      const left = steps[i - 1]!.exampleCurrent && !steps[i]!.exampleCurrent ? ", and the example date waited again" : "";
      events.push({ at: i, text: `In ${monthYear(steps[i]!.month)} the cutoff went back to ${longDate(b.iso)}${left}.` });
    }
    if (!steps[i - 1]!.exampleCurrent && steps[i]!.exampleCurrent) {
      events.push({ at: i - 0.5, text: `In ${monthYear(steps[i]!.month)} the cutoff passed it, so it was current.` });
    }
  }
  if (steps[0]?.exampleCurrent) events.push({ at: -1, text: `It was already current in ${monthYear(steps[0].month)}.` });
  return events.sort((x, y) => x.at - y.at).map((e) => e.text);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The figure's caption, every date from the run. */
export function captionOf(run: BulletinRun): string {
  const first = run.steps[0]!;
  const last = run.steps[run.steps.length - 1]!;
  const held = run.steps.filter((s) => s.cutoff !== null).length;
  const chart = run.chart === "finalAction" ? "final action" : "dates for filing";
  return [
    `An illustration of ${run.label}'s ${chart} cutoff in ${held === run.steps.length ? "the" : `${held} of the`} ${run.steps.length} bulletins from ${monthYear(first.month)} to ${monthYear(last.month)}, as the State Department printed them.`,
    "The rail runs by priority date, oldest at the door.",
    "The gate stands at each month's cutoff. The dates between the door and the gate were current that month, and so was every earlier one.",
    `The lime block is an example priority date, ${longDate(run.example)}.`,
    ...eventsOf(run),
    "Current, printed C, lifts the gate away, so every date is current. Unavailable, printed U, shuts the door, so none is.",
    "Drag along the rail, or scroll, to move through the bulletins.",
  ].join(" ");
}

/**
 * The bulletins worth a longer look while the run plays: where the cutoff went back, where the
 * line shut, opened or went Current, where the archive has a gap, and where the example date
 * became current or stopped being current.
 */
export function keySteps(run: BulletinRun): Set<number> {
  const keys = new Set<number>();
  run.steps.forEach((s, i) => {
    if (i === 0) return;
    const a = run.steps[i - 1]!;
    const kindA = a.cutoff?.kind ?? "none";
    const kindB = s.cutoff?.kind ?? "none";
    if (kindA !== kindB || a.exampleCurrent !== s.exampleCurrent) keys.add(i);
    else if (dated(a.cutoff) && dated(s.cutoff) && s.cutoff.iso < a.cutoff.iso) keys.add(i);
  });
  return keys;
}
