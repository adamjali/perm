import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarClock, FileText, Scale } from "lucide-react";

/**
 * The calculators, on the homepage.
 *
 * Laid out as the process itself rather than as a grid of cards, because the
 * order carries information: the wage determination gates everything, the
 * recruitment window is the only stage the employer paces, and the two queues
 * either side of it belong to DOL and USCIS. A row of five equal cards would
 * say none of that, and a band of nothing but text is the flattest thing a
 * page can do.
 *
 * A server component with no live figures, so the homepage stays static. The
 * numbers live on the tool pages, which revalidate hourly.
 */

const STAGES = [
  {
    href: "/tools/pwd-calculator",
    icon: Scale,
    stage: "First",
    name: "Prevailing wage",
    question: "How many requests are ahead of mine?",
    owner: "DOL decides the pace",
  },
  {
    href: "/tools/perm-deadline-calculator",
    icon: CalendarCheck,
    stage: "Then",
    name: "Your deadlines",
    question: "By when must I file?",
    owner: "You set the pace",
  },
  {
    href: "/tools/perm-timeline-calculator",
    icon: CalendarClock,
    stage: "Then",
    name: "PERM decision",
    question: "When will DOL decide?",
    owner: "DOL decides the pace",
  },
  {
    href: "/tools/i140-calculator",
    icon: FileText,
    stage: "Finally",
    name: "I-140 petition",
    question: "How deep is the queue?",
    owner: "USCIS decides the pace",
  },
] as const;

export function ToolsSection() {
  return (
    <section id="tools" className="border-t-2 border-border py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-black leading-tight sm:text-4xl">
            Free calculators, on the government&apos;s own numbers
          </h2>{" "}
          <p className="mt-4 text-lg leading-relaxed text-foreground/70">
            Four stages, four questions. Each one answers from what DOL and USCIS
            publish, says where the figure came from, and says so when the data
            cannot answer.
          </p>
        </div>

        {/* The strip reads left to right on desktop and top to bottom on a
            phone, which is the order the stages actually happen in. */}
        <ol className="mt-12 grid gap-4 md:grid-cols-4">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const isYours = s.owner.startsWith("You");
            return (
              <li key={s.href} className="flex">
                <Link
                  href={s.href}
                  className="group flex w-full flex-col border-2 border-border bg-card p-6 shadow-hard transition-all duration-150 hover:-translate-y-[2px] hover:shadow-hard-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/45">
                      {s.stage}
                    </span>
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-black leading-tight">
                    {s.name}
                  </h3>{" "}
                  {/* JSX drops the newline between these two, so an extractor
                      reads "Prevailing wageHow many requests..." as one word. */}
                  <p className="mt-2 flex-1 text-base leading-relaxed text-foreground/70">
                    {s.question}
                  </p>{" "}
                  {/* The one stage the employer controls is the one that
                      restarts the case when it is missed, so it is marked. */}
                  <span
                    className={
                      isYours
                        ? "mt-4 inline-block border-2 border-border bg-primary px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground"
                        : "mt-4 inline-block text-[11px] font-bold uppercase tracking-wider text-foreground/45"
                    }
                  >
                    {s.owner}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/tools"
            className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg"
          >
            See all calculators
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/tools/green-card-timeline"
            className="inline-flex min-h-[44px] items-center underline underline-offset-4 hover:text-primary"
          >
            Or see the whole timeline at once
          </Link>
        </div>
      </div>
    </section>
  );
}

export default ToolsSection;
