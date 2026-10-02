import { HOLD_STATUS, QUEUE_STATUS, type EmployerStageRow } from "@/lib/employerStages";
import { formatInt } from "@/lib/format";

/**
 * Where one employer's pending PERM cases sit, as one bar.
 *
 * Three segments in the stage-group colours the stage pages already use
 * (`GROUP_STYLE` in components/rfi/stageMeta.ts): grey for the normal queue,
 * amber for cases DOL has taken aside (on hold, RFI, NORD, supervised
 * recruitment), brick for the employer's own appeals. The order runs from
 * what DOL did to what the employer did, then the queue, so the part a
 * reader came to see starts at the left edge.
 *
 * No hooks, so the census table (a client component) can use the small size.
 */

const APPEALS = ["RECONSIDERATION APPEALS", "BALCA APPEALS", "REQUEST FOR REVIEW"];

export interface RibbonParts {
  pending: number;
  held: number;
  otherReview: number;
  appeal: number;
  queue: number;
}

export function ribbonParts(row: EmployerStageRow): RibbonParts {
  const held = row.byStatus[HOLD_STATUS] ?? 0;
  const appeal = APPEALS.reduce((a, s) => a + (row.byStatus[s] ?? 0), 0);
  const queue = row.byStatus[QUEUE_STATUS] ?? 0;
  return { pending: row.pending, held, appeal, queue, otherReview: Math.max(0, row.pending - held - appeal - queue) };
}

const SEGMENTS = [
  { key: "review", cls: "bg-data-warn-ink", n: (p: RibbonParts) => p.held + p.otherReview },
  { key: "appeal", cls: "bg-data-bad-ink", n: (p: RibbonParts) => p.appeal },
  { key: "queue", cls: "bg-data-none-ink", n: (p: RibbonParts) => p.queue },
] as const;

/** The legend's words, one per segment, each naming who acted. */
export function ribbonLegend(p: RibbonParts): { key: string; cls: string; text: string }[] {
  const review = [p.held > 0 ? `${formatInt(p.held)} on hold` : "", p.otherReview > 0 ? `${formatInt(p.otherReview)} at RFI or other DOL review` : ""]
    .filter(Boolean)
    .join(", ");
  return [
    review ? { key: "review", cls: "bg-data-warn-ink", text: review } : null,
    p.appeal > 0 ? { key: "appeal", cls: "bg-data-bad-ink", text: `${formatInt(p.appeal)} under the employer's appeal` } : null,
    p.queue > 0 ? { key: "queue", cls: "bg-data-none-ink", text: `${formatInt(p.queue)} in DOL's normal queue` } : null,
  ].filter((x): x is { key: string; cls: string; text: string } => x !== null);
}

/**
 * What a segment says on hover, inside a `ChartTips` the caller places (one
 * around a whole list, so a census of ribbons is one tab stop, not hundreds).
 */
export function ribbonTip(p: RibbonParts, key: string, name?: string): string {
  const words = ribbonLegend(p).find((l) => l.key === key)?.text ?? "";
  return `${name ?? "Pending PERM cases"}\n${words}\nOf ${formatInt(p.pending)} pending`;
}

export function StatusRibbon({
  parts,
  size = "lg",
  label,
  name,
}: {
  parts: RibbonParts;
  size?: "lg" | "sm";
  /** Read by screen readers in place of the bar. */
  label: string;
  /** The employer, as the heading of each segment's hover detail. */
  name?: string;
}) {
  const total = Math.max(1, parts.pending);
  const segs = SEGMENTS.map((s) => ({ ...s, value: s.n(parts) })).filter((s) => s.value > 0);
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex w-full overflow-hidden border-2 border-border bg-background ${size === "lg" ? "h-8" : "h-3"}`}
    >
      {segs.map((s, i) => (
        <span
          key={s.key}
          data-tip={ribbonTip(parts, s.key, name)}
          className={`${s.cls} h-full ${i > 0 ? "border-l-2 border-border" : ""}`}
          style={{ width: `${(100 * s.value) / total}%`, minWidth: "4px" }}
        />
      ))}
    </div>
  );
}
