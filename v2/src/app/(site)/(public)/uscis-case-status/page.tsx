import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowSquareOutIcon, WarningIcon } from "@phosphor-icons/react/ssr";

import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { SavedReceipts } from "@/components/tools/SavedReceipts";
import { UscisReceiptForm } from "@/components/tools/UscisReceiptForm";
import { UscisStatusResult } from "@/components/tools/UscisStatusResult";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import {
  RECEIPT_PREFIXES,
  RECEIPT_SHAPE_MESSAGE,
  decodeReceipt,
  normaliseReceipt,
} from "@/lib/uscis/receipt";
import { uscisEnabled } from "@/lib/uscis/torchClient";
import { MoreText } from "@/components/data/MoreText";
import { buttonVariants } from "@/components/ui/button";

/**
 * A USCIS receipt number in; what it encodes, and (with USCIS's API keys on
 * the deployment) the case status from USCIS's Case Status API.
 *
 * TWO STATES, BOTH HONEST. Until `USCIS_ENV` and the two credentials exist on
 * the deployment, the page decodes the receipt (prefix, office, the
 * conventional reading of the digits) and hands the reader to USCIS's own
 * status page and to Emma. It shows no status at all and says nothing about
 * access it does not have (round 3, Oct 15 2026: a page promising a lookup it
 * cannot make read as broken). With the keys present, the client half asks
 * `/api/uscis-case-status`, which carries every guard.
 *
 * The two links to USCIS's own tools are in uscis.gov's blue (#1A4480, read
 * from its stylesheet Oct 15 2026; white on it measures 10:1). Only those: the
 * owner tried the whole page in navy and kept the rest as every other page.
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
        : "No. It reads what the receipt number encodes. For the status itself, USCIS Case Status Online answers every receipt, and Emma, USCIS's virtual assistant, answers questions about a case. Both are linked on this page.",
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
      a: enabled
        ? "Yes, and nothing about you. Each lookup sends the receipt number to USCIS and keeps what comes back: the receipt number, the form type, the status text, the dated history and the time of the lookup. A stored lookup is deleted twelve months after the last lookup of that receipt, or sooner on request. No name, email or address is asked for or kept. Section 18 of the privacy policy states exactly this."
        : "This page doesn't store it. The number sits in the page's address so you can bookmark or share the result, and decoding it asks nothing of USCIS. A list you save stays in your own browser.",
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

  const prefixes = Object.entries(RECEIPT_PREFIXES);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={faqSchema} />

      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          Check a USCIS case by receipt number
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">
          The number at the top of an I-797 notice. See which office issued it, what the digits mean,
          and{" "}
          {enabled
            ? "the case's current status from USCIS."
            : "where USCIS shows its status."}{" "}
          A DOL number (G-100-…) goes on the{" "}
          <Link href="/perm-case-status" className={link}>
            PERM case page
          </Link>
          .
        </p>
      </header>

      <div className="mt-8 border-2 border-border bg-tint p-5 shadow-hard sm:p-6">
        <UscisReceiptForm defaultValue={typed} live={enabled} />
      </div>

      <SavedReceipts current={receipt} />

      {malformed ? (
        <p className="mt-6 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-soft">
          <WarningIcon className="mt-1 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>
            <b className="font-bold text-data-warn-ink">That is not the shape of a USCIS receipt number,</b>{" "}
            so nothing was looked up. {RECEIPT_SHAPE_MESSAGE}
          </span>
        </p>
      ) : null}

      {dolNumber ? (
        <div className="mt-6 bg-tint p-5 border-2 border-border">
          <p className="text-base leading-relaxed">
            <b className="font-bold">That is a Department of Labor number.</b> USCIS has no record
            under it; DOL does, and the PERM case page reads it.
          </p>{" "}
          <p className="mt-3">
            <Link
              href={`/perm-case-status?case=${encodeURIComponent(dolNumber)}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Look up {dolNumber} at DOL
            </Link>
          </p>
        </div>
      ) : null}

      {decoded ? (
        <section className="mt-8" aria-labelledby="decoded-heading">
          <h2 id="decoded-heading" className="font-heading text-2xl font-bold">
            What <span className="font-mono">{decoded.receipt}</span> encodes
          </h2>{" "}
          <dl className="mt-4 grid gap-x-8 gap-y-4 border-2 border-border bg-tint p-5 text-sm shadow-hard sm:grid-cols-3 sm:p-6">
            <div>
              <dt className="font-bold text-muted-foreground">Prefix {decoded.prefix}</dt>{" "}
              <dd className="mt-1 text-base">
                {decoded.office ? decoded.office.name : "An office USCIS's glossary does not name"}
                {decoded.office?.source === "notices" ? " (seen on notices; not in USCIS's glossary list)" : ""}
              </dd>
            </div>{" "}
            {decoded.convention ? (
              <>
                <div>
                  <dt className="font-bold text-muted-foreground">Fiscal year, by convention</dt>{" "}
                  <dd className="mt-1 text-base">FY{decoded.convention.fiscalYear}</dd>
                </div>{" "}
                <div>
                  <dt className="font-bold text-muted-foreground">Workday and sequence, by convention</dt>{" "}
                  <dd className="mt-1 text-base">
                    Day {decoded.convention.workday}, number {decoded.convention.sequence}
                  </dd>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <dt className="font-bold text-muted-foreground">Digits</dt>{" "}
                <dd className="mt-1 text-base">Masked by USCIS; nothing to read.</dd>
              </div>
            )}
          </dl>{" "}
          <p className="border-t-2 border-border bg-tint px-5 py-3 text-sm text-muted-foreground sm:px-6">
            The reading of the digits is a practitioner convention. USCIS publishes the
            letters&apos; meaning and not the digits&apos;, so the year and day are labelled
            as convention rather than fact.
          </p>
        </section>
      ) : null}

      {enabled ? (
        receipt ? (
          <div className="mt-8">
            <UscisStatusResult receipt={receipt} />
          </div>
        ) : null
      ) : (
        <div className="mt-8">
          <CheckWithUscis />
        </div>
      )}

      <section className="mt-14">
        <h2 className="font-heading text-2xl font-bold">The three letters</h2>{" "}
        <MoreText gist={"Seven office prefixes from USCIS's glossary, plus one seen on notices."} className="mt-3">
          <p className="max-w-2xl text-base leading-relaxed text-soft">
            USCIS&apos;s glossary names seven prefixes. One more, YSC, appears on
            notices from the Potomac Service Center and is listed here as seen on
            notices rather than as USCIS&apos;s own definition. Any three letters
            are accepted by USCIS&apos;s own validation, so a new one would still
            look up.
          </p>
        </MoreText>{" "}
        <details className="group mt-4 bg-tint">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-heading text-base font-bold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>Every prefix, and the office it names</span>{" "}
            <span aria-hidden="true" className="font-mono text-sm text-primary transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none">
              &gt;
            </span>
          </summary>{" "}
          <dl className="divide-y divide-border border-t-2 border-border">
            {prefixes.map(([code, p]) => (
              <div key={code} className="grid gap-x-6 gap-y-1 px-5 py-3 sm:grid-cols-[6rem_1fr] sm:items-center sm:px-6">
                <dt>
                  <span className="font-mono text-base font-bold">{code}</span>
                </dt>{" "}
                <dd className="text-base leading-relaxed text-soft">
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
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>{" "}
        <FaqList items={faqs} />
      </section>

      {enabled ? <DataProvenance datasets={["uscis-case-status"]} /> : null}
      {enabled ? (
      <MoreText gist={"Statuses are USCIS's own words, timed; USCIS is the authority."} className="mt-2">
        <p className="text-sm text-muted-foreground">
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
      </MoreText>
      ) : (
        <p className="mt-10 text-sm text-muted-foreground">
          The office names come from USCIS&apos;s glossary; the reading of the digits is a
          convention and is labelled as one. USCIS is the authority for any receipt, and{" "}
          <a href={USCIS_STATUS_URL} rel="noopener noreferrer" className={link}>
            its own status page
          </a>{" "}
          answers every one.
        </p>
      )}

      <PageBasics page="uscis-case-status" title="More questions" />

      <ToolPageFooter currentHref="/uscis-case-status" reading={READING} />
    </div>
  );
}

/**
 * Where the status lives while this page has no USCIS keys: USCIS's own two
 * tools, as uscis.gov-blue buttons in an ordinary box. Says nothing about access it does not have, and
 * never shows a status it did not get from USCIS.
 */
