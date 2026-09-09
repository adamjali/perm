import type { Metadata } from "next";
import Link from "next/link";

import { correctionsSorted } from "@/lib/corrections";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The corrections log. A site that publishes numbers gets some wrong; the
 * question is whether it says so where readers can see. Every entry names
 * what was said, what was true and what changed, and nothing is removed.
 */

const TITLE = "Corrections";
const DESCRIPTION =
  "Every published claim this site got wrong, dated: what it said, what was true, and what changed. Entries are added and never removed.";
const PATH = "/corrections";

export const metadata: Metadata = withSocialCard({
  title: `${TITLE}: What This Site Got Wrong, and When`,
  description: DESCRIPTION,
  alternates: { canonical: "/corrections" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "corrections");

export const dynamic = "force-static";

const long = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export default function CorrectionsPage() {
  const items = correctionsSorted();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/methodology" className="underline underline-offset-2 hover:text-primary">
            Reference
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Corrections</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          What this site published that was wrong, what was true, and what
          changed. The bar for an entry is a reader who could have believed
          something false from a page. Entries are added and never removed.
        </p>
      </header>

      <ol className="mt-10 space-y-6">
        {items.map((c) => (
          <li key={`${c.date}-${c.where}`} className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time dateTime={c.date} className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                {long(c.date)}
              </time>{" "}
              <span className="font-heading text-lg font-black">{c.where}</span>
            </p>{" "}
            <dl className="mt-4 grid grid-cols-1 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-6 sm:gap-y-3">
              <dt className="text-sm font-bold">What it said</dt>{" "}
              <dd className="text-sm leading-relaxed text-foreground/80">{c.said}</dd>{" "}
              <dt className="text-sm font-bold">What was true</dt>{" "}
              <dd className="text-sm leading-relaxed text-foreground/80">{c.truth}</dd>{" "}
              <dt className="text-sm font-bold">What changed</dt>{" "}
              <dd className="text-sm leading-relaxed text-foreground/80">
                {c.fix}
                {c.href ? (
                  <>
                    {" "}
                    <Link href={c.href} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                      See the page
                    </Link>
                  </>
                ) : null}
              </dd>
            </dl>{" "}
          </li>
        ))}
      </ol>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">What counts</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          A wrong figure, a wrong date, a wrong description of what the site can do, or a rule stated incorrectly, on a
          page a reader could see. Internal bugs that never reached a page are in the{" "}
          <Link href="/changelog" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            changelog
          </Link>{" "}
          when they matter and nowhere when they do not. Estimates that missed are not corrections; they are scored on{" "}
          <Link href="/estimate-scorecard" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the scorecard
          </Link>
          . To report something wrong, write to{" "}
          <a href="mailto:support@permtracker.app?subject=Correction" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            support@permtracker.app
          </a>
          .
        </p>
      </section>
    </div>
  );
}
