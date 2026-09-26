"use client";

import { Fragment, useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CompassIcon, InfoIcon } from "@phosphor-icons/react";

import { lineSlug } from "@/lib/bulletinLines";
import { LINE_COUNTRIES, LINE_COUNTRY_LABEL } from "@/lib/greenCardLine";
import type { CountryKey } from "@/lib/perm";
import { cn } from "@/lib/utils";
import {
  chooseCategories,
  type Answers,
  type JobRequirement,
  type Qualification,
  type Sponsor,
} from "@/lib/visaChooser";

const SELECT_CLASS =
  "mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
const OPTION_CLASS =
  "flex min-h-[44px] cursor-pointer items-center gap-3 border-2 border-border bg-background px-3 py-2 text-base has-[:checked]:bg-tint-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary";

const SPONSORS: Array<{ value: Sponsor; label: string }> = [
  { value: "employer", label: "A US employer offering me a job" },
  { value: "self", label: "Nobody, I'd file for myself" },
  { value: "family", label: "A US citizen or green card holder in my family" },
  { value: "investment", label: "My own investment in a US business" },
];

const JOBS: Array<{ value: JobRequirement; label: string }> = [
  { value: "advanced", label: "A master's or higher, or a bachelor's plus five years' progressive experience" },
  { value: "bachelors", label: "A bachelor's degree" },
  { value: "two-years", label: "At least two years of training or experience, no degree" },
  { value: "under-two", label: "Less than two years of training or experience" },
];

const QUALS: Array<{ value: Qualification; label: string }> = [
  { value: "advanced", label: "A master's degree or doctorate" },
  { value: "bachelors5", label: "A bachelor's plus five years' progressive experience in the field" },
  { value: "bachelors", label: "A bachelor's degree" },
  { value: "two-years", label: "Two or more years of training or experience" },
  { value: "under-two", label: "Less than that" },
];

const STATEMENTS: Array<{ key: keyof Pick<Answers, "acclaim" | "researcher" | "multinational" | "exceptional" | "nationalInterest">; label: string }> = [
  { key: "acclaim", label: "I have sustained national or international acclaim in my field, such as a major award or several of the regulation's criteria" },
  { key: "researcher", label: "I'm internationally recognized as outstanding in an academic field, with at least three years of teaching or research" },
  { key: "multinational", label: "I worked at least one of the last three years abroad as a manager or executive for this employer's affiliate" },
  { key: "exceptional", label: "My expertise is significantly above what's ordinarily encountered in my field" },
  { key: "nationalInterest", label: "My work has substantial merit and national importance, and I'm well positioned to advance it" },
];

function Radios<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-heading text-lg font-black">{legend}</legend>{" "}
      <div className="mt-3 grid grid-cols-1 gap-2 [&>*]:min-w-0">
        {options.map((o) => (
          <Fragment key={o.value}>
            {" "}
            <label className={OPTION_CLASS}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="h-5 w-5 shrink-0 accent-primary"
              />{" "}
              <span>{o.label}</span>
            </label>
          </Fragment>
        ))}
      </div>
    </fieldset>
  );
}

