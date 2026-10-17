import type { Metadata } from "next";

import { NotFoundBody } from "@/components/layout/NotFoundBody";

/**
 * The 404 for a public page that calls notFound(): a missing employer, firm,
 * article or month. It renders inside (site)/layout.tsx, so the site's header
 * and footer are already there; the root not-found.tsx draws its own for an
 * address no route matches.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function SiteNotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="relative flex-1 pt-(--site-header-h)">
      <NotFoundBody />
    </main>
  );
}
