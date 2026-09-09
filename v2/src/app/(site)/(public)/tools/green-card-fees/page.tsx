import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FaqList } from "@/components/tools/FaqList";
import { GreenCardFeesCalculator } from "@/components/tools/GreenCardFeesCalculator";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { openGraphBase } from "@/lib/openGraphBase";
import { FEE_SCHEDULE } from "@/lib/perm";
import { withSocialCard } from "@/lib/socialCard";

/**
 * USCIS government fees for the employment-based green card.
 *
 * A total from one edition of Form G-1055, with the edition date on the page
 * and the list of what the total leaves out. The question people ask is
 * "what does the whole thing cost", and the honest answer is a government
 * figure with a fence around it.
 */

const TITLE = "Employment-Based Green Card Government Fees Calculator";
const DESCRIPTION = `USCIS filing fees for an employment-based green card from Form G-1055 (edition ${FEE_SCHEDULE.edition}): I-140 and the asylum program fee, premium processing, I-485, work permit and advance parole per person.`;

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/green-card-fees" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/tools/green-card-fees" },
}, "green-card-fees");

export const dynamic = "force-static";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const FAQS = [
  {
    q: "What is the asylum program fee, and why is it on an I-140?",
    a: `USCIS's 2024 fee rule attached a fee to every I-129 and I-140 to fund asylum processing. On the ${FEE_SCHEDULE.edition} schedule it is ${usd(FEE_SCHEDULE.asylumProgramFee.regular)} for a regular petitioner, ${usd(FEE_SCHEDULE.asylumProgramFee.small)} for a small employer with 25 or fewer full-time employees or a self-petitioner, and ${usd(FEE_SCHEDULE.asylumProgramFee.nonprofit)} for a nonprofit. It is paid with the I-140 fee, not instead of it.`,
  },
  {
    q: "Does the PERM cost anything to file?",
    a: "No. DOL charges no fee for the prevailing wage request or the ETA-9089. The employer pays for recruitment and for the attorney, and 20 CFR 656.12 forbids passing those PERM-stage costs to the worker.",
  },
  {
    q: "Are the work permit and advance parole still free with an I-485?",
    a: `Not since April 1, 2024. An I-765 filed with or after a pending I-485 costs ${usd(FEE_SCHEDULE.i765WithPendingI485)} and an I-131 costs ${usd(FEE_SCHEDULE.i131WithPendingI485)} on the ${FEE_SCHEDULE.edition} schedule. Renewals of each are charged again.`,
  },
  {
    q: "Can I pay to speed up the I-485?",
    a: `No. Premium processing (Form I-907) covers the I-140, at ${usd(FEE_SCHEDULE.i907I140)}, and shortens USCIS's decision on the petition. It does nothing for the visa bulletin or the I-485 queue, which are where most of the wait is.`,
  },
];

export default function GreenCardFeesPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: FAQS.map((f) => ({ "@type": "Question" as const, name: f.q, acceptedAnswer: { "@type": "Answer" as const, text: f.a } })),
  };
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/tools" className="underline underline-offset-2 hover:text-primary">
            Tools
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Green card government fees
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          What USCIS charges for the employment-based green card, line by line
          from its own fee schedule, edition {FEE_SCHEDULE.edition}. The
          attorney, the recruitment and the medical exam are not in it, and the
          page says so.
        </p>
      </header>
      <section className="mt-10">
        <GreenCardFeesCalculator />
      </section>
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <FaqList items={FAQS} />
      </section>
      <ToolPageFooter
        currentHref="/tools/green-card-fees"
        reading={[
          { href: "/tools/green-card-timeline", label: "Green card timeline", note: "how long each of these stages takes" },
          { href: "/tools/i140-calculator", label: "I-140 queue", note: "what premium processing actually skips" },
          { href: "/tools/i485-queue-position", label: "I-485 queue position", note: "the wait no fee shortens" },
        ]}
      />
    </div>
  );
}
