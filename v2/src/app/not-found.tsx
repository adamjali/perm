import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

/**
 * A 404 must not be indexable. Without this it inherits the site default and
 * serves `index, follow`, which invites Google to index every mistyped URL
 * and to treat links FROM this page as real inbound links — that is how a
 * page ends up "reachable" only from the error page and counted as linked.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Dot pattern background */}
      <div
        className="bg-dots pointer-events-none fixed inset-0 opacity-30"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg">
        {/* 404 number — oversized, clipped by card */}
        <div className="relative bg-card border-2 border-border shadow-hard overflow-hidden">
          {/* Giant 404 watermark */}
          <div
            className="absolute -top-8 -right-4 font-heading font-bold text-[12rem] sm:text-[16rem] leading-none text-muted/20 select-none pointer-events-none"
            aria-hidden="true"
          >
            404
          </div>

          <div className="relative p-8 sm:p-10">
            {/* Status badge */}
            <div className="inline-block bg-destructive/10 border-2 border-destructive/30 px-3 py-1 mb-6">
              <span className="mono text-xs font-bold uppercase tracking-widest text-destructive">
                Page Not Found
              </span>
            </div>

            {/* Heading */}
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground uppercase tracking-tight mb-3">
              Dead End
            </h1>{" "}

            {/* Description */}
            <p className="text-muted-foreground mb-8 max-w-sm">
              The page you&apos;re looking for doesn&apos;t exist or has been
              moved. Check the URL or head back to familiar ground.
            </p>{" "}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-heading font-bold text-sm uppercase tracking-wide px-6 py-3 border-2 border-border shadow-hard hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
              >
                <Home className="w-4 h-4" strokeWidth={2.5} />
                Home
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-card text-foreground font-heading font-bold text-sm uppercase tracking-wide px-6 py-3 border-2 border-border shadow-hard hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <p className="text-center text-muted-foreground text-sm mt-6 mono uppercase tracking-widest">
          PERM Tracker
        </p>
      </div>
    </div>
  );
}
