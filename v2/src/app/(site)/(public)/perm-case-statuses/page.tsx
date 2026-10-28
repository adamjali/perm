import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { stageFromSlug } from "@/components/rfi/stageMeta";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import {
  dictionaryAnchors,
  KIND_HEADING,
  LCA_STATUSES,
  SEASONAL_STATUSES,
  permStatusGroups,
  PWD_STATUSES,
  statusAnchor,
  type FlagStatusEntry,
} from "@/lib/statusDictionary";
import { getLcaSummary } from "@/lib/db/lcaCases";
import { getSeasonalSummary } from "@/lib/db/seasonalCases";
import { getLiveCensus, statusTotalFrom } from "@/lib/db/liveCensus";
import { getPwdSummary } from "@/lib/db/pwdCases";
import { getSweepCoverage } from "@/lib/db/sweepCoverage";
import { withSocialCard } from "@/lib/socialCard";
import { formatInt } from "@/lib/format";
import { caseStatusTint, CASE_STATUS_FILL, type CaseStatusTint } from "@/lib/statusTone";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/constants/site";

/**
 * Every status word FLAG can show, with what it means, what the regulation
 * says about it, and how many cases carry it today.
 *
 * One page with an anchor per word, rather than a page per word: the reader
 * arrives with one status and leaves having seen the ones around it, which is
 * what "what happens next" needs. The PERM definitions are the same objects
 * the case page renders, so the two cannot drift. Counts are read from the
 * census doc the sweep writes, never computed on a render.
 */

const TITLE = "PERM Case Status: What Each DOL Status Means";
const DESCRIPTION =
  "What each DOL status means for a PERM, wage request or LCA case, from Analyst Review to Certified, and how to check your own case for free.";
const PATH = "/perm-case-statuses";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-case-statuses" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "perm-case-statuses");

export const revalidate = 21600;

/**
 * A status's live count, as the row's number. The date sits once in the
 * section's opening line, not on every row.
 */
function Count({ n }: { n: number | null }) {
  if (n === null) return null;
  // Plain text: the row is the fold's toggle, and a link inside a toggle is a
  // control inside a control. The stage's list of cases is linked in the entry.
  return (
    <span className="font-heading text-xl font-bold tabular-nums sm:text-2xl">
      {formatInt(n)}
      <span className="sr-only">{n === 1 ? " case" : " cases"}</span>
    </span>
  );
}

/** Each status's colour as a bar: the meaning its soft chip carries, a shade deeper. */
const TINT_BAR: Record<CaseStatusTint, string> = {
  wait: "bg-chart-yellow",
  good: "bg-chart-green",
  withdrawn: "bg-chart-purple",
  bad: "bg-chart-red",
  aside: "bg-chart-blue",
  flat: "bg-chart-sage",
};

/** A bar along the row's foot, in the status's colour: this status against the busiest in its group. */
function ShareBar({ n, max, status }: { n: number | null; max: number; status: string }) {
  if (!n || max <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("absolute bottom-0 left-0 h-1.5", TINT_BAR[caseStatusTint(status)])}
      style={{ width: `${Math.max(1.5, (n / max) * 100)}%` }}
    />
  );
}

/** The status's colour as a small chip before its name, the same soft fill as in the case tables. */
function ToneChip({ status }: { status: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("mt-1 size-3.5 shrink-0 border-2 border-border", CASE_STATUS_FILL[caseStatusTint(status)])}
    />
  );
}

/**
 * A program's banner (round 3, Oct 15 2026: the page read as one long list with
 * nothing between its parts). Ink across the column with the program's name in
 * white, its one-line context under it, and its statuses in one framed list.
 */
function ProgramSection({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-14 scroll-mt-28">
      <div className="dark flex items-center gap-3 border-2 border-black bg-[#141414] px-5 py-4 text-foreground">
        <span aria-hidden="true" className="size-3.5 shrink-0 bg-primary" />
        <h2 id={`${id}-title`} className="font-heading text-2xl font-bold">
          {title}
        </h2>
      </div>{" "}
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">{lede}</p>{" "}
      <div className="mt-4 border-2 border-border bg-card shadow-hard-sm">{children}</div>
    </section>
  );
}

/** Each PERM group's band, coloured by what the group means for a case. */
const KIND_FILL: Record<keyof typeof KIND_HEADING, string> = {
  queue: "bg-soft-wait",
  action: "bg-soft-warn",
  appeal: "bg-soft-bad",
  decided: "bg-soft-good",
};

