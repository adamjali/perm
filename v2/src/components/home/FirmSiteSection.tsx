import Link from "next/link";

import { CopyButton } from "@/components/badges/BadgeCatalogue";
import { SITE_URL } from "@/lib/constants/site";
import { EMBEDS, embedSnippet } from "@/lib/embeds";

/**
 * What a firm can put on its own site: the case lookup as a frame, and the
 * badge a verified firm gets. Both link back to this site, which is how a
 * firm's clients find the rest of it.
 */

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function FirmSiteSection() {
  const lookup = EMBEDS.find((e) => e.slug === "case-status")!;
  const snippet = embedSnippet(lookup, SITE_URL);
  return (
    <section id="for-your-site" aria-labelledby="for-your-site-h" className="bg-background">
      <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-8 sm:py-20">
        <h2 id="for-your-site-h" className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
          Put PERM Tracker on your firm&apos;s site
        </h2>{" "}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] [&>*]:min-w-0">
          <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
            <h3 className="font-heading text-lg font-black">A case checker for your clients</h3>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/80">
              Clients can type their case number on your site and see DOL&apos;s live status. It answers PERM, wage
              request, H-1B, H-2A, H-2B and CW-1 numbers. Paste this where you want it:
            </p>{" "}
            <div className="mt-4 flex flex-wrap items-start gap-3">
              <code className="block min-w-0 flex-1 whitespace-pre-wrap break-all border-2 border-border bg-background px-3 py-2 font-mono text-sm">
                {snippet}
              </code>{" "}
              <CopyButton text={snippet} />
            </div>{" "}
            <p className="mt-4 text-base">
              <Link href="/badges#embeds" className={link}>
                Every tool you can embed
              </Link>
            </p>
          </div>{" "}
          <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
            <h3 className="font-heading text-lg font-black">A badge for a verified firm</h3>{" "}
            <p className="mt-2 text-base leading-relaxed text-foreground/80">
              Claim your firm&apos;s page from the foot of it. Once we&apos;ve verified the claim, the page gives you a
              &ldquo;Verified firm&rdquo; badge that links to your PERM record.
            </p>{" "}
            <p className="mt-4 text-base">
              <Link href="/perm-attorneys" className={link}>
                Find your firm
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
