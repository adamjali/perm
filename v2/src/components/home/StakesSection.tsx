"use client";

/**
 * StakesSection Component
 *
 * Horizontal scrolling section showing what happens when PERM deadlines are missed.
 * Repurposes JourneySection's scroll-snap + progress bar mechanic,
 * but with warning-style red/orange cards instead of stage colors.
 *
 */

import * as React from "react";
import { ArrowRightIcon, ShieldIcon, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface StakeCard {
  number: string;
  title: string;
  consequence: string;
  prevention: string;
  severity: "critical" | "high";
}

const stakes: StakeCard[] = [
  {
    number: "1",
    title: "30-Day Audit Response",
    consequence:
      "Miss DOL's 30-day audit window and the case is abandoned. No extension, no appeal, and the process starts over.",
    prevention:
      "Deadline computed for you, with alerts at 14, 7, 3 and 1 day before",
    severity: "critical",
  },
  {
    number: "2",
    title: "PWD Expiration",
    consequence:
      "A prevailing wage determination expires under 20 CFR 656.40. File after that and you start from zero.",
    prevention:
      "Expiration computed from the determination date under DOL's rules",
    severity: "critical",
  },
  {
    number: "3",
    title: "180-Day Filing Window",
    consequence:
      "The ETA 9089 must be filed 30 to 180 days after recruitment ends, and before the PWD expires. Miss the window and recruitment is redone.",
    prevention:
      "Open and close dates computed from your recruitment dates",
    severity: "high",
  },
  {
    number: "4",
    title: "I-140 Filing Deadline",
    consequence:
      "You have 180 days after PERM certification to file the I-140. Miss it and the approved labor certification expires.",
    prevention:
      "Set automatically when you enter the certification date",
    severity: "high",
  },
  {
    number: "5",
    title: "Recruitment Timing",
    consequence:
      "Sunday ads, job orders and the notice of filing each have exact timing rules. Gaps in the documentation trigger DOL audits.",
    prevention:
      "Every recruitment deadline computed, business days accounted for",
    severity: "high",
  },
];

const severityColors = {
  critical: "var(--urgency-urgent, #DC2626)",
  high: "var(--urgency-soon, #EA580C)",
};

/**
 * The ink each severity can actually carry, measured rather than assumed.
 *
 * Both badges hardcoded `color: "#fff"`, and the two backgrounds want opposite
 * inks:
 *
 *   #DC2626 (critical)  white 4.83:1   black 4.35:1
 *   #EA580C (high)      white 3.56:1   black 5.90:1
 *
 * So white was correct on one badge and failed the 4.5 floor on the other, and
 * the two sit side by side in the same row. A single literal cannot serve two
 * grounds; the pairing has to be per colour.
 */
const severityInk = {
  critical: "#fff",
  high: "#000",
};

export function StakesSection() {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  // Update progress on scroll
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth - container.clientWidth;
        const progress = scrollWidth > 0 ? (scrollLeft / scrollWidth) * 100 : 0;
        setScrollProgress(progress);
        rafRef.current = null;
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <section id="stakes" className="pt-12 pb-8 sm:pt-20 sm:pb-12 relative overflow-hidden">
      {/* Header */}
      <div className="mx-auto max-w-[1400px] px-4 pb-12 text-center sm:px-8">
        <ScrollReveal direction="up">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            The Stakes
          </div>{" "}
          <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            What a Missed Deadline Costs
          </h2>{" "}
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
            PERM filing windows are measured in days. Miss one and recruitment
            starts over.
          </p>
        </ScrollReveal>
      </div>

      {/* Horizontal Scroll Container with Timeline BEHIND cards */}
      <div className="relative w-full">
        {/* Progress Timeline - positioned BEHIND cards */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-muted"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${scrollProgress}%`,
              background: `linear-gradient(90deg,
                var(--urgency-urgent) 0%,
                var(--urgency-urgent) 40%,
                var(--urgency-soon) 70%,
                var(--urgency-soon) 100%)`,
            }}
          />
        </div>

        {/* Cards container - scroll-snap with hidden scrollbar */}
        <div
          ref={scrollContainerRef}
          className="scrollbar-hide relative flex gap-6 overflow-x-auto overscroll-x-none py-6 px-[max(1rem,calc((100vw-1400px)/2+2rem))] [&::-webkit-scrollbar]:hidden"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            zIndex: 1,
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          {stakes.map((stake) => (
            <article
              key={stake.title}
              className="group relative flex-shrink-0 w-80 border-3 border-border bg-background overflow-hidden shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg"
              style={{
                scrollSnapAlign: "center",
                borderLeftWidth: "6px",
                borderLeftColor: severityColors[stake.severity],
              }}
            >
              {/* Hazard tint at top */}
              <div
                className="absolute inset-x-0 top-0 h-24 opacity-[0.04]"
                style={{
                  background: `linear-gradient(to bottom, ${severityColors[stake.severity]}, transparent)`,
                }}
                aria-hidden="true"
              />

              {/* Subtle diagonal hazard stripes */}
              <div
                className="absolute top-0 right-0 h-16 w-16 opacity-[0.03]"
                style={{
                  background: `repeating-linear-gradient(
                    -45deg,
                    ${severityColors[stake.severity]},
                    ${severityColors[stake.severity]} 3px,
                    transparent 3px,
                    transparent 8px
                  )`,
                }}
                aria-hidden="true"
              />

              {/* Content */}
              <div className="relative p-6">
                {/* Number badge */}
                <div
                  className="absolute -top-0 right-5 flex h-10 w-10 items-center justify-center border-3 border-border font-heading text-lg font-bold shadow-hard-sm"
                  style={{
                    backgroundColor: severityColors[stake.severity],
                    color: severityInk[stake.severity],
                    top: "-1px",
                  }}
                >
                  {stake.number}
                </div>

                {/* Warning icon */}
                <div className="mb-4 flex h-[60px] items-center">
                  <div className="transition-transform duration-500 group-hover:scale-110">
                    <AlertTriangle
                      className="h-12 w-12"
                      style={{ color: severityColors[stake.severity] }}
                    />
                  </div>
                </div>

                {/* Title */}
                <h3 className="mb-2 font-heading text-xl font-bold">
                  {stake.title}
                </h3>{" "}

                {/* Consequence */}
                <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                  {stake.consequence}
                </p>

                {/* Prevention line */}
                <div className="border-t-2 border-border pt-4">
                  <div className="flex items-start gap-2">
                    <ShieldIcon
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                    />
                    <p className="text-sm font-semibold text-foreground leading-relaxed">
                      PERM Tracker prevents this:{" "}
                      <span className="font-normal text-muted-foreground">
                        {stake.prevention}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Names the set instead of instructing. "Scroll to explore" is a cue
          that tells the reader to do something they can already see is
          possible, and its arrow carried `scroll-hint-icon`, an
          `animation: infinite` pulse. The count is read off the array so it
          cannot go stale. */}
      <div className="flex flex-col items-center gap-4 pt-8">
        <div className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <span>{stakes.length} ways a case is lost</span>{" "}
          <ArrowRightIcon className="h-4 w-4" />
        </div>{" "}
        <p className="text-sm text-muted-foreground text-center">
          PERM Tracker computes every one of them.
        </p>
      </div>
    </section>
  );
}

export default StakesSection;
