import facts from "../../../scripts/data/consular_facts.json";

/**
 * What the record says about immigrant visa interviews at US consulates, from the one hand-kept
 * file `scripts/data/consular_facts.json`. The planner, the consulate pages, the dated pause line
 * on the bulletin pages and the health check (which warns once `recheckBy` passes) all read it, so
 * the site says one thing everywhere and the day it was last checked.
 */

export interface FactSource {
  label: string;
  /** State's own words, where the source is a filing or page. */
  quote?: string;
  url: string;
  /** ISO day the source is dated. */
  date: string;
  kind?: string;
}

/** A report by someone other than State: shown as reported, never as State's word. */
export interface ReportedFact {
  label: string;
  says: string;
  url: string;
  date: string;
}

export interface ConsularPause {
  status: "paused" | "resumed";
  since: string;
  sinceLabel: string;
  /** The day the sources were last read. */
  checked: string;
  recheckBy: string;
  summary: string;
  reinterviewsExempt: string;
  sources: FactSource[];
  reported: ReportedFact[];
}

export interface SeventyFivePause {
  label: string;
  summary: string;
  effective: string;
  vacated: string;
  sources: FactSource[];
  /** [the name State printed, State's issuance key for the country]. */
  countries: [string, string][];
}

export const CONSULAR_PAUSE = facts.pause as ConsularPause;
export const SEVENTY_FIVE = facts.seventyFive as SeventyFivePause;
/** State's issuance keys for the 75 countries. */
export const SEVENTY_FIVE_KEYS: ReadonlySet<string> = new Set(SEVENTY_FIVE.countries.map(([, key]) => key));

/** True while the record says interviews are paused. */
export function pauseActive(pause: ConsularPause = CONSULAR_PAUSE): boolean {
  return pause.status === "paused";
}
