import type { BulletinMonth, CountryKey } from "@/lib/perm";
import { formatMonth } from "@/lib/dolFormat";
import type { I140Subtype } from "@/lib/processing-times/i140ProcessingTimes";
import { cn } from "@/lib/utils";

/**
 * The two panels that sit inside green-card timeline stages.
 *
 * Both exist because the stage bar answers "how long" and stops there, and the
 * next question a reader has is "how long for ME". Answering it with a link out
 * to another calculator loses them; answering it with three more paragraphs
 * loses them too. So each is a small table of published figures, rendered where
 * the question occurs.
 *
 * Plain server components. Neither needs state - the numbers are published and
 * the reader picks their own row by eye, which is faster than a select.
 */

/* ------------------------------------------------------------------ I-140 */

export interface I140SubtypePanelProps {
  /** Published ranges, already narrowed to the subtypes worth showing. */
  subtypes: readonly I140Subtype[];
  /** The subtype code the timeline bar itself is drawn from. */
  activeCode: string | null;
  asOf: string;
  className?: string;
}

export function I140SubtypePanel({
  subtypes,
  activeCode,
  asOf,
  className,
}: I140SubtypePanelProps) {
  if (subtypes.length === 0) return null;
  const slowest = Math.max(...subtypes.map((s) => s.highMonths));
  return (
    <div className={cn("border-2 border-border bg-background p-4", className)}>
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        USCIS published times, by category
      </p>
      <ul className="mt-3 space-y-2">
        {subtypes.map((s) => {
          const active = s.code === activeCode;
          return (
            <li key={s.code} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
              <div className="min-w-0">
                <p className={cn("truncate text-sm", active ? "font-bold" : "text-foreground/70")}>
                  {s.label}
                </p>
                {/* A bar rather than a second number: the point of the row is
                    which categories are slow, and a length says that faster
                    than a figure the eye has to compare. */}
                <div className="mt-1 h-1.5 w-full bg-muted" aria-hidden="true">
                  <div
                    className={cn("h-full", active ? "bg-primary" : "bg-foreground/30")}
                    style={{ width: `${(s.highMonths / slowest) * 100}%` }}
                  />
                </div>
              </div>
              <span
                className={cn(
                  "whitespace-nowrap font-mono text-sm tabular-nums",
                  active ? "font-bold" : "text-foreground/70",
                )}
              >
                {s.lowMonths}&ndash;{s.highMonths} mo
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        USCIS, as of {asOf}. The bar above uses{" "}
        {activeCode ? "the category with the most cases pending" : "no single category"}.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- Priority date */

const COUNTRIES: { key: CountryKey; label: string }[] = [
  { key: "worldwide", label: "All other" },
  { key: "china", label: "China" },
  { key: "india", label: "India" },
];

/**
 * A cutoff cell is a date, or `C`, or `U`, and those are not three flavours of
 * the same thing. `C` means the category is open to every priority date; `U`
 * means it is shut to all of them. Rendering `U` as a very old date would tell
 * someone they are nearly there in the month the category closed.
 */
function cutoff(raw: string | undefined): { text: string; tone: string } {
  if (!raw) return { text: "—", tone: "text-muted-foreground" };
  const v = raw.trim().toUpperCase();
  if (v === "C") return { text: "Current", tone: "text-primary font-bold" };
  if (v === "U") return { text: "Unavailable", tone: "text-data-bad-ink font-bold" };
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(v);
  if (!m) return { text: raw, tone: "text-foreground/70" };
  return { text: `${m[2]![0]}${m[2]!.slice(1).toLowerCase()} 20${m[3]}`, tone: "text-foreground" };
}

export interface PriorityDatePanelProps {
  bulletin: BulletinMonth | null;
  categories?: readonly string[];
  className?: string;
}

export function PriorityDatePanel({
  bulletin,
  categories = ["EB2", "EB3"],
  className,
}: PriorityDatePanelProps) {
  if (!bulletin) return null;
  const rows = categories.filter((c) => bulletin.finalAction[c]);
  if (rows.length === 0) return null;
  return (
    <div className={cn("border-2 border-border bg-background p-4", className)}>
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Where the line stood in {formatMonth(bulletin.bulletinMonth) ?? bulletin.bulletinMonth}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[20rem] border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b-2 border-border pb-1 text-left font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Category
              </th>
              {COUNTRIES.map((c) => (
                <th
                  key={c.key}
                  className="border-b-2 border-border pb-1 text-right font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cat) => (
              <tr key={cat}>
                <td className="border-b-2 border-border/40 py-2 font-bold">{cat}</td>
                {COUNTRIES.map((c) => {
                  const cell = cutoff(bulletin.finalAction[cat]?.[c.key]);
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b-2 border-border/40 py-2 text-right tabular-nums",
                        cell.tone,
                      )}
                    >
                      {cell.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Final action dates from the{" "}
        {formatMonth(bulletin.bulletinMonth) ?? bulletin.bulletinMonth} bulletin,
        which is the newest one held here and not necessarily the one in force.
        A priority date earlier than the cell is current.{" "}
        <a
          href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
          className="font-bold underline underline-offset-2 hover:text-primary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Check the current bulletin
        </a>
      </p>
    </div>
  );
}
