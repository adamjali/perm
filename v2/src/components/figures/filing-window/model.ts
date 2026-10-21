/**
 * What the filing-window figure says, from the central rule: the last step's date and the
 * window calculateFilingWindow gives for it. Pure, so the server's render and the browser's
 * first render say the same thing.
 */
import { addDaysUTC, calculateFilingWindow } from "@/lib/perm";
import { monthDay, shortDate } from "@convex/lib/months";

export interface FilingWindowReading {
  /** The last recruitment step, ISO. */
  last: string;
  opens: string;
  closes: string;
  /** One sentence for the readout and the slider's spoken value. */
  sentence: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The window for a case whose first step is `first` and whose last step is `lastDay` days after it. */
export function readFilingWindow(first: string, lastDay: number): FilingWindowReading {
  const last = iso(addDaysUTC(new Date(`${first}T00:00:00Z`), lastDay));
  const w = calculateFilingWindow({ firstRecruitmentDate: first, lastRecruitmentDate: last });
  if (!w) throw new Error(`no filing window for ${first} to ${last}`);
  const sentence =
    w.opens < w.closes
      ? `Last step ${monthDay(last)}: file from ${monthDay(w.opens)} to ${shortDate(w.closes)}.`
      : `Last step ${monthDay(last)}: file on ${shortDate(w.closes)} only.`;
  return { last, opens: w.opens, closes: w.closes, sentence };
}
