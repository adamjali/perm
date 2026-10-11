import Link from "next/link";
import { CaretRightIcon, CheckCircleIcon } from "@phosphor-icons/react/ssr";

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

/** The steps to the badge, in order: a real sequence, so they're numbered. */
const STEPS: { title: string; line: string }[] = [
  { title: "Claim your firm's page", line: "Firms in DOL's files already have one." },
  { title: "We check the claim", line: "By the email domains DOL's records tie to your firm, or by hand." },
  { title: "Paste the badge", line: "It links your site to your firm's PERM record." },
];

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
        <h2 id="for-your-site-h" className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
          Put PERM Tracker on your firm&apos;s site
        </h2>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">
          Clients check their own case on your page. Free, and it links back to their full record.
        </p>{" "}

        {/* The two things a firm can paste, side by side at the same height:
            the checker running live, and the badge as it renders. */}
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2 [&>*]:min-w-0">
          <figure className="m-0">
            <div className="border-3 border-border bg-card shadow-hard">
              <div className="flex items-center gap-3 border-b-3 border-border bg-muted px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-3 w-3 border-2 border-border bg-background" />
                  <span className="h-3 w-3 border-2 border-border bg-background" />
                  <span className="h-3 w-3 border-2 border-border bg-background" />
                </span>{" "}
                <span className="min-w-0 flex-1 truncate border-2 border-border bg-background px-3 py-1 font-mono text-sm text-foreground/70">
                  yourfirm.com/check-your-case
                </span>
              </div>
              {/* Taller on a phone, where the checker's help line wraps. */}
              <iframe
                src={`/embed/${lookup.slug}`}
                title={`${lookup.title}, as it shows on a firm's site`}
                loading="lazy"
                className="block h-[18.5rem] w-full border-0 sm:h-[15rem]"
              />
            </div>{" "}
            <figcaption className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
              <CopyButton text={snippet} label="Copy the checker's code" />{" "}
              <Link href="/badges#embeds" className={`inline-flex min-h-11 items-center ${link}`}>
                Every tool you can embed
              </Link>
            </figcaption>{" "}
            <details className="group mt-3 text-base">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
                <CaretRightIcon size={16} weight="bold" aria-hidden="true" className="transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                See the code
              </summary>{" "}
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words border-2 border-border bg-muted p-3 font-mono text-sm">
                {snippet}
              </pre>
            </details>
          </figure>{" "}

          <figure className="m-0 flex flex-col">
            <div className="grid flex-1 grid-cols-1 border-3 border-border shadow-hard sm:grid-cols-2 lg:grid-cols-1">
              <div className="flex min-h-36 items-center justify-center bg-neutral-950 p-6 sm:p-8">
                <span
                  aria-hidden="true"
                  className="block w-full max-w-[22rem] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: badge("dark") }}
                />
              </div>{" "}
              <div className="flex min-h-36 items-center justify-center border-t-3 border-border bg-neutral-50 p-6 sm:border-l-3 sm:border-t-0 sm:p-8 lg:border-l-0 lg:border-t-3">
                <span
                  aria-hidden="true"
                  className="block w-full max-w-[22rem] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: badge("light") }}
                />
              </div>
            </div>{" "}
            <figcaption className="mt-5 flex items-start gap-2 text-base text-foreground/80">
              <CheckCircleIcon size={20} weight="bold" className="mt-0.5 shrink-0 text-primary-text" aria-hidden="true" />
              <span>The badge says &ldquo;Verified firm&rdquo; only after we&apos;ve confirmed the claim.</span>
            </figcaption>
          </figure>
        </div>{" "}

        <h3 className="mt-14 font-heading text-2xl font-black">Getting the badge</h3>{" "}
        <ol className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4 border-2 border-border bg-card p-5 shadow-hard-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-border bg-primary font-heading text-lg font-black text-primary-foreground">
                {i + 1}
              </span>{" "}
              <span>
                <span className="block font-heading text-lg font-black">{step.title}</span>{" "}
                <span className="mt-1 block text-base text-foreground/75">{step.line}</span>
              </span>{" "}
            </li>
          ))}
        </ol>{" "}
        <p className="mt-6">
          <Link href="/perm-attorneys" className={`inline-flex min-h-11 items-center gap-2 border-2 border-border bg-primary px-5 font-heading font-black text-primary-foreground shadow-hard transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}>
            Find your firm&apos;s page
          </Link>
        </p>
      </div>
    </section>
  );
}
