import Link from "next/link";

import { ArrowRight } from "./icons";
import {
  BulletinStepsMini,
  QueueDepthMini,
  TapeMini,
  TwoBarsMini,
} from "@/components/tools/MiniDiagrams";

/**
 * The four stages, addressed to the person inside them.
 *
 * THE H2 SPEAKS TO THE APPLICANT ON PURPOSE. Every heading below the hero
 * used to address practitioners ("Built for PERM Practitioners", "For a
 * caseload"), and heading structure is what an answer engine aggregates into
 * "who this product is for" - so the consumer half of the product was
 * invisible at exactly the level machines read. This section is the
 * counterweight, and it earns its place by being useful rather than by
 * being a label: each stage names its own question and links the tool that
 * answers it plus the data behind it.
 *
 * Stage colors come from the design system's stage tokens, applied as a top
 * border so the strip reads as one system with four members, not four
 * designs.
 */

const STAGES = [
  {
    tag: "Stage 1",
    name: "Prevailing wage",
    agency: "Reviewed by the Department of Labor",
    question: "How long is the PWD taking?",
    detail:
      "A separate DOL queue most tools skip entirely, split into OEWS and non-OEWS.",
    viz: QueueDepthMini,
    tool: { label: "PWD timeline", href: "/tools/pwd-calculator" },
    data: { label: "Processing times", href: "/perm-processing-times" },
    border: "border-t-stage-pwd",
  },
  {
    tag: "Stage 2",
    name: "PERM",
    agency: "Reviewed by the Department of Labor",
    question: "When will my PERM be approved?",
    detail:
      "DOL's word is certified. Check your case number, or estimate from your filing month.",
    viz: TapeMini,
    tool: { label: "PERM timeline", href: "/tools/perm-timeline-calculator" },
    data: { label: "Check a case", href: "/perm-case-status" },
    border: "border-t-stage-eta9089",
  },
  {
    tag: "Stage 3",
    name: "I-140",
    agency: "Reviewed by USCIS",
    question: "How long does the I-140 take?",
    detail:
      "USCIS's petition stage, with premium processing and a 180-day clock that matters in a layoff.",
    viz: TwoBarsMini,
    tool: { label: "I-140 timeline", href: "/tools/i140-calculator" },
    data: { label: "I-140 trends", href: "/tools/i140-trends" },
    border: "border-t-stage-i140",
  },
  {
    // SPLIT FROM WHAT WAS ONE "STAGE 4". Waiting for a priority date to become
    // current and filing the adjustment are two different waits, run by two
    // different bodies, and merging them hid the one thing a reader in that
    // position most needs to see: that the bulletin can be current and the
    // I-485 still take a year.
    tag: "Stage 4",
    name: "Visa bulletin",
    agency: "Cutoffs published monthly by the State Department",
    question: "When is my priority date current?",
    detail:
      "The bulletin decides when a visa number is available at all. We hold 84 months of its history.",
    viz: BulletinStepsMini,
    tool: { label: "Cutoff history", href: "/tools/priority-date-calculator" },
    data: null,
    border: "border-t-stage-recruitment",
  },
  {
    tag: "Stage 4",
    name: "I-485",
    agency: "Reviewed by USCIS, or consular processing by the State Department",
    question: "How long does the adjustment take?",
    detail:
      "The last step, once a visa number is available. Filed with USCIS inside the US, or at a consulate abroad.",
    viz: TwoBarsMini,
    tool: { label: "Queue position", href: "/tools/i485-queue-position" },
    data: null,
    border: "border-t-stage-recruitment",
  },
] as const;

export function StageStrip() {
  return (
    <section className="border-b-3 border-border bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-20">
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          The whole road
        </p>{" "}
        <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
          Waiting on your green card? Every stage, measured
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
          PERM is only one stage of four, each with its own processing time.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 [&>*]:min-w-0 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {STAGES.map((s) => (
            <div
              key={s.name}
              className={`group flex flex-col border-3 border-border border-t-[6px] bg-card p-5 shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg ${s.border}`}
            >
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {s.tag}
              </span>{" "}
              <span className="mt-1 font-heading text-xl font-black">
                {s.name}
              </span>{" "}
              {/* WHO DECIDES THIS STAGE. Four stages run by three different
                  agencies is the fact that explains why the waits are
                  unrelated to each other, and the strip never said it. */}
              <span className="mt-1 text-sm leading-snug text-foreground/60">
                {s.agency}
              </span>{" "}
              {/* One drawing per stage from the calculators' own mini-diagram
                  kit, so the strip and the tools read as one system. Each
                  depicts the stage's actual mechanism: the PWD's two queues,
                  DOL's month tape, USCIS's two service centers, the
                  bulletin's stepped cutoffs. */}
              <span className="mt-3 block w-full max-w-[180px] text-foreground">
                <s.viz />
              </span>{" "}
              <span className="mt-2 font-bold">{s.question}</span>{" "}
              <span className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">
                {s.detail}
              </span>{" "}
              <span className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <Link
                  href={s.tool.href}
                  className="inline-flex min-h-[44px] items-center gap-1.5 font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
                >
                  {s.tool.label} <ArrowRight />
                </Link>{" "}
                {s.data ? (
                  <Link
                    href={s.data.href}
                    className="inline-flex min-h-[44px] items-center font-bold underline underline-offset-4 hover:text-primary"
                  >
                    {s.data.label}
                  </Link>
                ) : null}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-base text-foreground/70">
          Or see them drawn to scale:{" "}
          <Link
            href="/tools/green-card-timeline"
            className="font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            the whole green card timeline
          </Link>
        </p>
      </div>
    </section>
  );
}
