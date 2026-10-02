/**
 * The open datasets: the visa bulletin archive and DOL's processing-times
 * readings, as CSV and JSON under CC BY 4.0.
 *
 * Every figure here (counts, spans, the preview rows) is read from the same
 * tables the files are built from, so the page can't describe a file that
 * isn't there. The column guides and the licence's scope are folded: the page
 * leads with the files.
 */

import type { Metadata } from "next";
import { DownloadSimpleIcon, FileCsvIcon, BracketsCurlyIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { SITE_URL } from "@/lib/constants/site";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getDatasetSchema } from "@/lib/structuredData";
import {
  OPEN_DATA_CREDIT,
  OPEN_DATA_LICENSE,
  OPEN_DATA_PATHS,
  bulletinRows,
  dolRows,
  type BulletinRow,
  type DolRow,
} from "@/lib/openData";
import { getProcessingTimesArchive, getVisaBulletinsArchive } from "@/lib/turso/openData";

const TITLE = "Open Data: Visa Bulletin and DOL History";
const DESCRIPTION =
  "Visa bulletin cutoffs back to 2005 and every DOL processing-times reading we've kept, as CSV and JSON, free to reuse under CC BY 4.0.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/open-data" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/open-data" },
  },
  "open-data",
);

// A day, and expired early by /api/revalidate-bulletin and /api/revalidate-dol
// the day either source moves.
export const revalidate = 86400;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(ym: string | undefined): string {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y}`;
}
function dayLabel(iso: string | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${Number(d)}, ${y}`;
}
const fmt = (n: number) => n.toLocaleString("en-US");

/** Calendar months between the first and last held that aren't held. */
function missingMonths(held: string[]): number {
  if (held.length < 2) return 0;
  const sorted = [...held].sort();
  const toIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  const span = toIndex(sorted[sorted.length - 1]!) - toIndex(sorted[0]!) + 1;
  return span - new Set(sorted).size;
}

const BULLETIN_FIELDS: Array<[keyof BulletinRow, string]> = [
  ["bulletin_month", "The bulletin's own month, YYYY-MM."],
  ["preference", "employment or family."],
  ["chart", "final_action or dates_for_filing."],
  ["category", "As the bulletin names it: EB1, EB2, EB3, F2A and so on."],
  ["country", "worldwide, china, india, mexico or philippines."],
  ["as_printed", "The cell exactly as State printed it: a date like 15JAN13, C or U."],
  ["cutoff_date", "The printed date as YYYY-MM-DD; blank for C and U."],
  ["status", "date, current (C: open to every priority date) or unavailable (U: shut to all)."],
];

const DOL_FIELDS: Array<[keyof DolRow, string]> = [
  ["as_of", "DOL's own as-of date for that reading, YYYY-MM-DD."],
  ["table", "perm_queue, perm_average_days, pwd_queue_oews, pwd_queue_non_oews or pwd_perm_backlog."],
  ["row", "The queue, determination or program DOL names on that line."],
  ["month", "The month DOL printed, YYYY-MM; blank where DOL printed --."],
  ["calendar_days", "Average days to a determination (perm_average_days only)."],
  ["remaining_requests", "Wage requests still pending from that month (pwd_perm_backlog only)."],
];

