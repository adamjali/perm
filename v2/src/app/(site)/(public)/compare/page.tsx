/**
 * PERM trackers compared: every other site that tracks PERM cases, checked on
 * its own pages, beside this one.
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
import Link from "next/link";

import { TrackerMatrix, MARK_WORD, MarkIcon } from "@/components/compare/TrackerMatrix";
import { BarRows, type BarRow } from "@/components/data/BarRows";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { RIVALS } from "@/lib/compare/rivals";
import { CHECKED_ON, PERM_TRACKER, ROWS, type Tracker } from "@/lib/compare/trackers";
import { longDate as formatLongDate } from "@convex/lib/months";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

const TITLE = "PERM Trackers Compared: PERM Update, PERM Timeline and More";
const DESCRIPTION =
  "Seven PERM case trackers checked side by side on their own pages: what each looks up, where its data comes from, how fresh it is and what it costs.";

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

const checked = formatLongDate(CHECKED_ON) ?? CHECKED_ON;

/** Whole days between two Eastern days. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

function freshnessRows(trackers: readonly Tracker[]): BarRow[] {
  return trackers
    .filter((t) => t.newestData.day || t.slug === PERM_TRACKER.slug)
    .map((t) => {
      const age = t.newestData.day ? Math.max(0, daysBetween(t.newestData.day, CHECKED_ON)) : 0;
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

export default function ComparePage() {
  const trackers: Tracker[] = [PERM_TRACKER, ...RIVALS];
  const fresh = freshnessRows(trackers);
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-3xl">
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">PERM trackers compared</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-soft">
          The PERM trackers people search for by name, and the newest, each checked on its own pages on {checked}:
          what it can look up, where its data comes from, and what it costs.
        </p>
      </header>{" "}
      <section aria-label="The comparison" className="mt-8">
        <TrackerMatrix trackers={trackers} />
      </section>{" "}
      {fresh.length > 1 ? (
        <section aria-labelledby="fresh" className="mt-14 max-w-3xl">
          <h2 id="fresh" className="font-heading text-2xl font-bold">
            How old each site&apos;s newest data was
          </h2>{" "}
          <p className="mt-2 text-base text-soft">On {checked}, by each site&apos;s own date stamp. Shorter is fresher.</p>{" "}
          <BarRows rows={fresh} label="How old each site's newest data was" className="mt-6" />
        </section>
      ) : null}{" "}
      <section aria-labelledby="each" className="mt-14">
        <h2 id="each" className="font-heading text-2xl font-bold">
          Each one, in short
        </h2>{" "}
        <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          {RIVALS.map((t) => (
            <li key={t.slug} className="object flex flex-col gap-3 p-5">
              <div>
                <p className="font-heading text-xl font-bold">{t.name}</p>{" "}
                <p className="text-sm text-soft">
                  {t.url.replace(/^https?:\/\//, "")}
                  {t.operator ? <>, run by {t.operator}</> : null}{" "}
                </p>
              </div>{" "}
              <p className="text-base">
                <span className="font-semibold">Price:</span> {t.price}
              </p>{" "}
              {t.strengths.length ? (
                <div>
                  <p className="text-sm font-semibold">What it does well</p>{" "}
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-base">
                    {t.strengths.map((s) => (
                      <li key={s}>{s}{" "}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>{" "}
      <section aria-labelledby="check" className="object mt-14 max-w-3xl p-5 sm:p-6">
        <h2 id="check" className="font-heading text-xl font-bold">
          Check your case here
        </h2>{" "}
        <p className="mt-2 text-base text-soft">
          Straight from DOL&apos;s case-status service, with an email when it changes. Free, and no account needed.
        </p>{" "}
        <CaseLookupForm className="mt-4" compact label="Case number or employer" names help={null} source="compare" />
      </section>{" "}
      <details className="mt-14 max-w-4xl border-t-2 border-border pt-6">
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
                            {c.evidence.quote ? <>&ldquo;{c.evidence.quote}&rdquo;{" "}</> : null}
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
