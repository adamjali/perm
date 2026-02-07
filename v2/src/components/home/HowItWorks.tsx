"use client";

/**
 * HowItWorks Component
 *
 * Three-step process showing how PERM Tracker works.
 * Each step has a custom SVG illustration, animated connector
 * with SVG draw-in effect, and bold step numbers with hover effects.
 *
 */

import * as React from "react";
import Image from "next/image";
import { Route } from "lucide-react";
import { useInView } from "motion/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useReducedMotion } from "@/lib/animations";
import {
  RocketLaunchSVG,
  CalendarDeadlineSVG,
  NotificationBellSVG,
} from "@/components/illustrations";
import VideoPlayer from "@/components/content/VideoPlayer";

interface Step {
  number: number;
  illustration: React.ReactNode;
  title: string;
  description: string;
  bgImage: string;
  accentColor: string;
}

const steps: Step[] = [
  {
    number: 1,
    illustration: <RocketLaunchSVG size={80} className="text-foreground" />,
    title: "Sign Up Free",
    description: "Create your account with Google in one click. No credit card, no setup fee, no trial limits.",
    bgImage: "/images/hero/legal-office-wide.jpg",
    accentColor: "var(--primary)",
  },
  {
    number: 2,
    illustration: <CalendarDeadlineSVG size={80} className="text-foreground" />,
    title: "Add Your Cases",
    description: "Enter case details and key dates. Every downstream deadline — PWD expiration, filing windows, I-140 cutoffs — calculates automatically.",
    bgImage: "/images/features/calendar-planning.jpg",
    accentColor: "var(--stage-eta9089)",
  },
  {
    number: 3,
    illustration: <NotificationBellSVG size={80} className="text-foreground" />,
    title: "Never Miss a Deadline",
    description: "Get email and push alerts before deadlines hit. Sync to Google Calendar. Your whole team stays on the same page.",
    bgImage: "/images/features/notification-phone.jpg",
    accentColor: "var(--stage-pwd)",
  },
];

/**
 * Animated SVG connector between steps.
 * Draws a line from left to right with a traveling dot and arrow reveal.
 */