export default async function OpenDataPage() {
  // No fallback to empty lists: a page saying "0 bulletins" would describe
  // files that aren't empty. A failed read reaches the error screen, and a
  // failed regeneration keeps the last good page.
  const [bulletins, readings] = await Promise.all([getVisaBulletinsArchive(), getProcessingTimesArchive()]);
  const bRows = bulletinRows(bulletins);
  const dRows = dolRows(readings);

  const firstBulletin = bulletins[0]?.bulletinMonth;
  const lastBulletin = bulletins[bulletins.length - 1]?.bulletinMonth;
  const missingBulletins = missingMonths(bulletins.map((b) => b.bulletinMonth));
  const asOfs = readings.map((r) => r.permAsOf).sort();
  const firstReading = asOfs[0];
  const lastReading = asOfs[asOfs.length - 1];

  // The newest bulletin's EB-2 and EB-3 final action cells: the rows people open
  // this file for, and proof the preview is the file, not a mock-up.
  const bPreview = bRows
    .filter((r) => r.bulletin_month === lastBulletin && r.chart === "final_action" && /^EB[23]$/.test(r.category))
    .slice(0, 5);
  const dPreview = dRows.filter((r) => r.as_of === lastReading && r.table !== "pwd_perm_backlog").slice(0, 5);

  const schemas = [
    getDatasetSchema(SITE_URL, {
      name: "Visa bulletin cutoff history",
      description:
        "Every employment and family cutoff date the State Department printed in its monthly visa bulletin, final action and dates for filing, by category and country.",
      url: `${SITE_URL}/open-data`,
      isBasedOn: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
      license: OPEN_DATA_LICENSE.url,
      ...(firstBulletin && lastBulletin ? { temporalCoverage: `${firstBulletin}/${lastBulletin}` } : {}),
      distribution: [
        { encodingFormat: "text/csv", contentUrl: `${SITE_URL}${OPEN_DATA_PATHS.bulletinCsv}` },
        { encodingFormat: "application/json", contentUrl: `${SITE_URL}${OPEN_DATA_PATHS.bulletinJson}` },
      ],
      keywords: ["visa bulletin", "priority date", "cutoff date", "green card", "EB-2", "EB-3"],
    }),
    getDatasetSchema(SITE_URL, {
      name: "DOL processing times history",
      description:
        "Every reading of the Department of Labor's PERM and prevailing wage processing-times page kept since we began saving it: the month each queue was working, average days to a determination, and the wage-request backlog.",
      url: `${SITE_URL}/open-data`,
      isBasedOn: "https://flag.dol.gov/processingtimes",
      license: OPEN_DATA_LICENSE.url,
      ...(firstReading && lastReading ? { temporalCoverage: `${firstReading}/${lastReading}`, dateModified: lastReading } : {}),
      distribution: [
        { encodingFormat: "text/csv", contentUrl: `${SITE_URL}${OPEN_DATA_PATHS.dolCsv}` },
        { encodingFormat: "application/json", contentUrl: `${SITE_URL}${OPEN_DATA_PATHS.dolJson}` },
      ],
      keywords: ["PERM processing times", "prevailing wage", "DOL", "analyst review"],
    }),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      {schemas.map((s) => (
        <JsonLdScript key={s.name} schema={s} />
      ))}
      <header className="pt-10 sm:pt-12">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Open data</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/75">
          Two histories the agencies don&rsquo;t keep in one place, as files you can download and reuse with credit.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-8 [&>*]:min-w-0 lg:grid-cols-2">
        <DatasetPanel
          title="Visa bulletin cutoffs"
          summary={`Every cell of every bulletin we hold: employment and family, final action and dates for filing.${
            missingBulletins > 0
              ? ` ${missingBulletins} months in that span are missing, where State's older pages don't parse or its index doesn't link them.`
              : ""
          }`}
          stats={[
            ["Covers", firstBulletin && lastBulletin ? `${monthLabel(firstBulletin)} to ${monthLabel(lastBulletin)}` : "Unavailable"],
            ["Bulletins", fmt(bulletins.length)],
            ["Rows", fmt(bRows.length)],
          ]}
          source={{ label: "State Department visa bulletin", href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" }}
          columns={["bulletin_month", "category", "country", "as_printed", "status"]}
          preview={bPreview}
          files={{ csv: OPEN_DATA_PATHS.bulletinCsv, json: OPEN_DATA_PATHS.bulletinJson }}
          fields={BULLETIN_FIELDS}
        />{" "}
        <DatasetPanel
          title="DOL processing times"
          summary="Every reading of DOL's processing-times page we've saved. DOL overwrites the page, so earlier readings exist only where someone kept them."
          stats={[
            ["Covers", firstReading && lastReading ? `${dayLabel(firstReading)} to ${dayLabel(lastReading)}` : "Unavailable"],
            ["Readings", fmt(readings.length)],
            ["Rows", fmt(dRows.length)],
          ]}
          source={{ label: "DOL FLAG processing times", href: "https://flag.dol.gov/processingtimes" }}
          columns={["as_of", "table", "row", "month"]}
          preview={dPreview}
          files={{ csv: OPEN_DATA_PATHS.dolCsv, json: OPEN_DATA_PATHS.dolJson }}
          fields={DOL_FIELDS}
        />
      </div>{" "}

      <section className="mt-12 border-3 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-2xl font-black">Credit</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/75">
          Free to copy, change and publish, commercially too, under{" "}
          <a href={OPEN_DATA_LICENSE.url} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary" rel="license">
            {OPEN_DATA_LICENSE.short}
          </a>
          . Credit us like this:
        </p>{" "}
        <p className="mt-4 border-2 border-border bg-muted px-4 py-3 font-mono text-sm break-words">
          Source: {OPEN_DATA_CREDIT}, from U.S. Department of State and Department of Labor records. {OPEN_DATA_LICENSE.short}.
        </p>{" "}
        <details className="group mt-5">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center font-heading text-base font-bold underline decoration-primary decoration-2 underline-offset-4 [&::-webkit-details-marker]:hidden">
            What the licence covers
          </summary>{" "}
          <div className="mt-3 max-w-2xl space-y-3 text-base leading-relaxed text-foreground/75">
            <p>
              The dates and figures themselves are federal records with no copyright, and you can always take them from
              the State Department and DOL directly. The licence covers our compilation of them in these files: the
              months gathered in one place, the cells parsed, the readings kept.
            </p>{" "}
            <p>
              It covers these two files only. The rest of the site&rsquo;s compiled data stays under{" "}
              <a href="/terms#acceptable-use" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                the Terms
              </a>
              .
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}

function DatasetPanel<T extends object>({
  title,
  summary,
  stats,
  source,
  columns,
  preview,
  files,
  fields,
}: {
  title: string;
  summary: string;
  stats: Array<[string, string]>;
  source: { label: string; href: string };
  columns: Array<keyof T & string>;
  preview: T[];
  files: { csv: string; json: string };
  fields: Array<[keyof T & string, string]>;
}) {
  return (
    <section className="flex flex-col border-3 border-border bg-card shadow-hard">
      <div className="border-b-3 border-border p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-black">{title}</h2>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/75">{summary}</p>{" "}
        <dl className="mt-5 grid grid-cols-3 gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="min-w-0 border-2 border-border bg-background px-3 py-2">
              <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>{" "}
              <dd className="mt-0.5 font-heading text-base font-bold break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>{" "}

      {preview.length > 0 && (
        <div className="overflow-x-auto border-b-3 border-border bg-muted/60">
          <table className="w-full min-w-[26rem] border-collapse font-mono text-sm">
            <caption className="sr-only">The first rows of the newest {title.toLowerCase()} in the file</caption>
            <thead>
              <tr className="border-b-2 border-border">
                {columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 text-left font-bold">
                    {c}{" "}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-b border-border/40 last:border-b-0">
                  {columns.map((c) => (
                    <td key={c} className="px-3 py-1.5 whitespace-nowrap">
                      {String(r[c] ?? "")}{" "}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}{" "}

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap gap-3">
          <a
            href={files.csv}
            download
            className="inline-flex min-h-[44px] items-center gap-2 border-3 border-border bg-primary px-4 py-2 font-heading text-sm font-bold text-primary-foreground shadow-hard transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            <FileCsvIcon className="size-5" weight="bold" aria-hidden="true" />
            Download CSV
            <DownloadSimpleIcon className="size-4" weight="bold" aria-hidden="true" />
          </a>{" "}
          <a
            href={files.json}
            className="inline-flex min-h-[44px] items-center gap-2 border-3 border-border bg-card px-4 py-2 font-heading text-sm font-bold shadow-hard transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 motion-reduce:transition-none"
          >
            <BracketsCurlyIcon className="size-5" weight="bold" aria-hidden="true" />
            JSON
          </a>
        </div>{" "}
        <p className="text-sm text-muted-foreground">
          From the{" "}
          <a href={source.href} className="font-semibold underline underline-offset-2 hover:text-foreground" rel="noopener noreferrer" target="_blank">
            {source.label}
          </a>
          . Updated the day it changes.
        </p>{" "}
        <details className="group">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center font-heading text-base font-bold underline decoration-primary decoration-2 underline-offset-4 [&::-webkit-details-marker]:hidden">
            Columns
          </summary>{" "}
          <dl className="mt-2 space-y-2 text-sm">
            {fields.map(([name, what]) => (
              <div key={name}>
                <dt className="inline font-mono font-bold">{name}</dt>{" "}
                <dd className="inline text-foreground/75">{what}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  );
}
