import type { Metadata } from "next";
import { Fragment } from "react";

import { D, F } from "@/components/i18n/guideParts";
import { LanguageLinks } from "@/components/i18n/LanguageLinks";
import type { CountryKey, Cutoff } from "@/lib/perm";
import { GUIDE_COPY } from "@/lib/i18n/guide";
import { GLOSSED_STATUSES, SECTION_IDS } from "@/lib/i18n/guide/types";
import { getGuideData, type GuideData } from "@/lib/i18n/guideData";
import { languageAlternates, localeByCode, type LocaleCode, type LocaleDef } from "@/lib/i18n/locales";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * One localized guide: the page body every `/zh`, `/es`, `/pt-br`, `/ko` and
 * `/vi` renders, with that language's copy and today's figures.
 *
 * THE LANGUAGE IS DECLARED ON THE CONTENT. The site's <html> is English and
 * stays so (the header and footer are English); this wrapper carries the
 * page's own `lang`, which is what a screen reader switches voice on and what
 * a browser uses to pick a CJK font. Every figure, case number, form name and
 * DOL status word is `translate="no"`: those are the agencies' words.
 */

export function localizedGuideMetadata(code: LocaleCode): Metadata {
  const locale = localeByCode(code);
  const copy = GUIDE_COPY[code];
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: locale.path, languages: languageAlternates(locale.path)! },
    openGraph: {
      ...openGraphBase,
      title: `${copy.title} | PERM Tracker`,
      description: copy.description,
      url: locale.path,
      locale: locale.tag.replace("-", "_"),
    },
  };
}

const card = "border-2 border-border bg-card p-5 shadow-hard";
const h2 = "scroll-mt-24 font-heading text-2xl font-black sm:text-3xl";

function month(ym: string | null, intl: string): string | null {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  return new Date(`${ym}-15T12:00:00Z`).toLocaleDateString(intl, { year: "numeric", month: "long", timeZone: "UTC" });
}

function day(iso: string | null, intl: string): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl, { dateStyle: "long", timeZone: "UTC" });
}

function CutoffCell({ cutoff, locale, copy }: { cutoff: Cutoff | null; locale: LocaleDef; copy: (typeof GUIDE_COPY)[LocaleCode] }) {
  if (!cutoff) return <span className="text-foreground/70">{copy.cutoffs.notPrinted}</span>;
  if (cutoff.kind === "date") return <D>{day(cutoff.iso, locale.intl)}</D>;
  const [letter, gloss] = cutoff.kind === "current" ? ["C", copy.cutoffs.current] : ["U", copy.cutoffs.unavailable];
  return (
    <>
      <b translate="no">{letter}</b> <span className="text-foreground/80">({gloss})</span>
    </>
  );
}

