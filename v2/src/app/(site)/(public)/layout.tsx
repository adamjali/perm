/**
 * Public Layout
 * Wraps the marketing and data pages (Home, Tools, Blog, legal, and so on).
 *
 * The header, footer, skip link and the flex column live in `(site)/layout.tsx`
 * so that ONE header instance spans this group and `(auth)`. What is left here is
 * the chrome that genuinely belongs to the public pages and would be wrong on
 * a sign-in form: hash-anchor handling, the stale-page refresh and the
 * on-device diagnostic.
 *
 * Round 2 (Oct 15 2026): sections rise into place as they're scrolled to
 * (AutoReveal, below the fold only) and the back-to-top button is back, its
 * frame filling with lime as the page scrolls. The ambient particles stay out.
 *
 * No page transition, deliberately. A fade keyed on the pathname remounts the
 * whole tree, data rail included, on every click; the pathname commits WITH
 * the loading state, so the fade plays on the skeleton and the real page then
 * swaps in unanimated; and under reduced motion the wrapper changes type
 * after hydration and remounts the page a second time.
 */

import { HashScrollHandler } from "@/components/ui/hash-scroll-handler";
import { RefreshWhenStale } from "@/components/ui/refresh-when-stale";
import { ViewportDiag } from "@/components/diag/ViewportDiag";
import { DataShell } from "@/components/tools/DataShell";
import { SiteBreadcrumbs } from "@/components/layout/SiteBreadcrumbs";
import { AutoReveal } from "@/components/ui/auto-reveal";
import { ScrollToTop } from "@/components/ui/scroll-to-top";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <HashScrollHandler />
      {/* A page left open (a phone tab, a home-screen app) asks for current
          figures when the reader comes back to it after 30 minutes. */}
      <RefreshWhenStale />

      {/* Padded by the fixed header's height, the same token the auth group uses. */}
      <main
        id="main-content"
        className="relative flex-1 pt-(--site-header-h)"
        tabIndex={-1}
      >
        {/* The data rail lives here rather than on each of the 28 data
            pages: a sidebar has to sit BESIDE the content, so something has
            to own both. On every other public page DataShell renders its
            children untouched. */}
        <SiteBreadcrumbs />
        <DataShell>{children}</DataShell>
      </main>

      <AutoReveal />
      <ScrollToTop />

      {/* On-device layout diagnostic. Inert without ?diag=1 in the URL. */}
      <ViewportDiag />
    </>
  );
}
