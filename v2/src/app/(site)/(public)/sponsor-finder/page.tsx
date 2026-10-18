import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { shortDate } from "@convex/lib/months";
import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { buttonVariants } from "@/components/ui/button";
import { caseSearchHref } from "@/lib/caseSearchPlan";
import { ROW_LINK } from "@/components/entities/caseRows";
import { findSponsors, resolveJob, type FinderRow, type JobPick } from "@/lib/db/sponsorFinder";
import { MIN_DECIDED_FOR_MEDIAN, MIN_DECIDED_FOR_RATE } from "@/lib/entityPayload";
import { formatApprovalRate, formatDollars, formatInt } from "@/lib/format";
import { SECTOR_GROUPS } from "@/lib/naicsSectors";
import { openGraphBase } from "@/lib/openGraphBase";
import { isScheduleA } from "@/lib/socCode";
import { withSocialCard } from "@/lib/socialCard";
import {
  ANY,
  MONTH_STEPS,
  PAGE_SIZE,
  PATH,
  RATE_STEPS,
  RECENT_STEPS,
  SENIOR_SHARE,
  SORTS,
  TRANSFER_SHARE,
  WAGE_STEPS,
  ANSWER_ID,
  finderHref,
  parseFinder,
  type FinderFilters,
} from "@/lib/sponsorFinder";
import { US_STATE_NAMES, stateName } from "@/lib/usStateNames";

/**
 * Find a green card sponsor by job, place and what its record shows: the
 * job's own filings, approval rate, offered wage and typical time to a
 * decision; the employer's recent filing, cases waiting with DOL now and its
 * H-1B record. One GET form, so every search has an address. Reads
 * `sponsor_jobs` and `sponsor_index` (scripts/build_sponsor_index.py, nightly).
 *
 * It finds employers whose record matches; it doesn't say any of them will
 * sponsor a given person, and the page says so above the results.
 */

const TITLE = "Green Card Sponsor Finder";
const DESCRIPTION =
  "Find employers that file PERM green card cases for your job, by state, approval rate, offered wage and time to a decision, from DOL's own records.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "sponsor-finder");

const STATES = new Set(Object.keys(US_STATE_NAMES));
const FIELD =
  "min-h-[44px] w-full border-2 border-input bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary";
const NONE = "—";

interface Column {
  label: string;
  numeric?: boolean;
  cell: (r: FinderRow) => ReactNode;
}

/** The table, one definition per column, left to right after the employer. */
const COLUMNS: Column[] = [
  { label: "State", cell: (r) => r.state ?? NONE },
  { label: "Filings", numeric: true, cell: (r) => formatInt(r.filed) },
  {
    label: "Approved",
    numeric: true,
    cell: (r) =>
      r.rate !== null
        ? `${formatApprovalRate(r.rate)} of ${formatInt(r.decided)}`
        : r.decided > 0
          ? "too few to rate"
          : NONE,
  },
  { label: "Median offered wage", numeric: true, cell: (r) => (r.medianWage === null ? NONE : formatDollars(r.medianWage)) },
  { label: "Typical decision", numeric: true, cell: (r) => (r.medianDays === null ? NONE : `${formatInt(r.medianDays)} days`) },
  { label: "Waiting with DOL now", numeric: true, cell: (r) => formatInt(r.waiting) },
  { label: "H-1B LCAs, 24 months", numeric: true, cell: (r) => formatInt(r.lca24m) },
];

/** The lines under an employer's name: what it is, and anything a reader should know first. */
function employerNotes(r: FinderRow): string[] {
  const notes: string[] = [];
  if (r.sector) notes.push(r.sector);
  if (r.liveOnly) notes.push("New: no case decided yet");
  const newest = shortDate(r.latestFiled);
  if (newest) notes.push(`Newest filing ${newest}`);
  if (r.capExempt) notes.push("Likely cap-exempt");
  return notes;
}

