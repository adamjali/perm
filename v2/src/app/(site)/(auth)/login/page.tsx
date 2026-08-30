import type { Metadata } from "next";
import { openGraphBase } from "@/lib/openGraphBase";
import { DeadlineTrackFigure } from "@/components/marketing/PageFigures";
import { LoginPageClient } from "./LoginPageClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your PERM Tracker account to manage your immigration cases.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    ...openGraphBase,
    title: "Sign In | PERM Tracker",
    description:
      "Sign in to PERM Tracker.",
    url: "/login",
  },
  // Auth pages shouldn’t appear in SERPs. `noindex` is the correct signal per
  // Google (robots.txt Disallow ≠ noindex — Disallow blocks crawl, Google may
  // still index a Disallowed URL from inbound links). Keep `follow: true` so
  // any internal links from this page remain discoverable.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  // The layout no longer imposes a width, so the measure lives
    // here. Unchanged from what it was: max-w-md, centred.
    return (
      // The same shape as sign-up, deliberately: crossing between the two
      // should not move the form. The copy differs because the reader does -
      // somebody signing in already decided, so the panel reminds rather than
      // sells.
      <div className="mx-auto w-full max-w-5xl lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="mx-auto w-full max-w-md lg:mx-0">
          <LoginPageClient />
        </div>
        <aside className="mx-auto mt-8 w-full max-w-md border-2 border-border bg-card p-6 shadow-hard lg:mx-0 lg:mt-0 lg:max-w-none">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            While you were away
          </p>{" "}
          <h2 className="mt-2 font-heading text-2xl font-black leading-tight">
            Your deadlines kept counting
          </h2>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            Filing windows, wage expirations and audit responses are recomputed
            from your case dates every time DOL publishes, so nothing needs
            re-entering.
          </p>
          <figure className="mt-6">
            <DeadlineTrackFigure className="h-auto w-full text-foreground" />{" "}
            <figcaption className="mt-3 border-t-2 border-border pt-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              The window closes at the earlier of the two
            </figcaption>
          </figure>
        </aside>
      </div>
    );
}
