import { Fragment } from "react";

import { GROUP_STYLE, stageMeta } from "./stageMeta";

/**
 * What each status means, and whether anything official says so.
 *
 * THE SHAPE ENFORCES THE SOURCING RULE. Every entry must supply either a
 * `cite` (a real section of 20 CFR 656 with a link) or an `unsourced` reason.
 * There is no third option and no default, so an entry cannot be added with a
 * confident paraphrase and no citation behind it. Several of these strings
 * genuinely are DOL's internal workflow language with nothing published about
 * them, and saying that is more useful to a frightened reader than a fluent
 * guess would be.
 *
 * The deadlines are the part people most need and most often get from a forum
 * post. Where a regulation sets one it is quoted with its section.
 */

interface Entry {
  /** The FLAG status this explains, or null for a term with no status. */
  status: string | null;
  /** Heading, when there is no status string to take a label from. */
  term?: string;
  what: string;
  next?: string;
  deadline?: string;
  cite?: { label: string; section: string };
  unsourced?: string;
}

/**
 * Verified against the section text, not written from memory.
 *
 * Fetched from eCFR's versioner API (title 20, part 656, 2026-08-01 issue) and
 * read paragraph by paragraph. Three things came back different from the draft
 * this replaced, and one of them is the most consequential fact on the page:
 *
 *  - Missing the audit deadline does not merely deny the application. Under
 *    656.20(a)(3)(i)-(ii) it "constitutes a refusal to exhaust available
 *    administrative remedies" and "the administrative-judicial review
 *    procedure provided in 656.26 is not available", so the right to appeal to
 *    BALCA goes with it.
 *  - BALCA's three outcomes under 656.27(c) are affirm, direct the officer to
 *    grant, or direct a HEARING. The draft said "remand", which is what
 *    everybody assumes and is not what the section says.
 *  - 656.24(g)(3) bars reconsideration outright where the deficiency came from
 *    "the applicant's disregard of a system prompt or other direct
 *    instruction".
 */
const ECFR =
  "https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-C/section-";

const ENTRIES: Entry[] = [
  {
    status: "RFI ISSUED",
    what:
      "The analyst reviewing the application wants something clarified before deciding it. In DOL's queue language this is a request for information, and it is lighter than an audit: it asks a question rather than calling in the whole recruitment file.",
    next:
      "The employer or its attorney answers and the case goes back to the analyst for a determination. Of the ones that have reached a decision, most were certified.",
    unsourced:
      "The words \u201crequest for information\u201d and the acronym RFI appear nowhere in 20 CFR 656. The nearest regulatory hook is 656.20(d), which lets the certifying officer request supplemental information before making a determination, and it sets no deadline. That is why no response window is quoted here: the letter itself states the date, and that date is the one that counts. An audit is the separate, formal instrument under 656.20(a), with its own status and its own queue.",
  },
  {
    status: null,
    term: "Audit",
    what:
      "A formal demand for the documentation behind the application: the recruitment report, the tear sheets, the notice of filing, the resumes, and why each U.S. applicant was rejected. The certifying officer can order one after reviewing the case, and some applications are selected at random for quality control.",
    next:
      "The officer reviews what arrives and certifies or denies. Two different consequences hang off a failure to respond, and they are worth keeping apart: simply missing the date denies this application, while a substantial failure to provide the documentation can also require the employer to run supervised recruitment on its FUTURE filings for up to two years.",
    deadline:
      "30 days from the date on the audit letter. The officer may grant one extension of up to 30 days, at their discretion. Missing it costs more than the application: not responding in time counts as a refusal to exhaust administrative remedies, and the appeal to BALCA is then not available at all.",
    cite: { label: "20 CFR 656.20", section: "656.20" },
  },
  {
    status: "PENDING AUDIT RESPONSE",
    what:
      "An audit letter has gone out and DOL is waiting on the employer's documents.",
    next: "The certifying officer decides once the response arrives.",
    unsourced:
      "The status string is DOL's workflow label. The audit itself is 20 CFR 656.20, above.",
  },
  {
    status: "NORD ISSUED",
    what:
      "A notice about a deficiency DOL found in the recruitment the employer ran before filing.",
    next: "The employer responds and the analyst decides.",
    unsourced:
      "We could not confirm what NORD stands for from any DOL or OFLC publication, so this page does not expand the acronym rather than guess at it. What is measurable is where these cases sit: every one of them was filed inside a single four-month window, which is the signature of a batch review rather than of something that happens continuously.",
  },
  {
    status: "SUPERVISED RECRUITMENT",
    what:
      "DOL takes over the recruitment. The employer drafts an advertisement, the certifying officer approves it and decides where it runs, applicants send their resumes to the officer rather than to the employer, and the employer reports back on each one.",
    next:
      "The officer reviews the recruitment report and decides. A newspaper advertisement has to run three consecutive days, one of them a Sunday.",
    deadline:
      "Two clocks, both 30 days. The draft advertisement goes to the officer within 30 days of being notified, and the recruitment report within 30 days of the officer asking for it. Missing either one is a denial.",
    cite: { label: "20 CFR 656.21", section: "656.21" },
  },
  {
    status: "APPLICATION ON HOLD",
    what: "The application is not moving and no determination has been made.",
    unsourced:
      "DOL publishes no definition of this status. It is worth knowing that almost every case carrying it belongs to a single employer, so it is unlikely to describe a condition that applies broadly.",
  },
  {
    status: "RECONSIDERATION APPEALS",
    what:
      "After a denial, the employer asks the same certifying officer to look again. The request can only carry documents DOL already received, or documents the employer had no earlier chance to submit that existed when the application was filed and were kept on file.",
    next:
      "The officer either reconsiders, or treats the request as a request for review and sends it to the Board. Reconsideration is not available at all where the denial came from disregarding a system prompt or a direct instruction.",
    deadline: "30 days from the date the denial was issued.",
    cite: { label: "20 CFR 656.24(g)", section: "656.24" },
  },
  {
    status: "REQUEST FOR REVIEW",
    what:
      "The step that puts a denial in front of the Board. It goes to the certifying officer who issued the denial rather than to the Board directly, and the officer forwards the file. Reconsideration asks that officer to change their mind; a request for review asks a judge to.",
    deadline:
      "30 days from the date of the determination. It has to identify the determination, set out the grounds, and attach the Final Determination. Letting both this window and the reconsideration window pass counts as a failure to exhaust administrative remedies, and the denial then becomes the final determination of the Secretary, which forecloses a federal court looking at it later.",
    cite: { label: "20 CFR 656.26", section: "656.26" },
  },
  {
    status: "BALCA APPEALS",
    what:
      "The case is before the Board of Alien Labor Certification Appeals, a panel of administrative law judges sitting outside the office that denied it. The Board reviews the record the decision was made on, plus the request for review and any briefs, and everyone gets 30 days to file a statement of position.",
    next:
      "The Board affirms the denial, directs the certifying officer to grant the certification, or orders a hearing. The regulation lists those three and nothing else.",
    cite: { label: "20 CFR 656.27", section: "656.27" },
  },
  {
    status: "ANALYST REVIEW",
    what:
      "The ordinary queue. The case is in line for a human analyst and nothing has been asked of the employer.",
    unsourced:
      "A workflow status rather than a regulatory term. This is where the overwhelming majority of pending cases sit, and DOL publishes which filing month its analysts have reached. There is a second status, IN PROCESS, holding a few dozen cases, and DOL documents no difference between the two.",
  },
];

