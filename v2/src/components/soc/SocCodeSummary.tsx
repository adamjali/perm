"use client";

import { ArrowSquareOutIcon } from "@phosphor-icons/react";

import { BarRows } from "@/components/data/BarRows";
import { Button } from "@/components/ui/button";
import type { PublicQueryResult } from "@/hooks/usePublicQuery";
import { useSocProfile } from "@/hooks/useSocProfile";
import { MIN_DECIDED_FOR_MEDIAN, MIN_DECIDED_FOR_RATE } from "@/lib/entityPayload";
import { formatDollars, formatInt, formatShareOf } from "@/lib/format";
import type { SocProfile } from "@/lib/socProfile";
import { cn } from "@/lib/utils";

/** How many of the code's filed titles the card draws. */
const TITLES_SHOWN = 3;

/**
 * One SOC code at a glance, for the signed-in case page and the homepage's job band (the case form shows the
 * same facts as `SocCodeBrief`, below): its title, the job's median offered
 * wage and approval rate in DOL's PERM files, the titles other employers filed it under, and one line to the
 * code's own page (Sabrina's words, Nov 1 2026: "for more info about this positions median wage, how other
 * employers titles the position, and success rates visit our SOC code database").
 *
 * The link opens a new tab in the app, so a form with unsaved edits is never left. A figure under the site's floors
 * (MIN_DECIDED_FOR_RATE, MIN_DECIDED_FOR_MEDIAN) says why it's missing instead of printing a thin number.
 */
