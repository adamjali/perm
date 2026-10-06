import type { Metadata } from "next";
import Link from "next/link";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { stageFromSlug } from "@/components/rfi/stageMeta";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { KIND_LABEL } from "@/lib/permStatus";
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
import { getLcaSummary } from "@/lib/turso/lcaCases";
import { getSeasonalSummary } from "@/lib/turso/seasonalCases";
import { getLiveCensus, statusTotalFrom } from "@/lib/turso/liveCensus";
import { getPwdSummary } from "@/lib/turso/pwdCases";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";
import { withSocialCard } from "@/lib/socialCard";
import { formatInt } from "@/lib/format";
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

function Count({ n, asOf, href }: { n: number | null; asOf: string | null; href?: string }) {
  if (n === null) return null;
  const shown = asOf ? formatAsOf(asOf) : null;
  const text = `${formatInt(n)} now${shown ? `, as of ${shown}` : ""}`;
  const cls = "font-mono text-sm font-semibold";
  return href ? (
    <Link href={href} className={`${cls} underline decoration-primary decoration-2 underline-offset-2 hover:text-primary`}>
      {text}
    </Link>
  ) : (
    <span className={`${cls} text-foreground/70`}>{text}</span>
  );
}

function Source({ cite, unsourced }: { cite?: { label: string; href: string } | null; unsourced?: string }) {
  return cite ? (
    <p className="mt-3 text-sm text-muted-foreground">
      Source:{" "}
      <a href={cite.href} rel="noopener noreferrer" className="font-mono font-bold underline underline-offset-2 hover:text-primary">
        {cite.label}
      </a>
    </p>
  ) : (
    <p className="mt-3 text-sm text-muted-foreground">
      <span className="font-mono font-bold">No published definition.</span> {unsourced}
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
function FlagEntry({ e, anchor, n, asOf }: { e: FlagStatusEntry; anchor: string; n: number | null; asOf: string | null }) {
  const [lead, rest] = splitLead(e.summary);
  return (
    <details id={anchor} className="group scroll-mt-28 bg-card">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-heading text-base font-black">{e.label}</span>{" "}
            <code className="font-mono text-sm uppercase tracking-wide text-muted-foreground">{e.status}</code>{" "}
            <Count n={n} asOf={asOf} />
          </h3>{" "}
          <span className="mt-1 block text-sm leading-relaxed text-foreground/80">{lead}</span>
        </span>{" "}
        <CaretDownIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>{" "}
      <div className="max-w-3xl border-t-2 border-border/40 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {rest ? <p className="text-sm leading-relaxed text-foreground/80">{rest}</p> : null}{" "}
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
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          Every case status, explained
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          What each status DOL shows on a PERM, wage request, LCA, H-2A or H-2B case means, the rule behind
          it, and how many cases carry it today.
        </p>
      </header>{" "}

      {/* Searches like "perm case status" and "dol case status" land here, and
          most of those people want their own case, so the lookup comes first
          (Search Console, Oct 2026). The same plain GET form as the case page. */}
      <CaseLookupForm className="mt-8 max-w-2xl" />{" "}

      {/* Four doors, one per program, then every status behind one fold: the
          flat list of all of them was the first thing the page showed. */}
      <nav aria-label="Jump to a status" className="mt-8">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROGRAMS.map((pr) => (
            <li key={pr.id}>
              <a
                href={`#${pr.id}`}
                className="flex min-h-[44px] items-baseline justify-between gap-3 border-2 border-border bg-card px-4 py-3 shadow-hard transition-transform hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                <span className="font-heading font-black">{pr.label}</span>{" "}
                <span className="font-mono text-sm text-muted-foreground">
                  {anchors.filter((a) => a.program === pr.program).length} statuses
                </span>
              </a>{" "}
            </li>
          ))}
        </ul>{" "}
        <details className="group mt-3 border-2 border-border bg-card">
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
                        <a href={`#${a.anchor}`} className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
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

      <section id="program-perm" className="mt-12 scroll-mt-28">
        <h2 className="font-heading text-2xl font-black">PERM (ETA-9089)</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          Counts are cases in that status across every filing month
          {permAsOf ? `, as DOL showed them on ${formatAsOf(permAsOf)}` : ""}. A count says how common
          the state is and nothing about how long any one case stays in it.
          {census
            ? ""
            : " The counts are missing today: the daily census they come from couldn't be read or is more than eight days old."}
        </p>
        {groups.map((g) => (
          <div key={g.kind} className="mt-8">
            <h3 className="font-heading text-xl font-black">{KIND_HEADING[g.kind].title}</h3>{" "}
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground/70">{KIND_HEADING[g.kind].lede}</p>{" "}
            <div className="mt-4 grid gap-px border-2 border-border bg-border">
              {g.entries.map((m) => {
                const anchor = statusAnchor(m.status);
                const stagePage = stageFromSlug(anchor) ? `/perm-rfi-audit/${anchor}` : undefined;
                const [lead, rest] = splitLead(m.summary);
                return (
                  <details key={m.status} id={anchor} className="group scroll-mt-28 bg-card">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 p-4 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-5 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <span className="font-heading text-base font-black">{m.label}</span>{" "}
                          <code className="font-mono text-sm uppercase tracking-wide text-muted-foreground">{m.status}</code>{" "}
                          <span className="font-mono text-sm text-foreground/60">{KIND_LABEL[m.kind]}</span>{" "}
                          <Count n={permCount(m.status)} asOf={permAsOf} href={stagePage} />
                        </span>{" "}
                        <span className="mt-1 block text-sm leading-relaxed text-foreground/80">{lead}</span>
                      </span>{" "}
                      <CaretDownIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
                    </summary>{" "}
                    <div className="max-w-3xl border-t-2 border-border/40 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                      {rest ? <p className="text-sm leading-relaxed text-foreground/80">{rest}</p> : null}{" "}
                      {m.deadline ? (
                        <p className="mt-2 text-sm leading-relaxed">
                          <b className="font-bold">The clock:</b> {m.deadline}
                        </p>
                      ) : null}{" "}
                      {m.action ? (
                        <p className="mt-2 text-sm leading-relaxed text-foreground/80">
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
      </section>

      <section id="program-wage" className="mt-12 scroll-mt-28">
        <h2 className="font-heading text-2xl font-black">Prevailing wage requests (ETA-9141)</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          The wage request comes before the PERM and has its own review chain under 20 CFR 656.41.
          {pwd?.asOf
            ? ` Counts are from DOL's live index as of ${formatAsOf(pwd.asOf)}.`
            : " The counts are missing today: their summary couldn't be read."}
        </p>{" "}
        <div className="mt-4 grid gap-px border-2 border-border bg-border">
          {PWD_STATUSES.map((e) => (
            <FlagEntry key={e.status} e={e} anchor={`pwd-${statusAnchor(e.status)}`} n={flagCount(pwd, e.status)} asOf={pwd?.asOf ?? null} />
          ))}
        </div>
      </section>

      <section id="program-lca" className="mt-12 scroll-mt-28">
        <h2 className="font-heading text-2xl font-black">H-1B labor condition applications (ETA-9035)</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          An LCA is certified or returned within seven working days, so the live index holds almost nothing pending.
          {lca?.asOf
            ? ` Counts are from DOL's live index as of ${formatAsOf(lca.asOf)}.`
            : " The counts are missing today: their summary couldn't be read."}
        </p>{" "}
        <div className="mt-4 grid gap-px border-2 border-border bg-border">
          {LCA_STATUSES.map((e) => (
            <FlagEntry key={e.status} e={e} anchor={`lca-${statusAnchor(e.status)}`} n={flagCount(lca, e.status)} asOf={lca?.asOf ?? null} />
          ))}
        </div>
      </section>

      <section id="program-h2" className="mt-12 scroll-mt-28">
        <h2 className="font-heading text-2xl font-black">H-2A and H-2B (ETA-9142A, ETA-9142B and their wage requests)</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          Temporary farm and non-farm work, under 20 CFR part 655. Each entry says which of the three forms it
          appears on.
          {seasonal?.asOf
            ? ` Counts are from DOL's live index as of ${formatAsOf(seasonal.asOf)}.`
            : " The counts are missing today: their summary couldn't be read."}
        </p>{" "}
        <div className="mt-4 grid gap-px border-2 border-border bg-border">
          {SEASONAL_STATUSES.map((e) => (
            <FlagEntry
              key={e.status}
              e={{ ...e, summary: `${e.summary} On: ${e.forms}.` }}
              anchor={`h2-${statusAnchor(e.status)}`}
              n={flagCount(seasonal, e.status)}
              asOf={seasonal?.asOf ?? null}
            />
          ))}
        </div>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">Where these words come from</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          DOL&apos;s case-status search shows one status per case and never explains it. The regulations (20 CFR
          part 656 for PERM and wage requests, part 655 for LCAs, H-2A and H-2B) define the steps with a deadline;
          the rest are workflow words, described here by what the workflow shows.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            Look up a case number
          </Link>{" "}
          to see its status, or see every case at one review stage on{" "}
          <Link href="/perm-rfi-audit" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the RFI and audit page
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
