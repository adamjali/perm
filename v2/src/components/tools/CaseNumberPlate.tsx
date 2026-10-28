import type { ParsedCaseNumber } from "@/lib/permCaseNumber";
import { MS_PER_DAY } from "@/lib/time";
import { longDate } from "@convex/lib/months";
import type { Lang } from "@/lib/i18n/lang";
import { dayLabel } from "@/lib/i18n/format";
import { CASE_NUMBER_PLATE } from "./CaseNumberPlate.messages";

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
 * reading of the number. The prefix's letter names the program (G is PERM,
 * which the lookup's own routing relies on); DOL publishes no key for the
 * number after it, so the plate doesn't invent one.
 */

/** "2026-05-05" to "May 5, 2026" (or the reader's language); a value that isn't a date prints as given. */
const dayWords = (iso: string, lang: Lang = "en") => (lang === "en" ? longDate(iso) : dayLabel(iso, lang)) ?? iso;

export interface CaseNumberPlateProps {
  parsed: ParsedCaseNumber;
  /**
   * DOL's own recorded receipt date, when the case is in the record. Shown
   * instead of the decoded one, and the mismatch is stated rather than hidden.
   */
  recordedFilingDate?: string | null;
  className?: string;
  lang?: Lang;
}

export function CaseNumberPlate({
  parsed,
  recordedFilingDate,
  className,
  lang = "en",
}: CaseNumberPlateProps) {
  const [letter, office] = parsed.prefix.split("-");
  const yy = parsed.filingDate.slice(2, 4);
  const dayOfYear = String(
    Math.round(
      (Date.parse(`${parsed.filingDate}T00:00:00Z`) -
        Date.parse(`${parsed.filingDate.slice(0, 4)}-01-01T00:00:00Z`)) /
        MS_PER_DAY,
    ) + 1,
  ).padStart(3, "0");

  const t = CASE_NUMBER_PLATE[lang];
  const segments = [
    { text: `${letter}-${office}`, label: t.prefix },
    { text: yy, label: t.year },
    { text: dayOfYear, label: t.dayOfYear },
    { text: parsed.serial, label: t.serial },
  ];

  const decoded = dayWords(parsed.filingDate, lang);
  const disagrees =
    !!recordedFilingDate && recordedFilingDate !== parsed.filingDate;

  return (
    <div className={className}>
      <div>
        {/* Segments, not one run: the hyphens stay so the number is still the
            number a reader can compare against their own paperwork. */}
        <div className="flex flex-wrap items-end gap-x-1 gap-y-3">
          {segments.map((s, i) => (
            <div key={s.label} className="flex items-end">
              <span className="block">
                <span className="block text-sm text-muted-foreground">
                  {s.label}
                </span>{" "}
                <span className="block font-mono text-xl font-semibold leading-none tabular-nums sm:text-2xl">
                  {s.text}
                </span>
              </span>
              {i < segments.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="px-1 font-mono text-xl leading-none text-muted-foreground sm:text-2xl"
                >
                  -
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground border-t-2 border-border">
          {t.middleLead}{" "}
          <b className="font-semibold text-foreground">{t.dayOf(Number(dayOfYear), `20${yy}`)}</b>
          {t.which(decoded)}
          {disagrees ? (
            <>
              {" "}
              {t.disagreeLead}{" "}
              <b className="font-semibold text-foreground">{dayWords(recordedFilingDate, lang)}</b>
              {t.disagreeRest}
            </>
          ) : null}{" "}
          {letter === "G" ? t.gNote : null}
        </p>
      </div>
    </div>
  );
}
