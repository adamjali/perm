"use client";

/**
 * JourneySection Component
 *
 * Horizontal scrolling section showing the PERM process stages.
 * Features stage cards with color-coded indicators and scroll progress.
 *
 */

import * as React from "react";
import {
  FileSearch,
  Users,
  FileText,
  Stamp,
  Trophy,
  Clock,
  AlertCircle,
  Newspaper,
  Briefcase,
  Calendar,
  Hourglass,
  Timer,
  Zap,
  CheckCircle,
  Award,
  Map,
  ArrowRight,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// ============================================================================
// STAGE DATA
// ============================================================================

interface StageMeta {
  icon: typeof Clock;
  text: string;
}

interface JourneyStage {
  number: string;
  icon: typeof FileSearch;
  title: string;
  description: string;
  stage: "pwd" | "recruitment" | "eta9089" | "i140" | "success";
  meta: StageMeta[];
}

const stages: JourneyStage[] = [
  {
    number: "1",
    icon: FileSearch,
    title: "PWD Request",
    description:
      "Submit prevailing wage determination request to DOL. Processing typically takes 4-6 months.",
    stage: "pwd",
    meta: [
      { icon: Clock, text: "4-6 months processing" },
      { icon: AlertCircle, text: "Valid for 1 year" },
    ],
  },
  {
    number: "2",
    icon: Users,
    title: "Recruitment",
    description:
      "Conduct required recruitment activities including Sunday ads, job orders, and additional methods.",
    stage: "recruitment",
    meta: [
      { icon: Newspaper, text: "2 Sunday newspaper ads" },
      { icon: Briefcase, text: "30+ day job order" },
    ],
  },
  {
    number: "3",
    icon: FileText,
    title: "ETA 9089 Filing",
    description:
      "File the PERM application 30-180 days after recruitment ends and before PWD expires.",
    stage: "eta9089",
    meta: [
      { icon: Calendar, text: "30-180 day window" },
      { icon: Hourglass, text: "6-12 months processing" },
    ],
  },
  {
    number: "4",
    icon: Stamp,
    title: "I-140 Filing",
    description:
      "File I-140 within 180 days of PERM certification. Premium processing available.",
    stage: "i140",
    meta: [
      { icon: Timer, text: "180 day deadline" },
      { icon: Zap, text: "Premium: 15 days" },
    ],
  },
  {
    number: "\u2713",
    icon: Trophy,
    title: "Approved!",
    description:
      "I-140 approved! Your client's priority date is locked in. Green card journey continues.",
    stage: "success",
    meta: [
      { icon: CheckCircle, text: "Priority date secured" },
      { icon: Award, text: "Case complete" },
    ],
  },
];

// Stage color mapping
const stageColors: Record<JourneyStage["stage"], string> = {
  pwd: "var(--stage-pwd)",
  recruitment: "var(--stage-recruitment)",
  eta9089: "var(--stage-eta9089)",
  i140: "var(--stage-i140)",
  success: "var(--stage-success)",
};

// ============================================================================
// COMPONENT
// ============================================================================

export function JourneySection() {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  // Update progress on scroll
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Throttle with requestAnimationFrame
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
    <section id="journey" className="py-16 sm:py-24 relative overflow-hidden">
      {/* Header */}
      <div className="mx-auto max-w-[1400px] px-4 pb-16 text-center sm:px-8">
        <ScrollReveal direction="up">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Map className="h-3.5 w-3.5" />
            The PERM Process
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Your Immigration Journey
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Follow the complete PERM labor certification process from start to
            finish. We track every deadline so you don&apos;t have to.
          </p>
        </ScrollReveal>
      </div>

      {/* Horizontal Scroll Container with Timeline BEHIND cards */}
      <div className="relative w-full">
        {/* Progress Timeline - positioned BEHIND cards */}
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-muted"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${scrollProgress}%`,
              background: `linear-gradient(90deg,
                var(--stage-pwd) 0%,
                var(--stage-recruitment) 25%,
                var(--stage-eta9089) 50%,
                var(--stage-i140) 75%,
                var(--stage-success) 100%)`,
            }}
          />
        </div>

        {/* Cards container - scroll-snap with hidden scrollbar */}
        <div
          ref={scrollContainerRef}
          className="journey-scroll-container scrollbar-hide relative flex gap-8 overflow-x-auto py-8 px-[max(1rem,calc((100vw-1400px)/2+2rem))] [&::-webkit-scrollbar]:hidden"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            zIndex: 1,
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >

          {stages.map((stage) => (
            <article
              key={stage.title}
              className="relative flex-shrink-0 w-80 border-3 border-border bg-background p-8 shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg"
              style={{
                scrollSnapAlign: "center",
                borderLeftWidth: "6px",
                borderLeftColor: stageColors[stage.stage],
              }}
            >
              {/* Stage number badge */}
              <div
                className="absolute -top-4 right-6 flex h-12 w-12 items-center justify-center border-3 border-border font-heading text-xl font-bold shadow-hard-sm"
                style={{
                  backgroundColor: stageColors[stage.stage],
                  color: "#000",
                }}
              >
                {stage.number}
              </div>

              {/* Icon */}
              <div
                className="mb-6 inline-flex h-12 w-12 items-center justify-center border-2 border-border bg-muted"
                style={{ color: stageColors[stage.stage] }}
              >
                <stage.icon className="h-6 w-6" />
              </div>

              {/* Title */}
              <h3 className="mb-2 font-heading text-xl font-bold">
                {stage.title}
              </h3>

              {/* Description */}
              <p className="mb-6 text-[15px] leading-relaxed text-muted-foreground">
                {stage.description}
              </p>

              {/* Meta items */}
              <div className="flex flex-col gap-2">
                {stage.meta.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 font-mono text-xs text-muted-foreground"
                  >
                    <item.icon
                      className="h-3.5 w-3.5"
                      style={{ color: stageColors[stage.stage] }}
                    />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="flex items-center justify-center gap-2 pt-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>Scroll to explore</span>
        <ArrowRight className="h-4 w-4 scroll-hint-icon" />
      </div>
    </section>
  );
}

export default JourneySection;
