import type { Metadata } from "next";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { EadExtensionCalculator } from "@/components/tools/EadExtensionCalculator";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * Was a work permit automatically extended by its renewal? Since October 30,
 * 2025 the answer turns first on one date, and the page leads with it. The
 * rules are quoted from the Federal Register and the regulation as it now
 * reads (src/lib/eadExtension.ts carries the citations).
 */

const TITLE = "EAD Automatic Extension Calculator";
const DESCRIPTION =
  "Whether your work permit was automatically extended by a renewal, and to when, under the October 30, 2025 rule and 8 CFR 274a.13.";
const PATH = "/tools/ead-extension";

// No social card yet (a card is a capture of the rendered page).
export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "ead-extension");

export const dynamic = "force-static";

const FR_URL = "https://www.federalregister.gov/documents/2025/10/30/2025-19702/removal-of-the-automatic-extension-of-employment-authorization-documents";
const ECFR_URL = "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-274a/subpart-B/section-274a.13";

const FAQS = [
  {
    q: "What changed on October 30, 2025?",
    a: "DHS's interim final rule at 90 FR 48799 added 8 CFR 274a.13(e): a renewal received on or after October 30, 2025 no longer extends an expiring EAD, except where a law or a TPS Federal Register notice provides one. Renewals received before that date keep the old rule in 274a.13(d), an extension of up to 540 days.",
  },
  {
    q: "Does this affect an EAD that was already extended?",
    a: "No. The rule says it doesn't affect EADs automatically extended before October 30, 2025, and 274a.13(d) still governs any renewal received before that date.",
  },
  {
    q: "What did the 540-day extension require?",
    a: "Three things in 274a.13(d)(1): the renewal received before the date on the card, in the same category as the card, and in a category USCIS listed (it included (c)(9), a pending I-485, and (c)(26), an H-4 spouse). The extension starts the day after the card's date and ends after 540 days or on a denial, whichever comes first. H-4, L-2 and E spouses' extensions also ended with the I-94.",
  },
  {
    q: "When should I file the renewal?",
    a: "Early. USCIS's I-765 page says it generally recommends filing a renewal up to 180 days before the current card expires, and that it generally doesn't backdate or postdate the new card to the end of the old one. With no automatic extension, a renewal still pending when the old card expires leaves a gap. Whether anything else authorizes you to work in that gap depends on your status, which is a question for an attorney.",
  },
];

export default function EadExtensionPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({ "@type": "Question" as const, name: f.q, acceptedAnswer: { "@type": "Answer" as const, text: f.a } })),
  };
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">Was my work permit extended?</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          A renewal received on or after October 30, 2025 no longer extends an expiring EAD. Before that, most
          employment-based cards were extended up to 540 days while the renewal was pending.
        </p>
      </header>

      <div className="mt-8">
        <EadExtensionCalculator />
      </div>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">The rules, from the source</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          The October 30, 2025 interim final rule,{" "}
          <a href={FR_URL} rel="noopener" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            90 FR 48799
          </a>
          , added a paragraph (e) to{" "}
          <a href={ECFR_URL} rel="noopener" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            8 CFR 274a.13
          </a>{" "}
          and limited the older paragraph (d) to renewals received before that date. DHS took comments until
          December 1, 2025 and has published no final rule since (checked October 4, 2026).
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>

      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/guides/ead-and-advance-parole-timelines", label: "EAD and advance parole timelines", note: "how long USCIS takes on the I-765" },
          { href: "/uscis-processing-times", label: "USCIS processing times", note: "the I-765's median, quarter by quarter" },
        ]}
      />
    </div>
  );
}
