import { SentryClientInit } from "@/components/layout/SentryClientInit";
import { ConvexProviders } from "@/app/providers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

/**
 * Layout for sign in, sign up and password reset.
 *
 * The header, footer, skip link and the flex column live in `(site)/layout.tsx`,
 * one level up, so this group and the public group share one header instance.
 * Both groups pad their <main> by the same token, --site-header-h, so crossing
 * between them never moves the content under the fixed bar.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Scoped here from the root layout: this is the tree that talks to
    // Convex, so this is where the cookie read belongs. See src/app/layout.tsx.
    <ConvexAuthNextjsServerProvider>
    <ConvexProviders>
      {/* Sentry client: error capture + stale-deploy reload. No session
          replay anywhere; auth pages carry credential fields. */}
      <SentryClientInit />

      <main
        id="main-content"
        className="relative z-10 flex flex-1 pt-(--site-header-h) justify-center px-4 pb-8 sm:px-8 sm:pb-12"
        tabIndex={-1}
      >
        {/* WIDTH BELONGS TO THE PAGE, not to the layout. A fixed max-w-md
            here meant sign-up could never be anything but a single column,
            and it is the one page in this group with something to show
            beside the form. Sign-in and reset set the same measure
            themselves, so nothing about them changes.

            `my-auto` INSTEAD OF `items-center` ON THE PARENT, plus real top
            padding. Two separate fixes.

            The padding above reserves the header's height exactly and nothing
            more, so a page began 1px under a fixed bar with no breathing room
            at all; `pt-6 sm:pt-10` here adds that without touching the shared
            reservation expression, which the public group has to keep matching.

            And `align-items: center` on the parent is the wrong way to centre
            anything that might outgrow the viewport: the overflow goes both
            ways and the top of it becomes unreachable, which sign-up with a
            screenshot beside it can easily do on a laptop. An auto margin
            centres identically when there is room and collapses to zero when
            there is not, so nothing is ever scrolled off the top. */}
        {/* The top padding is published as a variable so a full-bleed page can
            cancel exactly it rather than hardcoding the pair of values and
            drifting the next time one changes. */}
        <div
          className="my-auto w-full pt-[var(--auth-pad-top)]"
          style={{ ["--auth-pad-top" as string]: "1.5rem" }}
        >
          {children}
        </div>
      </main>
    </ConvexProviders>
    </ConvexAuthNextjsServerProvider>
  );
}
