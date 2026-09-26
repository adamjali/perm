import { HOLD_STATUS, QUEUE_STATUS, type EmployerStageRow } from "@/lib/employerStages";

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
const int = (n: number) => n.toLocaleString("en-US");

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
  const review = [p.held > 0 ? `${int(p.held)} on hold` : "", p.otherReview > 0 ? `${int(p.otherReview)} at RFI or other DOL review` : ""]
    .filter(Boolean)
    .join(", ");
  return [
    review ? { key: "review", cls: "bg-data-warn-ink", text: review } : null,
    p.appeal > 0 ? { key: "appeal", cls: "bg-data-bad-ink", text: `${int(p.appeal)} under the employer's appeal` } : null,
    p.queue > 0 ? { key: "queue", cls: "bg-data-none-ink", text: `${int(p.queue)} in DOL's normal queue` } : null,
  ].filter((x): x is { key: string; cls: string; text: string } => x !== null);
}

export function StatusRibbon({
  parts,
  size = "lg",
  label,
}: {
  parts: RibbonParts;
  size?: "lg" | "sm";
  /** Read by screen readers in place of the bar. */
  label: string;
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
          className={`${s.cls} h-full ${i > 0 ? "border-l-2 border-border" : ""}`}
          style={{ width: `${(100 * s.value) / total}%`, minWidth: "4px" }}
        />
      ))}
    </div>
  );
}
