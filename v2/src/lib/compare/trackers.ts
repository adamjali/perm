/**
 * PERM trackers, side by side: the facts behind /compare.
 *
 * The one page on the site that names other trackers (owner's call, Oct 27
 * 2026; every other surface says "a third party"). Every mark on a rival is
 * something read on that site's own pages or answers on the day in its own
 * `checkedOn`, with the address and a short quote, so a reader can check it
 * and so can the site it's about. A feature we looked for and couldn't find
 * is "no" with what we checked; one we couldn't check (behind a sign-up, an
 * app we can't open) is "unknown", never a guess.
 *
 * Our own column links our own pages. Estimates aren't a row: they're the
 * owner's tool, never listed as something the site offers.
 */

import { longDate, MONTH_NAMES } from "@convex/lib/months";
import { LEGAL_NAME } from "@/lib/constants/about";

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
  /** Which list it sits in: the trackers built around PERM, or the wider green card sites people weigh beside them. */
  group: GroupKey;
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
  /** Who it suits best, in one line, from its strengths and marks. Never an overall winner. */
  bestFor: string;
  /** Where its data comes from, in a few words, from its `source` mark. */
  dataFrom: string;
  /** What it does that PERM Tracker doesn't, each from its strengths. Empty when we found nothing. */
  beatsUs: string[];
}

/** The two lists, in the order the page shows them. */
export const GROUPS = [
  { key: "perm", label: "PERM trackers" },
  { key: "greenCard", label: "Green card sites" },
] as const;

export type GroupKey = (typeof GROUPS)[number]["key"];

/**
 * The days the sites were read, in words: "October 27 and 28, 2026" when they
 * share a month, else each day in full. The page states it once, so it has to
 * name every day a mark rests on.
 */
export function checkedPhrase(days: readonly string[]): string {
  const sorted = [...new Set(days)].sort();
  if (sorted.length === 0) return "";
  const join = (xs: string[]) => (xs.length === 1 ? xs[0]! : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const month = sorted[0]!.slice(0, 7);
  if (sorted.every((d) => d.startsWith(month))) {
    const name = MONTH_NAMES[Number(month.slice(5, 7)) - 1];
    return `${name} ${join(sorted.map((d) => String(Number(d.slice(8, 10)))))}, ${month.slice(0, 4)}`;
  }
  return join(sorted.map((d) => longDate(d) ?? d));
}

const OURS = "https://permtracker.app";

export const PERM_TRACKER: Tracker = {
  slug: "permtracker",
  name: "PERM Tracker",
  url: OURS,
  operator: `${LEGAL_NAME} (Florida)`,
  price: "Free",
  group: "perm",
  checkedOn: "2026-10-28",
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
  bestFor: "Following one case's DOL status, in any DOL program, with a free email when it changes",
  dataFrom: "DOL's case-status service and its quarterly files",
  beatsUs: [],
};

/** Names in a sentence: "A", "A and B", "A, B and C". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The sites whose mark on a row is one of `marks`, alphabetically, so no site leads by our choice. */
export function namesWhere(trackers: readonly Tracker[], row: RowKey, marks: readonly Mark[]): string[] {
  return trackers
    .filter((t) => marks.includes(t.cells[row].mark))
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * The questions people ask when choosing a tracker, each answered from the
 * marks themselves, so an answer can't drift from the grid above it. A list
 * that comes out empty says so plainly rather than leaving a blank.
 */
export function compareFaq(trackers: readonly Tracker[]): { q: string; a: string }[] {
  const list = (row: RowKey, marks: readonly Mark[]) => nameList(namesWhere(trackers, row, marks)) || "none of them";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const freeNoAds = trackers.filter((t) => t.cells.free.mark === "yes" && t.cells.noAds.mark === "yes").map((t) => t.name).sort((a, b) => a.localeCompare(b));
  const freeAds = trackers.filter((t) => t.cells.free.mark === "yes" && t.cells.noAds.mark !== "yes").map((t) => t.name).sort((a, b) => a.localeCompare(b));
  const paid = trackers.filter((t) => t.cells.free.mark !== "yes").map((t) => `${t.name} (${t.price.charAt(0).toLowerCase()}${t.price.slice(1)})`);
  return [
    {
      q: "Which trackers read each case's status from DOL itself?",
      a: `${cap(list("source", ["yes"]))} read DOL's own records for each case. ${cap(list("source", ["partial"]))} build on DOL's published figures or files, or on other sources, and the grid says which. A tracker that doesn't read DOL's case-status service can't show a case DOL hasn't published yet.`,
    },
    {
      q: "Which are free, with no ads?",
      a: [
        freeNoAds.length ? `Free with no ads: ${nameList(freeNoAds)}.` : "",
        freeAds.length ? `Free with ads: ${nameList(freeAds)}.` : "",
        paid.length ? `With paid parts: ${nameList(paid)}.` : "",
      ].filter(Boolean).join(" "),
    },
    {
      q: "Which let me look up a case without an account?",
      a: `${cap(list("noAccount", ["yes"]))}. Some of the others show figures without an account but need one, or an app, to follow a case.`,
    },
    {
      q: "Which cover prevailing wage requests, H-1B LCAs, and H-2A and H-2B?",
      a: `Prevailing wage requests: ${list("wage", ["yes", "partial"])}. H-1B labor condition applications: ${list("lca", ["yes", "partial"])}. H-2A and H-2B: ${list("seasonal", ["yes", "partial"])}.`,
    },
    {
      q: "Which email me when my case changes?",
      a: `${cap(list("alerts", ["yes"]))}${namesWhere(trackers, "alerts", ["partial"]).length ? `, and in part ${list("alerts", ["partial"])}` : ""}. Each one's note in the grid says what it sends and what it costs.`,
    },
  ];
}