function Source({ cite, unsourced }: { cite?: { label: string; href: string } | null; unsourced?: string }) {
  return cite ? (
    <p className="mt-3 text-sm text-muted-foreground">
      Source:{" "}
      <a href={cite.href} rel="noopener noreferrer" className="link font-mono">
        {cite.label}
      </a>
    </p>
  ) : (
    <p className="mt-3 text-sm text-muted-foreground">
      <span className="font-bold">No published definition.</span> {unsourced}
    </p>
  );
}

/** The first sentence and the rest; ". " so "656.40" is not a boundary. */
function splitLead(text: string): [string, string] {
  const i = text.indexOf(". ");
  return i < 0 ? [text, ""] : [text.slice(0, i + 1), text.slice(i + 2)];
}

/** The four programs, in page order: the jump nav's doors and its grouped list. */
const PROGRAMS = [
  { id: "program-perm", program: "perm", label: "PERM" },
  { id: "program-wage", program: "pwd", label: "Wage requests" },
  { id: "program-lca", program: "lca", label: "H-1B LCAs" },
  { id: "program-h2", program: "seasonal", label: "H-2A, H-2B and CW-1" },
] as const;

/**
 * ONE ENTRY, COLLAPSED TO ITS FIRST SENTENCE. Uncollapsed, this page is
 * almost all prose and buries the one status a reader came for. The status, its
 * FLAG string, its live count and one sentence stay visible; the rest, the
 * clock and the source open on demand and stay in the DOM for every crawler.
 * The anchor is on the <details> itself: the "Jump to a status" nav and the
 * DefinedTermSet @ids both point at it, and a fragment jump lands on the
 * visible row whether or not the browser auto-expands the body.
 */
function FlagEntry({ e, anchor, n, max }: { e: FlagStatusEntry; anchor: string; n: number | null; max: number }) {
  const [lead, rest] = splitLead(e.summary);
  return (
    <details id={anchor} className="group scroll-mt-28">
      <summary className="relative flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 p-4 transition-colors hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5 [&::-webkit-details-marker]:hidden">
        <ToneChip status={e.status} />{" "}
        <span className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-heading text-base font-bold">{e.label}</span>{" "}
            <code className="text-sm text-muted-foreground">{e.status}</code>
          </h3>{" "}
          <span className="mt-1 block text-sm leading-relaxed text-soft">{lead}</span>
        </span>{" "}
        <Count n={n} />{" "}
        <ShareBar n={n} max={max} status={e.status} />
        <CaretDownIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>{" "}
      <div className="max-w-3xl border-t-2 border-border/40 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {rest ? <p className="text-sm leading-relaxed text-soft">{rest}</p> : null}{" "}
        <Source cite={e.cite} unsourced={e.unsourced} />
      </div>
    </details>
  );
}

