/**
 * The Calculators tab.
 *
 * Split out of the overview 2026-08-24: the section nav works as tabs, and a
 * tab that anchor-scrolls half a page down is not a tab. This page is the
 * calculator grid and nothing else, so choosing a tool is one short screen.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CalendarBlankIcon as CalendarRange, CalendarCheckIcon, CalendarDotIcon as CalendarClock, ChartBarIcon, CurrencyDollarIcon, FileTextIcon, PathIcon as Route, ScalesIcon as Scale, UsersIcon } from "@phosphor-icons/react/ssr";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { PageBasics } from "@/components/data/PageBasics";
import {
  BulletinStepsMini,
  CertaintyRangeMini,
  QueueDepthMini,
  ScaleBarsMini,
  TapeMini,
  TwoBarsMini,
  WindowSpansMini,
} from "@/components/tools/MiniDiagrams";

const TITLE = "PERM Calculators";
const DESCRIPTION =
  "Free PERM calculators built on DOL's own published data: decision-time estimates, the wage queue, the I-140 backlog, and every statutory deadline.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/calculators" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/calculators",
  },
};

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
const TOOLS = [
  {
    href: "/tools/perm-timeline-calculator",
    viz: "tape" as const,
    icon: CalendarClock,
    name: "PERM processing time calculator",
    kind: "Estimate",
    tone: "ink",
    blurb:
      "When DOL is likely to decide a case filed in a given month, from its published queue position and its record of cases already decided.",
  },
  {
    href: "/tools/perm-deadline-calculator",
    viz: "spans" as const,
    icon: CalendarCheckIcon,
    name: "PERM deadline calculator",
    kind: "Exact",
    tone: "pop",
    blurb:
      "The recruitment window, the quiet period and the ETA-9089 filing window, worked out from the prevailing wage determination under 20 CFR 656.",
  },
  {
    href: "/tools/pwd-calculator",
    viz: "queue" as const,
    icon: Scale,
    name: "Prevailing wage queue calculator",
    kind: "Count",
    tone: "paper",
    blurb:
      "How many wage requests sit ahead of yours, from the pending count DOL publishes.",
  },
  {
    href: "/tools/i140-calculator",
    viz: "twobars" as const,
    icon: FileTextIcon,
    kind: "Count",
    name: "I-140 queue calculator",
    tone: "paper",
    blurb:
      "How many petitions are waiting in your category against how fast USCIS clears them, next to the processing time USCIS publishes.",
  },
  {
    href: "/tools/i485-queue-position",
    viz: "range" as const,
    icon: UsersIcon,
    kind: "Range",
    name: "I-485 queue position",
    tone: "ink",
    blurb:
      "How many employment-based adjustment applications USCIS had pending ahead of a priority date. USCIS withholds its smallest counts, so the answer is a floor and a ceiling.",
  },
  {
    href: "/tools/priority-date-calculator",
    viz: "steps" as const,
    icon: CalendarRange,
    kind: "History",
    name: "Priority date calculator",
    tone: "tint",
    blurb:
      "Where a priority date sits against the visa bulletin, and which way the cutoff has moved, including the months it moved backwards.",
  },
  {
    href: "/tools/green-card-timeline",
    viz: "scale" as const,
    icon: Route,
    kind: "Overview",
    name: "Green card timeline",
    tone: "paper",
    blurb:
      "Every stage drawn to scale, from the wage queue to the wait for a visa number, marked by which are fixed by regulation, which are queues, and which have no published figure.",
  },
];

const EXPLORERS = [
  {
    href: "/tools/salary-explorer",
    icon: CurrencyDollarIcon,
    kind: "Distribution",
    name: "Salary explorer",
    blurb:
      "What certified PERM jobs actually pay, by occupation and state, as a percentile ladder rather than one average.",
  },
  {
    href: "/tools/i140-trends",
    icon: ChartBarIcon,
    kind: "Series",
    name: "I-140 trends",
    blurb:
      "Petitions received, approved, denied and left pending by category, quarter by quarter, from USCIS's own counts.",
  },
] as const;

export default function CalculatorsPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList" as const,
    name: "PERM calculators and tools",
    numberOfItems: TOOLS.length + EXPLORERS.length,
    itemListElement: [...TOOLS, ...EXPLORERS].map((t, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      item: {
        "@type": "WebApplication" as const,
        name: t.name,
        url: `https://permtracker.app${t.href}`,
        applicationCategory: "BusinessApplication",
        offers: { "@type": "Offer" as const, price: "0", priceCurrency: "USD" },
      },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={itemList} />      <header className="pt-10 sm:pt-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Calculators
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          PERM calculators
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          {TOOLS.length} calculators that take your dates and answer about your
          case, and {EXPLORERS.length} explorers that describe the field you
          filed into. All free, all on data the government publishes.
        </p>
      </header>

      {/* The hub's real job: route the reader's situation to the right
          tool, in the order the process happens. */}
      <section className="mt-10">
        <h2 className="font-heading text-2xl font-black">Which one answers your question?</h2>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-2 border-border text-left text-sm shadow-hard-sm">
            <thead className="bg-foreground text-background">
              <tr>
                <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">Your situation{" "}</th>
                <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">Ask{" "}</th>
                <th scope="col" className="p-3 font-mono text-xs font-bold uppercase tracking-wider">Use</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {[
                { s: "Wage request filed, nothing since", q: "How many are ahead of mine?", href: "/tools/pwd-calculator", tool: "Prevailing wage queue" },
                { s: "Determination in hand, planning recruitment", q: "By when must we file?", href: "/tools/perm-deadline-calculator", tool: "Deadline calculator" },
                { s: "ETA-9089 filed, waiting", q: "When will DOL decide?", href: "/tools/perm-timeline-calculator", tool: "Decision estimator" },
                { s: "PERM certified, I-140 next or pending", q: "How deep is USCIS's queue?", href: "/tools/i140-calculator", tool: "I-140 queue" },
                { s: "I-140 approved, waiting to adjust status", q: "How deep is the green card queue at my priority date?", href: "/tools/i485-queue-position", tool: "I-485 queue position" },
                { s: "I-140 approved, watching the bulletin", q: "Is my date current, and which way is it moving?", href: "/tools/priority-date-calculator", tool: "Priority dates" },
                { s: "Just starting, or explaining it to someone", q: "How long is the whole thing?", href: "/tools/green-card-timeline", tool: "Green card timeline" },
                { s: "Writing the job offer, before any of the above", q: "What does this role pay here?", href: "/tools/salary-explorer", tool: "Salary explorer" },
                { s: "Weighing EB-2 against EB-3", q: "Which category is USCIS clearing?", href: "/tools/i140-trends", tool: "I-140 trends" },
              ].map((r) => (
                <tr key={r.href} className="border-t border-border/40">
                  <td className="p-3">{r.s}{" "}</td>
                  <td className="p-3 text-foreground/70">{r.q}{" "}</td>
                  <td className="p-3">
                    <a href={r.href} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                      {r.tool}
                    </a>
                  {" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-8">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const card = (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "group flex h-full flex-col border-2 border-border p-6 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                  (t.tone === "ink"
                    ? "bg-foreground text-background shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
                    : t.tone === "tint"
                      ? "bg-tint-primary shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
                      : t.tone === "pop"
                        ? "bg-card hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-y-0 active:shadow-hard-sm"
                        : "bg-card shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm")
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <span
                    className={
                      "font-mono text-xs font-bold uppercase tracking-wider " +
                      (t.tone === "ink" ? "text-background/60" : "text-muted-foreground")
                    }
                  >
                    {t.kind}
                  </span>
                </div>
                <h3 className="mt-4 font-heading text-xl font-black leading-tight">
                  {t.name}
                </h3>{" "}
                {/* The tool's idea, drawn in the shared mini-diagram system. */}
                <div className="mt-4 max-w-[170px]">
                  {t.viz === "tape" ? <TapeMini /> : null}
                  {t.viz === "spans" ? <WindowSpansMini /> : null}
                  {t.viz === "queue" ? <QueueDepthMini /> : null}
                  {t.viz === "twobars" ? <TwoBarsMini /> : null}
                  {t.viz === "steps" ? <BulletinStepsMini /> : null}
                  {t.viz === "scale" ? <ScaleBarsMini /> : null}
                  {t.viz === "range" ? <CertaintyRangeMini /> : null}
                </div>{" "}
                <p
                  className={
                    "mt-3 flex-1 text-base leading-relaxed " +
                    (t.tone === "ink" ? "text-background/70" : "text-foreground/70")
                  }
                >
                  {t.blurb}
                </p>{" "}
                <span
                  className={
                    "mt-5 inline-flex items-center gap-2 font-bold underline decoration-primary decoration-2 underline-offset-4 " +
                    // Lime TEXT passes on ink (10.4:1) and fails on light
                    // surfaces (2.05:1 measured), so the label reads in the
                    // surface's own foreground and lime carries the underline.
                    (t.tone === "ink" ? "text-background" : "text-foreground")
                  }
                >
                  Open
                  <ArrowRightIcon
                    className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
            // One offset block in the grid, on the exact-answer tool.
            return t.tone === "pop" ? (
              <div key={t.href} className="pop">
                {card}
              </div>
            ) : (
              card
            );
          })}
        </div>
      </section>

      {/* A different shape from the calculator grid on purpose. These take no
          input about you, so they get a row of plain records rather than
          another card with a diagram of a mechanism they do not have. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">
          And the field you filed into
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
          These two ask nothing about your case. They describe what everyone
          else&apos;s looks like, which is what tells you whether a wage or a
          category is ordinary.
        </p>
        <div className="mt-6 divide-y-2 divide-border border-2 border-border bg-card shadow-hard">
          {EXPLORERS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="group flex flex-wrap items-start gap-x-4 gap-y-2 p-6 transition-colors duration-150 hover:bg-tint-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:p-8"
              >
                <Icon className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t.kind}
                  </span>{" "}
                  <h3 className="mt-1 font-heading text-xl font-black leading-tight">
                    {t.name}
                  </h3>{" "}
                  <p className="mt-2 text-base leading-relaxed text-foreground/70">
                    {t.blurb}
                  </p>
                </div>
                <ArrowRightIcon
                  className="mt-1 h-5 w-5 shrink-0 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-12 border-2 border-border bg-muted p-6 sm:p-8">
        <h2 className="font-heading text-xl font-black">
          Why some of these refuse to give you a number
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          A queue estimate is a forecast. Where DOL publishes enough to be sure,
          you get a figure and its source. Where it doesn’t, you get the count
          that’s real and a plain statement of what’s missing. The deadline
          calculator is the exception: those dates are arithmetic in the
          regulations, so they’re exact.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Public estimators disagree with each other by months on the same
          filing date.{" "}
          <Link
            href="/methodology"
            className="font-bold underline underline-offset-2 hover:text-primary"
          >
            How we compute ours, and why they differ
          </Link>
          .
        </p>
      </section>{" "}
      <PageBasics page="calculators" />
    </div>
  );
}
