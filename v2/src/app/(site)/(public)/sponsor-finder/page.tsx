import type { Metadata } from "next";
import Link from "next/link";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import {
  PAGE_SIZE,
  RATE_STEPS,
  RECENT_STEPS,
  SECTORS,
  SENIOR_SHARE,
  SORTS,
  TRANSFER_SHARE,
  finderHref,
  parseFinder,
} from "@/lib/sponsorFinder";
import { findSponsors } from "@/lib/turso/sponsorFinder";
import { US_STATE_NAMES } from "@/lib/usStateNames";

/**
 * Find a green card sponsor by what its record shows: recent PERM filing,
 * approval rate, state, industry, how often its H-1B hires are transfers,
 * and whether it's likely cap-exempt. One GET form, so every search has an
 * address. Reads `sponsor_index` (scripts/build_sponsor_index.py, nightly).
 *
 * It finds employers whose record matches; it doesn't say any of them will
 * sponsor a given person, and the page says so above the results.
 */

const TITLE = "Green Card Sponsor Finder";
const DESCRIPTION =
  "Find employers that file PERM green card cases, by state, industry, approval rate, recent filing and H-1B transfers, from DOL's own records.";
const PATH = "/sponsor-finder";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
};

const STATES = new Set(Object.keys(US_STATE_NAMES));
const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";
const FIELD =
  "min-h-[44px] w-full border-2 border-border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary";
const pct = (x: number | null, d = 0) => (x === null ? "" : `${(x * 100).toFixed(d)}%`);

