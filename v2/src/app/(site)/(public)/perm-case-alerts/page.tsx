import type { Metadata } from "next";
import Link from "next/link";
import { BellRingingIcon, BuildingsIcon, CalendarCheckIcon, CurrencyDollarIcon, EnvelopeSimpleIcon, NewspaperIcon } from "@phosphor-icons/react/ssr";

import { PageSection } from "@/components/data/PageSection";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { BulletinAlertForm } from "@/components/tools/BulletinAlertForm";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { DigestSignupForm } from "@/components/tools/DigestSignupForm";
import { FaqList } from "@/components/tools/FaqList";
import { currentMonthUtc } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

import { QueueAlertForm } from "../perm-processing-times/QueueAlertForm";

/**
 * Every free email alert on one page: a case, a filing month, a wage request's
 * month, the visa bulletin, an employer, and the weekly digest on its own (Oct
 * 29 2026: the wage-request queue and the digest had no place here). Built for the searches that never reached the site (Search
 * Console, 3 months to Oct 28 2026: no appearance at all for any search naming
 * an alert, an email or a notification), and for the person who wants to be told
 * rather than check. Each form is the one its own page uses.
 */

export const revalidate = 86400;

const PATH = "/perm-case-alerts";
const TITLE = "Free PERM Case Status Alerts by Email";
const DESCRIPTION =
  "Get an email the moment DOL changes your PERM case or wage request, reaches your filing month, or the visa bulletin moves your line. Free, no account.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: PATH },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
  },
  "perm-case-alerts",
);

const STEPS = [
  { title: "Enter your case number", body: "The case page shows DOL's record for it, with an alert form under the answer." },
  { title: "Add your email, and confirm it once", body: "One click in the confirmation email turns the alert on." },
  { title: "Hear the moment it moves", body: "When DOL changes your case's status, the email goes out within minutes." },
] as const;

const FAQS = [
  {
    q: "Is it really free?",
    a: "Yes. Every alert here is free and needs no account: an email address is all it asks for.",
  },
  {
    q: "How quickly will I hear when my PERM case changes?",
    a: "Within minutes on a weekday. A watched case is checked against DOL's record every 5 minutes from 7 AM to 9 PM Eastern on weekdays, and every half hour otherwise, and a status change is emailed at once. DOL emails the employer's attorney itself, so the attorney may still hear first.",
  },
  {
    q: "Will you fill my inbox?",
    a: "No. A status change on your own case goes out at once. Everything else you follow, a filing month, the visa bulletin or an employer, is gathered into at most one email a day.",
  },
  {
    q: "What happens after DOL decides my case?",
    a: "The watch carries on for a year, in case of an appeal or a reversal, then stops by itself. A certification lapsing on its own clock isn't emailed.",
  },
  {
    q: "Can I get just the weekly digest?",
    a: "Yes. Sign up for it on its own at the end of this page. It comes on Tuesdays, and you can add it to any alert too.",
  },
  {
    q: "How do I see everything I've signed up for?",
    a: "The email preferences page sends a link to your address that lists every alert and email it gets, and turns any of them off.",
  },
  {
    q: "How do I stop the emails?",
    a: "Every email has a one-click link that stops it, and a link to a page listing everything your address follows, where each can be turned off.",
  },
];

const KINDS = [
  { id: "case", icon: BellRingingIcon, title: "Your case", note: "DOL changes its status" },
  { id: "month", icon: CalendarCheckIcon, title: "Your filing month", note: "DOL reaches it" },
  { id: "wage", icon: CurrencyDollarIcon, title: "Your wage request", note: "DOL reaches its month" },
  { id: "bulletin", icon: EnvelopeSimpleIcon, title: "The visa bulletin", note: "your line's cutoff moves" },
  { id: "employer", icon: BuildingsIcon, title: "An employer", note: "DOL moves its cases as a group" },
  { id: "digest", icon: NewspaperIcon, title: "The weekly digest", note: "one email on Tuesdays" },
] as const;

