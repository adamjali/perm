/**
 * Who an account is for, read from the role it picked at onboarding (stored
 * as `userProfiles.jobTitle`, which Settings also lets a person type freely).
 *
 * The app is built for people who manage PERM cases: attorneys, paralegals,
 * HR and employers. People waiting on their own case sign up too, and they
 * belong in the account counts as themselves, not as practice users, or every
 * "how many attorneys use this" figure is inflated by people the app was not
 * built for. Nobody is turned away by this: it only labels and counts.
 *
 * "Other" stays its own bucket. Several "Other" accounts track their own
 * case, but the role alone can't say which, and a guess would move people
 * between buckets on no evidence.
 */

export type Audience = "practice" | "own-case" | "other" | "unstated";

/** The onboarding role for the person a case is about. */
export const OWN_CASE_ROLE = "Waiting on my own case";

/** The onboarding roles for people who file or manage cases. */
const PRACTICE_ROLES = new Set([
  "Immigration Attorney",
  "Paralegal",
  "HR Professional",
  "Employer/Petitioner",
]);

/** A role typed in Settings that names the work rather than one of the buttons. */
const PRACTICE_WORDS =
  /\b(attorney|lawyer|paralegal|counsel|legal|law firm|immigration specialist|human resources|hr|recruit(?:er|ing)?)\b/i;

export function audienceOf(role: string | null | undefined): Audience {
  const r = role?.trim();
  if (!r) return "unstated";
  if (r === OWN_CASE_ROLE) return "own-case";
  if (r === "Other") return "other";
  if (PRACTICE_ROLES.has(r) || PRACTICE_WORDS.test(r)) return "practice";
  return "other";
}

export const AUDIENCE_LABEL: Record<Audience, string> = {
  practice: "In practice",
  "own-case": "Own case",
  other: "Other",
  unstated: "No role",
};

export type AudienceCounts = Record<Audience, number>;

export function countAudiences(roles: Iterable<string | null | undefined>): AudienceCounts {
  const counts: AudienceCounts = { practice: 0, "own-case": 0, other: 0, unstated: 0 };
  for (const role of roles) counts[audienceOf(role)]++;
  return counts;
}

/** "2 in practice, 1 own case" in a fixed order, leaving out the empty buckets. */
export function audienceLine(counts: AudienceCounts): string {
  return (["practice", "own-case", "other", "unstated"] as const)
    .filter((a) => counts[a] > 0)
    .map((a) => `${counts[a]} ${AUDIENCE_LABEL[a].toLowerCase()}`)
    .join(", ");
}
