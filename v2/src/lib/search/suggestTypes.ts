/**
 * The shape /api/suggest answers with, in a plain module: the reader that
 * builds it is server-only, and even a type-only import of a server-only
 * module from a client component can break the route that renders it.
 */

export type SuggestKind = "employer" | "attorney" | "occupation";

export interface NameSuggestion {
  kind: SuggestKind;
  name: string;
  href: string;
  /** Filings behind the page, to tell two close names apart. */
  cases: number;
  /** How close, 0 to 1, weighted by filings, so several kinds can be ranked together. */
  score: number;
  /** In DOL's published PERM files (an entity page), not only the live feed or another program. */
  published: boolean;
}

export const KIND_NOUN: Record<SuggestKind, string> = {
  employer: "Employer",
  attorney: "Law firm",
  occupation: "Occupation",
};
