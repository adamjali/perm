/**
 * Every static page a person can be sent to by name: built from the same
 * constants the menus and the data rail use, plus the pages no menu lists.
 * The search palette lists it, and the 404 page matches a mistyped address
 * against it. A plain module, so neither has to load the other.
 */

import {
  LEARN_NAV_LINKS,
  PUBLIC_NAV_LINKS,
  TOOL_NAV_LINKS,
} from "@/lib/constants/navigation";
import { SECTIONS } from "@/components/tools/dataSections";

export interface SiteIndexEntry {
  label: string;
  href: string;
  group: string;
  keywords: string;
}

/**
 * The words people type for a rail page whose label doesn't carry them. A
 * section label is short ("By city"), and without these the palette's fuzzy
 * match can't tie "worksite", "naics" or "nationality" to the page that
 * filters by it.
 */
export const SECTION_KEYWORDS: Readonly<Record<string, string>> = {
  "open-data": "open data download csv json dataset bulk licence license cc-by bulletin history",
  "by-city": "city cities town metro worksite location",
  "by-industry": "industry industries naics sector",
  "by-country": "country countries citizenship nationality birth",
  "by-state": "state states worksite location",
  activity: "decided decisions day certified denied withdrawn citizenship education visa",
  "pwd-cases": "prevailing wage request p-100 pwd",
  "lca-cases": "lca h-1b labor condition i-200",
  "seasonal-cases": "h-2a h-2b h2a h2b cw-1 cw1 seasonal farm agricultural temporary h-300 h-400 p-400 p-500 jo-a-300 c-500 job order 790a 9142a 9142b 9142c northern mariana",
  "opt-employers": "opt stem opt cpt f-1 student students practical training sevis ice",
  "sponsor-finder": "sponsor sponsors green card employer employers find search filter state industry transfer cap-exempt",
  "h1b-employers": "h-1b h1b top employers sponsors biggest largest busiest companies ranking lca uscis data hub approvals by state",
  "wage-sources": "prevailing wage source survey oes radford aon mercer willis towers watson cba union h-1b lca",
  "h1b-lottery-calc": "h-1b h1b lottery registration cap selection odds chance wage level weighted",
  "employers-under-review": "on hold rfi audit appeals census",
  "compare-employers": "compare sponsors side by side",
  layoffs: "warn layoff notices",
  debarments: "debarred barred banned sponsors",
};

export function staticIndex(): SiteIndexEntry[] {
  const out: SiteIndexEntry[] = [];
  for (const l of PUBLIC_NAV_LINKS) {
    out.push({ label: l.label, href: l.href, group: "Go to", keywords: "" });
  }
  out.push({
    label: "Email preferences",
    href: "/email-preferences",
    group: "Go to",
    keywords: "unsubscribe alerts notifications",
  });
  for (const l of TOOL_NAV_LINKS) {
    out.push({
      label: l.label,
      href: l.href,
      group: "Timelines and calculators",
      keywords: "calculator estimate timeline predictor",
    });
  }
  // The three breakdowns by name, ahead of the rail's entries so these labels
  // win the de-dupe below: "By city" says little out of the rail's context.
  for (const [label, href, keywords] of [
    ["PERM jobs by city", "/perm-cities", "city cities town metro worksite location"],
    ["PERM by industry", "/perm-industries", "industry industries naics sector"],
    ["PERM by country of citizenship", "/perm-countries", "country countries citizenship nationality birth"],
  ] as const) {
    out.push({ label, href, group: "Data", keywords: `data statistics breakdown ${keywords}` });
  }
  for (const s of SECTIONS) {
    out.push({
      label: s.label,
      href: s.href,
      group: "Data",
      keywords: `data statistics ${SECTION_KEYWORDS[s.key] ?? "queue"}`,
    });
  }
  for (const l of LEARN_NAV_LINKS) {
    out.push({ label: l.label, href: l.href, group: "Learn", keywords: "" });
  }
  // THE A-TO-Z HUBS, which are in no nav list and were therefore in no index.
  // They are not in PUBLIC_NAV_LINKS (not top-level), not in SECTIONS (the
  // rail lists the entity indexes, not their alphabetical hubs) and not in
  // TOOL_NAV_LINKS, so a search that derives from those four lists could not
  // see them - the one blind spot in an index that is otherwise incapable of
  // going stale. Found by walking every public route against the index rather
  // than by anyone noticing they were missing.
  for (const [label, href, noun] of [
    ["Browse employers A to Z", "/perm-employers/browse", "employers companies sponsors"],
    ["Browse law firms A to Z", "/perm-attorneys/browse", "attorneys law firms counsel"],
    ["Browse occupations A to Z", "/perm-wages/browse", "occupations job titles soc wages"],
  ] as const) {
    out.push({ label, href, group: "Data", keywords: `browse alphabetical index ${noun}` });
  }
  // Pages reached from no nav list: the community timelines, the embed
  // gallery, and the guide in five languages.
  out.push({
    label: "Green card timelines",
    href: "/green-card-timelines",
    group: "Data",
    keywords: "i-140 i-485 timeline community reports rfe premium ead advance parole",
  });
  out.push({ label: "Embed a tool", href: "/badges#embeds", group: "Go to", keywords: "embed iframe widget calculator website" });
  out.push({
    label: "API and AI assistants",
    href: "/developers",
    group: "Go to",
    keywords: "api developer developers key json mcp claude cursor chatgpt assistant connector openapi integration",
  });
  out.push({ label: "API terms", href: "/api-terms", group: "Go to", keywords: "api terms license licence rules" });
  out.push({
    label: "Browser extension",
    href: "/extension",
    group: "Go to",
    keywords: "chrome extension browser add-on plugin linkedin indeed glassdoor handshake wellfound job posting sponsor h-1b",
  });
  for (const [label, href, keywords] of [
    ["中文指南 (Chinese)", "/zh", "chinese 中文 绿卡 排期 劳工证"],
    ["Guía en español (Spanish)", "/es", "spanish español green card"],
    ["Guia em português (Portuguese)", "/pt-br", "portuguese português brasil"],
    ["한국어 안내 (Korean)", "/ko", "korean 한국어 영주권 문호"],
    ["Hướng dẫn tiếng Việt (Vietnamese)", "/vi", "vietnamese tiếng việt thẻ xanh"],
  ] as const) {
    out.push({ label, href, group: "Learn", keywords });
  }
  // De-dupe by href: the nav lists overlap on purpose (Data appears in both
  // PUBLIC_NAV_LINKS and SECTIONS), and two rows for one page read as a bug.
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.href) ? false : (seen.add(e.href), true)));
}
