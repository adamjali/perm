/**
 * Every tool and chart another site can put on its own page, in one list.
 *
 * AN EMBED IS THE TOOL ITSELF, NOT A COPY OF IT. Each `/embed/<slug>` route
 * renders the tool's own page component and shows only the section marked
 * `data-embed="<slug>"` (see `EmbedFrame`), so an embed can never drift from
 * the page it came from: same data, same code, same day's figures. A page
 * section may belong to more than one embed (the attribute takes a
 * space-separated list), which is how the bulletin board is both part of the
 * priority-date page and an embed of its own.
 *
 * Framing is allowed on `/embed/*` ONLY (next.config.ts); every other page
 * keeps `frame-ancestors 'none'`. Embed pages are noindex and point their
 * canonical at the full tool, so a pasted embed never competes with the page
 * it came from.
 */

export type EmbedGroup = "lookup" | "estimate" | "calculator" | "chart";

export interface EmbedDef {
  slug: string;
  /** What the embed's own title bar says. */
  title: string;
  /** One line for the gallery. */
  blurb: string;
  /** The full tool on this site; the embed's footer links here. */
  href: string;
  /** A starting iframe height in CSS pixels, from the tool's usual first view. */
  height: number;
  group: EmbedGroup;
}

export const EMBEDS: readonly EmbedDef[] = [
  { slug: "case-status", title: "Check a DOL case", blurb: "Look up any PERM, prevailing wage or LCA case number and see DOL's current status.", href: "/perm-case-status", height: 560, group: "lookup" },
  { slug: "perm-timeline", title: "When will DOL decide my PERM?", blurb: "An estimate from the day DOL received the case, counted against DOL's own queue.", href: "/tools/perm-timeline-calculator", height: 900, group: "estimate" },
  { slug: "pwd-queue", title: "Prevailing wage wait", blurb: "Where a prevailing wage request sits in DOL's queue, and when it is likely to be reached.", href: "/tools/pwd-calculator", height: 760, group: "estimate" },
  { slug: "i140-queue", title: "I-140 wait", blurb: "USCIS's own I-140 processing figures for each category, and what they mean for a filing.", href: "/tools/i140-calculator", height: 760, group: "estimate" },
  { slug: "i485-position", title: "Place in the I-485 line", blurb: "How many pending I-485s sit ahead of a priority date, from USCIS's inventory.", href: "/tools/i485-queue-position", height: 860, group: "estimate" },
  { slug: "priority-date", title: "Is my priority date current?", blurb: "A priority date against every visa bulletin since October 2014.", href: "/tools/priority-date-calculator", height: 820, group: "estimate" },
  { slug: "green-card-timeline", title: "The whole green card timeline", blurb: "PWD, PERM, I-140 and the priority date, stage by stage, from each agency's own figures.", href: "/tools/green-card-timeline", height: 980, group: "estimate" },
  { slug: "perm-deadlines", title: "PERM deadlines", blurb: "The recruitment window, the filing window and the PWD cap, computed by the rules.", href: "/tools/perm-deadline-calculator", height: 820, group: "calculator" },
  { slug: "rfi-deadline", title: "RFI response deadline", blurb: "The date a PERM RFI response is due.", href: "/tools/rfi-deadline", height: 560, group: "calculator" },
  { slug: "pwd-validity", title: "When a prevailing wage expires", blurb: "The validity window of a determination, by the OEWS wage-year rule.", href: "/tools/pwd-validity", height: 600, group: "calculator" },
  { slug: "pd-retention", title: "Keeping a priority date", blurb: "Whether an earlier priority date carries over to a new I-140.", href: "/tools/priority-date-retention", height: 640, group: "calculator" },
  { slug: "h1b-six-year", title: "H-1B six-year limit", blurb: "When the six years run out, and the extensions a pending green card can earn.", href: "/tools/h1b-six-year-limit", height: 700, group: "calculator" },
  { slug: "green-card-fees", title: "Green card fees", blurb: "Every government filing fee from PERM to the green card, by who pays.", href: "/tools/green-card-fees", height: 820, group: "calculator" },
  { slug: "wage-levels", title: "Prevailing wage levels", blurb: "The four OEWS wage levels for an occupation and an area, live from DOL.", href: "/tools/wage-levels", height: 760, group: "calculator" },
  { slug: "salary-explorer", title: "PERM salaries", blurb: "Offered wages on certified PERM cases, by occupation, state and year.", href: "/tools/salary-explorer", height: 900, group: "calculator" },
  { slug: "compare-offer", title: "Compare my offer", blurb: "A salary offer against H-1B LCA wages for the same job and state.", href: "/tools/compare-my-offer", height: 760, group: "calculator" },
  { slug: "i140-trends", title: "I-140 trends", blurb: "USCIS I-140 receipts, approvals and pending by quarter.", href: "/tools/i140-trends", height: 760, group: "chart" },
  { slug: "perm-queue", title: "The PERM queue by filing month", blurb: "Every filing month's undecided cases, and the month DOL says it is working.", href: "/perm-queue", height: 900, group: "chart" },
  { slug: "visa-bulletin", title: "Visa bulletin cutoffs", blurb: "Final action and filing dates by category and country, with the month's movement.", href: "/visa-bulletin", height: 820, group: "chart" },
];

