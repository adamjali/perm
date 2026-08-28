import AuthHeader from "@/components/layout/AuthHeader";
import Footer from "@/components/layout/Footer";
import { SecurityIncidentBanner } from "@/components/layout/SecurityIncidentBanner";
import { getAllPosts } from "@/lib/content";

/**
 * The shell shared by every logged-out page: the marketing and data pages in
 * `(public)`, and sign in / sign up / reset in `(auth)`.
 *
 * WHY THIS FILE EXISTS. `AuthHeader` used to be mounted twice, once by each of
 * those group layouts. Route groups are siblings, so crossing between them
 * unmounted one instance and mounted another — and the two are not identical,
 * because `AuthHeader` branches on `usePathname()`: the homepage renders
 * section anchors and both auth buttons, every other page renders Home / Data
 * / Learn and one. So a visitor clicking "Sign Up" watched one header be
 * replaced by a visibly different one. That is the flash that was reported.
 *
 * Hoisting it here makes it ONE instance for both groups. A layout above the
 * segment that changed is preserved across navigation, so React reconciles
 * this header rather than tearing it down and building another. Nothing about
 * the URLs changes: `(site)`, `(public)` and `(auth)` are all route groups, so
 * `/`, `/signup` and `/blog` are still exactly those paths.
 *
 * WHAT LIVES HERE AND WHAT DOES NOT. Only the chrome both groups genuinely
 * shared: the flex column, the dotted ground, the skip link, the header, the
 * footer, and the incident banner the header's own `top` already reads. The
 * public group keeps its own ambient canvas, scroll progress, hash handling,
 * back-to-top and page transition; the auth group keeps `ConvexProviders` and
 * its centred column. Each child still owns its own `<main id="main-content">`,
 * which is what the skip link above targets — only one of them is ever
 * mounted, so there is exactly one `<main>` on any page.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Skip link for keyboard users. Its target is the <main> in whichever
          child group is mounted. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-hard-sm focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Fixed dot pattern background */}
      <div
        className="bg-dots pointer-events-none fixed inset-0 opacity-30"
        aria-hidden="true"
      />

      {/* Dismissible, auto-hides after 2026-04-27. It publishes
          --security-banner-h, which the header's `top` and both children's
          main padding read, so it belongs at the same level as the header. */}
      <SecurityIncidentBanner />

      {/* The search palette's article index: titles only, read from the
          content directory at render time (a server layout, so this costs
          the client nothing until the palette opens). */}
      <AuthHeader
        articles={getAllPosts().map((p) => ({
          title: p.meta.title,
          href: `/${p.type}/${p.slug}`,
          kind: p.type,
        }))}
      />

      {children}

      <Footer variant="extended" />
    </div>
  );
}