/** The employer's name, what it is, and a link to its filings for the chosen job: the table cell and the phone card alike. */
function EmployerCell({ r, jobSlug }: { r: FinderRow; jobSlug: string | null }) {
  return (
    <>
      <Link href={`/perm-employers/${r.slug}`} className={ROW_LINK}>
        {r.name}
      </Link>{" "}
      {employerNotes(r).map((n) => (
        <span key={n} className="block text-muted-foreground">
          {n}{" "}
        </span>
      ))}
      {jobSlug ? (
        <Link href={caseSearchHref({ q: r.name, occupation: jobSlug })} className={`${ROW_LINK} flex`}>
          Its filings for this job{" "}
        </Link>
      ) : null}
      {r.debarred ? <span className="block font-bold text-data-bad-ink">Debarred </span> : null}
    </>
  );
}

function Choices({ f, list }: { f: FinderFilters; list: { slug: string; name: string }[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {list.map((s) => (
        <Link
          key={s.slug}
          href={finderHref({ ...f, job: s.slug }, 1)}
          className="link inline-flex min-h-[44px] items-center border-2 border-border px-3"
        >
          {s.name}{" "}
        </Link>
      ))}
    </span>
  );
}

/** Why a Schedule A job's list is short: its cases skip DOL (20 CFR 656.15(a)). */
function ScheduleANote() {
  return (
    <p className="mt-3 border-l-4 border-data-warn pl-4">
      This is a{" "}
      <Link href="/glossary#schedule-a" className="link">
        Schedule A
      </Link>{" "}
      job: employers file it with USCIS, not with DOL, so DOL&rsquo;s PERM files hold only a few of these cases
      and the list here is short.{" "}
      <Link href="/guides/green-card-sponsors-for-your-job" className="link">
        How to find these sponsors
      </Link>
    </p>
  );
}

function JobLine({ pick, f }: { pick: JobPick; f: FinderFilters }) {
  if (pick.kind === "any") return null;
  if (pick.kind === "unknown") {
    return (
      <p className="mt-6 max-w-3xl border-l-4 border-data-warn pl-4 text-base">
        No job matches &ldquo;{pick.text}&rdquo;. Try its usual title, such as software developers or accountants.
      </p>
    );
  }
  return (
    <div className="mt-6 max-w-3xl text-base">
      <p>
        Sponsors for <strong>{pick.title}</strong> <span className="whitespace-nowrap text-muted-foreground">(SOC {pick.soc})</span>
        {f.state ? ` in ${stateName(f.state)}` : ""}.
      </p>{" "}
      {isScheduleA(pick.soc) ? <ScheduleANote /> : null}
      {pick.others.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Not this job?</span>{" "}
          <Choices f={f} list={pick.others} />
        </div>
      ) : null}
    </div>
  );
}

