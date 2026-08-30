/**
 * Public Layout
 * Wraps the marketing and data pages (Home, Tools, Blog, legal, and so on).
 *
 * The header, footer, incident banner, dotted ground, skip link and the flex
 * column all moved up to `(site)/layout.tsx` so that ONE `AuthHeader` instance
 * spans this group and `(auth)`. See that file for why. What is left here is
 * the chrome that genuinely belongs to the public pages and would be wrong on
 * a sign-in form: the ambient canvas, the scroll progress bar, hash-anchor
 * handling, the back-to-top button, the on-device diagnostic, and the page
 * transition.
 */

import { ScrollProgress } from "@/components/home";
import { PageTransition } from "@/components/ui/page-transition";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { HashScrollHandler } from "@/components/ui/hash-scroll-handler";
import { ViewportDiag } from "@/components/diag/ViewportDiag";
import { AmbientMurmuration } from "@/components/home/AmbientMurmuration";
import { DataShell } from "@/components/tools/DataShell";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* One ambient system for the whole public surface: a small murmuration
          at field opacity, steered by scroll along an invisible path. Opaque
          bands cover it; it lives on the dotted ground between them. */}
      <AmbientMurmuration />
      {/* Scroll progress indicator */}
      <ScrollProgress />
      <HashScrollHandler />

      {/* Main content - grows to fill space, pt accounts for the fixed header
          plus the security banner if visible (--security-banner-h is published
          by SecurityIncidentBanner in the (site) layout, cleared to 0 when
          dismissed). The auth group uses this identical expression. */}
      <main
        id="main-content"
        style={{ paddingTop: "calc(4.5rem + var(--security-banner-h, 0px))" }}
        className="relative flex-1 transition-[padding] duration-200"
        tabIndex={-1}
      >
        {/* The data rail lives here rather than on each of the 28 data
            pages: a sidebar has to sit BESIDE the content, so something has
            to own both. On every other public page DataShell renders its
            children untouched. */}
        <PageTransition>
          <DataShell>{children}</DataShell>
        </PageTransition>
      </main>

      {/* Back-to-top button */}
      <ScrollToTop />

      {/* On-device layout diagnostic. Inert without ?diag=1 in the URL. */}
      <ViewportDiag />
    </>
  );
}