export const EMBED_GROUP_LABEL: Record<EmbedGroup, string> = {
  lookup: "Look up a case",
  estimate: "Estimates",
  calculator: "Calculators",
  chart: "Charts",
};

export function embedBySlug(slug: string): EmbedDef | null {
  return EMBEDS.find((e) => e.slug === slug) ?? null;
}

/** The iframe a site pastes. Lazy, borderless, titled, and sized to start. */
export function embedSnippet(def: EmbedDef, origin = "https://permtracker.app"): string {
  const title = def.title.replace(/"/g, "&quot;");
  return `<iframe src="${origin}/embed/${def.slug}" title="${title}" width="100%" height="${def.height}" style="border:0;max-width:100%" loading="lazy"></iframe>`;
}

/**
 * The embedding site's key for the per-site lookup cap: a lowercased
 * hostname, "www." dropped, or "unknown". Anything that isn't a plain
 * hostname collapses to "unknown", so a crafted value cannot mint a fresh
 * budget bucket per request.
 */
export function siteKeyOf(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  let host = raw.trim().toLowerCase();
  if (host.length > 300) return "unknown";
  try {
    if (/^https?:\/\//.test(host)) host = new URL(host).hostname;
  } catch {
    return "unknown";
  }
  host = host.replace(/^www\./, "");
  // Length first, then a flat character class (no nested quantifier), then
  // the two shapes that class lets through: an empty label and a trailing dot.
  if (host.length > 100 || !/^[a-z0-9-]+\.[a-z0-9.-]+$/.test(host)) return "unknown";
  if (host.includes("..") || host.endsWith(".")) return "unknown";
  return host;
}

/**
 * Which site an embedded lookup is running on.
 *
 * The first load of the frame carries the embedding page as its Referer (the
 * default referrer policy sends the origin), so that wins. A lookup submitted
 * from inside the frame is a request from our own page, whose Referer is us;
 * that request carries the site forward in the `site` field the first load
 * wrote into the form. A caller can put anything in that field, which is why
 * EMBED_ALL_DAILY_LIVE exists: the per-site cap shares the budget fairly among
 * honest sites, and the all-sites cap is the guarantee.
 */
export function embedSiteFor(referer: string | null | undefined, carried: string | null | undefined): string {
  let host: string | null = null;
  try {
    host = referer ? new URL(referer).hostname.toLowerCase() : null;
  } catch {
    host = null;
  }
  const ours =
    !host ||
    host === "permtracker.app" ||
    host.endsWith(".permtracker.app") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return ours ? siteKeyOf(carried) : siteKeyOf(referer);
}

/**
 * Live DOL asks one embedding site may trigger per UTC day. Past it, an
 * embedded lookup still answers, from the stored record only. This site's own
 * pages are not counted here; the global daily discovery budget still binds
 * every lookup, embedded or not.
 */
export const EMBED_SITE_DAILY_LIVE = 50;

/**
 * Live DOL asks every embedding site together may trigger per UTC day. The
 * site key comes from the request, so a caller can mint new ones; this cap on
 * the shared resource is the one that cannot be rotated around, and it keeps
 * embeds to 5% of the site-wide discovery budget.
 */
export const EMBED_ALL_DAILY_LIVE = 5_000;
