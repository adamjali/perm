import Link from "next/link";

import { TOUR_SHOTS } from "@/components/marketing/tourShots";
import { JobCodeTabs, type JobCodeStep } from "./JobCodeTabs";

/**
 * "From a job title to a job description": the case app's SOC code work in one band, three steps as one switch over
 * one app window (JobCodeTabs), each step a real capture of the sample firm (src/components/tour/,
 * scripts/capture-tour.mjs). A real sequence, so the steps are numbered: the code from the position title, the
 * description the code suggests, and the code's figures on the case page (Sabrina's three asks, Nov 1 2026).
 * One window instead of three stacked pictures, so the page grows by one band (owner, Nov 2 2026: "don't want
 * the page to be too long").
 */
const STEPS: JobCodeStep[] = [
  {
    title: "Pick the code",
    text: "Type the position title, and the box offers the codes employers filed it under in DOL's own files, most used first.",
    url: "permtracker.app/cases/new",
    shots: TOUR_SHOTS["job-code"],
    alt: "The case form's SOC code box under the position title Operations Research Analyst, open on the codes employers filed that title under, each with its share of the filings.",
  },
  {
    title: "Take a description",
    text: "O*NET's description and tasks for the code, to take or leave. Keep the tasks that fit; the requirements stay the employer's.",
    url: "permtracker.app/cases/new",
    shots: TOUR_SHOTS["job-suggestion"],
    alt: "The description O*NET gives SOC 15-2031, Operations Research Analysts, suggested on the case form with its tasks ticked to include and the buttons Use this description and Not now.",
  },
  {
    title: "See the numbers",
    text: "The case page shows the median wage offered for the code, how often DOL certifies it and the titles employers use.",
    url: "permtracker.app/cases",
    shots: TOUR_SHOTS["job-card"],
    alt: "The case page's card for SOC 15-2041, Statisticians: the median wage offered in decided PERM cases, the share certified, and the job titles employers filed it under.",
  },
];

export function JobCodeSection() {
  return (
    <section id="job-code" aria-labelledby="job-code-heading" className="overflow-hidden border-b-2 border-black bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 [&>*]:min-w-0 lg:grid-cols-12 lg:items-start lg:gap-14">
          <div className="lg:col-span-4">
            <h2 id="job-code-heading" className="font-heading text-3xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-4xl">
              From a job title to a job description
            </h2>{" "}
            <p className="mt-4 text-lg leading-relaxed text-soft">
              Each case keeps its SOC code beside the position title, and the code brings a description to start from.{" "}
              <Link href="/soc-codes" className="link">
                Browse the SOC code database
              </Link>
              .
            </p>
          </div>{" "}
          <div className="lg:col-span-8">
            <JobCodeTabs steps={STEPS} label="The job code, step by step" />
          </div>
        </div>
      </div>
    </section>
  );
}
