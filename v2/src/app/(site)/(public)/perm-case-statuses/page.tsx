import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { stageFromSlug } from "@/components/rfi/stageMeta";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { KIND_LABEL } from "@/lib/permStatus";
import {
  dictionaryAnchors,
  KIND_HEADING,
  LCA_STATUSES,
  permStatusGroups,
  PWD_STATUSES,
  statusAnchor,
  type FlagStatusEntry,
} from "@/lib/statusDictionary";
import { getLcaSummary } from "@/lib/turso/lcaCases";
import { getLiveCensus, statusTotalFrom } from "@/lib/turso/liveCensus";
import { getPwdSummary } from "@/lib/turso/pwdCases";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";

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

const TITLE = "PERM Case Status Meanings: Every DOL Status Explained";
const DESCRIPTION =
  "What each FLAG case status means for a PERM, a prevailing wage request or an H-1B LCA: analyst review, RFI issued, on hold, appeals, certified and expired, with the regulation and today's count.";
const PATH = "/perm-case-statuses";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-case-statuses" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
};

export const revalidate = 21600;

const int = (n: number) => n.toLocaleString("en-US");

function Count({ n, asOf, href }: { n: number | null; asOf: string | null; href?: string }) {
  if (n === null) return null;
  const shown = asOf ? formatAsOf(asOf) : null;
  const text = `${int(n)} now${shown ? `, as of ${shown}` : ""}`;
  const cls = "font-mono text-[11px] font-semibold";
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
    <p className="mt-3 text-xs text-muted-foreground">
      Source:{" "}
      <a href={cite.href} rel="noopener noreferrer" className="font-mono font-bold underline underline-offset-2 hover:text-primary">
        {cite.label}
      </a>
    </p>
  ) : (
    <p className="mt-3 text-xs text-muted-foreground">
      <span className="font-mono font-bold">No published definition.</span> {unsourced}
    </p>
  );
}

function FlagEntry({ e, anchor, n, asOf }: { e: FlagStatusEntry; anchor: string; n: number | null; asOf: string | null }) {
  return (
    <article id={anchor} className="scroll-mt-28 bg-card p-4 sm:p-5">
      <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-heading text-base font-black">{e.label}</span>{" "}
        <code className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{e.status}</code>{" "}
        <Count n={n} asOf={asOf} />
      </h3>{" "}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/80">{e.summary}</p>{" "}
      <Source cite={e.cite} unsourced={e.unsourced} />
    </article>
  );
}

export default async function PermCaseStatusesPage() {
  const [census, sweep, pwd, lca] = await Promise.all([
    getLiveCensus().catch(() => null),
    getSweepCoverage().catch(() => null),
    getPwdSummary().catch(() => null),
    getLcaSummary().catch(() => null),
  ]);
  const permAsOf = sweep?.finishedOn ?? census?.asOf ?? null;
  const permCount = (status: string): number | null => (census ? statusTotalFrom(census.matrix, status) : null);
  const flagCount = (s: { byStatus: Record<string, number> } | null, status: string): number | null =>
    s ? (s.byStatus[status] ?? 0) : null;

  const groups = permStatusGroups();
  const anchors = dictionaryAnchors();
  const base = "https://permtracker.app";
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
    ],
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={termSet} />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/perm-case-status" className="underline underline-offset-2 hover:text-primary">
            Case status
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Every case status, explained
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          The words DOL&apos;s FLAG system puts on a PERM, a prevailing wage
          request or an H-1B LCA, what each one means, which regulation says
          so, and how many cases carry it today. Where DOL publishes no
          definition, the entry says that instead of guessing.
        </p>
      </header>

      <nav aria-label="Jump to a status" className="mt-8 border-2 border-border bg-card p-4 shadow-hard sm:p-5">
        <p className="text-sm font-bold">Jump to a status</p>{" "}
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {anchors.map((a) => (
            <li key={a.anchor}>
              <a href={`#${a.anchor}`} className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                {a.program === "perm" ? "" : a.program === "pwd" ? "Wage request: " : "LCA: "}
                {a.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">PERM (ETA-9089)</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          Counts are cases in that status across every filing month
          {permAsOf ? `, as DOL showed them on ${formatAsOf(permAsOf)}` : ""}. A count says how common
          the state is and nothing about how long any one case stays in it.
        </p>
        {groups.map((g) => (
          <div key={g.kind} className="mt-8">
            <h3 className="font-heading text-xl font-black">{KIND_HEADING[g.kind].title}</h3>{" "}
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground/70">{KIND_HEADING[g.kind].lede}</p>{" "}
            <dl className="mt-4 grid gap-px border-2 border-border bg-border">
              {g.entries.map((m) => {
                const anchor = statusAnchor(m.status);
                const stagePage = stageFromSlug(anchor) ? `/perm-rfi-audit/${anchor}` : undefined;
                return (
                  <div key={m.status} id={anchor} className="scroll-mt-28 bg-card p-4 sm:p-5">
                    <dt className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="font-heading text-base font-black">{m.label}</span>{" "}
                      <code className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{m.status}</code>{" "}
                      <span className="font-mono text-[11px] text-foreground/60">{KIND_LABEL[m.kind]}</span>{" "}
                      <Count n={permCount(m.status)} asOf={permAsOf} href={stagePage} />
                    </dt>{" "}
                    <dd className="mt-2 max-w-3xl">
                      <p className="text-sm leading-relaxed text-foreground/80">{m.summary}</p>{" "}
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
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Prevailing wage requests (ETA-9141)</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          The wage request comes before the PERM and has its own review chain under 20 CFR 656.41.
          {pwd?.asOf ? ` Counts are from DOL's live index as of ${formatAsOf(pwd.asOf)}.` : ""}
        </p>{" "}
        <div className="mt-4 grid gap-px border-2 border-border bg-border">
          {PWD_STATUSES.map((e) => (
            <FlagEntry key={e.status} e={e} anchor={`pwd-${statusAnchor(e.status)}`} n={flagCount(pwd, e.status)} asOf={pwd?.asOf ?? null} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">H-1B labor condition applications (ETA-9035)</h2>{" "}
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
          An LCA is certified or returned within seven working days, so the live index holds almost nothing pending.
          {lca?.asOf ? ` Counts are from DOL's live index as of ${formatAsOf(lca.asOf)}.` : ""}
        </p>{" "}
        <div className="mt-4 grid gap-px border-2 border-border bg-border">
          {LCA_STATUSES.map((e) => (
            <FlagEntry key={e.status} e={e} anchor={`lca-${statusAnchor(e.status)}`} n={flagCount(lca, e.status)} asOf={lca?.asOf ?? null} />
          ))}
        </div>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">Where these words come from</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          DOL&apos;s FLAG case-status search returns one status string per case and never explains it. The
          regulation, 20 CFR part 656 for PERM and wage requests and part 655 for LCAs, defines the steps
          that carry a deadline: the audit response, reconsideration, BALCA review, the 180-day life of a
          certification. The rest are workflow words, and the honest entry for one of those is what the
          workflow shows rather than a definition DOL never wrote.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          To see the status on a specific case,{" "}
          <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            look the number up
          </Link>
          ; the answer links back to the entry here. To see every case at one review stage,{" "}
          <Link href="/perm-rfi-audit" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the RFI and audit page
          </Link>{" "}
          lists them.
        </p>
      </section>
    </div>
  );
}
