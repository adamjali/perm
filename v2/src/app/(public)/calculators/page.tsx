/**
 * The Calculators tab.
 *
 * Split out of the overview 2026-08-24: the section nav works as tabs, and a
 * tab that anchor-scrolls half a page down is not a tab. This page is the
 * calculator grid and nothing else, so choosing a tool is one short screen.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  FileText,
  Route,
  Scale,
} from "lucide-react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";

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

const TOOLS = [
  {
    href: "/tools/perm-timeline-calculator",
    icon: CalendarClock,
    name: "PERM processing time calculator",
    kind: "Estimate",
    tone: "ink",
    blurb:
      "When DOL is likely to decide a case filed in a given month, from its published queue position and its record of cases already decided.",
  },
  {
    href: "/tools/perm-deadline-calculator",
    icon: CalendarCheck,
    name: "PERM deadline calculator",
    kind: "Exact",
    tone: "pop",
    blurb:
      "The recruitment window, the quiet period and the ETA-9089 filing window, worked out from the prevailing wage determination under 20 CFR 656.",
  },
  {
    href: "/tools/pwd-calculator",
    icon: Scale,
    name: "Prevailing wage queue calculator",
    kind: "Count",
    tone: "paper",
    blurb:
      "How many wage requests sit ahead of yours. DOL publishes this one as an actual pending count, so it is a fact rather than a model.",
  },
  {
    href: "/tools/i140-calculator",
    icon: FileText,
    kind: "Count",
    name: "I-140 queue calculator",
    tone: "paper",
    blurb:
      "How many petitions are waiting in your category against how fast USCIS clears them, next to the processing time USCIS publishes. The two disagree, and the gap is the useful part.",
  },
  {
    href: "/tools/priority-date-calculator",
    icon: CalendarRange,
    kind: "History",
    name: "Priority date calculator",
    tone: "tint",
    blurb:
      "Where a priority date sits against the visa bulletin, and which way the cutoff has moved. It goes backwards more often than people expect.",
  },
  {
    href: "/tools/green-card-timeline",
    icon: Route,
    kind: "Overview",
    name: "Green card timeline",
    tone: "paper",
    blurb:
      "Every stage drawn to scale, from the wage queue to the wait for a visa number. Shows which parts are fixed by regulation, which are queues, and which nobody can put a number on.",
  },
];

export default function CalculatorsPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList" as const,
    name: "PERM calculators and tools",
    numberOfItems: TOOLS.length,
    itemListElement: TOOLS.map((t, i) => ({
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
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={itemList} />

      <DataNav active="calculators" />

      <header className="pt-10 sm:pt-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          Calculators
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Pick the question
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Six calculators, one per question a PERM case raises. Each one says
          where its numbers come from, and says so when it cannot answer.
        </p>
      </header>

      <section className="mt-10">
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
                    ? "bg-foreground text-background shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg"
                    : t.tone === "tint"
                      ? "bg-tint-primary shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg"
                      : t.tone === "pop"
                        ? "bg-card hover:-translate-x-[1px] hover:-translate-y-[1px]"
                        : "bg-card shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg")
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <span
                    className={
                      "font-mono text-xs font-bold uppercase tracking-wider " +
                      (t.tone === "ink" ? "text-background/60" : "text-foreground/50")
                    }
                  >
                    {t.kind}
                  </span>
                </div>
                <h3 className="mt-4 font-heading text-xl font-black leading-tight">
                  {t.name}
                </h3>{" "}
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
                  <ArrowRight
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

      <section className="mt-12 border-2 border-border bg-muted p-6 sm:p-8">
        <h2 className="font-heading text-xl font-black">
          Why some of these refuse to give you a number
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          A queue estimate is a forecast. Where DOL publishes enough to be sure,
          you get a figure and its source. Where it does not, you get the count
          that is real and a plain statement of what is missing. The deadline
          calculator is the exception: those dates are arithmetic in the
          regulations, so they are exact.
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
      </section>
    </div>
  );
}