export default async function PermCaseStatusesPage() {
  const [census, sweep, pwd, lca, seasonal] = await Promise.all([
    getLiveCensus().catch(() => null),
    getSweepCoverage().catch(() => null),
    getPwdSummary().catch(() => null),
    getLcaSummary().catch(() => null),
    getSeasonalSummary().catch(() => null),
  ]);
  const permAsOf = sweep?.finishedOn ?? census?.asOf ?? null;
  const permCount = (status: string): number | null => (census ? statusTotalFrom(census.matrix, status) : null);
  const flagCount = (s: { byStatus: Record<string, number> } | null, status: string): number | null =>
    s ? (s.byStatus[status] ?? 0) : null;
  const programMax = (s: { byStatus: Record<string, number> } | null, list: readonly { status: string }[]): number =>
    Math.max(0, ...list.map((e) => flagCount(s, e.status) ?? 0));

  const groups = permStatusGroups();
  const anchors = dictionaryAnchors();
  const base = SITE_URL;
  const termSet = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet" as const,
    "@id": `${base}${PATH}`,
    name: "DOL FLAG case status vocabulary",
    description: DESCRIPTION,
    hasDefinedTerm: [
      ...groups.flatMap((g) =>
        g.entries.map((m) => ({
          "@type": "DefinedTerm" as const,
          "@id": `${base}${PATH}#${statusAnchor(m.status)}`,
          name: m.label,
          termCode: m.status,
          description: m.summary,
          inDefinedTermSet: `${base}${PATH}`,
        })),
      ),
      ...PWD_STATUSES.map((e) => ({
        "@type": "DefinedTerm" as const,
        "@id": `${base}${PATH}#pwd-${statusAnchor(e.status)}`,
        name: `${e.label} (prevailing wage request)`,
        termCode: e.status,
        description: e.summary,
        inDefinedTermSet: `${base}${PATH}`,
      })),
      ...LCA_STATUSES.map((e) => ({
        "@type": "DefinedTerm" as const,
        "@id": `${base}${PATH}#lca-${statusAnchor(e.status)}`,
        name: `${e.label} (H-1B LCA)`,
        termCode: e.status,
        description: e.summary,
        inDefinedTermSet: `${base}${PATH}`,
      })),
      ...SEASONAL_STATUSES.map((e) => ({
        "@type": "DefinedTerm" as const,
        "@id": `${base}${PATH}#h2-${statusAnchor(e.status)}`,
        name: `${e.label} (H-2A or H-2B)`,
        termCode: e.status,
        description: e.summary,
        inDefinedTermSet: `${base}${PATH}`,
      })),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={termSet} />
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          Every case status, explained
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          What each status DOL shows on a PERM, wage request, LCA, H-2A or H-2B case means, the rule behind
          it, and how many cases carry it today.
        </p>
      </header>{" "}

      {/* Searches like "perm case status" and "dol case status" land here, and
          most of those people want their own case, so the lookup comes first
          (Search Console, Oct 2026). The same plain GET form as the case page. */}
      <CaseLookupForm className="mt-8 max-w-2xl" source="status-dictionary" />{" "}

      {/* Four doors, one per program, then every status behind one fold: the
          flat list of all of them was the first thing the page showed. */}
      <nav aria-label="Jump to a status" className="mt-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROGRAMS.map((pr) => (
            <li key={pr.id}>
              <a
                href={`#${pr.id}`}
                className="flex min-h-[44px] flex-col gap-0.5 border-2 border-border bg-card px-4 py-3 shadow-hard transition-transform motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                <span className="font-heading font-bold">{pr.label}</span>{" "}
                <span className="font-mono text-sm text-muted-foreground">
                  {anchors.filter((a) => a.program === pr.program).length} statuses
                </span>
              </a>{" "}
            </li>
          ))}
        </ul>{" "}
        <details className="group mt-3 bg-tint">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
            Find one status
            <CaretDownIcon className="h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </summary>{" "}
          <div className="grid gap-6 border-t-2 border-border/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROGRAMS.map((pr) => (
              <div key={pr.id}>
                <p className="text-sm font-bold">{pr.label}</p>{" "}
                <ul className="mt-2 space-y-1.5 text-sm">
                  {anchors
                    .filter((a) => a.program === pr.program)
                    .map((a) => (
                      <li key={a.anchor}>
                        <a href={`#${a.anchor}`} className="link">
                          {a.label}
                        </a>{" "}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </nav>

      <ProgramSection
        id="program-perm"
        title="PERM (ETA-9089)"
        lede={
          <>
            Counts are cases in that status across every filing month
            {permAsOf ? `, as DOL showed them on ${formatAsOf(permAsOf)}` : ""}. A count says how common the state is
            and nothing about how long any one case stays in it.
            {census
              ? ""
              : " The counts are missing today: the daily census they come from couldn't be read or is more than eight days old."}
          </>
        }
      >
        {groups.map((g, gi) => (
          <div key={g.kind} className={gi > 0 ? "border-t-2 border-border" : undefined}>
            <div className={cn("border-b-2 border-border px-4 py-3 sm:px-5", KIND_FILL[g.kind])}>
              <h3 className="font-heading text-lg font-bold">{KIND_HEADING[g.kind].title}</h3>{" "}
              <p className="mt-0.5 max-w-3xl text-sm leading-relaxed text-soft">{KIND_HEADING[g.kind].lede}</p>
            </div>{" "}
            <div className="divide-y divide-border">
              {g.entries.map((m, _i, all) => {
                const groupMax = Math.max(0, ...all.map((x) => permCount(x.status) ?? 0));
                const anchor = statusAnchor(m.status);
                const stagePage = stageFromSlug(anchor) ? `/perm-rfi-audit/${anchor}` : undefined;
                const [lead, rest] = splitLead(m.summary);
                return (
                  <details key={m.status} id={anchor} className="group scroll-mt-28">
                    <summary className="relative flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 p-4 transition-colors hover:bg-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5 [&::-webkit-details-marker]:hidden">
                      <ToneChip status={m.status} />{" "}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="font-heading text-base font-bold">{m.label}</span>{" "}
                          <code className="text-sm text-muted-foreground">{m.status}</code>
                        </span>{" "}
                        <span className="mt-1 block text-sm leading-relaxed text-soft">{lead}</span>
                      </span>{" "}
                      <Count n={permCount(m.status)} />{" "}
                      <ShareBar n={permCount(m.status)} max={groupMax} status={m.status} />
                      <CaretDownIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                    </summary>{" "}
                    <div className="max-w-3xl border-t-2 border-border/40 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                      {rest ? <p className="text-sm leading-relaxed text-soft">{rest}</p> : null}{" "}
                      {stagePage && permCount(m.status) ? (
                        <p className="mt-2 text-sm">
                          <Link href={stagePage} className="link">
                            List the cases at this stage
                          </Link>
                        </p>
                      ) : null}{" "}
                      {m.deadline ? (
                        <p className="mt-2 text-sm leading-relaxed">
                          <b className="font-bold">The clock:</b> {m.deadline}
                        </p>
                      ) : null}{" "}
                      {m.action ? (
                        <p className="mt-2 text-sm leading-relaxed text-soft">
                          <b className="font-bold text-foreground">Who acts:</b> {m.action}
                        </p>
                      ) : null}{" "}
                      <Source cite={m.cite} unsourced="DOL's FLAG workflow uses the word and no section of 20 CFR 656 defines it." />
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        ))}
      </ProgramSection>

      <ProgramSection
        id="program-wage"
        title="Prevailing wage requests (ETA-9141)"
        lede={
          <>
            The wage request comes before the PERM and has its own review chain under 20 CFR 656.41.
            {pwd?.asOf
              ? ` Counts are from DOL's live index as of ${formatAsOf(pwd.asOf)}.`
              : " The counts are missing today: their summary couldn't be read."}
          </>
        }
      >
        <div className="divide-y divide-border">
          {PWD_STATUSES.map((e) => (
            <FlagEntry key={e.status} e={e} anchor={`pwd-${statusAnchor(e.status)}`} n={flagCount(pwd, e.status)} max={programMax(pwd, PWD_STATUSES)} />
          ))}
        </div>
      </ProgramSection>

      <ProgramSection
        id="program-lca"
        title="H-1B labor condition applications (ETA-9035)"
        lede={
          <>
            An LCA is certified or returned within seven working days, so the live index holds almost nothing
            pending.
            {lca?.asOf
              ? ` Counts are from DOL's live index as of ${formatAsOf(lca.asOf)}.`
              : " The counts are missing today: their summary couldn't be read."}
          </>
        }
      >
        <div className="divide-y divide-border">
          {LCA_STATUSES.map((e) => (
            <FlagEntry key={e.status} e={e} anchor={`lca-${statusAnchor(e.status)}`} n={flagCount(lca, e.status)} max={programMax(lca, LCA_STATUSES)} />
          ))}
        </div>
      </ProgramSection>

      <ProgramSection
        id="program-h2"
        title="H-2A and H-2B (ETA-9142A, ETA-9142B and their wage requests)"
        lede={
          <>
            Temporary farm and non-farm work, under 20 CFR part 655. Each entry says which of the three forms it
            appears on.
            {seasonal?.asOf
              ? ` Counts are from DOL's live index as of ${formatAsOf(seasonal.asOf)}.`
              : " The counts are missing today: their summary couldn't be read."}
          </>
        }
      >
        <div className="divide-y divide-border">
          {SEASONAL_STATUSES.map((e) => (
            <FlagEntry
              key={e.status}
              e={{ ...e, summary: `${e.summary} On: ${e.forms}.` }}
              anchor={`h2-${statusAnchor(e.status)}`}
              n={flagCount(seasonal, e.status)}
              max={programMax(seasonal, SEASONAL_STATUSES)}
            />
          ))}
        </div>
      </ProgramSection>

      <section className="mt-14 max-w-3xl">
        <h2 className="font-heading text-2xl font-bold">Where these words come from</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-soft">
          DOL&apos;s case-status search shows one status per case and never explains it. The regulations (20 CFR
          part 656 for PERM and wage requests, part 655 for LCAs, H-2A and H-2B) define the steps with a deadline;
          the rest are workflow words, described here by what the workflow shows.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-soft">
          <Link href="/perm-case-status" className="link">
            Look up a case number
          </Link>{" "}
          to see its status, or see every case at one review stage on{" "}
          <Link href="/perm-rfi-audit" className="link">
            the RFI and audit page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
