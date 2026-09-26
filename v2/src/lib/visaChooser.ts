/**
 * Which employment-based green card categories could fit, from a few answers,
 * read against the regulation's own definitions (8 CFR 204.5, read from eCFR
 * 2026-09-26) and USCIS's national interest waiver test (Policy Manual
 * Volume 6, Part F, Chapter 5, current as of 2026-09-23). Pure and tested.
 *
 * It names categories whose DEFINITIONS match what the reader said. Whether a
 * case meets them is USCIS's decision on the evidence, and reading that
 * evidence is an attorney's job; the page says so above the answer.
 */

export type Sponsor = "employer" | "self" | "family" | "investment";
/** The job's minimum requirement, as the employer sets it on the PERM. */
export type JobRequirement = "advanced" | "bachelors" | "two-years" | "under-two";
/** The person's own highest qualification. */
export type Qualification = "advanced" | "bachelors5" | "bachelors" | "two-years" | "under-two";

export interface Answers {
  sponsor: Sponsor;
  job: JobRequirement;
  qualification: Qualification;
  /** Sustained national or international acclaim, recognized in the field. */
  acclaim: boolean;
  /** Internationally recognized as outstanding in an academic field, three years' teaching or research. */
  researcher: boolean;
  /** A year of the last three abroad as a manager or executive for the US employer's affiliate. */
  multinational: boolean;
  /** Expertise significantly above that ordinarily encountered. */
  exceptional: boolean;
  /** Work of substantial merit and national importance that the person is well positioned to advance. */
  nationalInterest: boolean;
}

export type CategoryCode = "EB1A" | "EB1B" | "EB1C" | "EB2" | "EB2NIW" | "EB3" | "EW3";

export interface Fit {
  code: CategoryCode;
  name: string;
  /** Why this matched, in the reader's own terms. */
  why: string;
  needsPerm: boolean;
  needsJobOffer: boolean;
  whoFiles: string;
  /** The rule it rests on. */
  rule: string;
  /** The visa bulletin category that sets its queue. */
  bulletin: "EB1" | "EB2" | "EB3" | "EW3";
}

const ORDER: CategoryCode[] = ["EB1A", "EB1B", "EB1C", "EB2", "EB2NIW", "EB3", "EW3"];

const QUAL_RANK: Record<Qualification, number> = { "under-two": 0, "two-years": 1, bachelors: 2, bachelors5: 3, advanced: 4 };
/** The lowest qualification that meets each job requirement. */
const JOB_NEEDS: Record<JobRequirement, number> = { "under-two": 0, "two-years": 1, bachelors: 2, advanced: 3 };

const FIT: Record<CategoryCode, Omit<Fit, "why">> = {
  EB1A: {
    code: "EB1A", name: "EB-1A, extraordinary ability", needsPerm: false, needsJobOffer: false,
    whoFiles: "You, or anyone on your behalf", rule: "8 CFR 204.5(h)", bulletin: "EB1",
  },
  EB1B: {
    code: "EB1B", name: "EB-1B, outstanding professor or researcher", needsPerm: false, needsJobOffer: true,
    whoFiles: "The US employer", rule: "8 CFR 204.5(i)", bulletin: "EB1",
  },
  EB1C: {
    code: "EB1C", name: "EB-1C, multinational manager or executive", needsPerm: false, needsJobOffer: true,
    whoFiles: "The US employer", rule: "8 CFR 204.5(j)", bulletin: "EB1",
  },
  EB2: {
    code: "EB2", name: "EB-2 through a PERM", needsPerm: true, needsJobOffer: true,
    whoFiles: "The US employer", rule: "8 CFR 204.5(k)", bulletin: "EB2",
  },
  EB2NIW: {
    code: "EB2NIW", name: "EB-2 national interest waiver", needsPerm: false, needsJobOffer: false,
    whoFiles: "You, or anyone on your behalf", rule: "8 CFR 204.5(k), and USCIS's three-part test from Matter of Dhanasar", bulletin: "EB2",
  },
  EB3: {
    code: "EB3", name: "EB-3, professional or skilled worker", needsPerm: true, needsJobOffer: true,
    whoFiles: "The US employer", rule: "8 CFR 204.5(l)", bulletin: "EB3",
  },
  EW3: {
    code: "EW3", name: "EB-3 Other Workers", needsPerm: true, needsJobOffer: true,
    whoFiles: "The US employer", rule: "8 CFR 204.5(l)", bulletin: "EW3",
  },
};

