import type { Metadata } from "next";
import Link from "next/link";
import { WarningIcon } from "@phosphor-icons/react/ssr";

import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { UscisReceiptForm } from "@/components/tools/UscisReceiptForm";
import { UscisStatusResult } from "@/components/tools/UscisStatusResult";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import {
  RECEIPT_PREFIXES,
  RECEIPT_SHAPE_MESSAGE,
  decodeReceipt,
  normaliseReceipt,
} from "@/lib/uscis/receipt";
import { uscisEnabled } from "@/lib/uscis/torchClient";

/**
 * A USCIS receipt number in; what it encodes, and (once USCIS has issued API
 * keys) the case status from USCIS's Case Status API.
 *
 * TWO STATES, BOTH HONEST. Until `USCIS_ENV` and the two credentials exist on
 * the deployment, the page decodes the receipt (prefix, office, the
 * conventional reading of the digits) and says in words that live status is
 * pending, with links to USCIS's own status page and to Emma. It never shows
 * a status it did not get from USCIS. With the keys present, the client half
 * asks `/api/uscis-case-status`, which carries every guard.
 *
 * WHY A SEPARATE PAGE FROM `/perm-case-status`. Different agency, different
 * record, different lookup, different terms of use. One page that reads both
 * is how a P-100 row leaked into the PERM table. The DOL page recognises a
 * receipt and redirects here; this page recognises a DOL number and points
 * back.
 *
 * `?receipt=` results are `noindex` for the same reasons `?case=` is on the
 * DOL page: an unbounded crawl space of federal identifiers. The bare path is
 * canonical on every variant.
 */

const TITLE = "USCIS Case Status by Receipt Number";
const DESCRIPTION =
  "Look up a USCIS receipt number like EAC2190123456: which office issued it, what its digits encode, and where USCIS shows the case status today.";

const USCIS_STATUS_URL = "https://egov.uscis.gov/casestatus/landing.do";
const USCIS_EMMA_URL = "https://www.uscis.gov/tools/meet-emma-our-virtual-assistant";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string }>;
}): Promise<Metadata> {
  const { receipt: raw } = await searchParams;
  const hasReceipt = typeof raw === "string" && raw.trim().length > 0;
  return withSocialCard({
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/uscis-case-status" },
    robots: hasReceipt ? { index: false, follow: true } : undefined,
    openGraph: {
      ...openGraphBase,
      title: `${TITLE} | PERM Tracker`,
      description: DESCRIPTION,
      url: "/uscis-case-status",
    },
  }, "uscis-case-status");
}

function faqsFor(enabled: boolean) {
  return [
    {
      q: "What is a USCIS receipt number?",
      a: "The 13-character identifier USCIS assigns to a filing: three letters and ten digits, like EAC2190123456. USCIS's glossary says the letters are the office that took the case (EAC, WAC, LIN, SRC, NBC, MSC or IOE) and the ten digits are the number itself. It is the key to the case at USCIS, the way a G-100 number is the key to a PERM case at the Department of Labor.",
    },
    {
      q: "Where do I find my receipt number?",
      a: "At the top of the I-797 notice USCIS mailed after the filing was accepted, and on every later notice about the same case. If the filing went through a USCIS online account, the receipt starts with IOE and is shown in the account. The employer's attorney has it if you do not.",
    },
    {
      q: "Does this page show my case status?",
      a: enabled
        ? "Yes. It asks USCIS's Case Status API for the receipt you type and shows USCIS's own status text and dates, with the time we last heard from USCIS printed beside them. A copy under six hours old is answered from our record rather than asking USCIS again."
        : "Not yet. PERM Tracker's application for USCIS API access is pending. Until USCIS issues keys, this page decodes what the receipt number encodes and links you to USCIS's own status page, which answers the same receipt today. No status is shown here that did not come from USCIS.",
    },
    {
      q: "Is this the same as my PERM case number?",
      a: "No. A PERM case number (G-100-26125-868956) is the Department of Labor's record of the labor certification. A USCIS receipt number is USCIS's record of the petition filed after it, most often the I-140, or of the I-485 filed after that. Each agency answers only its own number. Type a DOL number here and this page sends you to the PERM lookup.",
    },
    {
      q: "What do the digits mean?",
      a: "USCIS does not publish a reading of them. The convention practitioners use is that the first two digits are the federal fiscal year, the next three are the workday of that year on which the case was receipted, and the last five are a sequence number. This page shows that reading and labels it a convention, because USCIS has not confirmed it.",
    },
    {
      q: "Do you store the receipt number I type in?",
      a: "Yes, and nothing about you. When USCIS access is live, each lookup sends the receipt number to USCIS and keeps what comes back: the receipt number, the form type, the status text, the dated history and the time of the lookup. A stored lookup is deleted twelve months after the last lookup of that receipt, or sooner on request. No name, email or address is asked for or kept. Section 18 of the privacy policy states exactly this.",
    },
  ];
}

