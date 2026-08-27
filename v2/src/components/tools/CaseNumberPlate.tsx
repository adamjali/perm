import { cn } from "@/lib/utils";
import type { ParsedCaseNumber } from "@/lib/permCaseNumber";

/**
 * The case number, read back as the artifact it is.
 *
 * A PERM case number is not a serial. `G-100-26125-868956` carries a prefix,
 * a two-digit year, the day of that year, and a serial, so the number states
 * its own filing date, and almost nobody holding one knows that. Showing the
 * segments apart is the cheapest genuinely new thing this page can tell
 * somebody, and it costs one component and no data.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM. The decoded day is presented as what
 * the DIGITS mean, never as the filing date, because the two are the same for
 * 89% of cases and a day or two apart for the rest. When DOL's own record is
 * available the page states the date from there and this plate stays a
 * reading of the number. And the prefix is labelled "prefix" rather than
 * "office": DOL publishes no key for it, and inventing one here would be a
 * fact-shaped guess sitting inside a plate that reads as authoritative.
 */

const DAY_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-05-05" to "May 5, 2026". Local to the plate; nothing else needs it. */
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const name = DAY_NAMES[Number(m[2]) - 1];
  return name ? `${name} ${Number(m[3])}, ${m[1]}` : iso;
}

export interface CaseNumberPlateProps {
  parsed: ParsedCaseNumber;
  /**
   * DOL's own recorded receipt date, when the case is in the record. Shown
   * instead of the decoded one, and the mismatch is stated rather than hidden.
   */
  recordedFilingDate?: string | null;
  className?: string;
}

export function CaseNumberPlate({
  parsed,
  recordedFilingDate,
  className,
}: CaseNumberPlateProps) {
  const [letter, office] = parsed.prefix.split("-");
  const yy = parsed.filingDate.slice(2, 4);
  const dayOfYear = String(
    Math.round(
      (Date.parse(`${parsed.filingDate}T00:00:00Z`) -
        Date.parse(`${parsed.filingDate.slice(0, 4)}-01-01T00:00:00Z`)) /
        86_400_000,
    ) + 1,
  ).padStart(3, "0");

  const segments = [
    { text: `${letter}-${office}`, label: "Prefix" },
    { text: yy, label: "Year" },
    { text: dayOfYear, label: "Day of year" },
    { text: parsed.serial, label: "Serial" },
  ];

  const decoded = longDate(parsed.filingDate);
  const disagrees =
    !!recordedFilingDate && recordedFilingDate !== parsed.filingDate;

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <p className="border-b-2 border-border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:px-5">
        Case number
      </p>

      <div className="px-4 py-5 sm:px-5">
        {/* Segments, not one run: the hyphens stay so the number is still the
            number a reader can compare against their own paperwork. */}
        <div className="flex flex-wrap items-end gap-x-1 gap-y-3">
          {segments.map((s, i) => (
            <div key={s.label} className="flex items-end">
              <span className="block">
                <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {s.label}
                </span>{" "}
                <span className="block font-mono text-xl font-black leading-none tracking-tight tabular-nums sm:text-2xl">
                  {s.text}
                </span>
              </span>
              {i < segments.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="px-1 font-mono text-xl font-black leading-none text-foreground/35 sm:text-2xl"
                >
                  -
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <p className="mt-4 border-t-2 border-border pt-3 text-sm leading-relaxed text-foreground/70">
          The middle five digits are a date:{" "}
          <b className="font-bold text-foreground">
            day {Number(dayOfYear)} of 20{yy}
          </b>
          , which is {decoded}.
          {disagrees ? (
            <>
              {" "}
              DOL&apos;s own record puts the receipt date one or two days off
              that, at{" "}
              <b className="font-bold text-foreground">
                {longDate(recordedFilingDate)}
              </b>
              , and the record is what every figure on this page uses.
            </>
          ) : null}{" "}
          DOL publishes no key for the prefix, so this page does not put a
          meaning on it.
        </p>
      </div>
    </div>
  );
}
