import SiteHeader from "@/components/layout/SiteHeader";
import Footer from "@/components/layout/Footer";

/**
 * The shell shared by every logged-out page: the marketing and data pages in
 * `(public)`, and sign in / sign up / reset in `(auth)`.
 *
 * The header and footer live here, above both groups, so moving between a
 * public page and the sign-in form keeps ONE header instance instead of
 * swapping one for another. Each child group owns its own
 * `<main id="main-content">`, the skip link's target; only one is mounted.
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
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:shadow-hard-sm"
      >
        Skip to main content
      </a>

      <SiteHeader />

      {children}

      <Footer />
    </div>
  );
}