export default async function SponsorFinderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = parseFinder(await searchParams, STATES);
  const found = await findSponsors(f);
  const pages = found ? Math.max(1, Math.ceil(found.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Find a green card sponsor</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Employers that file PERM cases, filtered by what DOL&apos;s records show about them. Each one links to its
          full record.
        </p>
      </header>

      <form method="get" action={PATH} className="mt-8 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
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
          <label className="block text-sm font-bold">
            Industry
            <select name="sector" defaultValue={f.sector ?? ""} className={`mt-1 ${FIELD}`}>
              <option value="">Any industry</option>
              {Object.entries(SECTORS).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            PERM filings, last 12 months
            <select name="recent" defaultValue={String(f.minRecent)} className={`mt-1 ${FIELD}`}>
              {RECENT_STEPS.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "At least 1" : `At least ${n}`}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-bold">
            PERM approval rate
            <select name="rate" defaultValue={f.minRate === null ? "" : String(f.minRate)} className={`mt-1 ${FIELD}`}>
              <option value="">Any</option>
              {RATE_STEPS.map((r) => (
                <option key={r} value={r}>
                  {`${Math.round(r * 100)}% or higher`}
                </option>
              ))}
            </select>
          </label>
        </div>{" "}
        <fieldset className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-base">
          <legend className="sr-only">More filters</legend>
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="transfers" value="1" defaultChecked={f.transfers} className="size-5" />
            Hires H-1B transfers ({Math.round(TRANSFER_SHARE * 100)}% or more of positions)
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="senior" value="1" defaultChecked={f.senior} className="size-5" />
            Mostly senior roles (wage level III or IV)
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="cap" value="1" defaultChecked={f.capExempt} className="size-5" />
            Likely cap-exempt
          </label>{" "}
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="debarred" value="1" defaultChecked={f.includeDebarred} className="size-5" />
            Include debarred employers
          </label>
        </fieldset>{" "}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block text-sm font-bold">
            Sort by
            <select name="sort" defaultValue={f.sort} className={`mt-1 ${FIELD} sm:w-auto`}>
              {Object.entries(SORTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>{" "}
          <button
            type="submit"
            className="min-h-[44px] border-2 border-border bg-foreground px-6 font-mono text-sm font-bold uppercase tracking-[0.1em] text-background shadow-hard focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Find sponsors
          </button>{" "}
          <Link href={PATH} className={`min-h-[44px] content-center text-sm ${LINK}`}>
            Clear
          </Link>
        </div>
      </form>

      <p className="mt-6 max-w-3xl border-l-4 border-primary pl-4 text-base text-foreground/80">
        These employers filed PERM cases. Whether one will sponsor you depends on the job and on them; DOL&apos;s
        records can&apos;t say. Debarred employers are left out unless you ask for them.
      </p>

      {found === null ? (
        <p className="mt-8 border-2 border-border bg-card p-5 text-base">
          The sponsor index is being built. Try again in a few minutes.
        </p>
      ) : (
        <section className="mt-8" aria-labelledby="results">
          <h2 id="results" className="font-heading text-2xl font-black">
            {found.total === 0
              ? "No sponsor matches every filter"
              : `${formatInt(found.total)} ${found.total === 1 ? "sponsor matches" : "sponsors match"}`}
          </h2>{" "}
          {found.total === 0 ? (
            <p className="mt-2 text-base text-foreground/70">Drop a filter or two and search again.</p>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto border-2 border-border">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <caption className="sr-only">Sponsors matching the filters</caption>
                  <thead>
                    <tr className="border-b-2 border-border bg-muted text-left">
                      <th scope="col" className="p-2 font-bold">Employer </th>
                      <th scope="col" className="p-2 font-bold">State </th>
                      <th scope="col" className="p-2 text-right font-bold">PERM, 12 months </th>
                      <th scope="col" className="p-2 text-right font-bold">PERM approved </th>
                      <th scope="col" className="p-2 text-right font-bold">H-1B LCAs, 24 months </th>
                      <th scope="col" className="p-2 text-right font-bold">Transfers </th>
                    </tr>
                  </thead>
                  <tbody>
                    {found.rows.map((r) => (
                      <tr key={r.slug} className="border-b border-border/50 align-top">
                        <th scope="row" className="p-2 text-left font-normal">
                          <Link href={`/perm-employers/${r.slug}`} className={LINK}>
                            {r.name}
                          </Link>{" "}
                          {r.sector ? <span className="block text-foreground/70">{r.sector} </span> : null}
                          {r.capExempt ? <span className="block text-foreground/70">Likely cap-exempt </span> : null}
                          {r.debarred ? <span className="block font-bold text-data-bad-ink">Debarred </span> : null}
                        </th>
                        <td className="p-2">{r.state ? `${r.state} ` : ""}</td>
                        <td className="p-2 text-right tabular-nums">{`${formatInt(r.permRecent)} `}</td>
                        <td className="p-2 text-right tabular-nums">
                          {r.permRate !== null && r.permDecided >= 20 ? `${pct(r.permRate, r.permRate >= 0.9 && r.permRate < 1 ? 1 : 0)} of ${formatInt(r.permDecided)} ` : "too few to rate "}
                        </td>
                        <td className="p-2 text-right tabular-nums">{`${formatInt(r.lca24m)} `}</td>
                        <td className="p-2 text-right tabular-nums">{r.transferShare !== null ? `${pct(r.transferShare)} ` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>{" "}
              {pages > 1 ? (
                <nav aria-label="Result pages" className="mt-4 flex flex-wrap items-center gap-4 text-base">
                  {f.page > 1 ? (
                    <Link href={finderHref(f, f.page - 1)} className={LINK}>
                      Previous {PAGE_SIZE}
                    </Link>
                  ) : null}{" "}
                  <span className="text-foreground/70">
                    Page {formatInt(f.page)} of {formatInt(pages)}
                  </span>{" "}
                  {f.page < pages ? (
                    <Link href={finderHref(f, f.page + 1)} className={LINK}>
                      Next {PAGE_SIZE}
                    </Link>
                  ) : null}
                </nav>
              ) : null}
            </>
          )}
        </section>
      )}

      <FinePrint summary="How these are counted" className="mt-8">
        <p>
          PERM figures are DOL&apos;s published PERM files and its live record. A rate is shown only over 20 or more
          decided cases. H-1B LCAs come from DOL&apos;s LCA files, read under every spelling of the employer&apos;s name.
          &quot;Transfers&quot; is the share of certified H-1B positions that were a change of employer, and &quot;senior&quot;
          the share of LCAs at wage level III or IV ({Math.round(SENIOR_SHARE * 100)}% or more), each over the most recent
          24 months of LCAs this site holds that detail for. &quot;Likely cap-exempt&quot; is an inference from the
          industry code a college or university files under; USCIS decides who&apos;s exempt. State is the one most of
          an employer&apos;s PERM cases name.
        </p>
      </FinePrint>{" "}
      <DataProvenance datasets={["perm-cases", "entities", "lca-disclosure"]} />
    </div>
  );
}