function CheckWithUscis() {
  const tiles = [
    {
      href: USCIS_STATUS_URL,
      title: "USCIS Case Status Online",
      note: "Opens egov.uscis.gov.",
    },
    {
      href: USCIS_EMMA_URL,
      title: "Emma, USCIS's virtual assistant",
      note: "USCIS's own chat tool for case and form questions. Opens uscis.gov.",
    },
  ];
  return (
    <section
      aria-labelledby="check-heading"
      className="border-2 border-border bg-card p-5 shadow-hard sm:p-6"
    >
      <h2 id="check-heading" className="font-heading text-2xl font-bold">
        Check case status with USCIS
      </h2>{" "}
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {tiles.map((t) => (
          <Fragment key={t.href}>
            {" "}
            <li className="flex">
              <a
                href={t.href}
                rel="noopener noreferrer"
                className="lift flex min-h-[44px] w-full items-start justify-between gap-3 border-2 border-black bg-[#1A4480] px-4 py-3 text-white shadow-hard-sm hover:bg-[#005288] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex flex-col">
                  <span className="font-heading text-base font-bold">{t.title}</span>{" "}
                  <span className="text-sm text-white/85">{t.note}</span>
                </span>{" "}
                <ArrowSquareOutIcon aria-hidden="true" weight="bold" className="mt-1 size-4 shrink-0" />
              </a>
            </li>
          </Fragment>
        ))}
      </ul>
    </section>
  );
}
