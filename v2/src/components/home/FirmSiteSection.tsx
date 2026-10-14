import Link from "next/link";
import { CheckCircleIcon } from "@phosphor-icons/react/ssr";

import { CopyButton } from "@/components/badges/BadgeCatalogue";
import { renderBadge } from "@/lib/badgeRender";
import { SITE_URL } from "@/lib/constants/site";
import { EMBEDS, embedSnippet } from "@/lib/embeds";
import { firmBadgeSpec } from "@/lib/firmBadge";

/**
 * What a firm can put on its own site, shown working: the case checker live
 * inside a frame drawn as the firm's own page, and the badge as it renders.
 * Both link back to this site, which is how a firm's clients find the rest.
 */

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

const STEPS = ["Claim your firm's page", "We check the claim", "Paste the badge"];

export function FirmSiteSection() {
  const lookup = EMBEDS.find((e) => e.slug === "case-status")!;
  const snippet = embedSnippet(lookup, SITE_URL);
  // The badge exactly as a verified firm's site will load it, drawn here from
  // the same renderer the badge route uses.
  const badge = (theme: "dark" | "light") =>
    renderBadge(firmBadgeSpec("Your firm", "your-firm", true), "shield", theme);

  return (
    <section id="for-your-site" aria-labelledby="for-your-site-h" className="bg-background">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8 sm:py-24">
        <h2 id="for-your-site-h" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          Put PERM Tracker on your firm&apos;s site
        </h2>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">
          Clients check their own case on your page. Free, and it links back to their full record.
        </p>{" "}

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] [&>*]:min-w-0">
          <div>
            <div className="border border-border bg-card">
              <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-3 w-3 border border-border bg-background" />
                  <span className="h-3 w-3 border border-border bg-background" />
                  <span className="h-3 w-3 border border-border bg-background" />
                </span>{" "}
                <span className="min-w-0 flex-1 truncate border border-border bg-background px-3 py-1 font-mono text-sm text-muted-foreground">
                  yourfirm.com/check-your-case
                </span>
              </div>
              <iframe
                src={`/embed/${lookup.slug}`}
                title={`${lookup.title}, as it shows on a firm's site`}
                loading="lazy"
                className="block h-[18.5rem] w-full border-0 sm:h-[15rem]"
              />
            </div>{" "}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <CopyButton text={snippet} />{" "}
              <span className="text-base text-soft">the code for this checker, ready to paste</span>{" "}
              <Link href="/badges#embeds" className={`ml-auto inline-flex min-h-11 items-center ${link}`}>
                Every tool you can embed
              </Link>
            </div>
          </div>{" "}

          <div className="flex flex-col">
            <div className="grid grid-cols-1 border border-border sm:grid-cols-2 lg:grid-cols-1">
              <div className="flex min-h-36 items-center justify-center bg-neutral-950 p-6 sm:p-8">
                <span
                  aria-hidden="true"
                  className="block w-full max-w-[22rem] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: badge("dark") }}
                />
              </div>{" "}
              <div className="flex min-h-36 items-center justify-center border-t border-border bg-neutral-50 p-6 sm:border-l sm:border-t-0 sm:p-8 lg:border-l-0 lg:border-t">
                <span
                  aria-hidden="true"
                  className="block w-full max-w-[22rem] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: badge("light") }}
                />
              </div>
            </div>{" "}
            <h3 className="mt-8 font-heading text-xl font-bold">A badge for a verified firm</h3>{" "}
            <ol className="mt-4 space-y-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-primary font-heading text-lg font-bold text-primary-foreground">
                    {i + 1}
                  </span>{" "}
                  <span className="text-lg font-semibold">{step}</span>{" "}
                </li>
              ))}
            </ol>{" "}
            <p className="mt-6 flex items-start gap-2 text-base text-soft">
              <CheckCircleIcon size={20} weight="bold" className="mt-0.5 shrink-0 text-primary-text" aria-hidden="true" />
              <span>It says &ldquo;Verified firm&rdquo; only after we&apos;ve confirmed the claim, and links to your record.</span>
            </p>{" "}
            <p className="mt-5 text-base">
              <Link href="/perm-attorneys" className={`inline-flex min-h-11 items-center ${link}`}>
                Find your firm
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
