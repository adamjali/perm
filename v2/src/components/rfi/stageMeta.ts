/**
 * The FLAG status strings, and the one distinction the page draws in colour.
 *
 * WHY THE GROUPING IS WHAT IT IS. Colour has to carry meaning, and the only
 * meanings available are ones the status strings themselves establish. Three
 * groups, each defensible from the words DOL prints:
 *
 *   queue   nothing has been asked of the employer and no determination has
 *           been challenged. Where 97% of pending cases sit.
 *   review  the case has been pulled aside for something extra before a
 *           determination. This is the page's subject.
 *   appeal  the string names an appeal or a review of a determination, so a
 *           determination already exists.
 *
 * `APPLICATION ON HOLD` is the hard one and it sits in `review` because that
 * is what the words say: the application is not moving and no appeal is
 * named. DOL publishes no definition of it, which the glossary states rather
 * than papering over.
 *
 * A fourth group split by "who has to act" was drafted and cut. It would have
 * required knowing whether a hold waits on the employer or on DOL, and
 * nothing in the data or in the regulations says.
 */

export type StageGroup = "queue" | "review" | "appeal";

export interface StageMeta {
  /** Sentence case, because the raw strings are shouted. */
  label: string;
  /**
   * The stage as a plural noun phrase, for use inside a sentence.
   *
   * `label.toLowerCase()` is not a substitute and shipped a real defect:
   * "755 employers hold the 905 rfi issued cases" and "99% of the application
   * on hold cases". A status string is a label, and a label dropped into
   * running prose reads like a database column.
   */
  phrase: string;
  group: StageGroup;
}

const STAGES: Record<string, StageMeta> = {
  "ANALYST REVIEW": {
    label: "Analyst review",
    phrase: "cases waiting for an analyst",
    group: "queue",
  },
  "IN PROCESS": { label: "In process", phrase: "cases in process", group: "queue" },
  "DETERMINATION ISSUED": {
    label: "Determination issued",
    phrase: "cases with a determination issued",
    group: "queue",
  },
  "APPLICATION ON HOLD": {
    label: "Application on hold",
    phrase: "applications on hold",
    group: "review",
  },
  "RFI ISSUED": { label: "RFI issued", phrase: "open RFIs", group: "review" },
  "NORD ISSUED": { label: "NORD issued", phrase: "open NORDs", group: "review" },
  "SUPERVISED RECRUITMENT": {
    label: "Supervised recruitment",
    phrase: "cases in supervised recruitment",
    group: "review",
  },
  "PENDING AUDIT RESPONSE": {
    label: "Pending audit response",
    phrase: "cases awaiting an audit response",
    group: "review",
  },
  "RECONSIDERATION APPEALS": {
    label: "Reconsideration appeals",
    phrase: "reconsideration requests",
    group: "appeal",
  },
  "BALCA APPEALS": { label: "BALCA appeals", phrase: "BALCA appeals", group: "appeal" },
  "REQUEST FOR REVIEW": {
    label: "Request for review",
    phrase: "requests for review",
    group: "appeal",
  },
  "DENIED - BALCA DISMISSED": {
    label: "Denied, BALCA dismissed",
    phrase: "cases dismissed by BALCA",
    group: "appeal",
  },
};

/**
 * An unknown status is `review`, not `queue`.
 *
 * DOL added `DENIED - BALCA DISMISSED` to this feed with one case while the
 * live-backlog query was being written, so a new string arriving is a thing
 * that happens rather than a hypothetical. Defaulting it into the ordinary
 * queue would hide a brand new review stage inside the 94,000-case bar, which
 * is the exact opposite of what this page is for. Defaulting it into `review`
 * puts it on the chart where somebody will notice it.
 */
export function stageMeta(status: string): StageMeta {
  const known = STAGES[status];
  if (known) return known;
  const label = sentenceCase(status);
  return { label, phrase: `${label.toLowerCase()} cases`, group: "review" };
}

/** The stages this page treats as its subject. */
export function isReviewStage(status: string): boolean {
  return stageMeta(status).group !== "queue";
}

function sentenceCase(s: string): string {
  const t = s.toLowerCase().replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Fill and text tokens per group.
 *
 * THE FILLS ARE THE `-ink` VARIANTS, NOT THE BARE TOKENS, AND THAT IS
 * MEASURED. WCAG 1.4.11 puts a 3:1 floor on any graphic you must see to read
 * the content, and a chart band is exactly that. Against the #FAFAFA page the
 * bare tokens measure `--data-none` 2.46:1, `--data-warn` 2.07:1 and
 * `--data-good` 2.05:1 — all under the floor. The `-ink` variants measure
 * 7.24, 4.81 and 4.70.
 *
 * It costs nothing in dark mode: globals.css resolves each `-ink` variant to
 * the same hex as its bare token there (`--data-good-ink` is `#2ECC40`), so
 * this is a light-mode fix and a dark-mode no-op.
 *
 * `ink` stays separate from `fill` because a label still needs the text-safe
 * value in contexts where the two diverge, and because a chart that labels a
 * band in the band's own colour is unreadable exactly where the reader looks.
 */
export const GROUP_STYLE: Record<
  StageGroup,
  { fill: string; ink: string; name: string }
> = {
  queue: {
    fill: "var(--data-none-ink)",
    ink: "var(--data-none-ink)",
    name: "Waiting for an analyst",
  },
  review: {
    fill: "var(--data-warn-ink)",
    ink: "var(--data-warn-ink)",
    name: "Pulled aside for extra review",
  },
  appeal: {
    fill: "var(--data-bad-ink)",
    ink: "var(--data-bad-ink)",
    name: "Challenging a determination",
  },
};
