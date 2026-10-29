/**
 * PERM trackers compared: every other site that tracks PERM cases, and the
 * green card sites people weigh beside them, each checked on its own pages,
 * beside this one.
 *
 * The one page that names other trackers (owner's call, Oct 27 2026). Search
 * Console showed people looking for them by name ("perm update tracker",
 * "perm timeline tracker") and meeting this site near the bottom of the first
 * page; this answers what they came to compare. The picture comes first: the
 * marks, then how fresh each site's data was, then each site in a few words,
 * then the case box. Every rival's mark rests on its own words, quoted and
 * linked in the list at the end.
 */

import type { Metadata } from "next";
import Image from "next/image";
import { Fragment } from "react";
import Link from "next/link";

import { TrackerMatrix, MARK_WORD, MarkIcon } from "@/components/compare/TrackerMatrix";
import { BarRows, type BarRow } from "@/components/data/BarRows";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { HOME_SHOTS } from "@/lib/compare/homeShots";
import { RIVALS } from "@/lib/compare/rivals";
import { checkedPhrase, compareFaq, GROUPS, PERM_TRACKER, ROWS, type Tracker } from "@/lib/compare/trackers";
import { FaqList } from "@/components/tools/FaqList";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { longDate as formatLongDate } from "@convex/lib/months";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

const TITLE = "PERM Trackers Compared: PERM Update, PERM Timeline and More";
const DESCRIPTION =
  "PERM case trackers and green card sites, each checked on its own pages: who each suits, where its data comes from, how fresh it is and what it costs.";

export const metadata: Metadata = withSocialCard(
  {
    // The rivals people search by name, with no brand suffix (it would push past 60).
    title: { absolute: "PERM Trackers Compared: PERM Update, PERM Timeline and More" },
    description: DESCRIPTION,
    alternates: { canonical: "/compare" },
    openGraph: { ...openGraphBase, title: TITLE, description: DESCRIPTION, url: "/compare" },
  },
  "compare",
);

export const dynamic = "force-static";

/** Every day a rival's marks were read, in words ("October 27 and 28, 2026"). */
const checked = checkedPhrase(RIVALS.map((t) => t.checkedOn));

/** Whole days between two Eastern days. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** A site's strengths, less any its "does that we don't" list already says (it opens with the same words). */
function ownStrengths(t: Tracker): string[] {
  return t.strengths.filter((s) => !t.beatsUs.some((b) => b.startsWith(s.slice(0, 25))));
}

function freshnessRows(trackers: readonly Tracker[]): BarRow[] {
  return trackers
    .filter((t) => t.newestData.day || t.slug === PERM_TRACKER.slug)
    .map((t) => {
      // Measured against the day the site was read, not today: a site read a day later
      // isn't a day staler.
      const age = t.newestData.day ? Math.max(0, daysBetween(t.newestData.day, t.checkedOn)) : 0;
      return {
        key: t.slug,
        label: t.name,
        sub: t.newestData.note ?? (t.newestData.day ? `Newest data shown: ${formatLongDate(t.newestData.day)}` : undefined),
        value: age,
        text: age === 0 ? "Same day" : age === 1 ? "1 day" : `${age} days`,
        tone: t.slug === PERM_TRACKER.slug ? ("primary" as const) : ("blue" as const),
      };
    })
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
}

/**
 * Which sites were read on which day, in words, for the pictures' caption:
 * "October 27, 2026 for PERM Update, ...; October 28, 2026 for H1BGrader, ...".
 * One day reads simply as that day.
 */
function shotDays(rivals: readonly Tracker[]): string {
  const days = [...new Set(rivals.map((t) => t.checkedOn))].sort();
  if (days.length === 1) return formatLongDate(days[0]!) ?? days[0]!;
  return days
    .map((d) => {
      const names = rivals.filter((t) => t.checkedOn === d).map((t) => t.name);
      const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
      return `${formatLongDate(d) ?? d} for ${list}`;
    })
    .join("; ");
}

