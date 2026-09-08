/**
 * The page social cards: one 1200x630 JPEG per public page, in public/og/.
 *
 * Rendered by scripts/make-page-cards.mjs from a real screenshot of the page
 * inset in the house frame (or a drawn motif for indexes and legal pages).
 * Nothing on a card is a live figure, because a static image of a number that
 * moves weekly is wrong by the second week; the label says what the page IS.
 *
 * Every slug here must have a file, and every page that names a slug here must
 * exist; social-cards.test.ts holds both. `home` is also what the root
 * /opengraph-image serves, so any page without its own card shows it.
 */

export const PAGE_CARD_ALT = {
  "about": "About PERM Tracker. A free, independent site on DOL's own data, run by an immigration attorney who files these cases.",
  "blog": "PERM Tracker blog. What DOL's own files show about processing times, denials, wages and the queue.",
  "calculators": "PERM calculators. Seven calculators for your case and two explorers for the field, all free, on data the government publishes.",
  "case-search": "Search every DOL case an employer filed. PERM, prevailing wage and H-1B LCA, open and decided, in one search.",
  "changelog": "What changed. Every release, dated, with the data and features it added.",
  "contact": "Get in touch. support@permtracker.app, and the GitHub issue templates for bugs and requests.",
  "faq": "Frequently asked questions. What applicants and attorneys ask about PERM Tracker and the PERM process.",
  "for-attorneys": "Track every PERM deadline. Filing windows, wage expirations and audit clocks, computed per case. Free.",
  "guides": "PERM guides. How-tos, references and checklists for the PERM process and for PERM Tracker itself.",
  "home": "PERM Tracker. Look up a PERM case, see where DOL's queue stands, and track every deadline. Free, from DOL's own data.",
  "lca-cases": "Find an H-1B LCA. The number, title, filing date and status, from DOL's daily check and its files.",
  "methodology": "How these numbers are computed. Where every figure comes from, how it is computed, and what we refuse to publish.",
  "perm-attorneys": "Who files the most PERM cases. Every firm named on a PERM filing, ranked, with its approval rate from DOL's files.",
  "perm-by-state": "PERM filings, state by state. Every certified, denied and withdrawn case at its worksite state.",
  "perm-case-status": "Check a PERM case. The status DOL holds, its place in the queue, and an email when it changes.",
  "perm-decision-activity": "How fast the queue is moving. Decisions counted by the day DOL issued them, and the cases it moved.",
  "perm-denial-risk": "What gets denied. Denial rates by job, worksite and what the form asks, from DOL's own files.",
  "perm-employers": "Who sponsors the most. Every employer in DOL's files, ranked by filings, with its approval rate.",
  "perm-processing-times": "PERM processing times. Where DOL's queue stands, from DOL's own published figures, checked daily.",
  "perm-queue": "Where the PERM queue stands. Undecided cases by filing month, from a per-case scan of DOL's index.",
  "perm-rfi-audit": "RFIs, audits and appeals. How many cases sit at each review stage, and how long they have waited.",
  "perm-wages": "What PERM cases pay. Wage percentiles by occupation, employer and state, from DOL's disclosure files.",
  "privacy": "Privacy policy. What the site collects, what it never collects, and who processes it.",
  "lca-wages": "H-1B salaries by occupation and state. Every wage on a certified labor condition application, as percentiles, from DOL's files.",
  "compare-my-offer": "Compare an H-1B offer against what employers actually filed for the same job and state. The offer stays in the browser.",
  "policy-changes": "Immigration policy changes on the record. Every Federal Register rule, proposed rule and notice touching PERM, wages, H-1B and the I-485, linked.",
  "employer-compare": "Two employers side by side: PERM filings, approval rate, wage levels and recent activity, from DOL's own files.",
  "pwd-cases": "Find a prevailing wage request. Pending from DOL's daily check, decided with the wage set, searched by employer.",
  "security": "How your data is protected. Encryption at rest, isolated accounts, short sessions, and no client data on the public pages.",
  "terms": "Terms of service. The terms for using PERM Tracker, its data and its case management.",
  "visa-bulletin": "The next visa bulletin, from the last 84. What every earlier bulletin for this month did, per category and country, beside the I-485 inventory ahead of each cutoff.",
  "tools": "Live PERM data and free calculators. DOL's own figures, each with its date, and calculators built on them.",
} as const;

export type PageCardSlug = keyof typeof PAGE_CARD_ALT;

export function pageCardUrl(slug: PageCardSlug): string {
  return `/og/${slug}.jpg`;
}
