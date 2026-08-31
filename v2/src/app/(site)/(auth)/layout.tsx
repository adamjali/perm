import { SentryClientInit } from "@/components/layout/SentryClientInit";
import { ConvexProviders } from "@/app/providers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

/**
 * Layout for sign in, sign up and password reset.
 *
 * The header, footer, incident banner, dotted ground, skip link and the flex
 * column live in `(site)/layout.tsx`, one level up, so this group and the
 * public group share a single `AuthHeader` instance instead of mounting one
 * each. See that file for why that matters.
 *
 * IT RESERVES THE SAME SPACE FOR THE HEADER AS THE PUBLIC GROUP DOES.
 * `AuthHeader` is `position: fixed`, so whatever sits under it has to reserve
 * its height by hand — and the two groups used to disagree. This layout used
 * an 80px spacer div while the public one padded its main by
 * `calc(4rem + var(--security-banner-h, 0px))`, which was 64px, so crossing
 * between them moved the content 16px vertically under a header that had not
 * moved at all. Both now use the identical expression, and it picks up the
 * security-banner variable this layout previously ignored even though the
 * header's own `top` reads it.
 *
 * THE NUMBER IS MEASURED, NOT GUESSED. The bar is 71px at rest: py-3 gives
 * 12 + 12 around a min-h-[44px] logo row, plus a 3px bottom border. Both
 * groups used to reserve 4rem = 64px, so the first 7px of every page sat
 * beneath the fixed bar. 4.5rem = 72px clears it. Changing one file alone
 * reintroduces the mismatch this shared expression exists to remove, so the
 * public layout carries the identical value.
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

      {/* The padding, not a spacer div, is what reserves the fixed header's
          height — the same expression the public group uses. */}
      <main
        id="main-content"
        style={{ paddingTop: "calc(var(--site-header-max-h, 4.5rem) + var(--security-banner-h, 0px))" }}
        className="relative z-10 flex flex-1 justify-center px-4 pb-8 transition-[padding] duration-200 sm:px-8 sm:pb-12"
        tabIndex={-1}
      >
        {/* WIDTH BELONGS TO THE PAGE, not to the layout. A fixed max-w-md
            here meant sign-up could never be anything but a single column,
            and it is the one page in this group with something to show
            beside the form. Sign-in and reset set the same measure
            themselves, so nothing about them changes.

            `my-auto` INSTEAD OF `items-center` ON THE PARENT, plus real top
            padding. Adam: "need top paddingspacing". Two separate faults.

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
