import Link from "next/link";

import { FlapWord } from "@/components/home/FlapBoard";
import { cn } from "@/lib/utils";

/**
 * The page's last word: one door per audience, so a page built for both sides
 * ends by addressing both. `lead` picks which door is the page's main action:
 * the lookup on the homepage (no account, and what most visitors came for),
 * the app on the attorney page.
 */
export function CTASection({ lead = "lookup" }: { lead?: "lookup" | "app" }) {
  const ink = "inline-flex min-h-12 items-center justify-center border-2 border-black px-6 text-base font-semibold transition-colors";
  return (
    <section aria-labelledby="cta-title" className="bg-primary text-black">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-14 text-center sm:px-8 sm:py-16">
        <FlapWord word="permtracker.app" />{" "}
        <h2 id="cta-title" className="mt-6 font-heading text-2xl font-bold sm:text-3xl">
          Check a case, or track a caseload
        </h2>{" "}
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed">
          Both free. The lookup needs no account; the app takes a few minutes to set up.
        </p>{" "}
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/perm-case-status"
            className={cn(ink, lead === "lookup" ? "bg-black text-white hover:bg-[#262626]" : "hover:bg-black/10")}
          >
            Check my case
          </Link>{" "}
          <Link
            href="/signup"
            className={cn(ink, lead === "app" ? "bg-black text-white hover:bg-[#262626]" : "hover:bg-black/10")}
          >
            Start tracking cases
          </Link>
        </div>{" "}
        <p className="mt-5 text-sm">
          <Link href="/tools" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
            Or browse the case data, no account needed
          </Link>
        </p>
      </div>
    </section>
  );
}
