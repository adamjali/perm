import { typeLabel } from "@/components/policy/DocRow";
import { commentWindow, type PolicyFeed } from "@/lib/policyFeed";

/**
 * One document for the policy page's search: prepared on the server, so the browser gets strings and a flag
 * rather than the Register's whole record. The page sends only the search box's parts (`PolicyFacets`); the
 * documents load from /policy-changes/search.json the first time someone uses the box. They had ridden in
 * every page load: 1,147 documents, 0.89 MB of the page's 3.1 MB (measured Oct 28 2026).
 */
export interface PolicyItem {
  id: string;
  date: string;
  /** "Final rule", "Proposed rule", "Notice", "OFLC". */
  kind: string;
  title: string;
  url: string;
  agencies: string;
  /** Title, abstract, agencies and citation, lower-cased once. */
  text: string;
  commentsOpen: boolean;
}

/** What the search box needs before the documents arrive. */
export interface PolicyFacets {
  kinds: string[];
  /** Newest first. */
  years: string[];
  anyOpen: boolean;
  count: number;
}

/**
 * Everything the page's lists hold, as strings the search can match, newest first. The OFLC years folded under
 * their summaries are included on purpose: those are the titles a reader can't otherwise find without opening
 * every year.
 */
export function policySearchItems(feed: PolicyFeed, today: string): PolicyItem[] {
  return [...feed.filed, ...feed.signed, ...feed.register, ...feed.announcements, ...feed.bills, ...feed.decisions]
    .map((n) => ({
      id: n.documentNumber,
      date: n.publicationDate,
      kind: typeLabel(n.type),
      title: n.title,
      url: n.url,
      agencies: n.agencies.join(", "),
      text: [n.title, n.abstract, n.agencies.join(" "), n.citation, n.documentNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
      commentsOpen: commentWindow(n, today)?.state === "open",
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function policyFacets(items: readonly PolicyItem[]): PolicyFacets {
  return {
    kinds: [...new Set(items.map((i) => i.kind))].sort(),
    years: [...new Set(items.map((i) => i.date.slice(0, 4)))].sort().reverse(),
    anyOpen: items.some((i) => i.commentsOpen),
    count: items.length,
  };
}
