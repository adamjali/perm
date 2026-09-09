import type { Metadata } from "next";
import Link from "next/link";

import { BADGE_KINDS, type BadgeKind } from "@/lib/badge";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The embeddable badges and how to embed them. Each badge carries one figure
 * DOL itself publishes, regenerated daily, so a forum signature or a README
 * shows DOL's current queue month without anyone editing it.
 */

const TITLE = "PERM Queue Badges";
const DESCRIPTION =
  "Three embeddable SVG badges, regenerated daily from DOL's own figures: the PERM queue month, the average decision days and the wage-request month.";
const PATH = "/badges";
const ORIGIN = "https://permtracker.app";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/badges" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "badges");

export const dynamic = "force-static";

const ABOUT: Record<BadgeKind, { title: string; what: string; href: string }> = {
  "perm-queue": { title: "PERM queue", what: "The filing month DOL's analysts are working, from DOL's processing-times page.", href: "/perm-queue" },
  "perm-days": { title: "PERM decision", what: "DOL's published average calendar days to an analyst-review determination.", href: "/perm-processing-times" },
  "pwd-queue": { title: "Wage requests", what: "The month the National Prevailing Wage Center is working for PERM requests on OEWS wages.", href: "/tools/pwd-calculator" },
};

export default function BadgesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/methodology" className="underline underline-offset-2 hover:text-primary">
            Reference
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Badges</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          A small image that shows DOL&apos;s current figure wherever you paste it, regenerated once a day. Each one
          carries a number DOL publishes and the page it comes from. No estimates, nothing of ours.
        </p>
      </header>

      <div className="mt-10 space-y-8">
        {BADGE_KINDS.map((kind) => {
          const a = ABOUT[kind];
          const src = `${ORIGIN}/badge/${kind}.svg`;
          const md = `[![${a.title}](${src})](${ORIGIN}${a.href})`;
          const html = `<a href="${ORIGIN}${a.href}"><img src="${src}" alt="${a.title}, from permtracker.app" height="20"></a>`;
          return (
            <section key={kind} className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
              <h2 className="font-heading text-xl font-black">{a.title}</h2>{" "}
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground/70">{a.what}</p>{" "}
              <p className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- an SVG badge served by this site's own route, shown at its natural size */}
                <img src={`/badge/${kind}.svg`} alt={`${a.title} badge`} height={20} className="h-5 w-auto" />
              </p>{" "}
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Markdown</p>{" "}
                  <pre className="mt-1 overflow-x-auto border-2 border-border bg-background p-3 font-mono text-xs leading-relaxed">
                    <code>{md}</code>
                  </pre>
                </div>{" "}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">HTML</p>{" "}
                  <pre className="mt-1 overflow-x-auto border-2 border-border bg-background p-3 font-mono text-xs leading-relaxed">
                    <code>{html}</code>
                  </pre>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">What a badge says, and what it does not</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Each badge is rendered from DOL&apos;s processing-times page as this site last read it, and is cached for a
          day. On a day DOL published no figure for one of them, the badge says so instead of showing an old number.
          None of them carries an estimate; the estimator&apos;s own record is on{" "}
          <Link href="/estimate-scorecard" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the scorecard
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