export function chooseCategories(a: Answers): { fits: Fit[]; notes: string[] } {
  const fits: Fit[] = [];
  const notes: string[] = [];
  const add = (code: CategoryCode, why: string) => fits.push({ ...FIT[code], why });
  const employer = a.sponsor === "employer";
  const advancedPerson = QUAL_RANK[a.qualification] >= QUAL_RANK.bachelors5;

  if (a.sponsor === "family") {
    notes.push(
      "Family-sponsored green cards follow their own rules and their own bulletin chart, which this page doesn't cover. USCIS's family pages are the place to start.",
    );
  }
  if (a.sponsor === "investment") {
    notes.push(
      "An investment route is EB-5, with its own capital and job-creation rules that this page doesn't cover. The bulletin's EB-5 lines are on the category pages.",
    );
  }

  if (a.acclaim) add("EB1A", "You said you have sustained national or international acclaim in your field. No employer or PERM is needed.");
  if (a.researcher) {
    if (employer) add("EB1B", "You said you're recognized as outstanding in an academic field and a US employer is offering the job.");
    else notes.push("EB-1B needs a US employer offering a permanent research or tenure-track teaching position.");
  }
  if (a.multinational) {
    if (employer) add("EB1C", "You said you managed for the employer's affiliate abroad and are coming to manage for it here.");
    else notes.push("EB-1C needs the US employer whose affiliate you worked for abroad.");
  }

  if (employer) {
    if (QUAL_RANK[a.qualification] < JOB_NEEDS[a.job]) {
      notes.push(
        "The job requires more than you said you hold. On a PERM, the person must meet the job's own minimum requirements.",
      );
    } else if (a.job === "advanced") {
      add("EB2", "The job requires an advanced degree (or a bachelor's plus five years' progressive experience), and you hold it.");
    } else if (a.job === "bachelors" || a.job === "two-years") {
      add("EB3", a.job === "bachelors"
        ? "The job requires a bachelor's degree, which makes it a professional EB-3 job."
        : "The job requires at least two years of training or experience, which makes it a skilled-worker EB-3 job.");
    } else {
      add("EW3", "The job requires less than two years of training or experience. The job sets the category, whatever degrees you hold.");
    }
  }

  if (a.nationalInterest) {
    if (advancedPerson || a.exceptional) {
      add("EB2NIW", "You said your work has substantial merit and national importance, and you hold an advanced degree or have exceptional ability. No employer or PERM is needed.");
    } else {
      notes.push("A national interest waiver is an EB-2 route, so it needs an advanced degree or exceptional ability first.");
    }
  }

  // A job needing an advanced degree also supports EB-3: a second I-140 on the
  // same PERM keeps the original priority date (8 CFR 204.5(e)).
  if (fits.some((f) => f.code === "EB2")) {
    add("EB3", "A job requiring an advanced degree also meets EB-3, so a second I-140 in EB-3 can be filed on the same PERM, keeping the priority date.");
  }

  if (a.sponsor === "self" && fits.length === 0) {
    notes.push(
      "Without an employer, the employment categories open to you are EB-1A and the national interest waiver, and nothing you ticked points to either.",
    );
  }

  fits.sort((x, y) => ORDER.indexOf(x.code) - ORDER.indexOf(y.code));
  return { fits, notes };
}
