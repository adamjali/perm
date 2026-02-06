"use client";

/**
 * TestimonialsSection Component
 *
 * Quote cards from immigration attorneys with photo avatars,
 * neobrutalist styling, and staggered scroll animations.
 *
 */

import Image from "next/image";
import { Quote } from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// ============================================================================
// TESTIMONIAL DATA
// ============================================================================

interface Testimonial {
  name: string;
  title: string;
  quote: string;
  avatar: string;
  accentColor: string;
}

const testimonials: Testimonial[] = [
  {
    name: "Sarah Chen",
    title: "Immigration Attorney, NYC",
    quote:
      "PERM Tracker transformed how I manage my caseload. The automatic deadline calculations alone have saved me countless hours of manual tracking.",
    avatar: "/images/hero/attorney-at-desk.jpg",
    accentColor: "var(--primary)",
  },
  {
    name: "Michael Rodriguez",
    title: "Partner, Rodriguez & Associates",
    quote:
      "The calendar sync feature is a game-changer. My whole team stays aligned on deadlines without any extra effort. I can't imagine going back.",
    avatar: "/images/features/team-meeting.jpg",
    accentColor: "var(--stage-recruitment)",
  },
  {
    name: "Priya Patel",
    title: "Solo Practitioner, Bay Area",
    quote:
      "As a solo attorney handling dozens of PERM cases, this tool gives me the confidence that nothing falls through the cracks. The notifications are perfectly timed.",
    avatar: "/images/hero/legal-office-wide.jpg",
    accentColor: "var(--stage-eta9089)",
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function TestimonialsSection() {
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <svg className="absolute top-12 left-[5%] opacity-8" width="60" height="60" viewBox="0 0 60 60" fill="none">
          <path d="M10 45 L10 25 Q10 10 25 10 L28 10 L28 16 L25 16 Q16 16 16 25 L16 30 L28 30 L28 45 Z" fill="var(--primary)" />
          <path d="M35 45 L35 25 Q35 10 50 10 L53 10 L53 16 L50 16 Q41 16 41 25 L41 30 L53 30 L53 45 Z" fill="var(--primary)" />
        </svg>
        <div className="absolute bottom-8 right-[8%] h-20 w-20 border-3 border-primary/10 rotate-12" />
        <div className="absolute top-[40%] right-[3%] h-16 w-16 border-2 border-border/20 -rotate-6" />
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-12 text-center sm:mb-16">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Quote className="h-3.5 w-3.5" />
            What Attorneys Say
          </div>
          <h2 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Trusted by Practitioners
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Immigration attorneys rely on PERM Tracker to manage their most critical deadlines.
          </p>
        </ScrollReveal>

        {/* Testimonial cards grid */}
        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <ScrollReveal
              key={testimonial.name}
              direction="up"
              delay={index * 0.1}
            >
              <div className="group relative border-3 border-border bg-background overflow-hidden shadow-hard transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                {/* Top accent bar */}
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: testimonial.accentColor }}
                  aria-hidden="true"
                />

                {/* Background image - very subtle */}
                <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500">
                  <Image
                    src={testimonial.avatar}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    aria-hidden="true"
                  />
                </div>

                {/* Content */}
                <div className="relative p-8">
                  {/* Quote icon */}
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center border-2 border-border"
                    style={{ backgroundColor: testimonial.accentColor }}
                  >
                    <Quote className="h-5 w-5 text-black" />
                  </div>

                  {/* Quote text */}
                  <blockquote className="mb-6 text-[15px] leading-relaxed text-muted-foreground italic">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    {/* Avatar circle with image */}
                    <div className="relative h-10 w-10 border-2 border-border overflow-hidden flex-shrink-0">
                      <Image
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div>
                      <div className="font-heading text-sm font-bold">
                        {testimonial.name}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {testimonial.title}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TestimonialsSection;
