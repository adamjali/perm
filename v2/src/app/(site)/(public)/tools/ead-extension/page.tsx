import type { Metadata } from "next";

import ScreenshotFigure from "@/components/content/ScreenshotFigure";
import { BarRows } from "@/components/data/BarRows";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { EadExtensionCalculator } from "@/components/tools/EadExtensionCalculator";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { getUscisPosted } from "@/lib/db/uscisPosted";
import { openGraphBase } from "@/lib/openGraphBase";
import { h4EadTimes } from "@/lib/uscisPosted";
import { longDate } from "@convex/lib/months";
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

// Daily: the H-4 section prints USCIS's newest posted times (perm_docs['uscis_posted_times'], read twice a day).
export const revalidate = 86400;

const FR_URL = "https://www.federalregister.gov/documents/2025/10/30/2025-19702/removal-of-the-automatic-extension-of-employment-authorization-documents";
/** DHS's final rule, 2026-20955: it finalized the interim rule without changes, effective Oct 14 2026. */
const FINAL_RULE_URL =
  "https://www.federalregister.gov/documents/2026/10/14/2026-20955/removal-of-automatic-extensions-for-certain-employment-authorization-documents";
const H4_RULE_URL = "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2#p-214.2(h)(9)(iv)";
const ECFR_URL = "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-274a/subpart-B/section-274a.13";

const FAQS = [
  {
    q: "What changed on October 30, 2025?",
    a: "DHS's interim final rule at 90 FR 48799 added 8 CFR 274a.13(e): a renewal received on or after October 30, 2025 no longer extends an expiring EAD, except where a law or a TPS Federal Register notice provides one. Renewals received before that date keep the old rule in 274a.13(d), an extension of up to 540 days. DHS's final rule at 91 FR 65306, effective October 14, 2026, kept those rules without changes.",
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

export default async function EadExtensionPage() {
  const h4 = h4EadTimes(await getUscisPosted(), new Date().toISOString().slice(0, 10));
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
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Was my work permit extended?</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          A renewal received on or after October 30, 2025 no longer extends an expiring EAD. Before that, most
          employment-based cards were extended up to 540 days while the renewal was pending.
        </p>
      </header>

      <div className="mt-8">
        <EadExtensionCalculator />
      </div>

      <section className="mt-10 max-w-4xl">
        <h2 className="font-heading text-2xl font-bold">Where the card prints them</h2>{" "}
        <ScreenshotFigure
          src="/images/tools/ead-cards.webp"
          alt="USCIS sample work permits, the older design and the 2023 redesign, each showing a Category code and a Card Expires date"
          caption="USCIS's sample cards, the older design on the left and the 2023 redesign on the right. The date the tool needs is the one after Card Expires, and the category prints as a letter and a number: C11 is (c)(11). The red rings are USCIS's own, marking the redesign's new security features."
          credit="Image: U.S. Citizenship and Immigration Services"
          creditHref="https://www.uscis.gov/sites/default/files/document/guides/EAD_Comparison_EN.pdf"
          aspectRatio={1520 / 530}
          maxWidth={960}
        />
      </section>

      <section className="mt-10 max-w-3xl" id="h4-ead">
        <h2 className="font-heading text-2xl font-bold">H-4 EAD: who can apply, and how long it takes</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-soft">
          An H-4 spouse of an H-1B worker can get a work permit only if the H-1B worker has an approved I-140, or is
          in H-1B status past six years under sections 106(a) and (b) of AC21 (
          <a href={H4_RULE_URL} rel="noopener" className="link">
            8 CFR 214.2(h)(9)(iv)
          </a>
          ).
        </p>{" "}
        {h4 ? (
          <>
            <p className="mt-3 text-base leading-relaxed text-soft">
              How long USCIS took to decide 80% of these applications over the past six months, as its processing-times
              page posted on {longDate(h4.published)}. Filing with the H-4 extension is the faster route.
            </p>{" "}
            <div className="mt-4">
              <BarRows
                label="USCIS's posted time for an H-4 work permit, by how it's filed"
                inline
                rows={h4.rows.map((r, i) => ({
                  key: r.key,
                  label: r.name,
                  value: r.months,
                  text: r.text,
                  tone: i === 0 ? "primary" : "blue",
                }))}
              />
            </div>
          </>
        ) : (
          <p className="mt-3 text-base leading-relaxed text-soft">
            USCIS&rsquo;s current times for it are on{" "}
            <a href="https://egov.uscis.gov/processing-times/" rel="noopener" className="link">
              its processing-times page
            </a>{" "}
            (Form I-765, category (c)(26)).
          </p>
        )}
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="font-heading text-2xl font-bold">The rules, from the source</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-soft">
          The October 30, 2025 interim final rule,{" "}
          <a href={FR_URL} rel="noopener" className="link">
            90 FR 48799
          </a>
          , added a paragraph (e) to{" "}
          <a href={ECFR_URL} rel="noopener" className="link">
            8 CFR 274a.13
          </a>{" "}
          and limited the older paragraph (d) to renewals received before that date. DHS&rsquo;s final rule,{" "}
          <a href={FINAL_RULE_URL} rel="noopener" className="link">
            91 FR 65306
          </a>
          , kept both without changes; it took effect October 14, 2026.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
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