export default function Page() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
      <JsonLdScript schema={faqSchema} />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Get an email when your PERM case changes</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-soft">
          Free alerts for your case, your filing month, your wage request, the visa bulletin and any employer, and a
          weekly digest. No account, and one click to stop.
        </p>{" "}
        <p className="mt-3 text-base text-soft">
          Already signed up?{" "}
          <Link href="/email-preferences" className="link">
            See and change everything your address gets
          </Link>
          .
        </p>
      </header>{" "}
      <nav aria-label="Alerts on this page" className="mt-8">
        <ul className="grid grid-cols-1 gap-[2px] border-2 border-border bg-border shadow-hard-sm sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {KINDS.map(({ id, icon: Icon, title, note }) => (
            <li key={id} className="bg-card">
              <a href={`#${id}`} className="flex min-h-[44px] items-start gap-3 p-4 hover:bg-sage">
                <Icon className="mt-0.5 size-6 shrink-0 text-primary-text" weight="duotone" aria-hidden="true" />{" "}
                <span>
                  <span className="block font-heading text-lg font-bold">{title}</span>{" "}
                  <span className="block text-sm text-muted-foreground">{note}</span>
                </span>
              </a>{" "}
            </li>
          ))}
        </ul>
      </nav>{" "}
      <PageSection id="case" title="Your case" lede="Enter its number. On the next page, add your email under the answer.">
        <div className="max-w-2xl">
          <CaseLookupForm action="/perm-case-status#watch" label="Your case number" source="alerts-page" buttonLabel="Next" />
        </div>{" "}
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-soft">
          Wage request and H-1B LCA numbers work in the same box, and so do H-2A, H-2B and CW-1 numbers. On the case&apos;s
          page you can also have your browser notify you, with no email at all.
        </p>{" "}
        <ol aria-label="How a case alert works" className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4 [&>*]:min-w-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 border-2 border-border bg-card p-4">
              <span className="flex size-8 shrink-0 items-center justify-center bg-primary font-mono text-base font-bold text-primary-foreground" aria-hidden="true">
                {i + 1}
              </span>{" "}
              <div className="min-w-0">
                <p className="font-heading text-lg font-bold leading-snug">{s.title}</p>{" "}
                <p className="mt-1 text-base leading-relaxed text-soft">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </PageSection>{" "}
      <PageSection id="month" title="Your filing month">
        <div className="max-w-2xl">
          <QueueAlertForm source="alerts-page" newestMonth={currentMonthUtc()} bare />
        </div>
      </PageSection>{" "}
      <PageSection id="wage" title="Your wage request">
        <div className="max-w-2xl">
          <QueueAlertForm source="alerts-page" newestMonth={currentMonthUtc()} queue="pwd-oews" allowPwdChoice bare />
        </div>
      </PageSection>{" "}
      <PageSection id="bulletin" title="The visa bulletin">
        <div className="max-w-2xl">
          <BulletinAlertForm source="alerts-page" bare />
        </div>
      </PageSection>{" "}
      <PageSection id="employer" title="An employer" lede="Hear when DOL holds, releases or decides an employer's cases as a group.">
        <p className="max-w-2xl text-base leading-relaxed">
          Each employer&apos;s page has a Follow box.{" "}
          <Link href="/perm-employers" className="link">
            Find the employer
          </Link>
          , then follow it from its page.
        </p>
      </PageSection>{" "}
      <PageSection
        id="digest"
        title="The weekly digest"
        lede="Every Tuesday: where DOL's queue stands, what the visa bulletin moved, USCIS's processing times and the rules on their way."
      >
        <div className="max-w-2xl">
          <DigestSignupForm source="alerts-page" />
        </div>
      </PageSection>{" "}
      <section className="mt-14">
        <h2 className="font-heading text-2xl font-bold">FAQs</h2>
        <FaqList items={FAQS} openFirst={false} />
      </section>
    </div>
  );
}
