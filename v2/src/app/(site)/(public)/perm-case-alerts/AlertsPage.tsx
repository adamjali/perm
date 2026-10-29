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
import { hrefLangFor, localizedPath, pageAlternates, type Lang } from "@/lib/i18n/lang";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

import { QueueAlertForm } from "../perm-processing-times/QueueAlertForm";
import { ALERTS_PAGE } from "./alertsPage.messages";

/**
 * Every free email alert on one page, in every language it's published in: a case, a filing month, a wage
 * request's month, the visa bulletin, an employer, and the weekly digest on its own. Built for the searches that
 * never reached the site (Search Console, 3 months to Oct 28 2026: no appearance at all for any search naming an
 * alert, an email or a notification), and for the person who wants to be told rather than check. Each form is
 * the one its own page uses, in the page's language.
 */

const PATH = "/perm-case-alerts";

export function alertsPageMetadata(lang: Lang): Metadata {
  const t = ALERTS_PAGE[lang];
  const path = localizedPath(PATH, lang);
  return withSocialCard(
    {
      title: t.metaTitle,
      description: t.metaDescription,
      alternates: { canonical: path, languages: pageAlternates(PATH) },
      openGraph: { ...openGraphBase, title: `${t.metaTitle} | PERM Tracker`, description: t.metaDescription, url: path },
    },
    "perm-case-alerts",
  );
}

const ICONS = {
  case: BellRingingIcon,
  month: CalendarCheckIcon,
  wage: CurrencyDollarIcon,
  bulletin: EnvelopeSimpleIcon,
  employer: BuildingsIcon,
  digest: NewspaperIcon,
} as const;
const ORDER = ["case", "month", "wage", "bulletin", "employer", "digest"] as const;

export function AlertsPage({ lang }: { lang: Lang }) {
  const t = ALERTS_PAGE[lang];
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12">
      <JsonLdScript schema={faqSchema} />
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{t.h1}</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-soft">{t.intro}</p>{" "}
        <p className="mt-3 text-base text-soft">
          {t.already}{" "}
          <Link href={localizedPath("/email-preferences", lang)} className="link">
            {t.alreadyLink}
          </Link>
          {lang === "zh" ? "。" : "."}
        </p>
      </header>{" "}
      <nav aria-label={t.navLabel} className="mt-8">
        <ul className="grid grid-cols-1 gap-[2px] border-2 border-border bg-border shadow-hard-sm sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {ORDER.map((id) => {
            const Icon = ICONS[id];
            return (
              <li key={id} className="bg-card">
                <a href={`#${id}`} className="flex min-h-[44px] items-start gap-3 p-4 hover:bg-sage">
                  <Icon className="mt-0.5 size-6 shrink-0 text-primary-text" weight="duotone" aria-hidden="true" />{" "}
                  <span>
                    <span className="block font-heading text-lg font-bold">{t.kinds[id].title}</span>{" "}
                    <span className="block text-sm text-muted-foreground">{t.kinds[id].note}</span>
                  </span>
                </a>{" "}
              </li>
            );
          })}
        </ul>
      </nav>{" "}
      <PageSection id="case" title={t.kinds.case.title} lede={t.caseLede}>
        <div className="max-w-2xl">
          <CaseLookupForm
            action={`${localizedPath("/perm-case-status", lang)}#watch`}
            label={t.caseLabel}
            source="alerts-page"
            buttonLabel={t.caseButton}
          />
        </div>{" "}
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-soft">{t.caseNote}</p>{" "}
        <ol aria-label={t.stepsLabel} className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4 [&>*]:min-w-0">
          {t.steps.map((s, i) => (
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
      <PageSection id="month" title={t.kinds.month.title}>
        <div className="max-w-2xl">
          <QueueAlertForm source="alerts-page" newestMonth={currentMonthUtc()} bare lang={lang} />
        </div>
      </PageSection>{" "}
      <PageSection id="wage" title={t.kinds.wage.title}>
        <div className="max-w-2xl">
          <QueueAlertForm source="alerts-page" newestMonth={currentMonthUtc()} queue="pwd-oews" allowPwdChoice bare lang={lang} />
        </div>
      </PageSection>{" "}
      <PageSection id="bulletin" title={t.kinds.bulletin.title}>
        <div className="max-w-2xl">
          <BulletinAlertForm source="alerts-page" headingLevel="h3" lang={lang} />
        </div>
      </PageSection>{" "}
      <PageSection id="employer" title={t.kinds.employer.title} lede={t.employerLede}>
        <p className="max-w-2xl text-base leading-relaxed">
          {t.employerBefore}{" "}
          <Link href="/perm-employers" className="link" hrefLang={hrefLangFor("/perm-employers", lang)}>
            {t.employerLink}
          </Link>
          {t.employerAfter}
        </p>
      </PageSection>{" "}
      <PageSection id="digest" title={t.kinds.digest.title} lede={t.digestLede}>
        <div className="max-w-2xl">
          <DigestSignupForm source="alerts-page" lang={lang} />
        </div>
      </PageSection>{" "}
      <section className="mt-14">
        <h2 className="font-heading text-2xl font-bold">{t.faqHeading}</h2>
        <FaqList items={t.faqs} openFirst={false} />
      </section>
    </div>
  );
}
