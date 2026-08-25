import AuthHeader from "@/components/layout/AuthHeader";
import Footer from "@/components/layout/Footer";
import { SentryClientInit } from "@/components/layout/SentryClientInit";
import { ConvexProviders } from "@/app/providers";

/**
 * Layout for sign in, sign up and password reset.
 *
 * IT RESERVES THE SAME SPACE FOR THE HEADER AS THE PUBLIC LAYOUT DOES, and
 * that is the point of this file's shape. `AuthHeader` is `position: fixed`,
 * so whatever sits under it has to reserve its height by hand — and the two
 * groups that mount it were reserving different amounts. This layout used an
 * 80px spacer div; `(public)/layout.tsx` pads its main by
 * `calc(4rem + var(--security-banner-h, 0px))`, which is 64px. So crossing
 * between the groups moved the content 16px vertically under a header that
 * had not moved at all, which reads as the header itself changing.
 *
 * Both now use the identical expression. It also picks up the security-banner
 * variable, which this layout ignored entirely even though the header's own
 * `top` reads it — with the banner showing, the bar moved down and nothing
 * here moved with it.
 *
 * KNOWN, AND NOT MINE TO CHANGE: 4rem under-reserves. The bar measures 71px
 * at rest (py-3 = 12 + 12, a 44px minimum logo row, and a 3px bottom border),
 * so the first 7px of content sits beneath it. Nothing is visibly clipped
 * today because every page's first band carries its own top padding. The fix
 * is 4rem -> 4.5rem in BOTH files at once; changing only this one would
 * reintroduce the mismatch it exists to remove.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviders>
      <div className="relative flex min-h-screen flex-col bg-background">
        {/* Lazily initialize Sentry on auth pages */}
        <SentryClientInit />

        {/* Keyboard users had no way past the header here; the public group
            has had one since it was built. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-hard-sm focus:outline-none"
        >
          Skip to main content
        </a>

        {/* Fixed dot pattern background - matches other layouts */}
        <div
          className="bg-dots pointer-events-none fixed inset-0 opacity-30"
          aria-hidden="true"
        />

        <AuthHeader />

        {/* Main Content Area. The padding, not a spacer div, is what reserves
            the fixed header's height — same expression the public layout uses. */}
        <main
          id="main-content"
          style={{ paddingTop: "calc(4rem + var(--security-banner-h, 0px))" }}
          className="relative z-10 flex flex-1 items-center justify-center px-4 pb-8 transition-[padding] duration-200 sm:px-8 sm:pb-12"
          tabIndex={-1}
        >
          <div className="w-full max-w-md">{children}</div>
        </main>

        <Footer variant="extended" />
      </div>
    </ConvexProviders>
  );
}