export default async function SponsorFinderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const asked = parseFinder(await searchParams, STATES);
  const pick = await resolveJob(asked.job);
  // The address names the job by its page slug once it's found, whatever was typed.
  const f: FinderFilters = { ...asked, job: pick.kind === "job" ? pick.slug : asked.job };
  const found = pick.kind === "unknown" ? null : await findSponsors(f, pick.kind === "job" ? pick.soc : ANY);
  const pages = found ? Math.max(1, Math.ceil(found.total / PAGE_SIZE)) : 1;
  const narrowed = pick.kind === "job" || f.state !== null;
  const jobSlug = pick.kind === "job" ? pick.slug : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Find a green card sponsor</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Employers that file PERM cases for your job, where you want to work, and what DOL&apos;s records show about
          each. Every name links to its full record.
        </p>
      </header>

      <form method="get" action={`${PATH}#${ANSWER_ID}`} className="mt-8 object p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <label className="block text-sm font-bold">
            Job
            <input
              type="search"
              name="job"
              defaultValue={pick.kind === "job" ? pick.title : asked.job}
              placeholder="Software developers, registered nurses..."
              autoComplete="off"
              className={`mt-1 ${FIELD}`}
            />
          </label>{" "}
          <label className="block text-sm font-bold">
            State
            <select name="state" defaultValue={f.state ?? ""} className={`mt-1 ${FIELD}`}>
              <option value="">Any state</option>
              {Object.entries(US_STATE_NAMES)
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
            </select>
          </label>
        </div>{" "}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          <label className="block text-sm font-bold">
            Industry
            <select name="sector" defaultValue={f.sector ?? ""} className={`mt-1 ${FIELD}`}>
              <option value="">Any industry</option>
              {SECTOR_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>{" "}
          <label className="block text-sm font-bold">
            PERM filings in the last 12 months
            <select name="recent" defaultValue={String(f.minRecent)} className={`mt-1 ${FIELD}`}>
              {RECENT_STEPS.map((n) => (
                <option key={n} value={n}>
                  {`At least ${formatInt(n)}`}
                </option>
              ))}
            </select>
          </label>{" "}
          <label className="block text-sm font-bold">
            Approval rate
            <select name="rate" defaultValue={f.minRate === null ? "" : String(f.minRate)} className={`mt-1 ${FIELD}`}>
              <option value="">Any</option>
              {RATE_STEPS.map((r) => (
                <option key={r} value={r}>
                  {`${formatApprovalRate(r)} or higher`}
                </option>
              ))}
            </select>
          </label>{" "}
          <label className="block text-sm font-bold">
            Median offered wage
            <select name="wage" defaultValue={f.minWage === null ? "" : String(f.minWage)} className={`mt-1 ${FIELD}`}>
              <option value="">Any</option>
              {WAGE_STEPS.map((w) => (
                <option key={w} value={w}>
                  {`At least ${formatDollars(w)}`}
                </option>
              ))}
            </select>
          </label>{" "}
          <label className="block text-sm font-bold">
            Typical decision
            <select name="within" defaultValue={f.withinMonths === null ? "" : String(f.withinMonths)} className={`mt-1 ${FIELD}`}>
              <option value="">Any</option>
              {MONTH_STEPS.map((m) => (
                <option key={m} value={m}>
                  {`Within ${m} months`}
                </option>
              ))}
            </select>
          </label>{" "}
          <label className="block text-sm font-bold">
            Sort by
            <select name="sort" defaultValue={f.sort} className={`mt-1 ${FIELD}`}>
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>{" "}
        <fieldset className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-base">
          <legend className="sr-only">More filters</legend>
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="waiting" value="1" defaultChecked={f.waitingNow} className="size-5 shrink-0" />
            Has cases waiting with DOL now
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="transfers" value="1" defaultChecked={f.transfers} className="size-5 shrink-0" />
            Hires H-1B transfers ({Math.round(TRANSFER_SHARE * 100)}% or more of positions)
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="senior" value="1" defaultChecked={f.senior} className="size-5 shrink-0" />
            Mostly senior roles (wage level III or IV)
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="cap" value="1" defaultChecked={f.capExempt} className="size-5 shrink-0" />
            Likely cap-exempt
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="debarred" value="1" defaultChecked={f.includeDebarred} className="size-5 shrink-0" />
            Include debarred employers
          </label>
        </fieldset>{" "}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonVariants()}>
            Find sponsors
          </button>{" "}
          <Link href={PATH} className="link min-h-[44px] content-center text-sm">
            Clear
          </Link>
        </div>
      </form>

      <div id={ANSWER_ID}>
        <JobLine pick={pick} f={f} />{" "}

        <p className="mt-6 max-w-3xl border-l-4 border-primary pl-4 text-base text-soft">
          These employers filed PERM cases. Whether one will sponsor you depends on the job and on them; DOL&apos;s
          records can&apos;t say. Debarred employers are left out unless you ask for them.
        </p>

        {pick.kind === "unknown" ? null : found === null ? (
          <p className="mt-8 bg-sage p-5 text-base border-2 border-border">
            The sponsor index is being built. Try again in a few minutes.
          </p>
        ) : (
          <section className="mt-8" aria-labelledby="results">
            <h2 id="results" className="font-heading text-2xl font-bold">
              {found.total === 0
                ? "No sponsor matches every filter"
                : `${formatInt(found.total)} ${found.total === 1 ? "sponsor matches" : "sponsors match"}`}
            </h2>{" "}
            {found.total === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">
                {pick.kind === "job" && isScheduleA(pick.soc)
                  ? "For this job that's expected: see the note above."
                  : "Drop a filter or two and search again."}
              </p>
            ) : (
              <>
                <p className="mt-2 max-w-3xl text-base text-muted-foreground">
                  {narrowed
                    ? "Filings, approval, wage and typical decision are for this job and place, from DOL's published files. Waiting now and the newest filing are the whole employer, from DOL's live record."
                    : "Waiting now and the newest filing come from DOL's live record; the rest from DOL's published files. Employers with no case decided yet are included."}
                </p>{" "}
                {/* A phone gets a card per sponsor, every figure labelled, from the same columns. */}
                <ul className="mt-4 divide-y divide-border border-y border-border sm:hidden">
                  {found.rows.map((r) => (
                    <li key={r.slug} className="py-3 text-base">
                      <EmployerCell r={r} jobSlug={jobSlug} />{" "}
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm [&>*]:min-w-0">
                        {COLUMNS.map((c) => (
                          <Fragment key={c.label}>
                            <dt className="text-muted-foreground">{c.label}</dt>{" "}
                            <dd className="text-right tabular-nums">{c.cell(r)}</dd>{" "}
                          </Fragment>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>{" "}
                <div className="mt-4 hidden overflow-x-auto border-t-2 border-[var(--object-border)] sm:block">
                  <table className="w-full min-w-[960px] border-collapse text-sm">
                    <caption className="sr-only">Sponsors matching the filters</caption>
                    <thead>
                      <tr className="border-b-2 border-border bg-sage text-left">
                        <th scope="col" className="p-2 font-bold">Employer </th>
                        {COLUMNS.map((c) => (
                          <th key={c.label} scope="col" className={`p-2 font-bold ${c.numeric ? "text-right" : ""}`}>
                            {c.label}{" "}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {found.rows.map((r) => (
                        <tr key={r.slug} className="border-b border-border/50 align-top">
                          <th scope="row" className="p-2 text-left font-normal">
                            <EmployerCell r={r} jobSlug={jobSlug} />
                          </th>
                          {COLUMNS.map((c) => (
                            <td key={c.label} className={`p-2 ${c.numeric ? "whitespace-nowrap text-right tabular-nums" : ""}`}>
                              {c.cell(r)}{" "}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>{" "}
                {pages > 1 ? (
                  <nav aria-label="Result pages" className="mt-4 flex flex-wrap items-center gap-4 text-base">
                    {f.page > 1 ? (
                      <Link href={finderHref(f, f.page - 1)} className={ROW_LINK}>
                        Previous {PAGE_SIZE}
                      </Link>
                    ) : null}{" "}
                    <span className="text-muted-foreground">
                      Page {formatInt(f.page)} of {formatInt(pages)}
                    </span>{" "}
                    {f.page < pages ? (
                      <Link href={finderHref(f, f.page + 1)} className={ROW_LINK}>
                        Next {PAGE_SIZE}
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </>
            )}
          </section>
        )}
      </div>

      <FinePrint summary="How these are counted" className="mt-8">
        <p>
          A job is its SOC occupation as DOL&apos;s files code it, both the dotted and plain spellings. Filings, the
          approval rate, the median offered wage and the typical decision are from DOL&apos;s published PERM files for
          that job and state (every outcome counted, as on each employer&apos;s page). A rate shows over{" "}
          {MIN_DECIDED_FOR_RATE} or more decided cases and a median over {MIN_DECIDED_FOR_MEDIAN} or more, the employer
          pages&apos; own bars. Filings in the last 12 months and cases waiting now include DOL&apos;s live record, which
          names no job or worksite, so they count every job. H-1B LCAs come from DOL&apos;s LCA files, read under every
          spelling of the employer&apos;s name. &quot;Transfers&quot; is the share of certified H-1B positions that were a
          change of employer, and &quot;senior&quot; the share of LCAs at wage level III or IV (
          {Math.round(SENIOR_SHARE * 100)}% or more), each over the most recent 24 months of LCAs this site holds that
          detail for. &quot;Likely cap-exempt&quot; is an inference from the industry code a college or university files
          under; USCIS decides who&apos;s exempt. With every state chosen, State is the one most of an employer&apos;s
          cases name.
        </p>
      </FinePrint>{" "}
      <DataProvenance datasets={["perm-cases", "perm-case-status", "entities", "lca-disclosure"]} />
    </div>
  );
}
