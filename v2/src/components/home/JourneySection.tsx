"use client";

/**
 * JourneySection Component
 *
 * Horizontal scrolling section showing the PERM process stages.
 * Each card has a background photograph, custom SVG illustration,
 * stage-colored accents, and scroll progress timeline.
 *
 */

import * as React from "react";
import Image from "next/image";
import {
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
import {
  DocumentStackSVG,
  NewspaperAdSVG,
  CalendarDeadlineSVG,
  ShieldCheckSVG,
  SuccessCelebrationSVG,
} from "@/components/illustrations";

interface StageMeta {
  icon: typeof Clock;
  text: string;
}

interface JourneyStage {
  number: string;
  illustration: React.ReactNode;
  title: string;
  description: string;
  stage: "pwd" | "recruitment" | "eta9089" | "i140" | "success";
  bgImage: string;
  meta: StageMeta[];
}

const stages: JourneyStage[] = [
  {
    number: "1",
    illustration: <DocumentStackSVG size={70} className="text-foreground" />,
    title: "PWD Request",
    description:
      "Submit prevailing wage determination request to DOL. Processing typically takes 4-6 months.",
    stage: "pwd",
    bgImage: "/images/journey/pwd-documents.jpg",
    meta: [
      { icon: Clock, text: "4-6 months processing" },
      { icon: AlertCircle, text: "Valid for 1 year" },
    ],
  },
  {
    number: "2",
    illustration: <NewspaperAdSVG size={70} className="text-foreground" />,
    title: "Recruitment",
    description:
      "Conduct required recruitment activities including Sunday ads, job orders, and additional methods.",
    stage: "recruitment",
    bgImage: "/images/journey/recruitment-office.jpg",
    meta: [
      { icon: Newspaper, text: "2 Sunday newspaper ads" },
      { icon: Briefcase, text: "30+ day job order" },
    ],
  },
  {
    number: "3",
    illustration: <CalendarDeadlineSVG size={70} className="text-foreground" />,
    title: "ETA 9089 Filing",
    description:
      "File the PERM application 30-180 days after recruitment ends and before PWD expires.",
    stage: "eta9089",
    bgImage: "/images/journey/filing-forms.jpg",
    meta: [
      { icon: Calendar, text: "30-180 day window" },
      { icon: Hourglass, text: "6-12 months processing" },
    ],
  },
  {
    number: "4",
    illustration: <ShieldCheckSVG size={70} className="text-foreground" />,
    title: "I-140 Filing",
    description:
      "File I-140 within 180 days of PERM certification. Premium processing available.",
    stage: "i140",
    bgImage: "/images/journey/approval-stamp.jpg",
    meta: [
      { icon: Timer, text: "180 day deadline" },
      { icon: Zap, text: "Premium: 15 days" },
    ],
  },
  {
    number: "\u2713",
    illustration: <SuccessCelebrationSVG size={70} className="text-foreground" />,
    title: "Approved!",
    description:
      "I-140 approved! Your client's priority date is locked in. Green card journey continues.",
    stage: "success",
    bgImage: "/images/journey/celebration.jpg",
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

export function JourneySection() {
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
    <section id="journey" className="py-16 sm:py-24 relative overflow-hidden">
      {/* Header */}
      <div className="mx-auto max-w-[1400px] px-4 pb-16 text-center sm:px-8">
        <ScrollReveal direction="up">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Map className="h-3.5 w-3.5" />
            The PERM Process
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Every PERM Stage, Tracked
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            From PWD request to I-140 approval — we calculate every deadline, validate every step, and alert you before anything expires.
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
              className="group relative flex-shrink-0 w-80 border-3 border-border bg-background overflow-hidden shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg"
              style={{
                scrollSnapAlign: "center",
                borderLeftWidth: "6px",
                borderLeftColor: stageColors[stage.stage],
              }}
            >
              {/* Background image - subtle tint */}
              <div className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
                <Image
                  src={stage.bgImage}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="320px"
                  aria-hidden="true"
                />
              </div>

              {/* Stage color gradient at top */}
              <div
                className="absolute inset-x-0 top-0 h-20 opacity-[0.06]"
                style={{
                  background: `linear-gradient(to bottom, ${stageColors[stage.stage]}, transparent)`,
                }}
                aria-hidden="true"
              />

              {/* Content */}
              <div className="relative p-8">
                {/* Stage number badge */}
                <div
                  className="absolute -top-0 right-6 flex h-12 w-12 items-center justify-center border-3 border-border font-heading text-xl font-bold shadow-hard-sm"
                  style={{
                    backgroundColor: stageColors[stage.stage],
                    color: "#000",
                    top: "-1px",
                  }}
                >
                  {stage.number}
                </div>

                {/* Illustration */}
                <div className="mb-5 flex h-[70px] items-center">
                  <div className="transition-transform duration-500 group-hover:scale-110">
                    {stage.illustration}
                  </div>
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
