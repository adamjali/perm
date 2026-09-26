/**
 * Every employment-based line in the visa bulletin, one cell each, linking to
 * the line's own page (`/visa-bulletin/categories/<line>`). The newest
 * bulletin's final action cutoff on top, dates for filing under it.
 */

import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DataProvenance } from "@/components/data/DataProvenance";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { bulletinMonthLabel, cutoffLabel } from "@/lib/bulletinNext";
import { LINE_CATEGORY_SHORT, LINE_COUNTRY_SHORT, LINE_PAGE_COUNTRIES, lineSlug } from "@/lib/bulletinLines";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import type { BulletinMonth } from "@/lib/perm";
import { summariseBulletins } from "@/lib/turso/bulletin";
import { getVisaBulletins } from "@/lib/turso/publicData";

export const revalidate = 86400;

const TITLE = "Visa Bulletin by Category and Country";
const DESCRIPTION =
  "Every employment-based visa bulletin line, EB-1 to EB-5, for India, China, Mexico, the Philippines and the rest of the world, each with its own history.";
const PATH = "/visa-bulletin/categories";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "visa-bulletin-categories");

export default async function BulletinCategoriesPage() {
  const raw = await getVisaBulletins().catch(() => []);
  const board = summariseBulletins(
    raw.map((b) => ({
      bulletinMonth: b.bulletinMonth,
      finalAction: (b.finalAction ?? {}) as BulletinMonth["finalAction"],
      datesForFiling: (b.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
    })),
  );
  const categories = (board?.categories ?? []).filter((c) => LINE_CATEGORY_SHORT[c]);
  const cell = (list: NonNullable<typeof board>["finalAction"], category: string, country: string) =>
    list.find((c) => c.category === category && c.country === country) ?? null;

  const breadcrumb = generateBreadcrumbSchema([
    { name: "Visa bulletin", href: "/visa-bulletin" },
    { name: "Categories", href: PATH },
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/visa-bulletin" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Visa bulletin
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Every line in the bulletin</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          {board
            ? `The ${bulletinMonthLabel(board.lastMonth)} bulletin's cutoffs for every employment-based category and country. Pick a line for its history back to ${bulletinMonthLabel(board.firstMonth)}.`
            : "The bulletin archive is unavailable right now."}
        </p>
      </header>

      {board && categories.length ? (
        <section className="mt-10">
          <div className="overflow-x-auto border-2 border-border bg-card shadow-hard">
            <table className="w-full min-w-[760px] text-left text-base">
              <caption className="sr-only">
                Final action and dates for filing cutoffs, {bulletinMonthLabel(board.lastMonth)}, by category and country
              </caption>
              <thead className="border-b-2 border-border bg-muted/40">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">Category{" "}</th>
                  {LINE_PAGE_COUNTRIES.map((c) => (
                    <th key={c} scope="col" className="px-4 py-3 font-bold">
                      {LINE_COUNTRY_SHORT[c]}{" "}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-4 py-3 font-bold" translate="no">
                      {LINE_CATEGORY_SHORT[cat]}{" "}
                    </th>
                    {LINE_PAGE_COUNTRIES.map((country) => {
                      const fa = cell(board.finalAction, cat, country);
                      const dff = cell(board.datesForFiling, cat, country);
                      return (
                        <td key={country} className="px-2 py-1 align-top">
                          {fa ? (
                            <Link
                              href={`/visa-bulletin/categories/${lineSlug(cat, country)}`}
                              className="block min-h-[44px] px-2 py-2 hover:bg-muted"
                              aria-label={`${LINE_CATEGORY_SHORT[cat]} ${LINE_COUNTRY_SHORT[country]}: final action ${cutoffLabel(fa.latest)}`}
                            >
                              <span className="block font-bold tabular-nums underline underline-offset-2">{cutoffLabel(fa.latest)}</span>{" "}
                              {dff ? (
                                <span className="block text-sm text-foreground/70 tabular-nums">filing {cutoffLabel(dff.latest)}</span>
                              ) : null}
                            </Link>
                          ) : (
                            <span className="block px-2 py-2 text-foreground/60">not listed</span>
                          )}{" "}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>{" "}
          <p className="mt-3 text-base text-foreground/70">
            Top: the final action date, when a green card can be approved. Under it: the dates for filing, when USCIS
            allows it for filing an I-485. &ldquo;Current&rdquo; means every priority date qualifies; &ldquo;Unavailable&rdquo;
            means no numbers this month.
          </p>
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Each line&apos;s page</h2>{" "}
        <div className="mt-4 grid grid-cols-1 gap-6 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="font-heading text-lg font-black" translate="no">
                {LINE_CATEGORY_SHORT[cat]}
              </h3>{" "}
              <ul className="mt-2 space-y-1">
                {LINE_PAGE_COUNTRIES.map((country) => (
                  <Fragment key={country}>
                    {" "}
                    <li>
                      <Link
                        href={`/visa-bulletin/categories/${lineSlug(cat, country)}`}
                        className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
                      >
                        {LINE_CATEGORY_SHORT[cat]} {LINE_COUNTRY_SHORT[country]}
                      </Link>
                    </li>
                  </Fragment>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <DataProvenance datasets={["visa-bulletin"]} />

      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/visa-bulletin", label: "What the next bulletin usually does", note: "every earlier same-month bulletin, and the inventory ahead of each cutoff" },
          { href: "/tools/priority-date-calculator", label: "Priority date calculator", note: "your own date against any line, month by month" },
          { href: "/tools/green-card-line", label: "The green card line", note: "everyone ahead of your date in EB-2, EB-3 and Other Workers" },
        ]}
      />
    </div>
  );
}
