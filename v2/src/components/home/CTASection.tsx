import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/**
 * The page's last word: one door per audience, so a page built for both sides
 * ends by addressing both. The lookup is the main action (no account, and
 * what most visitors came for); the practice's door sits beside it.
 */
export function CTASection() {
  return (
    <section aria-labelledby="cta-title" className="border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8 sm:py-20">
        <h2 id="cta-title" className="font-heading text-2xl font-bold sm:text-3xl">
          Check a case, or track a caseload
        </h2>{" "}
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-soft">
          Both free. The lookup needs no account; the app takes a few minutes to set up.
        </p>{" "}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/perm-case-status" className={buttonVariants({ size: "lg" })}>
            Check my case
          </Link>{" "}
          <Link href="/signup" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Start tracking cases
          </Link>
        </div>{" "}
        <p className="mt-6 text-sm">
          <Link href="/tools" className="link">
            Or browse the case data, no account needed
          </Link>
        </p>
      </div>
    </section>
  );
}
