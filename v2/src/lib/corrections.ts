/**
 * The corrections log: every time this site published something wrong about
 * its data, its process or the rules, what it said, what was true, and what
 * changed. Entries are added, never removed, and never softened.
 *
 * The bar for an entry is a reader who could have formed a false belief from
 * the page, not an internal bug. A wrong number on a live page qualifies; a
 * typo does not; a misjudged design does not unless it misled.
 */

export interface Correction {
  /** ISO date the correction shipped. */
  date: string;
  /** Where the wrong claim lived. */
  where: string;
  /** What the site said. */
  said: string;
  /** What was true. */
  truth: string;
  /** What changed, and how it is kept from recurring. */
  fix: string;
  /** Page to see the corrected state. */
  href?: string;
}

export const CORRECTIONS: Correction[] = [
  {
    date: "2026-09-07",
    where: "The case status page",
    said: "\"Status seen\" quoted a July date for pending cases, telling a beneficiary that DOL had not looked at their case since summer.",
    truth: "The date came from the retired mirror's stamp. The site's own sweep had checked every pending case daily since August 26.",
    fix: "The date is now the sweep's own finish date, read from the coverage record the sweep writes. A test pins the source.",
    href: "/perm-case-status",
  },
  {
    date: "2026-09-06",
    where: "The privacy policy",
    said: "That Sentry Session Replay was in use, and nothing about two other third parties.",
    truth: "Session Replay had been removed on August 29. Ahrefs Web Analytics and the Senja review widget were present and unlisted.",
    fix: "The policy names what actually runs, and is reviewed whenever a script is added or removed.",
    href: "/privacy",
  },
  {
    date: "2026-09-06",
    where: "The RFI and audit hub",
    said: "A two-case PERM review stage that did not exist.",
    truth: "Two prevailing wage request rows had leaked into the PERM table through the lookup path before a guard was deployed, and were counted as a PERM stage.",
    fix: "The rows were deleted and the lookup refuses non-PERM prefixes for that table. The stage list is derived from a static vocabulary.",
    href: "/perm-rfi-audit",
  },
  {
    date: "2026-09-06",
    where: "The review stage pages",
    said: "Median ages that stopped at a date the sweep never updated.",
    truth: "The ages were measured from filing to a stamp the retired mirror had last written in July, or to nothing at all for 12,187 cases.",
    fix: "Age is filing date to today on every stage page and in the census that feeds them.",
    href: "/perm-rfi-audit",
  },
  {
    date: "2026-09-05",
    where: "llms.txt and the site-wide structured data",
    said: "\"Check any PERM case number\", after every visible page had been corrected two days earlier.",
    truth: "The site looks up prevailing wage requests and H-1B LCAs as well, and the two most machine-read surfaces on the site still described only PERM. Google's AI Mode had already told a reader we could not check a pending wage request.",
    fix: "Both surfaces name all three programs, and a test fails if either stops doing so.",
    href: "/perm-case-status",
  },
  {
    date: "2026-09-03",
    where: "41 places across 34 public pages, the homepage FAQ first",
    said: "That this site checks PERM case numbers, in words that read as PERM only.",
    truth: "P- and I- numbers were already looked up live. An answer engine lifted the homepage's product definition and told people we could not do what we did.",
    fix: "Every surface was rewritten to name what can and cannot be looked up, and the guides state what each page cannot tell you.",
    href: "/perm-case-status",
  },
  {
    date: "2026-09-02",
    where: "The homepage trust badges",
    said: "\"Real-Time Updates\" and \"DOL Compliant\".",
    truth: "Status is checked daily, not in real time. \"DOL compliant\" means nothing for a site that reads DOL's published data.",
    fix: "The badges say what is true: federal data only, checked daily. Badges are audited whenever a source or cadence changes.",
    href: "/",
  },
  {
    date: "2026-08-30",
    where: "24 employer pages",
    said: "That the employer \"also filed as\" a name identical to the page's own heading.",
    truth: "The two spellings differed only in whitespace, which a browser collapses, so the page was presenting one spelling as two.",
    fix: "Spellings are compared as rendered. Case and punctuation differences are still shown, because a reader can see those.",
    href: "/perm-employers",
  },
  {
    date: "2026-08-30",
    where: "The RFI and audit hub and its stage pages",
    said: "The same count with two different dates: 965 cases \"as of August 30\" on the hub and the same 965 \"as of August 27\" on the stage page.",
    truth: "Both were the same census; the hub had taken the latest date across all stages and the leaf its own.",
    fix: "Both read the per-stage date. A figure and its stamp are one claim.",
    href: "/perm-rfi-audit",
  },
  {
    date: "2026-08-29",
    where: "The PERM deadline calculator",
    said: "A filing window that closed at first recruitment plus 180 days, on cases where the wage determination expired earlier.",
    truth: "The window closes at the earlier of the two, and the tool had computed the raw arithmetic without the cap, printing close dates on which filing was barred.",
    fix: "The tool calls the canonical composite that carries the cap, and says when the cap applied.",
    href: "/tools/perm-deadline-calculator",
  },
  {
    date: "2026-08-27",
    where: "The denial risk page",
    said: "A finding that denial rates rose in a particular wage band.",
    truth: "The pattern was a binning artefact of how the bands were cut, not a property of the cases.",
    fix: "The finding was retracted on the page and the bands were re-cut; the page says why one number is not offered as a score.",
    href: "/perm-denial-risk",
  },
  {
    date: "2026-08-27",
    where: "Several data pages",
    said: "That the site's per-case data was second-hand, mirrored from another tracker.",
    truth: "By that date every dataset was read from DOL, USCIS or the State Department directly.",
    fix: "The copy names the federal source on each page, and the methodology page lists every dataset with its source and cadence.",
    href: "/methodology",
  },
  {
    date: "2026-08-25",
    where: "The priority date chart",
    said: "One caption, \"a month with no visa numbers at all\", for two shaded states, and a line drawn through months when the category was closed.",
    truth: "\"Current\" (open to every date) and \"Unavailable\" (closed to all) are opposites, and a closed run is a break in the series, not a slope.",
    fix: "The two states have different colours and their own captions, and the line breaks at every gap.",
    href: "/tools/priority-date-calculator",
  },
  {
    date: "2026-08-23",
    where: "The I-140 processing time table in the case tracker",
    said: "EB-2 national interest waiver petitions took about 7 months, and offered a choice of service center.",
    truth: "USCIS was publishing 29 to 32 months, and no longer reports I-140 by service center at all. The table had not been touched in 16 months.",
    fix: "The table is keyed on USCIS's real subtypes, carries its as-of date, and a test fails when that date is more than eight months old.",
    href: "/tools/i140-calculator",
  },
];

/** Newest first. */
export function correctionsSorted(): Correction[] {
  return [...CORRECTIONS].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