const READING = [
  {
    href: "/guides/check-perm-case-status",
    label: "Check a PERM case at DOL",
    note: "The other half of the same journey: the labor certification that comes before the I-140.",
  },
  {
    href: "/tools/i140-calculator",
    label: "The I-140 queue",
    note: "USCIS's published I-140 volumes and processing times, which is what a receipt number is waiting in.",
  },
  {
    href: "/tools/i485-queue-position",
    label: "I-485 queue position",
    note: "Where a priority date stands in USCIS's own pending inventory.",
  },
] as const;

const link = "font-bold underline underline-offset-2 hover:text-primary";

export default async function UscisCaseStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ receipt?: string }>;
}) {
  const { receipt: raw } = await searchParams;
  const typed = typeof raw === "string" ? raw.slice(0, 60) : "";
  const trimmed = typed.trim();
  const enabled = uscisEnabled();

  // A DOL number belongs on the other page. Checked FIRST, so a G-100 typed
  // here is routed rather than reported as a bad receipt.
  const dolNumber =
    trimmed.length > 0 && /^[A-Z]-\d/i.test(trimmed)
      ? (normaliseCaseNumber(trimmed) ?? trimmed.toUpperCase())
      : null;
  const receipt = !dolNumber && trimmed.length > 0 ? normaliseReceipt(trimmed) : null;
  const decoded = receipt ? decodeReceipt(receipt) : null;
  const malformed = trimmed.length > 0 && !dolNumber && receipt === null;

  const faqs = faqsFor(enabled);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: faqs.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "USCIS case status", href: "/uscis-case-status" },
  ]);

  const prefixes = Object.entries(RECEIPT_PREFIXES);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumbSchema} />

      <header>
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Link href="/tools" className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary">
            Data
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Check a USCIS case by receipt number
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80">
          The number at the top of an I-797 notice, three letters and ten digits.
          This page says which office issued it and what the digits are read as,
          and{" "}
          {enabled
            ? "asks USCIS's Case Status API for the case's current status."
            : "will read the case's status from USCIS's Case Status API once USCIS issues PERM Tracker its API keys."}{" "}
          A Department of Labor number (G-100-…) belongs on the{" "}
          <Link href="/perm-case-status" className={link}>
            PERM case page
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <UscisReceiptForm defaultValue={typed} />
      </div>

      {malformed ? (
        <p className="mt-6 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-foreground/80">
          <WarningIcon className="mt-1 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>
            <b className="font-bold text-data-warn-ink">That is not the shape of a USCIS receipt number,</b>{" "}
            so nothing was looked up. {RECEIPT_SHAPE_MESSAGE}
          </span>
        </p>
      ) : null}

      {dolNumber ? (
        <div className="mt-6 border-2 border-border bg-tint-primary p-5">
          <p className="text-base leading-relaxed">
            <b className="font-bold">That is a Department of Labor number.</b> USCIS has no record
            under it; DOL does, and the PERM case page reads it.
          </p>{" "}
          <p className="mt-3">
            <Link
              href={`/perm-case-status?case=${encodeURIComponent(dolNumber)}`}
              className="inline-flex min-h-[44px] items-center border-2 border-border bg-foreground px-5 font-mono text-sm font-bold uppercase tracking-wider text-background hover:bg-primary hover:text-primary-foreground"
            >
              Look up {dolNumber} at DOL
            </Link>
          </p>
        </div>
      ) : null}

      {decoded ? (
        <section className="mt-8" aria-labelledby="decoded-heading">
          <h2 id="decoded-heading" className="font-heading text-2xl font-black">
            What {decoded.receipt} encodes
          </h2>{" "}
          <dl className="mt-4 grid gap-x-8 gap-y-4 border-2 border-border bg-card p-5 text-sm shadow-hard sm:grid-cols-3 sm:p-6">
            <div>
              <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Prefix {decoded.prefix}</dt>{" "}
              <dd className="mt-1 text-base">
                {decoded.office ? decoded.office.name : "An office USCIS's glossary does not name"}
                {decoded.office?.source === "notices" ? " (seen on notices; not in USCIS's glossary list)" : ""}
              </dd>
            </div>{" "}
            {decoded.convention ? (
              <>
                <div>
                  <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Fiscal year, by convention</dt>{" "}
                  <dd className="mt-1 text-base">FY{decoded.convention.fiscalYear}</dd>
                </div>{" "}
                <div>
                  <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Workday and sequence, by convention</dt>{" "}
                  <dd className="mt-1 text-base">
                    Day {decoded.convention.workday}, number {decoded.convention.sequence}
                  </dd>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Digits</dt>{" "}
                <dd className="mt-1 text-base">Masked by USCIS; nothing to read.</dd>
              </div>
            )}
          </dl>{" "}
          <p className="mt-2 text-sm text-muted-foreground">
            The reading of the digits is a practitioner convention. USCIS publishes the
            letters&apos; meaning and not the digits&apos;, so the year and day are labelled
            as convention rather than fact.
          </p>
        </section>
      ) : null}

      {receipt ? (
        <div className="mt-8">
          {enabled ? (
            <UscisStatusResult receipt={receipt} />
          ) : (
            <PendingPanel receipt={receipt} />
          )}
        </div>
      ) : !enabled ? (
        <div className="mt-8">
          <PendingPanel />
        </div>
      ) : null}

      <section className="mt-14">
        <h2 className="font-heading text-2xl font-black">The three letters</h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          USCIS&apos;s glossary names seven prefixes. One more, YSC, appears on
          notices from the Potomac Service Center and is listed here as seen on
          notices rather than as USCIS&apos;s own definition. Any three letters
          are accepted by USCIS&apos;s own validation, so a new one would still
          look up.
        </p>{" "}
        <details className="group mt-4 border-2 border-border bg-card shadow-hard">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-heading text-base font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>Every prefix, and the office it names</span>{" "}
            <span aria-hidden="true" className="font-mono text-sm text-primary transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none">
              &gt;
            </span>
          </summary>{" "}
          <dl className="divide-y-2 divide-border border-t-2 border-border">
            {prefixes.map(([code, p]) => (
              <div key={code} className="grid gap-x-6 gap-y-1 px-5 py-3 sm:grid-cols-[6rem_1fr] sm:px-6">
                <dt className="font-mono text-base font-bold">{code}</dt>{" "}
                <dd className="text-base leading-relaxed text-foreground/80">
                  {p.name}
                  {p.source === "notices" ? " (seen on notices; not in USCIS's glossary list)" : ""}
                  {p.note ? ` ${p.note}` : ""}{" "}
                </dd>{" "}
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section className="mt-14">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>{" "}
        <FaqList items={faqs} />
      </section>

      <DataProvenance datasets={["uscis-case-status"]} />
      <p className="mt-2 text-sm text-muted-foreground">
        Statuses on this page, when shown, are USCIS&apos;s own words from its Case
        Status API, with the time we last heard from USCIS printed beside them. USCIS
        is the authority for any receipt and{" "}
        <a href={USCIS_STATUS_URL} rel="noopener noreferrer" className={link}>
          its own status page
        </a>{" "}
        answers every receipt today. The office names come from USCIS&apos;s glossary;
        the reading of the digits is a convention and is labelled as one. What a
        lookup sends and what is kept is stated in{" "}
        <Link href="/privacy#uscis-case-status" className={link}>
          section 18 of the privacy policy
        </Link>
        .
      </p>

      <PageBasics page="uscis-case-status" />

      <ToolPageFooter currentHref="/uscis-case-status" reading={READING} />
    </div>
  );
}

/**
 * The state while the keys are absent. Says so, plainly, and hands the reader
 * the two USCIS tools that answer today. Never a placeholder status.
 */
function PendingPanel({ receipt }: { receipt?: string }) {
  return (
    <section aria-labelledby="pending-heading" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">
        Live status
      </p>{" "}
      <h2 id="pending-heading" className="mt-2 font-heading text-2xl font-black">
        USCIS access is pending
      </h2>{" "}
      <p className="mt-3 max-w-prose text-base leading-relaxed text-foreground/80">
        This page will check live once USCIS issues API keys. PERM Tracker&apos;s
        application for USCIS Case Status API access is in progress, and until it
        is granted nothing here is looked up at USCIS.{" "}
        {receipt ? `The receipt ${receipt} has been decoded above and not checked.` : ""}
      </p>{" "}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        <li className="flex">
          <a
            href={USCIS_STATUS_URL}
            rel="noopener noreferrer"
            className="flex min-h-[44px] w-full flex-col justify-center border-2 border-border bg-background px-4 py-3 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="font-heading text-base font-bold">USCIS Case Status Online</span>{" "}
            <span className="text-sm text-muted-foreground">
              The same receipt, answered by USCIS today. Opens egov.uscis.gov.
            </span>
          </a>{" "}
        </li>{" "}
        <li className="flex">
          <a
            href={USCIS_EMMA_URL}
            rel="noopener noreferrer"
            className="flex min-h-[44px] w-full flex-col justify-center border-2 border-border bg-background px-4 py-3 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <span className="font-heading text-base font-bold">Emma, USCIS&apos;s virtual assistant</span>{" "}
            <span className="text-sm text-muted-foreground">
              USCIS&apos;s own chat tool for case and form questions. Opens uscis.gov.
            </span>
          </a>{" "}
        </li>
      </ul>
    </section>
  );
}