function CutoffTable({ country, data, locale }: { country: CountryKey; data: NonNullable<GuideData["bulletin"]>; locale: LocaleDef }) {
  const copy = GUIDE_COPY[locale.code];
  const rows = data.rows[country] ?? [];
  return (
    <div className="overflow-x-auto border-2 border-border bg-card">
      <table className="w-full min-w-[34rem] border-collapse text-left text-base">
        <caption className="border-b-2 border-border bg-muted px-4 py-2 text-left font-heading text-lg font-black">
          {copy.cutoffs.countryName[country] ?? country}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="px-4 py-2 font-bold">{copy.cutoffs.head.category}{" "}</th>
            <th scope="col" className="px-4 py-2 font-bold">{copy.cutoffs.head.finalAction}{" "}</th>
            <th scope="col" className="px-4 py-2 font-bold">{copy.cutoffs.head.datesForFiling}{" "}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className="border-t-2 border-border/40">
              <th scope="row" className="px-4 py-3 font-bold">{copy.cutoffs.category[r.category]}{" "}</th>
              <td className="px-4 py-3 tabular-nums">
                <CutoffCell cutoff={r.finalAction} locale={locale} copy={copy} />{" "}
              </td>
              <td className="px-4 py-3 tabular-nums">
                <CutoffCell cutoff={r.datesForFiling} locale={locale} copy={copy} />{" "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function LocalizedGuide({ code }: { code: LocaleCode }) {
  const locale = localeByCode(code);
  const copy = GUIDE_COPY[code];
  const data = await getGuideData().catch(() => null);
  const n = (x: number) => x.toLocaleString(locale.intl);

  const permMonth = month(data?.perm?.month ?? null, locale.intl);
  const pwdMonth = month(data?.pwdMonth ?? null, locale.intl);
  const asOf = day(data?.perm?.asOf ?? null, locale.intl);
  const avg = data?.perm?.averageDays ?? null;
  const figures = [
    permMonth ? { label: copy.queue.permLabel, value: <D>{permMonth}</D> } : null,
    avg !== null ? { label: copy.queue.averageLabel, value: copy.queue.days(<D>{n(avg)}</D>) } : null,
    pwdMonth ? { label: copy.queue.pwdLabel, value: <D>{pwdMonth}</D> } : null,
  ].filter((f): f is { label: string; value: React.ReactNode } => f !== null);
  const bulletinMonth = data?.bulletin ? month(data.bulletin.month, locale.intl) : null;

  return (
    <div lang={locale.tag} className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-8 sm:pt-10" />
      <LanguageLinks current={code} />

      <header className="mt-8">
        <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{copy.eyebrow}</p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">{copy.h1}</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/80">{copy.lede}</p>{" "}
        <p className="mt-4 border-l-4 border-primary bg-card px-4 py-3 text-base leading-relaxed text-foreground/80">
          {copy.translationNote}
        </p>
      </header>

      <nav aria-label={copy.onThisPage} className="mt-8">
        <p className="font-heading text-base font-black">{copy.onThisPage}</p>{" "}
        <ol className="mt-2 flex flex-wrap gap-2">
          {SECTION_IDS.map((id, i) => (
            <Fragment key={id}>
              {" "}
              <li>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-11 items-center gap-2 border-2 border-border bg-background px-3 text-sm font-bold hover:bg-primary/20"
                >
                  <span className="tabular-nums text-foreground/70">{i + 1}</span> {copy.toc[id]}
                </a>
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>

      <section className="mt-12" aria-labelledby="check">
        <h2 id="check" className={h2}>{copy.check.h2}</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">{copy.check.intro}</p>
        <form method="get" action="/perm-case-status" className={`mt-5 grid grid-cols-1 gap-2 [&>*]:min-w-0 ${card}`}>
          <label htmlFor="guide-case" className="text-base font-bold">{copy.check.label}</label>{" "}
          <div className="flex gap-2">
            <input
              id="guide-case"
              name="case"
              translate="no"
              placeholder="G-100-26125-868956"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              className="min-h-11 min-w-0 flex-1 border-2 border-border bg-background px-3 text-base"
            />{" "}
            <button
              type="submit"
              className="min-h-11 border-2 border-border bg-primary px-5 font-bold text-primary-foreground shadow-hard-sm"
            >
              {copy.check.button}
            </button>
          </div>{" "}
          <p className="text-sm leading-relaxed text-foreground/70">{copy.check.formats}</p>
        </form>{" "}
        <p className="mt-4 text-base leading-relaxed text-foreground/80">{copy.check.after}</p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">{copy.check.noNumber}</p>
      </section>

      <section className="mt-12" aria-labelledby="queue">
        <h2 id="queue" className={h2}>{copy.queue.h2}</h2>{" "}
        {figures.length > 0 ? (
          <>
            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
              {figures.map((f, i) => (
                <Fragment key={i}>
                  {" "}
                  <div className={card}>
                    <dt className="text-sm leading-snug text-foreground/70">{f.label}</dt>{" "}
                    <dd className="mt-2 font-heading text-2xl font-black leading-tight">{f.value}</dd>
                  </div>
                </Fragment>
              ))}
            </dl>{" "}
            {asOf ? <p className="mt-3 text-sm text-foreground/70">{copy.queue.asOf(<D>{asOf}</D>)}</p> : null}
          </>
        ) : (
          <p className={`mt-5 text-base ${card}`}>{copy.queue.missing}</p>
        )}
        {copy.queue.meaning.map((p, i) => (
          <Fragment key={i}>
            {" "}
            <p className="mt-4 text-base leading-relaxed text-foreground/80">{p}</p>
          </Fragment>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="steps">
        <h2 id="steps" className={h2}>{copy.steps.h2}</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">{copy.steps.intro}</p>
        <ol className="mt-5 grid grid-cols-1 gap-3 [&>*]:min-w-0">
          {copy.steps.items.map((s, i) => (
            <Fragment key={s.form}>
              {" "}
              <li className="grid grid-cols-[2.75rem_1fr] gap-4 border-2 border-border bg-card p-4 [&>*]:min-w-0">
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center border-2 border-border bg-primary font-heading text-lg font-black text-primary-foreground"
                >
                  {i + 1}
                </span>{" "}
                <div>
                  <p className="font-heading text-lg font-black leading-snug">
                    <F>{s.form}</F> <span className="font-bold">{s.name}</span>
                  </p>{" "}
                  <p className="mt-1 text-base leading-relaxed text-foreground/80">{s.body}</p>
                </div>
              </li>
            </Fragment>
          ))}
        </ol>{" "}
        <p className="mt-4 text-base leading-relaxed text-foreground/80">{copy.steps.skipPerm}</p>
      </section>

      <section className="mt-12" aria-labelledby="eb3-other-workers">
        <h2 id="eb3-other-workers" className={h2}>{copy.ew3.h2}</h2>
        {copy.ew3.body.map((p, i) => (
          <Fragment key={i}>
            {" "}
            <p className="mt-3 text-base leading-relaxed text-foreground/80">{p}</p>
          </Fragment>
        ))}
      </section>

      <section className="mt-12" aria-labelledby="cutoffs">
        <h2 id="cutoffs" className={h2}>{copy.cutoffs.h2}</h2>{" "}
        {data?.bulletin && bulletinMonth ? (
          <>
            <p className="mt-3 text-base leading-relaxed text-foreground/80">
              {copy.cutoffs.intro(<D>{bulletinMonth}</D>)}
            </p>{" "}
            <p className="mt-3 text-base leading-relaxed text-foreground/80">{copy.cutoffs.birth}</p>
            <div className="mt-5 grid grid-cols-1 gap-5 [&>*]:min-w-0">
              {locale.countries.map((c) => (
                <Fragment key={c}>
                  {" "}
                  <CutoffTable country={c} data={data.bulletin!} locale={locale} />
                </Fragment>
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-1 gap-2 text-base leading-relaxed text-foreground/80 [&>*]:min-w-0">
              {copy.cutoffs.legend.map((l, i) => (
                <Fragment key={i}>
                  {" "}
                  <li>{l}</li>
                </Fragment>
              ))}
            </ul>
          </>
        ) : (
          <p className={`mt-5 text-base ${card}`}>{copy.cutoffs.missing}</p>
        )}
      </section>

      <section className="mt-12" aria-labelledby="statuses">
        <h2 id="statuses" className={h2}>{copy.statuses.h2}</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">{copy.statuses.intro}</p>
        <dl className="mt-5 grid grid-cols-1 border-2 border-border bg-card [&>*]:min-w-0">
          {GLOSSED_STATUSES.map((s, i) => (
            <Fragment key={s}>
              {" "}
              <div className={`grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[16rem_1fr] sm:gap-4 [&>*]:min-w-0 ${i > 0 ? "border-t-2 border-border/40" : ""}`}>
                <dt className="font-bold" translate="no">{s}</dt>{" "}
                <dd className="text-base leading-relaxed text-foreground/80">{copy.statuses.gloss[s]}</dd>
              </div>
            </Fragment>
          ))}
        </dl>
      </section>

      <section className="mt-12" aria-labelledby="limits-h">
        <h2 id="limits-h" className={h2}>{copy.limits.h2}</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-base leading-relaxed text-foreground/80 [&>*]:min-w-0">
          {copy.limits.items.map((l, i) => (
            <Fragment key={i}>
              {" "}
              <li className="border-l-4 border-border pl-3">{l}</li>
            </Fragment>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="more-h">
        <h2 id="more-h" className={h2}>{copy.more.h2}</h2>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
          {copy.more.links.map((l) => (
            <Fragment key={l.href}>
              {" "}
              <li>
                <a
                  href={l.href}
                  hrefLang="en"
                  className="flex min-h-11 items-center border-2 border-border bg-card px-4 py-2 font-bold hover:bg-primary/20"
                >
                  {l.label}
                </a>
              </li>
            </Fragment>
          ))}
        </ul>
      </section>
    </div>
  );
}
