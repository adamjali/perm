"use client";

/**
 * CTASection Component
 *
 * Full-width call-to-action section with primary green background.
 * Features background photograph with mesh gradient overlay,
 * RocketLaunchSVG illustration, floating mini-icons, and dual CTA buttons.
 *
 */

import { CircleNotchIcon, MagnifyingGlassIcon, CalendarCheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { FlapWord } from "./FlapBoard";

/**
 * TWO DOORS, one per audience, so the last thing on a page built for both
 * sides addresses both. The primary button is the lookup,
 * which needs no account and is what most visitors came for; the practice's
 * door sits beside it at equal weight.
 */
export function CTASection() {
  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  return (
    <section className="relative overflow-hidden bg-primary py-16 text-center sm:py-20">
      {/* NO DECORATION: nothing here that is not an object from this
          site's world doing a job, and no hand-rolled icon paths, which the
          house rules ban. The flap word below is the films' end card. */}
      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-8">
        {/* Single stagger container (1 Intersection Observer) */}
        <ScrollReveal direction="up" stagger>
          <FlapWord word="permtracker.app" className="mx-auto mb-6 justify-center" />{" "}

          <div>
            {/* /70, not /60. Black at 60% over the lime panel measures 4.37:1
                against a 4.5 floor; 70% gives 5.80:1. Computed against the
                real token (#2ecc40), not eyeballed. */}
            <h2 className="font-heading text-2xl font-black text-black sm:text-3xl lg:text-4xl">
              Check a case, or track a caseload
            </h2>{" "}
            <p className="mx-auto mt-3 max-w-lg text-base text-black/70">
              Both free. The lookup needs no account; the app takes a few
              minutes to set up.
            </p>
          </div>{" "}

          {/* The secondary link sits OUTSIDE MagneticButton, which applies a
              pointer-tracking transform to everything it wraps: inside it,
              this link drifted with the button and was the harder of the two
              to click. One magnetic element, one button. */}
          <div className="mt-6 flex flex-col items-center gap-5">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <MagneticButton>
                <Button
                  size="lg"
                  className="h-12 border-3 border-black bg-black px-6 font-heading text-base font-bold text-white transition-all duration-150 hover:bg-white hover:text-black hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 dark:border-black dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black"
                  style={{ boxShadow: "4px 4px 0px #000" }}
                  onClick={() => navigateTo("/perm-case-status")}
                  disabled={isNavigating}
                >
                  {isNavigating && targetPath === "/perm-case-status" ? (
                    <CircleNotchIcon className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <MagnifyingGlassIcon className="mr-2 h-5 w-5" />
                  )}
                  Check my case
                </Button>
              </MagneticButton>{" "}
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-3 border-black bg-transparent px-6 font-heading text-base font-bold text-black transition-all duration-150 hover:bg-black hover:text-white hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 dark:border-black dark:text-black dark:hover:bg-black dark:hover:text-white"
                onClick={() => navigateTo("/signup")}
                disabled={isNavigating}
              >
                {isNavigating && targetPath === "/signup" ? (
                  <CircleNotchIcon className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CalendarCheckIcon className="mr-2 h-5 w-5" />
                )}
                Start tracking cases
              </Button>
            </div>{" "}
            <a
              href="/tools"
              className="inline-flex min-h-[44px] items-center font-bold text-black underline decoration-black/40 decoration-2 underline-offset-4 transition-colors hover:decoration-black"
            >
              Or browse the case data, no account needed
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