function AnimatedConnector({
  isInView,
  reducedMotion,
  delay,
}: {
  isInView: boolean;
  reducedMotion: boolean;
  delay: number;
}) {
  const [lineDrawn, setLineDrawn] = React.useState(false);

  // Track when line draw completes to trigger dot + arrow
  React.useEffect(() => {
    if (reducedMotion || !isInView) return;
    const timer = setTimeout(
      () => setLineDrawn(true),
      delay * 1000 + 800 // delay + draw duration
    );
    return () => clearTimeout(timer);
  }, [isInView, reducedMotion, delay]);

  // Line length matches the SVG viewBox width
  const LINE_LENGTH = 200;

  return (
    <div
      className="absolute hidden md:block"
      style={{
        top: "52px",
        left: "calc(50% + 48px)",
        width: "calc(100% - 96px)",
        height: "12px",
        zIndex: 1,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${LINE_LENGTH} 12`}
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ overflow: "visible" }}
      >
        {/* Main line with draw-in effect */}
        <line
          x1="0"
          y1="6"
          x2={LINE_LENGTH}
          y2="6"
          stroke="var(--border)"
          strokeWidth="3"
          strokeDasharray={LINE_LENGTH}
          strokeDashoffset={
            reducedMotion ? 0 : isInView ? 0 : LINE_LENGTH
          }
          style={{
            transition: reducedMotion
              ? "none"
              : `stroke-dashoffset 0.8s ease-out ${delay}s`,
          }}
        />

        {/* Traveling dot */}
        {!reducedMotion && (
          <circle
            cx="0"
            cy="6"
            r="3"
            fill="var(--primary)"
            opacity={isInView && lineDrawn ? 1 : 0}
            style={{
              transition: "opacity 0.15s",
            }}
          >
            {lineDrawn && (
              <animate
                attributeName="cx"
                from="0"
                to={String(LINE_LENGTH)}
                dur="1s"
                fill="freeze"
                begin="0s"
              />
            )}
          </circle>
        )}

        {/* Arrow at end */}
        <polygon
          points={`${LINE_LENGTH},6 ${LINE_LENGTH - 8},1 ${LINE_LENGTH - 8},11`}
          fill="var(--border)"
          opacity={reducedMotion ? 1 : lineDrawn ? 1 : 0}
          style={{
            transition: reducedMotion
              ? "none"
              : "opacity 0.3s ease-out",
          }}
        />
      </svg>
    </div>
  );
}

export function HowItWorks() {
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const reducedMotion = useReducedMotion();

  return (
    <section id="how" className="relative bg-muted">
      {/* Content container */}
      <div ref={sectionRef} className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 sm:py-28">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Route className="h-3.5 w-3.5" />
            Simple Process
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Get Started in 3 Steps
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
            From signup to case tracking in under a minute.
          </p>
        </ScrollReveal>

        {/* Step cards with connectors - single stagger container */}
        <ScrollReveal direction="up" stagger className="relative grid gap-0 md:grid-cols-3">
          {steps.map((step, index) => (
              <div key={step.number} className="group relative text-center px-6 py-8">
                {/* Animated SVG connector line */}
                {index < steps.length - 1 && (
                  <AnimatedConnector
                    isInView={isInView}
                    reducedMotion={reducedMotion}
                    delay={index === 0 ? 0.3 : 0.6}
                  />
                )}

                {/* Step number - big and bold with spring hover */}
                <div className="relative z-10 mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center border-3 border-border bg-primary text-2xl font-heading font-black text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 hover:rotate-[-3deg]">
                  {step.number}
                </div>

                {/* Illustration card */}
                <div className="relative mx-auto mb-6 h-24 w-24 overflow-hidden border-2 border-border/30 bg-background/50 p-2">
                  {/* Background image tint */}
                  <div className="absolute inset-0 opacity-[0.06]">
                    <Image
                      src={step.bgImage}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="96px"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="relative flex h-full w-full items-center justify-center transition-transform duration-500 group-hover:scale-110">
                    {step.illustration}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-heading text-xl font-bold mb-2">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-[15px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                  {step.description}
                </p>
              </div>
          ))}
        </ScrollReveal>

        {/* Product screenshots — see it in action */}
        <ScrollReveal direction="up" delay={0.3} className="mt-16">
          <div className="text-center mb-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              See it in action
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                src: "/images/screenshots/dashboard.png",
                alt: "PERM Tracker dashboard showing deadline hub with overdue, this week, and upcoming deadlines",
                label: "Deadline Hub",
              },
              {
                src: "/images/screenshots/cases.png",
                alt: "Cases view with filterable case cards showing status, deadlines, and progress",
                label: "Case Cards",
              },
              {
                src: "/images/screenshots/calendar.png",
                alt: "Calendar view with color-coded PERM deadlines and AI assistant chat",
                label: "Calendar + AI Chat",
              },
            ].map((screenshot) => (
              <div key={screenshot.label} className="group">
                <div className="border-3 border-border shadow-hard overflow-hidden transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                  {/* Mini browser chrome */}
                  <div className="flex items-center gap-1.5 border-b-2 border-border bg-foreground px-3 py-1.5">
                    <div className="h-2 w-2 bg-[#FF5F57]" />
                    <div className="h-2 w-2 bg-[#FFBD2E]" />
                    <div className="h-2 w-2 bg-[#28CA41]" />
                    <span className="ml-2 font-mono text-[9px] text-background/50">
                      {screenshot.label}
                    </span>
                  </div>
                  <Image
                    src={screenshot.src}
                    alt={screenshot.alt}
                    width={800}
                    height={500}
                    className="w-full transition-transform duration-500 group-hover:scale-[1.02]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 450px"
                  />
                </div>
                <p className="mt-3 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {screenshot.label}
                </p>
              </div>
            ))}
          </div>

          {/* Product demo video */}
          <div className="mt-12 mx-auto max-w-3xl">
            <div className="text-center mb-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Watch the full demo
              </p>
            </div>
            <div className="border-3 border-border shadow-hard overflow-hidden">
              <div className="flex items-center gap-1.5 border-b-2 border-border bg-foreground px-3 py-1.5">
                <div className="h-2 w-2 bg-[#FF5F57]" />
                <div className="h-2 w-2 bg-[#FFBD2E]" />
                <div className="h-2 w-2 bg-[#28CA41]" />
                <span className="ml-2 font-mono text-[9px] text-background/50">
                  Product Demo
                </span>
              </div>
              <VideoPlayer videoId="ProductDemo" className="border-0 shadow-none" autoPlay loop />
            </div>
          </div>

          {/* Create case GIF — shows auto-calculated deadlines */}
          <div className="mt-12 mx-auto max-w-3xl">
            <div className="text-center mb-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Auto-calculated deadlines in action
              </p>
            </div>
            <div className="group border-3 border-border shadow-hard overflow-hidden transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
              <div className="flex items-center gap-1.5 border-b-2 border-border bg-foreground px-3 py-1.5">
                <div className="h-2 w-2 bg-[#FF5F57]" />
                <div className="h-2 w-2 bg-[#FFBD2E]" />
                <div className="h-2 w-2 bg-[#28CA41]" />
                <span className="ml-2 font-mono text-[9px] text-background/50">
                  Create Case
                </span>
              </div>
              {/* GIF can't use Next.js Image — use raw img with lazy loading */}
              <figure className="not-prose">
                <img
                  src="/images/screenshots/create-case.gif"
                  alt="Creating a new PERM case with automatic deadline calculation"
                  loading="lazy"
                  className="w-full"
                />
              </figure>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default HowItWorks;
