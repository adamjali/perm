import Link from "next/link";

import { ArrowRight } from "./icons";

/**
 * The attorney door, slimmed to a panel.
 *
 * The full practitioner pitch (stakes, walkthrough, feature grid, security
 * table) moved to /for-attorneys so the homepage can lead with the person
 * waiting; this panel is what remains here - enough to route a practitioner
 * in one glance, small enough that it no longer sets the page's identity.
 */
export function AttorneyPanel() {
  return (
    <section className="border-b-3 border-border bg-foreground text-background">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-8 px-4 py-14 [&>*]:min-w-0 sm:px-8 sm:py-16 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-background/70">
            For attorneys and firms
          </p>{" "}
          <h2 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
            Every deadline, computed per case
          </h2>{" "}
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-background/80 sm:text-lg">
            Enter the case dates once. Filing windows, wage expirations,
            recruitment clocks and audit responses come out computed, with
            email reminders, calendar sync and a client-ready timeline.
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <Link
            href="/for-attorneys"
            className="group inline-flex min-h-[48px] items-center justify-center gap-2 border-3 border-background bg-primary px-6 font-heading font-black text-primary-foreground shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
          >
            How the software works{" "}
            <ArrowRight className="transition-transform duration-150 group-hover:translate-x-1" />
          </Link>{" "}
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] items-center justify-center border-3 border-background px-6 font-heading font-black text-background transition-colors hover:bg-background hover:text-foreground"
          >
            Start free
          </Link>
        </div>
      </div>
    </section>
  );
}
