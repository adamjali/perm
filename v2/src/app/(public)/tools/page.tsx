import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarClock, FileText, Route, Scale } from "lucide-react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";

const TITLE = "PERM Calculators and Tools";
const DESCRIPTION =
  "Free PERM calculators built on the Department of Labor's own published data: decision-time estimates, the prevailing wage queue, and every statutory deadline in a case.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools",
  },
};

export const dynamic = "force-static";

const TOOLS = [
  {
    href: "/tools/green-card-timeline",
    icon: Route,
    kind: "Overview",
    name: "Green card timeline",
    blurb:
      "Every stage drawn to scale, from the wage queue to the wait for a visa number. Shows which parts are fixed by regulation, which are queues, and which nobody can put a number on.",
  },
  {
    href: "/tools/perm-timeline-calculator",
    icon: CalendarClock,
    name: "PERM processing time calculator",
    kind: "Estimate",
    blurb:
      "When DOL is likely to decide a case filed in a given month, from its published queue position and its record of cases already decided.",
  },
  {
    href: "/tools/pwd-calculator",
    icon: Scale,
    name: "Prevailing wage queue calculator",
    kind: "Count",
    blurb:
      "How many wage requests sit ahead of yours. DOL publishes this one as an actual pending count, so it is a fact rather than a model.",
  },
  {
    href: "/tools/i140-calculator",
    icon: FileText,
    kind: "Count",
    name: "I-140 queue calculator",
    blurb:
      "How many petitions are waiting in your category against how fast USCIS clears them, next to the processing time USCIS publishes. The two disagree, and the gap is the useful part.",
  },
  {
    href: "/tools/perm-deadline-calculator",
    icon: CalendarCheck,
    name: "PERM deadline calculator",
    kind: "Exact",
    blurb:
      "The recruitment window, the quiet period and the ETA-9089 filing window, worked out from the prevailing wage determination under 20 CFR 656.",
  },
];

export default function ToolsPage() {
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
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <JsonLdScript schema={itemList} />

      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          PERM calculators
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Free, and built on the Department of Labor&apos;s own published
          figures. Each one says where its numbers come from, and says so when it
          cannot answer.
        </p>
      </header>

      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="group flex flex-col border-2 border-border bg-card p-6 shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                  {t.kind}
                </span>
              </div>
              <h2 className="mt-4 font-heading text-xl font-black leading-tight">{t.name}</h2>{" "}
              <p className="mt-3 flex-1 text-base leading-relaxed text-foreground/70">
                {t.blurb}
              </p>{" "}
              <span className="mt-5 inline-flex items-center gap-2 font-bold text-primary">
                Open
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  aria-hidden="true"
                />
              </span>
            </Link>
          );
        })}
      </section>

      <section className="mt-12 border-2 border-border bg-muted p-6 sm:p-8">
        <h2 className="font-heading text-xl font-black">
          Why some of these refuse to give you a number
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Two of the three answer questions about a queue, and a queue estimate
          is a forecast rather than a fact. Where DOL publishes enough to be sure
          you get a figure and its source. Where it does not, you get the count
          that is real and a plain statement of what is missing, rather than a
          number that looks precise because it was made up.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          The deadline calculator is the exception. Those dates are arithmetic in
          the regulations, so they are exact.
        </p>
      </section>
    </div>
  );
}
