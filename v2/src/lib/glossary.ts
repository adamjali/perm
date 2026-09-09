/**
 * The vocabulary of an employment-based green card, defined once.
 *
 * Every term is one to three sentences, written for a reader who has the
 * word in front of them and not the process behind it. Where a term is
 * defined by a regulation the entry cites the section; where it is DOL's or
 * USCIS's working language it says so instead of inventing a source. `see`
 * points at the page on this site that uses the term with real data, so the
 * glossary is a map and not a dead end.
 *
 * `glossary.test.ts` holds the slugs unique, every `see` href on an existing
 * route, and every entry under 400 characters, because a glossary that grows
 * paragraphs stops being one.
 */

export interface GlossaryTerm {
  term: string;
  /** URL fragment, unique. */
  slug: string;
  definition: string;
  /** Other spellings people search: "PWD", "LC". */
  aka?: string[];
  cite?: { label: string; href: string };
  see?: { label: string; href: string }[];
}

const CFR656 = (s: string) => ({ label: `20 CFR ${s}`, href: `https://www.ecfr.gov/current/title-20/chapter-V/part-656/section-${s}` });
const CFR655 = (s: string) => ({ label: `20 CFR ${s}`, href: `https://www.ecfr.gov/current/title-20/chapter-V/part-655/section-${s}` });
const CFR8 = (part: string, s: string) => ({ label: `8 CFR ${s}`, href: `https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-${part}/section-${s}` });

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "AC21",
    slug: "ac21",
    aka: ["American Competitiveness in the Twenty-first Century Act"],
    definition:
      "The 2000 law behind three rules people still cite by section: 106(a), one-year H-1B extensions past six years when a PERM or I-140 has been on file 365 days; 104(c), three-year extensions on an approved I-140 with no visa number available; and 106(c), the I-485 portability now at INA 204(j).",
    see: [{ label: "H-1B six-year limit calculator", href: "/tools/h1b-six-year-limit" }],
  },
  {
    term: "Adjustment of status",
    slug: "adjustment-of-status",
    aka: ["I-485", "AOS"],
    definition:
      "Becoming a permanent resident from inside the United States on Form I-485, once a visa number is available for the priority date. The alternative is consular processing abroad. USCIS's pending inventory of employment-based I-485s is published monthly by category and country.",
    see: [{ label: "I-485 queue position", href: "/tools/i485-queue-position" }],
  },
  {
    term: "Advance parole",
    slug: "advance-parole",
    aka: ["I-131"],
    definition:
      "Permission to travel abroad and return while an I-485 is pending, requested on Form I-131. Leaving without it is treated as abandoning the I-485 for most applicants. Since April 2024 it carries its own USCIS fee.",
    see: [{ label: "Green card fees", href: "/tools/green-card-fees" }],
  },
  {
    term: "Analyst review",
    slug: "analyst-review",
    definition:
      "DOL's status for a PERM in the ordinary queue: in line for a human analyst, with nothing asked of the employer. Around 94% of pending cases sit here, worked in filing order, and DOL publishes which filing month its analysts have reached.",
    see: [{ label: "The queue by month", href: "/perm-queue" }, { label: "Every status, explained", href: "/perm-case-statuses#analyst-review" }],
  },
  {
    term: "Area of intended employment",
    slug: "area-of-intended-employment",
    definition:
      "The place the job will be done and the area within normal commuting distance of it. Recruitment, the prevailing wage and the layoff look-back are all measured against it, which is why a worksite change can mean a new PERM.",
    cite: CFR656("656.3"),
  },
  {
    term: "Audit",
    slug: "audit",
    definition:
      "DOL's formal demand for the documentation behind a PERM: the recruitment report, the advertisements, the notice of filing and why each U.S. applicant was rejected. Selected after review or at random. Thirty days from the letter to respond, and missing it forfeits the appeal.",
    cite: CFR656("656.20"),
    see: [{ label: "RFI deadline calculator", href: "/tools/rfi-deadline" }, { label: "RFI and audit rates", href: "/perm-rfi-audit" }],
  },
  {
    term: "BALCA",
    slug: "balca",
    aka: ["Board of Alien Labor Certification Appeals"],
    definition:
      "The panel of DOL administrative law judges that reviews PERM denials on the record. It can affirm the denial, direct the Certifying Officer to grant the certification, or order a hearing, and nothing else.",
    cite: CFR656("656.27"),
    see: [{ label: "Appealing a denial", href: "/guides/perm-appeal-reconsideration-balca" }],
  },
  {
    term: "Case number",
    slug: "case-number",
    definition:
      "DOL's identifier for a filing: a program prefix, a five-digit day code (two-digit year and day of year), and a six-digit serial from one counter shared by every FLAG program. G-100 is a PERM, P-100 a prevailing wage request, I-200 an H-1B LCA. Older PERMs carry an A- number.",
    see: [{ label: "The PERM case number format", href: "/guides/perm-case-number-format" }, { label: "Look up a case", href: "/perm-case-status" }],
  },
  {
    term: "Certified",
    slug: "certified",
    definition:
      "DOL granted the labor certification. It is not a green card and not a petition: it is the document the employer files with the I-140, and it expires 180 days after the grant if no I-140 is filed with it.",
    cite: CFR656("656.30"),
    see: [{ label: "Every status, explained", href: "/perm-case-statuses#certified" }],
  },
  {
    term: "Certifying Officer",
    slug: "certifying-officer",
    aka: ["CO"],
    definition:
      "The DOL official who decides a PERM: grants or denies it, orders an audit or supervised recruitment, and hears the first-level request for reconsideration. Works at the Atlanta National Processing Center.",
    cite: CFR656("656.24"),
  },
  {
    term: "Chargeability",
    slug: "chargeability",
    aka: ["cross-chargeability"],
    definition:
      "The country a visa number is counted against, normally the applicant's country of birth, not citizenship. A spouse's country of birth can be used instead (cross-chargeability), which is how a family can move from an oversubscribed country's cutoff to the worldwide one.",
    see: [{ label: "Priority date calculator", href: "/tools/priority-date-calculator" }],
  },
  {
    term: "Consular processing",
    slug: "consular-processing",
    definition:
      "Finishing the green card at a U.S. consulate abroad instead of by I-485: the DS-260 application, an interview, and an immigrant visa. Its fees are State Department fees and are not on the USCIS schedule.",
  },
  {
    term: "Current",
    slug: "current",
    aka: ["C"],
    definition:
      "A visa bulletin entry meaning every priority date in that category and country may proceed. Printed as the letter C. Its opposite is U, unavailable, which means no number at all that month.",
    see: [{ label: "The visa bulletin, month by month", href: "/visa-bulletin" }],
  },
  {
    term: "Cutoff date",
    slug: "cutoff-date",
    aka: ["final action date", "date for filing"],
    definition:
      "The visa bulletin's line: a priority date earlier than it may proceed, one on or after it waits. The final action date governs approvals; the dates-for-filing chart, when USCIS says to use it, governs when an I-485 may be filed.",
    see: [{ label: "Priority date history", href: "/tools/priority-date-calculator" }],
  },
  {
    term: "Denied",
    slug: "denied",
    definition:
      "The Certifying Officer refused the PERM. Two 30-day windows run from the date of the denial: a request for reconsideration to the same officer, or a request for review by BALCA. Letting both pass makes the denial final.",
    cite: CFR656("656.24"),
    see: [{ label: "What happens after a denial", href: "/guides/perm-denied-what-happens-next" }],
  },
  {
    term: "Disclosure files",
    slug: "disclosure-files",
    definition:
      "DOL's quarterly spreadsheets of decided PERM, prevailing wage and LCA cases, with the employer, occupation, worksite and wage. They contain no pending cases and run to the end of the last quarter, which is why the live case-status index is read beside them.",
    see: [{ label: "Where the data comes from", href: "/methodology" }],
  },
  {
    term: "EAD",
    slug: "ead",
    aka: ["employment authorization document", "I-765"],
    definition:
      "The work permit card requested on Form I-765. With a pending I-485 it lets the applicant work for any employer while waiting, and it has carried its own USCIS fee since April 2024.",
    see: [{ label: "Green card fees", href: "/tools/green-card-fees" }],
  },
  {
    term: "Employment-based preference categories",
    slug: "eb-categories",
    aka: ["EB-1", "EB-2", "EB-3"],
    definition:
      "The five annual visa allotments for employment immigrants under INA 203(b). PERM cases are EB-2 (advanced degree or exceptional ability) or EB-3 (professionals, skilled and other workers); EB-1 and the EB-2 national interest waiver need no PERM.",
    see: [{ label: "I-140 trends by category", href: "/tools/i140-trends" }],
  },
  {
    term: "ETA-9035",
    slug: "eta-9035",
    aka: ["LCA form"],
    definition:
      "The labor condition application form for an H-1B, H-1B1 or E-3 petition, filed through FLAG and certified within seven working days. It attests to the wage and working conditions; it is not a labor certification.",
    cite: CFR655("655.730"),
    see: [{ label: "H-1B LCA search", href: "/lca-cases" }],
  },
  {
    term: "ETA-9089",
    slug: "eta-9089",
    aka: ["PERM form"],
    definition:
      "The application for permanent employment certification, the PERM itself. Filed by the employer through FLAG after recruitment, it becomes the case DOL decides and the document that accompanies the I-140.",
    cite: CFR656("656.17"),
    see: [{ label: "PERM processing times", href: "/perm-processing-times" }],
  },
  {
    term: "ETA-9141",
    slug: "eta-9141",
    aka: ["prevailing wage request form"],
    definition:
      "The application for a prevailing wage determination. Filed before recruitment, it asks the National Prevailing Wage Center to set the wage the PERM job must offer.",
    cite: CFR656("656.40"),
    see: [{ label: "Wage request search", href: "/pwd-cases" }],
  },
  {
    term: "FLAG",
    slug: "flag",
    aka: ["Foreign Labor Application Gateway"],
    definition:
      "DOL's filing system for PERM, prevailing wage and LCA cases, and the source of the status words on this site. Its case-status search answers by case number; it publishes no definitions of the words it returns.",
    see: [{ label: "Every status, explained", href: "/perm-case-statuses" }],
  },
  {
    term: "H-1B recapture",
    slug: "h1b-recapture",
    definition:
      "Days spent outside the United States during H-1B status do not count toward the six-year limit and can be added back with proof of travel. The calculator takes the total as an input because only the passport holds it.",
    see: [{ label: "H-1B six-year limit calculator", href: "/tools/h1b-six-year-limit" }],
  },
  {
    term: "I-140",
    slug: "i-140",
    definition:
      "The immigrant petition the employer files with USCIS on the certified PERM. Its approval fixes the priority date and the category; USCIS publishes quarterly receipt, approval and denial counts, and premium processing is available.",
    see: [{ label: "I-140 queue", href: "/tools/i140-calculator" }],
  },
  {
    term: "I-693",
    slug: "i-693",
    definition:
      "The medical examination report a civil surgeon signs for the I-485. One signed on or after November 1, 2023 no longer expires. USCIS charges nothing for the form; the civil surgeon charges for the exam.",
    see: [{ label: "The I-693 medical exam", href: "/guides/i693-medical-exam" }],
  },
  {
    term: "Job order",
    slug: "job-order",
    aka: ["SWA job order"],
    definition:
      "A mandatory recruitment step: the job posted with the state workforce agency for 30 days, inside the 180 days before the PERM is filed. Its end date is one of the deadline calculator's inputs.",
    cite: CFR656("656.17"),
    see: [{ label: "PERM deadline calculator", href: "/tools/perm-deadline-calculator" }],
  },
  {
    term: "Labor certification",
    slug: "labor-certification",
    aka: ["LC"],
    definition:
      "DOL's finding that no able, willing, qualified and available U.S. worker was found for the job at the prevailing wage, and that hiring the foreign worker will not adversely affect U.S. workers. The PERM is the process that produces it.",
    cite: CFR656("656.1"),
  },
  {
    term: "LCA",
    slug: "lca",
    aka: ["labor condition application"],
    definition:
      "The wage-and-conditions attestation an H-1B petition needs, filed on ETA-9035. DOL certifies it within seven working days on a review of completeness rather than of the wage, and publishes the wage attested in its quarterly files.",
    cite: CFR655("655.740"),
    see: [{ label: "H-1B salary explorer", href: "/lca-wages" }],
  },
  {
    term: "National interest waiver",
    slug: "niw",
    aka: ["NIW", "EB-2 NIW"],
    definition:
      "An EB-2 I-140 the worker files for themselves, asking USCIS to waive the job offer and the labor certification because the work is in the national interest. No PERM, no employer, and the same EB-2 visa queue.",
    see: [{ label: "I-140 trends", href: "/tools/i140-trends" }],
  },
  {
    term: "Notice of filing",
    slug: "notice-of-filing",
    aka: ["NOF"],
    definition:
      "The notice the employer posts at the worksite for ten consecutive business days, telling employees a labor certification is being sought and how to comment to DOL. One of the recruitment steps an audit calls for.",
    cite: CFR656("656.10"),
  },
  {
    term: "NPWC",
    slug: "npwc",
    aka: ["National Prevailing Wage Center"],
    definition:
      "The DOL office that issues prevailing wage determinations for PERM and H-1B cases and hears the first request to redetermine one. Its queue is published by filing month and read on the wage queue page.",
    see: [{ label: "Prevailing wage queue", href: "/tools/pwd-calculator" }],
  },
  {
    term: "OEWS",
    slug: "oews",
    aka: ["Occupational Employment and Wage Statistics", "OES"],
    definition:
      "The Bureau of Labor Statistics survey DOL's prevailing wages are drawn from, updated each July 1. That turnover is why a wage determination issued after July 1 runs to the next June 30.",
    see: [{ label: "Wage determination validity", href: "/tools/pwd-validity" }],
  },
  {
    term: "OFLC",
    slug: "oflc",
    aka: ["Office of Foreign Labor Certification"],
    definition:
      "The DOL office that runs PERM, prevailing wage and LCA programs, publishes the processing-time page and the quarterly disclosure files, and keeps the debarment list.",
    see: [{ label: "Debarments", href: "/debarments" }],
  },
  {
    term: "PERM",
    slug: "perm",
    aka: ["Program Electronic Review Management"],
    definition:
      "The labor certification process for most employment-based green cards since 2005: a prevailing wage determination, employer recruitment, and an ETA-9089 that DOL decides in filing order. The certification, not the green card, is what it produces.",
    cite: CFR656("656.17"),
    see: [{ label: "The complete PERM guide", href: "/guides/complete-perm-filing-guide" }],
  },
  {
    term: "Portability",
    slug: "portability",
    aka: ["204(j)", "same or similar occupation"],
    definition:
      "Once an I-485 has been pending 180 days, it may be approved on a new job offer in the same or a similar occupation, filed on Supplement J. Whether the new job is same or similar is USCIS's finding.",
    cite: CFR8("245", "245.25"),
    see: [{ label: "Priority date retention calculator", href: "/tools/priority-date-retention" }],
  },
  {
    term: "Premium processing",
    slug: "premium-processing",
    aka: ["I-907"],
    definition:
      "USCIS's paid faster decision on an I-140, requested on Form I-907. It shortens the petition's wait and nothing else: not the PERM, not the visa bulletin, not the I-485, for which it is not offered.",
    see: [{ label: "Green card fees", href: "/tools/green-card-fees" }],
  },
  {
    term: "Prevailing wage determination",
    slug: "prevailing-wage-determination",
    aka: ["PWD"],
    definition:
      "The wage DOL sets for the job before recruitment, from OEWS at one of four levels or from an acceptable survey. The PERM must offer at least this wage. Valid for 90 days or until June 30, depending on when it was issued.",
    cite: CFR656("656.40"),
    see: [{ label: "How DOL sets a prevailing wage", href: "/guides/how-dol-sets-a-prevailing-wage" }, { label: "Validity calculator", href: "/tools/pwd-validity" }],
  },
  {
    term: "Priority date",
    slug: "priority-date",
    definition:
      "The applicant's place in the visa line: the day DOL received the PERM, or the day USCIS received an I-140 that needs no PERM. Retained from an approved I-140 for later petitions unless USCIS revoked the approval for fraud, error or an invalid certification.",
    cite: CFR8("204", "204.5"),
    see: [{ label: "Read your priority date history", href: "/guides/read-your-priority-date-history" }],
  },
  {
    term: "Quiet period",
    slug: "quiet-period",
    definition:
      "The 30 days after the last recruitment step ends before the ETA-9089 may be filed, so that U.S. applicants still have time to respond. Together with the 180-day recruitment window it fixes the filing window the deadline calculator draws.",
    cite: CFR656("656.17"),
    see: [{ label: "PERM deadline calculator", href: "/tools/perm-deadline-calculator" }],
  },
  {
    term: "Reconsideration",
    slug: "reconsideration",
    definition:
      "Asking the Certifying Officer who denied a PERM to look again, within 30 days of the denial. It can only use documents DOL already had or that existed at filing and were kept on file; the officer may instead forward it to BALCA.",
    cite: CFR656("656.24"),
    see: [{ label: "Appealing a denial", href: "/guides/perm-appeal-reconsideration-balca" }],
  },
  {
    term: "Recruitment report",
    slug: "recruitment-report",
    definition:
      "The employer's signed account of the recruitment: each step, the number of applicants, and the lawful job-related reasons each U.S. applicant was rejected. Kept on file and produced on audit.",
    cite: CFR656("656.17"),
    see: [{ label: "The recruitment checklist", href: "/guides/perm-recruitment-checklist" }],
  },
  {
    term: "Request for evidence",
    slug: "rfe",
    aka: ["RFE"],
    definition:
      "USCIS's request for more evidence on a petition or application, with its own response period. Not DOL's RFI on a PERM, which is a different agency, a different letter and a different clock.",
  },
  {
    term: "Request for information",
    slug: "rfi",
    aka: ["RFI"],
    definition:
      "DOL's question to the employer before deciding a PERM, under the officer's power to request supplemental information. Lighter than an audit; the letter sets its own deadline, and the regulation sets none.",
    cite: CFR656("656.20"),
    see: [{ label: "RFI issued: what to do", href: "/guides/perm-rfi-issued-what-to-do" }],
  },
  {
    term: "Retrogression",
    slug: "retrogression",
    definition:
      "A cutoff date moving backwards from one visa bulletin to the next, so a priority date that was current stops being current. It happens when demand at the earlier dates exceeds the numbers left in the year, and it is visible in the cutoff history.",
    see: [{ label: "Priority date history", href: "/tools/priority-date-calculator" }],
  },
  {
    term: "Schedule A",
    slug: "schedule-a",
    definition:
      "Occupations DOL has pre-certified as short of U.S. workers, chiefly physical therapists and professional nurses. The employer files the I-140 with the uncertified ETA-9089 and skips DOL's queue, but still needs a prevailing wage determination and a notice of filing.",
    cite: CFR656("656.15"),
  },
  {
    term: "Six-year limit",
    slug: "six-year-limit",
    definition:
      "H-1B status is capped at six years, counting time in L-1 status too. The AC21 extensions and recaptured travel days are the ways past it, and each needs a date in the record.",
    see: [{ label: "H-1B six-year limit calculator", href: "/tools/h1b-six-year-limit" }],
  },
  {
    term: "SOC code",
    slug: "soc-code",
    aka: ["Standard Occupational Classification"],
    definition:
      "The federal occupation code, such as 15-1252 for software developers, that a wage determination and a PERM are keyed to. DOL prints it with and without a decimal suffix in its files, so the site groups on the first seven characters.",
    see: [{ label: "PERM wages by occupation", href: "/perm-wages" }],
  },
  {
    term: "Special handling",
    slug: "special-handling",
    definition:
      "The recruitment rule for college and university teachers: the employer may use a competitive selection already run within the past 18 months instead of the standard PERM recruitment, and must show the foreign worker was the most qualified.",
    cite: CFR656("656.18"),
  },
  {
    term: "Spillover",
    slug: "spillover",
    definition:
      "Visa numbers a preference category or country cannot use in a fiscal year being made available to another under the INA's ordering rules. The State Department reports the year's totals after the fact; this site prints no spillover forecast because no figure for the coming year exists.",
    see: [{ label: "The next visa bulletin", href: "/visa-bulletin" }],
  },
  {
    term: "Supervised recruitment",
    slug: "supervised-recruitment",
    definition:
      "Recruitment DOL directs: the officer approves the advertisement and where it runs, applicants write to the officer, and the employer reports on each. Ordered after a failure on audit or as a two-year consequence of not responding to one.",
    cite: CFR656("656.21"),
    see: [{ label: "Every status, explained", href: "/perm-case-statuses#supervised-recruitment" }],
  },
  {
    term: "Three 180-day clocks",
    slug: "three-180-day-clocks",
    definition:
      "Three unrelated rules that share a number: a certified PERM expires 180 days after the grant if no I-140 is filed; an approved I-140 survives the employer's withdrawal after 180 days; a pending I-485 becomes portable after 180 days.",
    see: [{ label: "The three 180-day clocks", href: "/guides/three-180-day-clocks" }],
  },
  {
    term: "Unavailable",
    slug: "unavailable",
    aka: ["U"],
    definition:
      "A visa bulletin entry meaning no numbers at all for that category and country that month, printed as the letter U. Different from a far-back cutoff date: U is a closed door, a date is a line.",
    see: [{ label: "The visa bulletin, month by month", href: "/visa-bulletin" }],
  },
  {
    term: "Visa bulletin",
    slug: "visa-bulletin",
    definition:
      "The State Department's monthly table of cutoff dates by preference category and country of chargeability, in two charts: final action dates and dates for filing. This site holds 84 months of it and computes the next one's seasonal pattern rather than predicting it.",
    see: [{ label: "The next visa bulletin", href: "/visa-bulletin" }],
  },
  {
    term: "Wage level",
    slug: "wage-level",
    aka: ["Level I", "Level II", "Level III", "Level IV"],
    definition:
      "The four OEWS wage tiers a prevailing wage determination is set at, chosen from the job's requirements against what the occupation normally needs. Level I is entry, Level IV fully competent. The level, not the survey, is where most wage disputes live.",
    see: [{ label: "How DOL sets a prevailing wage", href: "/guides/how-dol-sets-a-prevailing-wage" }],
  },
  {
    term: "WARN notice",
    slug: "warn-notice",
    definition:
      "The public notice of a mass layoff or plant closing that the Worker Adjustment and Retraining Notification Act requires 60 days ahead, filed with the state. Where a state publishes them, it is the record of a layoff that DOL's PERM files do not carry.",
    see: [{ label: "Layoffs and your PERM", href: "/guides/employer-layoffs-and-your-perm" }],
  },
  {
    term: "Withdrawn",
    slug: "withdrawn",
    definition:
      "The employer withdrew the application before a decision. DOL records no reason. A withdrawal is not a denial and does not count against anyone; a PERM withdrawn is simply a job offer that is no longer being certified.",
    see: [{ label: "Every status, explained", href: "/perm-case-statuses#withdrawn" }],
  },
];

/** Alphabetical, by the term as printed. */
export function glossarySorted(): GlossaryTerm[] {
  return [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" }));
}

/** The first letter (or digit) of each term, for the jump strip. */
export function glossaryLetters(): string[] {
  return [...new Set(glossarySorted().map((t) => t.term.charAt(0).toUpperCase()))];
}
