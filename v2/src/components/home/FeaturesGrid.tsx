"use client";

/**
 * FeaturesGrid Component
 *
 * Six-card grid showcasing PERM Tracker features.
 * Each card has a custom SVG illustration, background image tint,
 * animated hover states, and neobrutalist styling.
 *
 */

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import {
  CalendarDeadlineSVG,
  NotificationBellSVG,
  CalendarSyncSVG,
  TimelineSVG,
  ShieldCheckSVG,
} from "@/components/illustrations";

interface Feature {
  title: string;
  description: string;
  illustration: React.ReactNode;
  bgImage: string;
  accentColor: string;
}

const features: Feature[] = [
  {
    title: "Auto Deadline Calculation",
    description:
      "Enter one date and every downstream deadline updates instantly — PWD expiration, filing windows, I-140 cutoffs. No more manual math or spreadsheet formulas.",
    illustration: <CalendarDeadlineSVG size={100} className="text-foreground" />,
    bgImage: "/images/features/calendar-planning.jpg",
    accentColor: "var(--stage-pwd)",
  },
  {
    title: "Deadline Alerts",
    description:
      "Get email and push notifications before deadlines hit. Your team stays informed even when you're in court or on vacation.",
    illustration: <NotificationBellSVG size={100} className="text-foreground" />,
    bgImage: "/images/features/notification-phone.jpg",
    accentColor: "var(--primary)",
  },
  {
    title: "Google Calendar Sync",
    description:
      "Every PERM deadline appears on your Google Calendar automatically. Access your filing schedule from any device.",
    illustration: <CalendarSyncSVG size={100} className="text-foreground" />,
    bgImage: "/images/features/team-meeting.jpg",
    accentColor: "var(--stage-recruitment)",
  },
  {
    title: "Visual Case Timeline",
    description:
      "See exactly where each case stands with a color-coded timeline. Instantly spot which cases need attention and which are on track.",
    illustration: (
      <div className="flex items-center justify-center w-[100px] h-[100px]">
        <TimelineSVG size={180} className="text-foreground" />
      </div>
    ),
    bgImage: "/images/journey/filing-forms.jpg",
    accentColor: "var(--stage-eta9089)",
  },
  {
    title: "DOL Compliance Checks",
    description:
      "Built-in validation catches missing recruitment steps, expired PWDs, and filing window violations before they become audit problems.",
    illustration: <ShieldCheckSVG size={100} className="text-foreground" />,
    bgImage: "/images/journey/pwd-documents.jpg",
    accentColor: "var(--stage-i140)",
  },
  {
    title: "AI Case Assistant",
    description:
      "Ask questions in plain English — \"What cases have deadlines this week?\" or \"Start a new case for John Smith.\" It handles the rest.",
    illustration: (
      <svg width="100" height="100" viewBox="0 0 200 200" fill="none" className="text-foreground" aria-hidden="true">
        {/* Chat bubble */}
        <rect x="30" y="40" width="140" height="90" rx="8" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="3" />
        <polygon points="60,130 80,130 70,150" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="3" />
        {/* Sparkle */}
        <path d="M140 55 L143 48 L146 55 L153 58 L146 61 L143 68 L140 61 L133 58 Z" fill="var(--primary)" />
        <path d="M60 65 L61.5 61 L63 65 L67 66.5 L63 68 L61.5 72 L60 68 L56 66.5 Z" fill="var(--primary)" opacity="0.5" />
        {/* Text lines */}
        <line x1="55" y1="80" x2="125" y2="80" stroke="currentColor" strokeWidth="3" opacity="0.3" strokeLinecap="round" />
        <line x1="55" y1="95" x2="105" y2="95" stroke="currentColor" strokeWidth="3" opacity="0.2" strokeLinecap="round" />
        <line x1="55" y1="110" x2="115" y2="110" stroke="currentColor" strokeWidth="3" opacity="0.15" strokeLinecap="round" />
      </svg>
    ),
    bgImage: "/images/backgrounds/dark-geometric.jpg",
    accentColor: "var(--stage-closed)",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="relative">
      {/* Content container */}
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-8 sm:py-28">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-12 text-center sm:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            What You Get
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Built for PERM Practitioners
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Stop juggling spreadsheets and calendar reminders. Every tool you need to manage PERM cases, in one place.
          </p>
        </ScrollReveal>

        {/* Feature cards grid - 6 cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              direction="up"
              delay={index * 0.08}
            >
              <div className="feature-card group relative border-3 border-border bg-background overflow-hidden shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                {/* Background image - subtle, tinted */}
                <div className="absolute inset-0 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
                  <Image
                    src={feature.bgImage}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    aria-hidden="true"
                  />
                </div>

                {/* Top accent bar - appears on hover */}
                <div
                  className="absolute left-0 right-0 top-0 h-1.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{ backgroundColor: feature.accentColor }}
                  aria-hidden="true"
                />

                {/* Corner accent - grows on hover */}
                <div
                  className="absolute -bottom-10 -right-10 h-24 w-24 rotate-45 opacity-5 transition-all duration-300 group-hover:opacity-10 group-hover:scale-125"
                  style={{ backgroundColor: feature.accentColor }}
                  aria-hidden="true"
                />

                {/* Content */}
                <div className="relative p-8 sm:p-10">
                  {/* Illustration */}
                  <div className="mb-6 flex h-[100px] items-center">
                    <div className="transition-transform duration-500 group-hover:scale-105">
                      {feature.illustration}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="relative font-heading text-xl font-bold mb-3">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="relative text-[15px] text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesGrid;
