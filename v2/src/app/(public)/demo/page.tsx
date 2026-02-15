/**
 * Demo Page
 *
 * Server-rendered shell with metadata + static content (hero, tour, screenshots).
 * Interactive demo sections (stats, calendar, cases) are lazy-loaded via DemoInteractive.
 */

import type { Metadata } from "next";
import Image from "next/image";
import {
  Play,
  Eye,
  MousePointerClick,
  CalendarDays,
  ArrowDown,
} from "lucide-react";
import { DemoBanner } from "@/components/demo";
import { DemoInteractiveLoader } from "./DemoInteractiveLoader";

export const metadata: Metadata = {
  title: "Try Demo",
  description:
    "Try PERM Tracker for free. Explore all features with sample data before signing up. No account required.",
  alternates: {
    canonical: "/demo",
  },
  openGraph: {
    title: "Try PERM Tracker Demo",
    description:
      "Try PERM Tracker for free. Explore deadline tracking, case validation, and all features with sample data.",
    url: "/demo",
    type: "website",
  },
};

export default function DemoPage() {
  return (
    <div className="relative">
      <DemoBanner />

      {/* HERO INTRO — server-rendered for fast LCP */}
      <section className="relative overflow-hidden border-b-3 border-border bg-muted pt-14">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="page-enter">
            <div className="text-center">
              <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <Play className="h-3.5 w-3.5" />
                Interactive Demo
              </div>
              <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                See How PERM Tracker{" "}
                <span className="inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard">
                  Works
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                This is a fully interactive sandbox with 5 sample cases at
                different PERM stages. Add cases, edit dates, and watch
                deadlines calculate automatically — exactly like the real
                product.
              </p>
            </div>
          </div>

          <div className="page-enter" style={{ animationDelay: "0.1s" }}>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <Eye className="h-5 w-5" />,
                  title: "Explore Cases",
                  desc: "5 sample cases across all PERM stages",
                  color: "var(--stage-pwd)",
                },
                {
                  icon: <MousePointerClick className="h-5 w-5" />,
                  title: "Edit & Add",
                  desc: "Change dates and see deadlines auto-calculate",
                  color: "var(--stage-recruitment)",
                },
                {
                  icon: <CalendarDays className="h-5 w-5" />,
                  title: "Calendar View",
                  desc: "See deadlines on this month's calendar",
                  color: "var(--stage-eta9089)",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-3 border-border bg-background p-4 text-center shadow-hard-sm"
                  style={{
                    borderTopWidth: "4px",
                    borderTopColor: item.color,
                  }}
                >
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center text-foreground">
                    {item.icon}
                  </div>
                  <h3 className="font-heading text-sm font-bold">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="page-enter" style={{ animationDelay: "0.2s" }}>
            <div className="mt-10 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              <ArrowDown className="h-4 w-4 animate-bounce" />
              <span>Scroll to explore the demo</span>
            </div>
          </div>
        </div>
      </section>

      {/* GUIDED TOUR (Supademo) — server-rendered, iframe loads lazily */}
      <section className="relative border-b-3 border-border bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="page-enter">
            <div className="text-center">
              <div className="mb-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <MousePointerClick className="h-3.5 w-3.5" />
                Guided Tour
              </div>
              <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">
                Click Through the{" "}
                <span className="inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard-sm">
                  Full App
                </span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                50-step interactive walkthrough — create cases, configure
                settings, use the AI assistant, and more.
              </p>
            </div>
          </div>

          <div className="page-enter" style={{ animationDelay: "0.1s" }}>
            <div className="mt-8">
              <div
                className="relative overflow-hidden border-3 border-border shadow-hard-lg"
                style={{ aspectRatio: "16/9" }}
              >
                <div className="flex items-center gap-1.5 border-b-3 border-border bg-muted px-3 py-2">
                  <div className="h-2.5 w-2.5 border border-border bg-[#FF5F57]" />
                  <div className="h-2.5 w-2.5 border border-border bg-[#FFBD2E]" />
                  <div className="h-2.5 w-2.5 border border-border bg-[#28CA41]" />
                  <span className="ml-3 font-mono text-[10px] text-muted-foreground">
                    permtracker.app — Interactive Tour
                  </span>
                </div>
                <iframe
                  src="https://app.supademo.com/embed/cmli1lvlg1lkg5351b6olnd9n?embed_v=2"
                  loading="lazy"
                  title="PERM Tracker interactive product tour"
                  allow="clipboard-write"
                  className="h-full w-full"
                  style={{
                    border: "none",
                    position: "absolute",
                    top: "0",
                    left: "0",
                    width: "100%",
                    height: "100%",
                    paddingTop: "34px",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT SCREENSHOTS — server-rendered images */}
      <section className="border-b-3 border-border bg-foreground py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="page-enter">
            <p className="mb-8 text-center font-mono text-xs uppercase tracking-widest text-background/80">
              From the real product
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  src: "/images/screenshots/dashboard.png",
                  alt: "Dashboard with deadline hub showing overdue and upcoming deadlines",
                  label: "Deadline Hub",
                },
                {
                  src: "/images/screenshots/cases.png",
                  alt: "Case cards with filters, status badges, and progress indicators",
                  label: "Case Management",
                },
                {
                  src: "/images/screenshots/calendar.png",
                  alt: "Calendar with color-coded deadlines and AI chat assistant",
                  label: "Calendar + AI Chat",
                },
              ].map((screenshot) => (
                <div key={screenshot.label} className="group">
                  <div className="overflow-hidden border-3 border-background/20 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-center gap-1.5 bg-background/10 px-3 py-1.5">
                      <div className="h-2 w-2 bg-[#FF5F57]" />
                      <div className="h-2 w-2 bg-[#FFBD2E]" />
                      <div className="h-2 w-2 bg-[#28CA41]" />
                      <span className="ml-2 font-mono text-[9px] text-background/70">
                        {screenshot.label}
                      </span>
                    </div>
                    <Image
                      src={screenshot.src}
                      alt={screenshot.alt}
                      width={600}
                      height={400}
                      className="w-full"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <p className="mt-3 text-center font-mono text-xs uppercase tracking-widest text-background/70">
                    {screenshot.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE DEMO — lazy-loaded client component */}
      <DemoInteractiveLoader />
    </div>
  );
}
