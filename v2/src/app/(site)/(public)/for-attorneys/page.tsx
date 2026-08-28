import type { Metadata } from "next";
import Link from "next/link";

import {
  StakesSection,
  FeaturesGrid,
  HowItWorks,
  SecuritySection,
  CTASection,
} from "@/components/home";
import { SectionDivider } from "@/components/home/SectionDivider";
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
      <section className="border-b-3 border-border">
        <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            For attorneys, paralegals and HR teams
          </p>{" "}
          <h1 className="mt-4 max-w-3xl font-heading text-[2rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-5xl">
            Every PERM deadline,{" "}
            <span className="inline-block bg-primary px-[0.22em] text-primary-foreground shadow-hard">
              computed per case
            </span>
          </h1>{" "}
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-foreground/70 sm:text-lg">
            Enter the case dates once. The filing window, the wage expiration,
            the recruitment clocks and the audit response dates come out
            computed, cascade when a date changes, and remind you before they
            arrive.
          </p>{" "}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center justify-center border-3 border-border bg-primary px-7 font-heading font-black text-primary-foreground shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              Start tracking free
            </Link>{" "}
            <Link
              href="/perm-case-status"
              className="inline-flex min-h-[48px] items-center justify-center border-3 border-border px-7 font-heading font-black shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              Check a case number first
            </Link>
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
