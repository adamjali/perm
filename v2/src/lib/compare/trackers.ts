/**
 * PERM trackers, side by side: the facts behind /compare.
 *
 * The one page on the site that names other trackers (owner's call, Oct 27
 * 2026; every other surface says "a third party"). Every mark on a rival is
 * something read on that site's own pages or answers on the day in
 * `checkedOn`, with the address and a short quote, so a reader can check it
 * and so can the site it's about. A feature we looked for and couldn't find
 * is "no" with what we checked; one we couldn't check (behind a sign-up, an
 * app we can't open) is "unknown", never a guess.
 *
 * Our own column links our own pages. Estimates aren't a row: they're the
 * owner's tool, never listed as something the site offers.
 */

export type Mark = "yes" | "partial" | "no" | "unknown";

export interface Evidence {
  /** The page or answer the mark was read from. */
  url: string;
  /** A few of its own words, under 25. Required on a rival's mark; our own column links the page itself. */
  quote?: string;
}

export interface Cell {
  mark: Mark;
  /** One plain line under the mark: what exactly, or what we checked. */
  note?: string;
  evidence?: Evidence;
}

/** The questions, in the order someone waiting on a case asks them. */
export const ROWS = [
  { key: "lookup", label: "Look up a case by its number" },
  { key: "pending", label: "Cases still waiting, not only decided ones" },
  { key: "source", label: "Status read from DOL itself" },
  { key: "wage", label: "Prevailing wage requests" },
  { key: "lca", label: "H-1B labor condition applications" },
  { key: "seasonal", label: "H-2A and H-2B" },
  { key: "alerts", label: "An email when a case changes" },
  { key: "employers", label: "A page for every employer" },
  { key: "bulletin", label: "Visa bulletin" },
  { key: "attorney", label: "Deadline app for attorneys" },
  { key: "noAccount", label: "No account to look a case up" },
  { key: "free", label: "Free" },
  { key: "noAds", label: "No ads" },
  { key: "openData", label: "Data you can download or call" },
] as const;

export type RowKey = (typeof ROWS)[number]["key"];

export interface Tracker {
  slug: string;
  name: string;
  url: string;
  /** Who runs it, as the site itself says, or null when it doesn't say. */
  operator: string | null;
  /** What it costs, in its own terms. */
  price: string;
  /** "YYYY-MM-DD", the Eastern day every mark below was read. */
  checkedOn: string;
  /**
   * The newest data the site showed that day, by its own stamp, as an
   * Eastern day; null when it shows none we could read.
   */
  newestData: { day: string | null; evidence?: Evidence; note?: string };
  cells: Record<RowKey, Cell>;
  /** What it does well, honestly; a reader picking a tracker should know. */
  strengths: string[];
}

export const CHECKED_ON = "2026-10-27";

const OURS = "https://permtracker.app";

export const PERM_TRACKER: Tracker = {
  slug: "permtracker",
  name: "PERM Tracker",
  url: OURS,
  operator: "PERM Tracker LLC (Florida)",
  price: "Free",
  checkedOn: CHECKED_ON,
  newestData: { day: null, note: "Read from DOL each night, and every 5 minutes on weekdays for watched cases" },
  cells: {
    lookup: { mark: "yes", note: "Any PERM, wage request, LCA, H-2A, H-2B or CW-1 number", evidence: { url: `${OURS}/perm-case-status` } },
    pending: { mark: "yes", note: "Every pending case DOL's case-status service returns", evidence: { url: `${OURS}/perm-queue` } },
    source: { mark: "yes", note: "DOL's case-status service and its quarterly disclosure files", evidence: { url: `${OURS}/methodology` } },
    wage: { mark: "yes", evidence: { url: `${OURS}/pwd-cases` } },
    lca: { mark: "yes", evidence: { url: `${OURS}/lca-cases` } },
    seasonal: { mark: "yes", evidence: { url: `${OURS}/seasonal-cases` } },
    alerts: { mark: "yes", note: "Free; a status change is emailed at once", evidence: { url: `${OURS}/perm-case-status` } },
    employers: { mark: "yes", note: "Every employer in DOL's files, PERM or not", evidence: { url: `${OURS}/perm-employers` } },
    bulletin: { mark: "yes", note: "Every bulletin back to 2005", evidence: { url: `${OURS}/visa-bulletin` } },
    attorney: { mark: "yes", note: "Free, with every PERM deadline worked out per case", evidence: { url: `${OURS}/for-attorneys` } },
    noAccount: { mark: "yes", evidence: { url: `${OURS}/perm-case-status` } },
    free: { mark: "yes", evidence: { url: `${OURS}/about` } },
    noAds: { mark: "yes" },
    openData: { mark: "yes", note: "A free API and CC BY 4.0 files", evidence: { url: `${OURS}/open-data` } },
  },
  strengths: [],
};
