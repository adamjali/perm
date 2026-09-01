"use client";

/**
 * SecuritySection Component
 *
 * Neobrutalist table showing honest security posture.
 * AES-256-GCM, Convex SOC 2, 15-min timeout, row-level isolation, full export.
 *
 */

import { ShieldIcon } from "@phosphor-icons/react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

interface SecurityRow {
  label: string;
  detail: string;
}

const securityRows: SecurityRow[] = [
  {
    label: "Sensitive fields encrypted",
    detail: "AES-256-GCM on employer FEIN and OAuth tokens",
  },
  {
    label: "SOC 2 Type II infrastructure",
    detail: "Hosted on Convex (SOC 2 certified) on AWS",
  },
  {
    label: "Session security",
    detail: "15-minute inactivity timeout with auto sign-out",
  },
  {
    label: "Row-level isolation",
    detail: "Your cases are invisible to every other user",
  },
  {
    label: "Full data export",
    detail: "CSV or JSON export of all cases, anytime",
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="relative bg-muted">
      <div className="mx-auto max-w-[900px] px-4 py-16 sm:px-8 sm:py-20">
        {/* Section header */}
        <ScrollReveal direction="up" className="mb-10 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
            <ShieldIcon className="h-3.5 w-3.5" />
            Security
          </div>{" "}
          <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            Your Client Data Is Protected
          </h2>
        </ScrollReveal>

        {/* Neobrutalist table */}
        <ScrollReveal direction="up" delay={0.1}>
          <div className="border-3 border-border shadow-hard overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_1.5fr] border-b-3 border-border bg-foreground text-background">
              <div className="px-5 py-3 font-heading text-sm font-bold uppercase tracking-wider">
                What Protects You
              </div>{" "}
              <div className="px-5 py-3 font-heading text-sm font-bold uppercase tracking-wider border-l-2 border-background/20">
                How
              </div>
            </div>

            {/* Table rows */}
            {securityRows.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1fr_1.5fr] border-border ${
                  index < securityRows.length - 1 ? "border-b-2" : ""
                } ${index % 2 === 0 ? "bg-background" : "bg-muted"}`}
              >
                <div className="px-5 py-4 font-heading text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldIcon
                    className="h-4 w-4 flex-shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {row.label}
                </div>{" "}
                <div className="px-5 py-4 text-sm text-muted-foreground leading-relaxed border-l-2 border-border/30 flex items-center">
                  {row.detail}
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Bottom statement */}
        <ScrollReveal direction="up" delay={0.2}>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            We don&apos;t sell your data or train AI on it.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default SecuritySection;
