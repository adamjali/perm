import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarDot as CalendarClock, FileText, Scales as Scale } from "@phosphor-icons/react/ssr";

import { formatMonth } from "@/lib/dolFormat";
import { QueueDepthMini, TapeMini, WindowSpansMini } from "@/components/tools/MiniDiagrams";

/**
 * The calculators, on the homepage, drawn as the process itself.
 *
 * The first version was four identical cards in a row, which is the flattest
 * thing a page can do. This one puts the information in the STRUCTURE: a rail
 * runs through all four stages in the order they happen, each stage carries an
 * oversized numeral and its own tone (the one stage the employer paces is the
 * inverted one), and where the page already holds a live figure, the stage
 * shows it — evidence in the card, not adjectives.
 */

export interface ToolsSectionProps {
  /** Live figures from the page's one snapshot fetch. All optional. */
  pwdPending?: number | null;
  frontierMonth?: string | null;
  averageDays?: number | null;
}

export function ToolsSection({ pwdPending, frontierMonth, averageDays }: ToolsSectionProps) {
  const STAGES = [
    {
      href: "/tools/pwd-calculator",
      icon: Scale,
      n: "01",
      viz: "queue" as const,
      name: "Prevailing wage",
      question: "How many requests are ahead of mine?",
      owner: "DOL decides the pace",
      tone: "card" as const,
      stat: pwdPending != null ? `${pwdPending.toLocaleString("en-US")} pending` : null,
    },
    {
      href: "/tools/perm-deadline-calculator",
      icon: CalendarCheck,
      n: "02",
      viz: "spans" as const,
      name: "Your deadlines",
      question: "By when must we file?",
      owner: "You set the pace",
      tone: "ink" as const,
      stat: "Exact under 20 CFR 656",
    },
    {
      href: "/tools/perm-timeline-calculator",
      icon: CalendarClock,
      n: "03",
      viz: "tape" as const,
      name: "PERM decision",
      question: "When will DOL decide?",
      owner: "DOL decides the pace",
      tone: "tint" as const,
      stat: frontierMonth
        ? `Now deciding ${formatMonth(frontierMonth)}`
        : averageDays != null
          ? `${averageDays} days on average`
          : null,
    },
    {
      href: "/tools/i140-calculator",
      icon: FileText,
      n: "04",
      viz: "queue-deep" as const,
      name: "I-140 petition",
      question: "How deep is the queue?",
      owner: "USCIS decides the pace",
      tone: "card" as const,
      stat: null,
    },
  ];

  // No top border here: page.tsx draws this seam with a `comb` SectionDivider,
  // and a flat rule sitting below the silhouette reads as a stray line.
  return (
    <section id="tools" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
            The process, in order
          </p>{" "}
          <h2 className="mt-2 font-heading text-3xl font-black leading-tight sm:text-4xl">
            Four stages, four questions
          </h2>{" "}
          <p className="mt-4 text-lg leading-relaxed text-foreground/70">
            Free calculators on the government&apos;s own numbers. Each one says
            where its figure came from, and says so when the data can’t answer.
          </p>
        </div>

        {/* The rail: a hard line running through the four stages, numerals
            sitting on it. Reads left to right on desktop, top to bottom on a
            phone — the order the stages actually happen in. */}
        <ol className="relative mt-14 grid gap-x-4 gap-y-10 md:grid-cols-4">
          <span
            aria-hidden="true"
            className="absolute -top-5 left-4 hidden h-1 w-[calc(100%-2rem)] bg-border md:block"
          />
          <span
            aria-hidden="true"
            className="absolute -left-1 top-4 block h-[calc(100%-2rem)] w-1 bg-border md:hidden"
          />
          {STAGES.map((s) => {
            const Icon = s.icon;
            const ink = s.tone === "ink";
            return (
              <Fragment key={s.href}>{" "}
              <li className="relative flex">
                {/* The numeral sits ON the rail. */}
                <span
                  aria-hidden="true"
                  className={
                    "absolute z-10 flex h-9 w-9 items-center justify-center border-2 border-border font-mono text-sm font-bold shadow-hard-sm " +
                    "-left-5 top-1 md:-top-9 md:left-4 " +
                    (ink ? "bg-primary text-black" : "bg-background")
                  }
                >
                  {s.n}
                </span>
                <Link
                  href={s.href}
                  className={
                    "group flex w-full flex-col border-2 border-border p-6 pl-8 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:-translate-y-[2px] hover:shadow-hard-lg md:pl-6 md:pt-8  active:translate-y-0 active:shadow-hard-sm " +
                    (ink
                      ? "bg-foreground text-background shadow-hard"
                      : s.tone === "tint"
                        ? "bg-tint-primary shadow-hard"
                        : "bg-card shadow-hard")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                    {s.stat ? (
                      <span
                        className={
                          "border px-1.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider " +
                          (ink
                            ? "border-background/30 text-background/80"
                            : "border-border/40 text-foreground/60")
                        }
                      >
                        {s.stat}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-black leading-tight">{s.name}</h3>{" "}
                  {/* The stage's idea, drawn: a queue is depth, a window is
                      spans, the DOL line is the tape. */}
                  <div className="mt-3 max-w-[150px]">
                    {s.viz === "queue" ? <QueueDepthMini /> : null}
                    {s.viz === "spans" ? <WindowSpansMini /> : null}
                    {s.viz === "tape" ? <TapeMini /> : null}
                    {s.viz === "queue-deep" ? <QueueDepthMini deep /> : null}
                  </div>{" "}
                  <p
                    className={
                      "mt-2 flex-1 text-base leading-relaxed " +
                      (ink ? "text-background/70" : "text-foreground/70")
                    }
                  >
                    {s.question}
                  </p>{" "}
                  {/* The one stage the employer controls restarts the case
                      when it is missed, so it is the marked one. */}
                  <span
                    className={
                      s.owner.startsWith("You")
                        ? "mt-4 inline-block border-2 border-border bg-primary px-2 py-1 text-xs font-bold uppercase tracking-wider text-black"
                        : "mt-4 inline-block text-xs font-bold uppercase tracking-wider " +
                          (ink ? "text-background/50" : "text-foreground/50")
                    }
                  >
                    {s.owner}
                  </span>
                </Link>
              </li>
              </Fragment>
            );
          })}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/calculators"
            className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
          >
            See all six calculators
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/tools/green-card-timeline"
            className="inline-flex min-h-[44px] items-center underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            Or see the whole timeline at once
          </Link>
        </div>
      </div>
    </section>
  );
}

export default ToolsSection;
