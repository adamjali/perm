import type { Metadata } from "next";

import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";
import { NotFoundBody } from "@/components/layout/NotFoundBody";
import { getAllPosts } from "@/lib/content";

/**
 * A 404 must not be indexable. Without this it inherits the site default and
 * serves `index, follow`, which invites Google to index every mistyped URL
 * and to treat links FROM this page as real inbound links — that is how a
 * page ends up "reachable" only from the error page and counted as linked.
 *
 * This is the 404 for an address no route matches (and for the signed-in
 * app). Next renders it inside the root layout alone, so it draws the site's
 * header and footer itself. A page inside the public site that calls
 * notFound() gets (site)/not-found.tsx instead, inside the site's own header
 * and footer, so neither case shows two of them or none.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const articles = getAllPosts().map((p) => ({ title: p.meta.title, href: `/${p.type}/${p.slug}`, kind: p.type }));
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <SiteHeader articles={articles} />
      <main id="main-content" tabIndex={-1} className="relative flex-1 pt-(--site-header-h)">
        <NotFoundBody />
      </main>
      <Footer />
    </div>
  );
}
