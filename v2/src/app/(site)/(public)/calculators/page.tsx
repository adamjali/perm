/**
 * The Calculators tab.
 *
 * Its own page because the section nav works as tabs, and a tab that
 * anchor-scrolls half a page down is not a tab. This page is the
 * calculator grid and nothing else, so choosing a tool is one short screen.
 */

import type { Metadata } from "next";
import { FinePrint } from "@/components/data/FinePrint";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";
import { ArrowRightIcon, ChartBarIcon, CurrencyDollarIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { PageBasics } from "@/components/data/PageBasics";
import { CalculatorTour } from "@/components/tools/CalculatorTour";
import { SITE_URL } from "@/lib/constants/site";
import { CALCULATOR_PAGES, pageName } from "@/lib/siteMap";

const TITLE = "Free PERM Timeline and Deadline Calculators";
const DESCRIPTION =
  "Free PERM calculators built on DOL's own published data: decision-time estimates, the wage queue, the I-140 backlog, and every statutory deadline.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/calculators" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/calculators",
  },
}, "calculators");

export const dynamic = "force-static";

/**
 * TWO KINDS OF TOOL, AND THE COUNT COMES FROM THE ARRAYS.
 *
 * This page said "Seven calculators" in copy while the site's own
 * `TOOL_NAV_LINKS` carried nine entries, and the two it was missing were real
 * pages reachable from the footer. Writing a total into a sentence guarantees
 * it goes stale the next time a tool ships, so the counts below are computed.
 *
 * The split is not padding to make the number bigger. A calculator takes YOUR
 * dates or YOUR category and answers about YOUR case; an explorer takes no
 * input about you and describes the field. They belong in one place because a
 * reader arrives with a question rather than a taxonomy, and they are labelled
 * apart because "what will happen to me" and "what does this job pay" want
 * different things from the same visit.
 */
/** The explorers: they take nothing about the reader's case. Named by the site map, like every page. */
const EXPLORERS = [
  {
    href: "/tools/salary-explorer",
    icon: CurrencyDollarIcon,
    kind: "Distribution",
    blurb:
      "What certified PERM jobs actually pay, as a percentile ladder rather than one average.",
  },
  {
    href: "/lca-wages",
    icon: CurrencyDollarIcon,
    kind: "Distribution",
    blurb:
      "The wage attested on certified H-1B LCAs, by occupation and worksite state, annualised from the unit each filing quoted.",
  },
  {
    href: "/tools/compare-my-offer",
    icon: CurrencyDollarIcon,
    kind: "Percentile",
    blurb:
      "Where your offer sits among certified H-1B LCAs and PERM offers for the same job and state. The number stays in your browser.",
  },
  {
    href: "/tools/i140-trends",
    icon: ChartBarIcon,
    kind: "Series",
    blurb:
      "Petitions received, approved, denied and left pending by category, quarter by quarter.",
  },
].map((e) => ({ ...e, name: pageName(e.href) ?? e.href }));
const EXPLORER_HREFS = new Set(EXPLORERS.map((e) => e.href));
/** The calculators about the reader's own case: every calculator in the site map but the explorers. */
const CASE_TOOLS = CALCULATOR_PAGES.filter((p) => !EXPLORER_HREFS.has(p.href));