export function SocCodeSummary({
  profile,
  className,
  newTab = true,
}: {
  profile: SocProfile;
  className?: string;
  /** In the app the code's page opens in a new tab, so a form's unsaved edits stay; on public pages it doesn't. */
  newTab?: boolean;
}) {
  const f = profile.figures;
  const titles = profile.titles.slice(0, TITLES_SHOWN);
  return (
    <section aria-label={`SOC code ${profile.soc}`} className={cn("border-2 border-border bg-tint", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-border px-4 py-3">
        <p className="min-w-0 font-heading text-lg font-bold leading-snug">
          <span className="mr-2 whitespace-nowrap font-mono text-base">{profile.soc}</span>{" "}
          {profile.title}
        </p>{" "}
        {profile.zoneLabel ? (
          <p className="text-sm text-soft" title={profile.zoneName ?? undefined}>
            O*NET Job Zone {profile.zoneLabel}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] [&>*]:min-w-0">
        <Stat
          label="Median wage offered"
          value={f?.medianWage != null ? formatDollars(f.medianWage) : null}
          note={f ? `in ${formatInt(f.decided)} decided PERM cases` : null}
          missing={f ? `Fewer than ${MIN_DECIDED_FOR_MEDIAN} decided cases` : "No PERM case under this code yet"}
        />{" "}
        <Stat
          label="Certified"
          value={f?.approvalRate != null ? formatShareOf(f.certified, f.decided) : null}
          note={f ? `of ${formatInt(f.decided)} decided` : null}
          missing={f ? `Fewer than ${MIN_DECIDED_FOR_RATE} decided cases` : "No PERM case under this code yet"}
        />{" "}
        <div className="bg-tint px-4 py-3">
          <p className="text-sm font-semibold">How employers title it</p>{" "}
          {titles.length ? (
            <BarRows
              className="mt-2"
              label={`Titles employers filed under ${profile.soc}`}
              rows={titles.map((t) => ({ key: t.title, label: t.title, value: t.share, text: profile.codeFilings > 0 ? formatShareOf(t.filings, profile.codeFilings) : `${formatInt(t.filings)} filings` }))}
            />
          ) : (
            <p className="mt-1 text-sm text-soft">No filed titles under this code yet.</p>
          )}
        </div>
      </div>
      <p className="border-t-2 border-border px-4 py-3 text-sm leading-relaxed">
        For this position&apos;s median wage, how other employers title it and how often DOL approves it, see{" "}
        <CodePageLink profile={profile} newTab={newTab} />.
      </p>
    </section>
  );
}

/** The line to the code's own page, in Sabrina's words: its pay, how employers title it, how often DOL approves it. */
function CodePageLink({ profile, newTab }: { profile: SocProfile; newTab: boolean }) {
  const text = `${profile.soc} in the SOC code database`;
  return newTab ? (
    <a href={profile.href} target="_blank" rel="noopener" className="link inline-flex min-h-11 items-center gap-1 sm:min-h-0">
      {text}
      <ArrowSquareOutIcon className="size-4 shrink-0" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <a href={profile.href} className="link inline-flex min-h-11 items-center sm:min-h-0">
      {text}
    </a>
  );
}

/**
 * The same facts as `SocCodeSummary`, set quietly under the case form's SOC field: a rule down the left, the
 * code's title, the median offered wage and certified share in a line, the titles employers filed it under, and
 * the link to the code's page. No box of its own, so it reads as part of the field it sits under.
 */
export function SocCodeBrief({ profile, className }: { profile: SocProfile; className?: string }) {
  const f = profile.figures;
  const titles = profile.titles.slice(0, TITLES_SHOWN);
  const share = (filings: number) => (profile.codeFilings > 0 ? formatShareOf(filings, profile.codeFilings) : `${formatInt(filings)} filings`);
  const thin = f && f.medianWage == null && f.approvalRate == null;
  return (
    <div aria-label={`SOC code ${profile.soc}`} role="group" className={cn("space-y-1 border-l-2 border-primary pl-3 text-sm leading-relaxed", className)}>
      <p>
        <span className="font-mono font-semibold">{profile.soc}</span> <span className="font-semibold">{profile.title}</span>
        {profile.zoneLabel ? (
          <span className="text-soft" title={profile.zoneName ?? undefined}>
            {" "}
            (O*NET Job Zone {profile.zoneLabel})
          </span>
        ) : null}
      </p>{" "}
      {!f ? (
        <p className="text-soft">No PERM case filed under this code yet.</p>
      ) : thin ? (
        <p className="text-soft">
          {formatInt(f.decided)} decided PERM {f.decided === 1 ? "case" : "cases"}, too few for a median or an approval rate.
        </p>
      ) : (
        <p className="flex flex-wrap gap-x-5">
          {f.medianWage != null ? (
            <span>
              <strong className="tabular-nums">{formatDollars(f.medianWage)}</strong> median wage offered
            </span>
          ) : null}{" "}
          {f.approvalRate != null ? (
            <span>
              <strong className="tabular-nums">{formatShareOf(f.certified, f.decided)}</strong> certified, of {formatInt(f.decided)} decided
            </span>
          ) : null}
        </p>
      )}{" "}
      {titles.length ? (
        <p className="text-soft">
          Employers file it as{" "}
          {titles.map((t, i) => (
            <span key={t.title}>
              <span className="text-foreground">{t.title}</span> ({share(t.filings)}){i < titles.length - 1 ? ", " : ""}
            </span>
          ))}
          .
        </p>
      ) : null}{" "}
      <p>
        Pay, titles and approval rate in full: <CodePageLink profile={profile} newTab />
      </p>
    </div>
  );
}

function Stat({ label, value, note, missing }: { label: string; value: string | null; note: string | null; missing: string }) {
  return (
    <div className="bg-tint px-4 py-3">
      <p className="text-sm font-semibold">{label}</p>{" "}
      {value ? (
        <>
          <p className="mt-1 font-heading text-2xl font-bold tabular-nums">{value}</p>{" "}
          {note ? <p className="text-sm text-soft">{note}</p> : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-soft">{missing}</p>
      )}
    </div>
  );
}

/** A profile read's three states as one block: the card, a sentence with Try again, or a placeholder its size. */
export function SocProfileState({
  result,
  brief = false,
  className,
}: {
  result: PublicQueryResult<SocProfile>;
  /** The quiet brief, for the case form; the full card otherwise (the case page). */
  brief?: boolean;
  className?: string;
}) {
  if (result.failed) {
    return (
      <div role="status" className={cn("flex flex-wrap items-center gap-3 border-2 border-border bg-tint px-4 py-3 text-sm", className)}>
        <span>{result.failure?.message ?? "This job code couldn't be read just now."}</span>{" "}
        <Button type="button" variant="outline" size="sm" onClick={result.retry}>
          Try again
        </Button>
      </div>
    );
  }
  if (!result.data) {
    return brief ? (
      <div aria-hidden="true" className={cn("skeleton-pulse h-[7.5rem] border-l-2 border-input", className)} />
    ) : (
      <div aria-hidden="true" className={cn("skeleton-pulse h-[13.5rem] border-2 border-border sm:h-[11rem]", className)} />
    );
  }
  return brief ? <SocCodeBrief profile={result.data} className={className} /> : <SocCodeSummary profile={result.data} className={className} />;
}

/** The card for a code the page holds as a value: it reads the profile itself. */
export function SocCodeCard({ code, className }: { code: string | null | undefined; className?: string }) {
  const result = useSocProfile(code);
  return code ? <SocProfileState result={result} className={className} /> : null;
}
