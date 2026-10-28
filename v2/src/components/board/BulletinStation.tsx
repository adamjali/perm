"use client";

import { useId, useState } from "react";

import { CutoffLine, Station } from "@/components/board/BoardParts";
import type { Shift, StepStatus } from "@/lib/board";
import { CATEGORY_LABEL, COUNTRY_LABEL } from "@/lib/bulletinNext";
import type { CountryKey } from "@/lib/perm";
import { shortDate } from "@convex/lib/months";

/** One line of the newest bulletin, as the station draws it. Built on the server. */
export interface BulletinLine {
  category: string;
  country: CountryKey;
  /** The final action cutoff as the bulletin prints it: a date, Current or Unavailable. */
  finalAction: string;
  /** The final action cutoff's day, when it is one, for the picture. */
  cutoffIso: string | null;
  /** The dates-for-filing cutoff, as printed, or null when the chart leaves the line out. */
  datesForFiling: string | null;
  status: StepStatus | null;
  shift: Shift | null;
}

/** "EB2" as people say it: EB-2; the other-workers line in words. */
const categoryName = (c: string) => (c === "EW3" ? "EB-3 other workers" : c.replace(/^EB(\d)/, "EB-$1"));
/** The bulletin's catch-all column as people say it. */
const countryName = (c: CountryKey) => (c === "worldwide" ? "Rest of world" : COUNTRY_LABEL[c]);

const SELECT =
  "min-h-11 w-full min-w-0 border-2 border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * The bulletin's step on the board, for the reader's own line (Sabrina's notes, Oct 27
 * 2026: pick a category and a country). Every line is drawn on the server and the
 * switch only picks one, so nothing is fetched and the page works before its script.
 */
export function BulletinStation({
  step,
  lines,
  bulletinMonth,
  monthLabel,
}: {
  step: number;
  lines: readonly BulletinLine[];
  bulletinMonth: string;
  monthLabel: string;
}) {
  const id = useId();
  const [category, setCategory] = useState("EB2");
  const [country, setCountry] = useState<CountryKey>("worldwide");
  const categories = [...new Set(lines.map((l) => l.category))];
  const countries = [...new Set(lines.map((l) => l.country))];
  const line = lines.find((l) => l.category === category && l.country === country) ?? lines[0];
  if (!line) return null;
  const name = `${categoryName(line.category)}, ${countryName(line.country)}`;

  return (
    <Station
      step={step}
      name="Visa bulletin"
      lead={`${name}: current if filed before`}
      big={line.finalAction}
      picture={
        line.cutoffIso ? (
          <CutoffLine
            cutoff={line.cutoffIso}
            bulletinMonth={bulletinMonth}
            label={`In the ${monthLabel} bulletin, ${name} priority dates before ${shortDate(line.cutoffIso)} are current`}
          />
        ) : null
      }
      controls={
        <div className="mt-3">
          <div className="grid grid-cols-1 gap-2 [&>*]:min-w-0">
            <label htmlFor={`${id}-cat`} className="sr-only">
              Category
            </label>{" "}
            <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
              {categories.map((c) => (
                <option key={c} value={c} title={CATEGORY_LABEL[c]}>
                  {categoryName(c)}
                </option>
              ))}
            </select>{" "}
            <label htmlFor={`${id}-country`} className="sr-only">
              Country of birth
            </label>{" "}
            <select id={`${id}-country`} value={country} onChange={(e) => setCountry(e.target.value as CountryKey)} className={SELECT}>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          </div>{" "}
          <p className="mt-2 text-sm text-soft">
            Dates for filing: <b className="font-semibold text-foreground">{line.datesForFiling ?? "not listed"}</b>
          </p>
        </div>
      }
      shift={line.shift}
      status={line.status}
      href="/visa-bulletin"
      linkLabel="The visa bulletin"
    />
  );
}