export function StageGlossary({ auditQueue }: { auditQueue: string | null }) {
  return (
    <div>
      <dl className="grid gap-px border-2 border-border bg-border">
        {ENTRIES.map((e) => {
          const meta = e.status ? stageMeta(e.status) : null;
          const label = e.term ?? meta?.label ?? e.status ?? "";
          return (
            <Fragment key={label}>{" "}
            <div className="bg-card p-4 sm:p-5">
              <dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                {meta ? (
                  <span
                    className="inline-block h-3 w-3 shrink-0 border border-border"
                    style={{ backgroundColor: GROUP_STYLE[meta.group].fill }}
                    aria-hidden="true"
                  />
                ) : null}{" "}
                <h3 className="font-heading text-base font-black">{label}</h3>{" "}
                {e.status ? (
                  <code className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                    {e.status}
                  </code>
                ) : null}
              </dt>{" "}
              <dd className="mt-2 grid gap-2 text-sm leading-relaxed">
                <p>{e.what}</p>{" "}
                {e.deadline ? (
                  <p className="border-l-2 border-[var(--data-warn)] bg-[var(--data-warn)]/10 px-3 py-2">
                    <b className="font-bold">Deadline.</b> {e.deadline}
                  </p>
                ) : null}{" "}
                {e.next ? (
                  <p className="text-muted-foreground">
                    <b className="font-bold text-foreground">What follows.</b>{" "}
                    {e.next}
                  </p>
                ) : null}{" "}
                {/*
                  THE SOURCE LINE IS PART OF THE DEFINITION, NOT A FOOTNOTE. An
                  entry with a regulation behind it and an entry that is DOL
                  workflow language are different kinds of claim, and a reader
                  deciding whether to act on a deadline needs to know which one
                  they are reading.
                */}
                {e.cite ? (
                  <p className="font-mono text-[11px]">
                    <a
                      className="font-bold text-primary underline"
                      href={`${ECFR}${e.cite.section}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {e.cite.label}
                    </a>
                  </p>
                ) : null}{" "}
                {e.unsourced ? (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    <b className="font-bold">No published definition.</b>{" "}
                    {e.unsourced}
                  </p>
                ) : null}
              </dd>
            </div>
            </Fragment>
          );
        })}
      </dl>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        An audit has no status string of its own in the case-status feed, which
        is why it appears here without a live count. DOL does publish an Audit
        Review queue on its processing-times page
        {auditQueue ? (
          <>
            , currently working filings from {monthName(auditQueue)}
          </>
        ) : null}
        , so audits are plainly still being worked even though nothing in the
        data behind this page counts them.
      </p>{" "}
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Deadlines run from the date on the letter, not from the day the status
        changed or the day you read it here. This is a description of a federal
        process and not legal advice.
      </p>
    </div>
  );
}

function monthName(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const names = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  return `${names[Number(m[2]) - 1] ?? ym} ${m[1]}`;
}
