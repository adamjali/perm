import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MagnifyingGlassIcon, RocketLaunchIcon } from "@phosphor-icons/react/ssr";

import {
  StakesSection,
  FeaturesGrid,
  HowItWorks,
  SecuritySection,
  CTASection,
} from "@/components/home";
import { SectionDivider } from "@/components/home/SectionDivider";
import { FloatingShapes } from "@/components/home/DecorativeElements";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * The practitioner pitch, on its own page.
 *
 * These sections used to be the homepage's lower half, which made the whole
 * site read as attorney software: every H2 below the fold addressed a
 * caseload, and answer engines aggregated exactly that into "what PERM
 * Tracker is". Nothing was deleted in the move - the stakes wall, the
 * walkthrough, the feature grid and the security table live here in full,
 * addressed to the audience they were always written for, while the homepage
 * leads with the person waiting on a case.
 *
 * Fully static: every section is presentational, so this prerenders and
 * revalidates on the public tree's default schedule.
 */

export const metadata: Metadata = {
  title: "PERM Software for Attorneys and Firms",
  description:
    "Track every PERM case's deadlines automatically: filing windows, wage expirations, recruitment clocks and audit responses, with reminders. Free.",
  alternates: {
    canonical: "/for-attorneys",
  },
  openGraph: {
    ...openGraphBase,
    title: "PERM Software for Attorneys and Firms",
    description:
      "Every deadline computed per case, with reminders, calendar sync and a client-ready timeline. Free.",
    url: "/for-attorneys",
  },
};

export default function ForAttorneysPage() {
  return (
    <>
      {/* The original homepage hero, back by request - Adam pointed at the
          2026-01-28 archive capture and asked for this one here. Ported from
          commit 9297548c with three adaptations: the buttons are plain links
          (the old client Button + navigation-spinner pair is retired), the
          icons are Phosphor (lucide left the stack), and the dead /demo
          route became the case lookup. Copy, layout, floating shapes, the
          accent-box hover and the dashboard still are verbatim. */}
      <section className="relative overflow-hidden border-b-3 border-border">
        <FloatingShapes className="absolute inset-0" />
        <div className="relative z-10 mx-auto flex max-w-[1400px] items-center px-4 py-12 sm:px-8 sm:py-16 lg:py-20">
          <div className="grid w-full items-center gap-12 [&>*]:min-w-0 lg:grid-cols-2 lg:gap-20">
            <div className="flex flex-col gap-6">
              <ScrollReveal direction="up">
                <div className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
                  <span className="pulse-dot h-2 w-2 bg-primary" />
                  Case Management Reimagined
                </div>
              </ScrollReveal>
              <ScrollReveal direction="up" delay={0.05}>
                <h1 className="font-heading text-4xl font-black leading-[1.1] tracking-[-0.02em] sm:text-5xl lg:text-6xl xl:text-7xl">
                  Track Your PERM Cases{" "}
                  <span className="inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-lg">
                    Effortlessly
                  </span>
                </h1>
              </ScrollReveal>
              <ScrollReveal direction="up" delay={0.1}>
                <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                  Free case management for immigration attorneys. Enter the case
                  dates once, get every PERM deadline.
                </p>
              </ScrollReveal>
              <ScrollReveal direction="up" delay={0.15}>
                <div className="flex flex-wrap gap-4 pt-4">
                  <Link
                    href="/signup"
                    className="inline-flex h-14 items-center border-3 border-border bg-primary px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <RocketLaunchIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Get Started Free
                  </Link>{" "}
                  <Link
                    href="/perm-case-status"
                    className="inline-flex h-14 items-center border-3 border-border bg-transparent px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-foreground shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-foreground hover:text-background hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <MagnifyingGlassIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                    Check a Case First
                  </Link>
                </div>
              </ScrollReveal>
            </div>
            <ScrollReveal direction="right" delay={0.15} className="relative lg:order-last">
              <div
                className="absolute -right-10 -top-10 h-28 w-28 rotate-45 bg-primary opacity-10"
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-16 -left-16 h-32 w-32 rotate-12 bg-primary opacity-10"
                aria-hidden="true"
              />
              <div className="relative border-4 border-black shadow-hard-lg dark:border-white/20">
                <Image
                  src="/images/hero-showcase.png"
                  alt="PERM Tracker dashboard showing case timeline, deadline tracking, and status updates"
                  width={800}
                  height={600}
                  priority
                  className="w-full"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
      <StakesSection />
      <SectionDivider kind="tape" fill="var(--muted)" />
      <HowItWorks />
      <SectionDivider kind="comb" fill="var(--background)" />
      <FeaturesGrid />
      <SectionDivider kind="ledger" fill="var(--muted)" />
      <SecuritySection />
      <SectionDivider kind="step" fill="var(--primary)" />
      <CTASection />
    </>
  );
}