export default function ComparePage() {
  const trackers: Tracker[] = [PERM_TRACKER, ...RIVALS];
  const fresh = freshnessRows(trackers);
  const faq = compareFaq(trackers);
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    // Wider than most pages: the grid is the page's picture, and every site needs its column.
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <JsonLdScript schema={faqSchema} />
      <header className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end [&>*]:min-w-0">
        <div>
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">PERM trackers compared</h1>{" "}
          {/* The answer first (Google: say which suits which use; Ahrefs: never crown yourself). */}
          <p className="mt-4 text-lg leading-relaxed">
            The {trackers.length} sites here track PERM cases or the green card steps around them. They differ most in
            where their data comes from and which DOL programs they cover, so the best one depends on what you need: the
            table below says who each one suits.
          </p>{" "}
          <p className="mt-3 text-base leading-relaxed text-soft">
            PERM Tracker made this page and is one of the sites on it. We chose the questions. Every mark on another
            site rests on that site&apos;s own page, quoted at the end, as read on {checked}. Where another site does
            something we don&apos;t, its entry says so.
          </p>
        </div>{" "}
        <div className="object p-5">
          <p className="font-heading text-lg font-bold">Check your case here</p>{" "}
          <CaseLookupForm compact label="Case number or employer" names help={null} source="compare-top" />
        </div>
      </header>{" "}
      <section aria-labelledby="fit" className="mt-12">
        <h2 id="fit" className="font-heading text-2xl font-bold">
          Who each one suits
        </h2>{" "}
        <div className="mt-5 overflow-hidden border-2 border-border">
          <table className="w-full border-collapse text-left text-base">
            <thead className="bg-tint">
              <tr>
                <th scope="col" className="px-4 py-3 font-heading font-bold">Site{" "}</th>
                <th scope="col" className="px-4 py-3 font-heading font-bold">Best for{" "}</th>
                <th scope="col" className="hidden px-4 py-3 font-heading font-bold md:table-cell">Data from{" "}</th>
                <th scope="col" className="hidden px-4 py-3 font-heading font-bold lg:table-cell">Cost{" "}</th>
              </tr>
            </thead>{" "}
            <tbody>
              {trackers.map((t) => (
                <tr key={t.slug} className={t.slug === PERM_TRACKER.slug ? "border-t-2 border-border bg-sage" : "border-t border-border/25"}>
                  <th scope="row" className="px-4 py-3 align-top font-semibold">
                    {t.slug === PERM_TRACKER.slug ? (
                      <>{t.name}{" "}<span className="block text-sm font-normal text-soft">this site</span></>
                    ) : (
                      <a href={`#site-${t.slug}`} className="link">
                        {t.name}
                      </a>
                    )}{" "}
                  </th>
                  <td className="px-4 py-3 align-top">{t.bestFor}{" "}</td>
                  <td className="hidden px-4 py-3 align-top text-soft md:table-cell">{t.dataFrom}{" "}</td>
                  <td className="hidden px-4 py-3 align-top text-soft lg:table-cell">{t.price}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>{" "}
      <section aria-labelledby="grid" className="mt-14">
        <h2 id="grid" className="font-heading text-2xl font-bold">
          Side by side
        </h2>{" "}
        <div className="mt-5">
          <TrackerMatrix trackers={trackers} />
        </div>
      </section>{" "}
      {fresh.length > 1 ? (
        <section aria-labelledby="fresh" className="mt-14">
          <h2 id="fresh" className="font-heading text-2xl font-bold">
            How old each site&apos;s newest data was
          </h2>{" "}
          <p className="mt-2 text-base text-soft">
            On the day each was read, by each site&apos;s own date stamp. Shorter is fresher.
          </p>{" "}
          <BarRows rows={fresh} label="How old each site's newest data was" className="mt-6" inline />
        </section>
      ) : null}{" "}
      <section aria-labelledby="each" className="mt-14">
        <h2 id="each" className="font-heading text-2xl font-bold">
          Each site
        </h2>{" "}
        {/* One site a row, picture beside its words: every entry the same shape, so no
            card sits alone on a row (owner, Oct 29 2026: the three-across cards left one
            card by itself and ran to uneven heights). */}
        {GROUPS.map((g) => {
          const rivals = RIVALS.filter((t) => t.group === g.key);
          if (!rivals.length) return null;
          return (
            <Fragment key={g.key}>
              <h3 className="mt-8 font-heading text-lg font-bold">
                {g.label}{" "}
              </h3>{" "}
              <ul aria-label={g.label} className="mt-4 space-y-6">
                {rivals.map((t) => {
                  const shot = HOME_SHOTS[t.slug];
                  return (
                    <li
                      key={t.slug}
                      id={`site-${t.slug}`}
                      className="object grid scroll-mt-24 grid-cols-1 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] [&>*]:min-w-0"
                    >
                      {shot ? (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${t.name}'s homepage (opens in a new tab)`}
                          className="block border-b-2 border-foreground md:border-b-0 md:border-r-2"
                        >
                          <Image
                            src={shot.src}
                            width={shot.width}
                            height={shot.height}
                            alt={shot.alt}
                            sizes="(min-width: 768px) 320px, 100vw"
                            className="block aspect-[16/10] h-auto w-full object-cover object-left-top md:aspect-auto md:h-full"
                          />
                        </a>
                      ) : null}{" "}
                      <div className="flex flex-col gap-4 p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                          <div className="min-w-0">
                            <p className="font-heading text-xl font-bold">{t.name}</p>{" "}
                            <p className="text-sm text-soft">
                              {t.url.replace(/^https?:\/\//, "")}
                              {t.operator ? <>, run by {t.operator}</> : null}{" "}
                            </p>
                          </div>{" "}
                          <p className="bg-tint px-2.5 py-1 text-sm font-semibold">{t.price}</p>
                        </div>{" "}
                        <p className="text-base">
                          <span className="font-semibold">Best for:</span> {t.bestFor}{" "}
                        </p>{" "}
                        <div className={t.beatsUs.length ? "grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0" : undefined}>
                          {t.strengths.length ? (
                            <div>
                              <p className="text-sm font-semibold text-soft">What it does well</p>{" "}
                              <ul className="mt-2 space-y-2 text-base">
                                {ownStrengths(t).map((s) => (
                                  <li key={s} className="flex items-start gap-2.5">
                                    <MarkIcon mark="yes" className="mt-0.5 size-5 shrink-0 [&_svg]:size-3" />
                                    <span>{s}{" "}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}{" "}
                          {t.beatsUs.length ? (
                            <div className="border-l-4 border-chart-blue pl-4">
                              <p className="text-sm font-semibold text-soft">What it does that we don&apos;t</p>{" "}
                              <ul className="mt-2 space-y-2 text-base">
                                {t.beatsUs.map((s) => (
                                  <li key={s}>{s}{" "}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          );
        })}
        <p className="mt-4 text-sm text-soft">
          Each site&apos;s homepage as it opened the day its marks were read: {shotDays(RIVALS)}.
        </p>
      </section>{" "}
      <section aria-labelledby="faq" className="mt-14">
        <h2 id="faq" className="font-heading text-2xl font-bold">
          Choosing a tracker
        </h2>{" "}
        <FaqList items={faq} openFirst={false} />
      </section>{" "}
      <section
        aria-labelledby="check"
        className="object mt-14 grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center lg:gap-10 [&>*]:min-w-0"
      >
        <div>
          <h2 id="check" className="font-heading text-xl font-bold">
            Check your case here
          </h2>{" "}
          <p className="mt-2 text-base text-soft">
            Straight from DOL&apos;s case-status service, with an email when it changes. Free, and no account needed.
          </p>
        </div>{" "}
        <CaseLookupForm compact label="Case number or employer" names help={null} source="compare" />
      </section>{" "}
      <details className="mt-14 border-t-2 border-border pt-6">
        <summary className="cursor-pointer py-2">
          <h2 className="inline font-heading text-xl font-bold">What each mark rests on</h2>
        </summary>{" "}
        <div className="mt-6 space-y-10">
          {RIVALS.map((t) => (
            <section key={t.slug} aria-labelledby={`ev-${t.slug}`}>
              <h3 id={`ev-${t.slug}`} className="font-heading text-lg font-bold">
                {t.name}{" "}
              </h3>{" "}
              <ul className="mt-3 space-y-3">
                {ROWS.map((r) => {
                  const c = t.cells[r.key];
                  return (
                    <li key={r.key} className="flex items-start gap-3 text-base">
                      <MarkIcon mark={c.mark} className="mt-0.5 size-6 shrink-0" />{" "}
                      <div className="min-w-0">
                        <p>
                          <span className="font-semibold">{r.label}:</span> {MARK_WORD[c.mark]}
                          {c.note ? <>. {c.note}</> : null}{" "}
                        </p>
                        {c.evidence ? (
                          <p className="mt-0.5 break-words text-sm text-soft">
                            {/* A <q>: the browser draws the curly quotes, and checkers can tell the
                                rival's own words (dashes and all) from ours. */}
                            {c.evidence.quote ? <><q>{c.evidence.quote}</q>{" "}</> : null}
                            <a href={c.evidence.url} target="_blank" rel="noopener noreferrer nofollow" className="link">
                              {c.evidence.url.replace(/^https?:\/\//, "")}
                            </a>
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </details>{" "}
      <p className="mt-10 max-w-3xl text-sm text-soft">
        Something here wrong or out of date?{" "}
        <Link href="/contact" className="link">
          Tell us
        </Link>{" "}
        and we&apos;ll check it and correct it. Corrections are listed on the{" "}
        <Link href="/changelog/corrections" className="link">
          corrections page
        </Link>
        .
      </p>
    </div>
  );
}