export function VisaChooser({ className }: { className?: string }) {
  const uid = useId();
  const [a, setA] = useState<Answers>({
    sponsor: "employer",
    job: "bachelors",
    qualification: "bachelors",
    acclaim: false,
    researcher: false,
    multinational: false,
    exceptional: false,
    nationalInterest: false,
  });
  const [country, setCountry] = useState<CountryKey>("worldwide");
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((prev) => ({ ...prev, [k]: v }));
  const result = useMemo(() => chooseCategories(a), [a]);

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="flex items-start gap-3 border-b-2 border-border bg-muted/40 p-4 sm:px-8">
        <InfoIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />{" "}
        <p className="text-base leading-relaxed">
          This matches your answers against the regulation&apos;s definitions. It isn&apos;t legal advice: whether a case
          meets a definition is USCIS&apos;s decision on the evidence, and an immigration attorney reads that evidence.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 p-6 [&>*]:min-w-0 sm:p-8">
        <Radios legend="Who would sponsor you?" name={`${uid}-sponsor`} options={SPONSORS} value={a.sponsor} onChange={(v) => set("sponsor", v)} />{" "}
        {a.sponsor === "employer" ? (
          <Radios legend="What does the job require at minimum?" name={`${uid}-job`} options={JOBS} value={a.job} onChange={(v) => set("job", v)} />
        ) : null}{" "}
        <Radios legend="What do you hold?" name={`${uid}-qual`} options={QUALS} value={a.qualification} onChange={(v) => set("qualification", v)} />{" "}
        <fieldset className="min-w-0">
          <legend className="font-heading text-lg font-black">Tick any that are true</legend>{" "}
          <div className="mt-3 grid grid-cols-1 gap-2 [&>*]:min-w-0">
            {STATEMENTS.map((s) => (
              <Fragment key={s.key}>
                {" "}
                <label className={OPTION_CLASS}>
                  <input
                    type="checkbox"
                    checked={a[s.key]}
                    onChange={(e) => set(s.key, e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />{" "}
                  <span>{s.label}</span>
                </label>
              </Fragment>
            ))}
          </div>
        </fieldset>{" "}
        <div className="max-w-sm">
          <label htmlFor={`${uid}-country`} className="font-heading text-lg font-black">
            Country of chargeability
          </label>
          <select id={`${uid}-country`} value={country} onChange={(e) => setCountry(e.target.value as CountryKey)} className={SELECT_CLASS}>
            {LINE_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {LINE_COUNTRY_LABEL[c]}
              </option>
            ))}
          </select>{" "}
          <p className="mt-1 text-sm text-foreground/70">Usually your country of birth. It only changes the links below.</p>
        </div>
      </div>

      <section className="border-t-2 border-border p-6 sm:p-8" aria-live="polite" aria-labelledby={`${uid}-result`}>
        <div className="flex items-center gap-3">
          <CompassIcon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />{" "}
          <h2 id={`${uid}-result`} className="font-heading text-2xl font-black leading-tight">
            {result.fits.length === 0
              ? "No employment category matches these answers"
              : result.fits.length === 1
                ? "One category could fit"
                : `${result.fits.length} categories could fit`}
          </h2>
        </div>{" "}
        {result.fits.length ? (
          <ul className="mt-5 grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2">
            {result.fits.map((f) => (
              <Fragment key={f.code}>
                {" "}
                <li className="border-2 border-border bg-background p-5">
                  <h3 className="font-heading text-xl font-black" translate="no">
                    {f.name}
                  </h3>{" "}
                  <p className="mt-2 text-base leading-relaxed text-foreground/85">{f.why}</p>{" "}
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-base [&>*]:min-w-0">
                    <dt className="text-foreground/70">PERM needed</dt>{" "}
                    <dd className="font-bold">{f.needsPerm ? "Yes" : "No"}</dd>{" "}
                    <dt className="text-foreground/70">Job offer needed</dt>{" "}
                    <dd className="font-bold">{f.needsJobOffer ? "Yes" : "No"}</dd>{" "}
                    <dt className="text-foreground/70">Who files</dt>{" "}
                    <dd className="font-bold">{f.whoFiles}</dd>{" "}
                    <dt className="text-foreground/70">Rule</dt>{" "}
                    <dd>{f.rule}</dd>
                  </dl>{" "}
                  <div className="mt-3 flex flex-wrap gap-x-5">
                    <Link
                      href={`/visa-bulletin/categories/${lineSlug(f.bulletin, country)}`}
                      className="inline-flex min-h-[44px] items-center gap-2 font-semibold underline underline-offset-2 hover:text-primary"
                    >
                      This line in the bulletin
                      <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </Link>{" "}
                    {f.bulletin !== "EB1" ? (
                      <Link
                        href={`/tools/green-card-line?category=${f.bulletin}&country=${country}`}
                        className="inline-flex min-h-[44px] items-center gap-2 font-semibold underline underline-offset-2 hover:text-primary"
                      >
                        People ahead in it
                        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </div>
                </li>
              </Fragment>
            ))}
          </ul>
        ) : null}{" "}
        {result.notes.length ? (
          <ul className="mt-5 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/85">
            {result.notes.map((n) => (
              <Fragment key={n}>
                {" "}
                <li>{n}</li>
              </Fragment>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
