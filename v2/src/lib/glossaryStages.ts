/**
 * Where each glossary term comes up on the road to a green card, for the map
 * at the top of /glossary. Six stops in order, then two groups that sit beside
 * the road rather than on it. Every glossary slug belongs to exactly one place
 * (glossaryStages.test.ts), so a new term has to be placed before it ships.
 */

export interface GlossaryStage {
  id: string;
  name: string;
  /** Who runs this stop, or what the group is. */
  who: string;
  /** A stop on the road (numbered), or a group beside it. */
  onRoad: boolean;
  slugs: readonly string[];
}

export const GLOSSARY_STAGES: readonly GlossaryStage[] = [
  {
    id: "wage",
    name: "Prevailing wage",
    who: "Labor Department",
    onRoad: true,
    slugs: ["prevailing-wage-determination", "eta-9141", "npwc", "oews", "wage-level", "soc-code", "area-of-intended-employment"],
  },
  {
    id: "recruitment",
    name: "Recruitment",
    who: "The employer",
    onRoad: true,
    slugs: ["job-order", "notice-of-filing", "recruitment-report", "quiet-period", "supervised-recruitment", "special-handling", "schedule-a"],
  },
  {
    id: "perm",
    name: "PERM",
    who: "Labor Department",
    onRoad: true,
    slugs: [
      "perm", "eta-9089", "labor-certification", "case-number", "flag", "oflc", "analyst-review", "audit", "rfi",
      "certifying-officer", "certified", "denied", "withdrawn", "reconsideration", "balca", "disclosure-files", "three-180-day-clocks",
    ],
  },
  {
    id: "i140",
    name: "I-140",
    who: "USCIS",
    onRoad: true,
    slugs: ["i-140", "priority-date", "eb-categories", "premium-processing", "niw", "receipt-number", "rfe"],
  },
  {
    id: "bulletin",
    name: "Visa bulletin",
    who: "State Department",
    onRoad: true,
    slugs: ["visa-bulletin", "cutoff-date", "current", "unavailable", "retrogression", "chargeability", "spillover"],
  },
  {
    id: "greencard",
    name: "Green card",
    who: "USCIS or a consulate",
    onRoad: true,
    slugs: ["adjustment-of-status", "consular-processing", "i-693", "supplement-j", "portability", "ead", "advance-parole", "median-processing-time", "emma"],
  },
  {
    id: "h1b",
    name: "Staying on H-1B meanwhile",
    who: "Beside the road",
    onRoad: false,
    slugs: ["ac21", "six-year-limit", "h1b-recapture", "h1b-dependent", "lca", "eta-9035"],
  },
  {
    id: "other",
    name: "Other programs and records",
    who: "Beside the road",
    onRoad: false,
    slugs: ["h-2a", "h-2b", "cw-1", "eta-9142", "warn-notice"],
  },
];