export default function CalculatorsPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList" as const,
    name: "PERM calculators and tools",
    numberOfItems: CASE_TOOLS.length + EXPLORERS.length,
    itemListElement: [...CASE_TOOLS, ...EXPLORERS].map((t, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      item: {
        "@type": "WebApplication" as const,
        name: t.name,
        url: `${SITE_URL}${t.href}`,
        applicationCategory: "UtilitiesApplication",
        offers: { "@type": "Offer" as const, price: "0", priceCurrency: "USD" },
      },
    })),
  };

  return (
    <>
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <JsonLdScript schema={itemList} />      <header className="pt-10 sm:pt-12">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          PERM calculators
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {CASE_TOOLS.length} calculators about your case, {EXPLORERS.length}{" "}
          explorers about the field you filed into. Free, on the
          government&apos;s own data.
        </p>
      </header>
    </div>{" "}
    {/* Every calculator, stretch by stretch, each band showing one of them answered. */}
    <div className="mt-10">
      <CalculatorTour />
    </div>{" "}
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">

      {/* The hub's real job: route the reader's situation to the right
          tool, in the order the process happens. */}
      <section className="mt-10">
        <h2 className="font-heading text-2xl font-bold">Which one answers your question?</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-t-2 border-[var(--object-border)] text-left text-sm">
            <thead className="dark border-b border-black bg-[#141414] text-foreground">
              <tr>
                <th scope="col" className="p-3 text-sm font-bold">Your situation{" "}</th>
                <th scope="col" className="p-3 text-sm font-bold">Ask{" "}</th>
                <th scope="col" className="p-3 text-sm font-bold">Use{" "}</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {[
                // A person with a live wage request was routed to a queue count only.
                // Their first question is where THEIR request is, and that is a lookup.
                { s: "Wage request filed, nothing since", q: "Where is mine right now?", href: "/perm-case-status", tool: "Case status (takes P- numbers)" },
                { s: "Wage request filed, no number for it", q: "What is the case number?", href: "/pwd-cases", tool: "Wage request search" },
                { s: "Wage request filed, nothing since", q: "How many are ahead of mine?", href: "/tools/pwd-calculator", tool: "Prevailing wage queue" },
                { s: "Determination in hand, planning recruitment", q: "By when must we file?", href: "/tools/perm-deadline-calculator", tool: "Deadline calculator" },
                { s: "ETA-9089 filed, waiting", q: "When will DOL decide?", href: "/tools/perm-timeline-calculator", tool: "PERM timeline calculator" },
                { s: "PERM certified, I-140 next or pending", q: "How deep is USCIS's queue?", href: "/tools/i140-calculator", tool: "I-140 queue" },
                { s: "I-140 approved, waiting to adjust status", q: "How deep is the green card queue at my priority date?", href: "/tools/i485-queue-position", tool: "I-485 queue position" },
                { s: "I-140 approved, watching the bulletin", q: "Is my date current, and which way is it moving?", href: "/tools/priority-date-calculator", tool: "Priority dates" },
                { s: "I-140 approved, years from current", q: "How many people are ahead of me in the whole line?", href: "/tools/green-card-line", tool: "Green card line" },
                { s: "Deciding between EB-2 and EB-3", q: "Which line has fewer people ahead of my date?", href: "/tools/eb2-vs-eb3", tool: "EB-2 vs EB-3" },
                { s: "Before the PERM", q: "Which employment green card could my job lead to?", href: "/tools/which-green-card", tool: "Which green card fits" },
                { s: "Just starting, or planning ahead", q: "When will I get my green card, and what will it cost?", href: "/tools/green-card-timeline", tool: "Green card timeline and planner" },
                { s: "Writing the job offer, before any of the above", q: "What does this role pay here?", href: "/tools/salary-explorer", tool: "Salary explorer" },
                { s: "Weighing EB-2 against EB-3", q: "Which category is USCIS clearing?", href: "/tools/i140-trends", tool: "I-140 trends" },
              ].map((r) => (
                <tr key={r.href} className="border-t border-border/40">
                  <td className="p-3">{r.s}{" "}</td>
                  <td className="p-3 text-muted-foreground">{r.q}{" "}</td>
                  <td className="p-3">
                    <a href={r.href} className="link">
                      {r.tool}
                    </a>
                  {" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* A different shape from the calculator grid on purpose. These take no
          input about you, so they get a row of plain records rather than
          another card with a diagram of a mechanism they do not have. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">
          And the field you filed into
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          These ask nothing about your case. They tell you whether a wage or a
          category is ordinary.
        </p>
        <div className="mt-6 divide-y divide-border border-border bg-card border">
          {EXPLORERS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="group flex flex-wrap items-start gap-x-4 gap-y-2 p-6 transition-colors duration-150 hover:bg-tint focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:p-8"
              >
                <Icon className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-muted-foreground">
                    {t.kind}
                  </span>{" "}
                  <h3 className="mt-1 font-heading text-xl font-bold leading-tight">
                    <span className="u-title">{t.name}</span>
                  </h3>{" "}
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    {t.blurb}
                  </p>
                </div>
                <ArrowRightIcon
                  className="mt-1 h-5 w-5 shrink-0 transition-transform duration-150 motion-reduce:transition-none motion-safe:group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-12 bg-tint p-6 sm:p-8 border-2 border-border">
        <h2 className="font-heading text-xl font-bold">
          Why some of these refuse to give you a number
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          A queue estimate is a forecast; a deadline is arithmetic in the
          regulations, so those dates are exact.
        </p>{" "}
        <FinePrint summary="What you get when DOL has not published enough" className="mt-3">
          <p>
            Where DOL publishes enough, you get a figure and its source. Where
            it doesn’t, you get the count that’s real and what’s missing.
          </p>
        </FinePrint>{" "}
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Public estimators disagree with each other by months on the same
          filing date.{" "}
          <Link
            href="/methodology"
            className="link"
          >
            How we compute ours, and why they differ
          </Link>
          .
        </p>
      </section>{" "}
      <PageBasics page="calculators" />
    </div>
    </>
  );
}
