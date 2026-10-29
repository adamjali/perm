import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BellRingingIcon,
  BuildingsIcon,
  CalendarCheckIcon,
  EnvelopeSimpleIcon,
  FileMagnifyingGlassIcon,
  HourglassIcon,
  ListChecksIcon,
  MegaphoneIcon,
  NewspaperIcon,
  PowerIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";

import { PrefsRequestForm } from "@/components/prefs/PrefsRequestForm";
import { AlertLanesFigure } from "@/components/marketing/PageFigures";
import {
  ACCOUNT_KINDS,
  MAIL_KINDS,
  NOTIFICATION_SETTINGS_PATH,
  SUBSCRIBER_KINDS,
  type MailKindId,
} from "@/lib/mailKinds";
import { hrefLangFor, localizedPath, pageAlternates, type Lang } from "@/lib/i18n/lang";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

import { PREFS_PAGE } from "./emailPrefs.messages";

/**
 * Everything PERM Tracker emails, and the one link that turns it off.
 *
 * The alerts each carry their own unsubscribe link, and nothing else let a
 * person see what an address gets across all of them. This page requests the
 * preferences link (served by Convex at /prefs) and lists every kind of email
 * from the shared list in convex/lib/mailKinds.ts, the same names the emailed
 * page and Settings use. Turning something on always happens on the page that
 * owns it, never from a link.
 *
 * Published in every language the alerts are (Oct 29 2026): the words come from emailPrefs.messages.ts, English
 * from the shared list itself. The page an emailed link opens, and the emails, are still in English, and a
 * translated page says so under the form.
 */

const PATH = "/email-preferences";

export function emailPreferencesMetadata(lang: Lang): Metadata {
  const t = PREFS_PAGE[lang];
  const path = localizedPath(PATH, lang);
  return withSocialCard(
    {
      title: t.metaTitle,
      description: t.metaDescription,
      alternates: { canonical: path, languages: pageAlternates(PATH) },
      openGraph: {
        ...openGraphBase,
        title: lang === "en" ? t.metaTitle : `${t.metaTitle} | PERM Tracker`,
        description: t.ogDescription,
        url: path,
      },
    },
    "email-preferences",
  );
}

const KIND_ICONS: Record<MailKindId, Icon> = {
  case: FileMagnifyingGlassIcon,
  queue: HourglassIcon,
  bulletin: CalendarCheckIcon,
  employer: BuildingsIcon,
  newsletter: NewspaperIcon,
  news: MegaphoneIcon,
  reminders: BellRingingIcon,
  updates: ArrowsClockwiseIcon,
  digest: ListChecksIcon,
};

const RULE_ICONS: readonly Icon[] = [SealCheckIcon, EnvelopeSimpleIcon, PowerIcon];

function KindTile({ id, lang }: { id: MailKindId; lang: Lang }) {
  const kind = PREFS_PAGE[lang].kinds[id];
  const href = MAIL_KINDS[id].start.href;
  const Glyph = KIND_ICONS[id];
  return (
    <li className="flex flex-col bg-tint p-5 border-2 shadow-hard-sm border-border">
      <div className="flex items-start justify-between gap-3">
        <Glyph aria-hidden="true" className="size-6 shrink-0 text-primary-text" />{" "}
        <span className="text-sm text-muted-foreground border-2 px-2 py-0.5 border-border">{kind.when}</span>
      </div>{" "}
      <h4 className="mt-4 font-heading text-lg font-bold">{kind.name}</h4>{" "}
      <p className="mt-1 flex-1 text-base leading-relaxed text-soft">{kind.what}</p>{" "}
      <Link
        href={localizedPath(href, lang)}
        hrefLang={hrefLangFor(href, lang)}
        className="link group mt-4 inline-flex min-h-[44px] items-center gap-2 self-start text-sm"
      >
        {kind.start}{" "}
        <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function KindGroup({ title, ids, lang }: { title: string; ids: readonly MailKindId[]; lang: Lang }) {
  return (
    <>
      <h3 className="mt-10 font-heading text-xl font-bold">{title}</h3>{" "}
      <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {ids.map((id) => (
          /* Keyed Fragment with a real space: mapped siblings otherwise read
             as one glued run to anything that extracts the text. */
          <Fragment key={id}>
            {" "}
            <KindTile id={id} lang={lang} />
          </Fragment>
        ))}
      </ul>
    </>
  );
}

export function EmailPreferencesPage({ lang }: { lang: Lang }) {
  const t = PREFS_PAGE[lang];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{t.h1}</h1>{" "}
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">{t.intro}</p>

      <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="lg:col-span-7">
          <PrefsRequestForm lang={lang} />
          {t.emailLanguage ? <p className="mt-3 text-sm text-muted-foreground">{t.emailLanguage}</p> : null}
        </div>{" "}
        {/* Beside the form: a reader deciding whether to give an address
            wants to see what arrives. */}
        <figure className="m-0 bg-tint p-5 lg:col-span-5 border-2 shadow-hard-sm border-border">
          <AlertLanesFigure className="text-foreground" lanes={t.lanes} label={t.lanesLabel} />{" "}
          <figcaption className="mt-3 border-t-2 border-border pt-3 text-sm font-semibold text-muted-foreground">
            {t.caption}
          </figcaption>
        </figure>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3 [&>*]:min-w-0">
        {t.rules.map((rule, i) => {
          const Glyph = RULE_ICONS[i] ?? SealCheckIcon;
          return (
            <Fragment key={rule.title}>
              {" "}
              <li className="flex gap-3 border-t-3 border-border pt-4">
                <Glyph aria-hidden="true" className="size-7 shrink-0 text-primary" weight="bold" />{" "}
                <div>
                  <p className="font-heading font-bold">{rule.title}</p>{" "}
                  <p className="mt-1 text-base text-soft">{rule.body}</p>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>

      <section aria-labelledby="kinds-heading" className="mt-16">
        <h2 id="kinds-heading" className="font-heading text-2xl font-bold sm:text-3xl">
          {t.kindsHeading}
        </h2>{" "}
        <KindGroup title={t.noAccount} ids={SUBSCRIBER_KINDS} lang={lang} />{" "}
        <KindGroup title={t.withAccount} ids={ACCOUNT_KINDS} lang={lang} />
        <p className="mt-6 text-base text-soft">
          {t.signedIn.before}{" "}
          <Link href={NOTIFICATION_SETTINGS_PATH} className="link" hrefLang={hrefLangFor(NOTIFICATION_SETTINGS_PATH, lang)}>
            {t.signedIn.link}
          </Link>
          {t.signedIn.after}
        </p>
      </section>
    </div>
  );
}
