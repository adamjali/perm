"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useUrlSearchParams } from "@/hooks/useUrlSearchParams";
import { formatShareOf } from "@/lib/format";
import { codeHref, type CodeAnswer, type TitleAnswer } from "@/lib/socFinder";
import { formText } from "@/lib/forms/formText";

/**
 * The job code finder: a job title or a code in, the codes employers filed it under out, each with
 * its share. Reads /api/soc. The query lives in the address (`?q=`), so an answer can be shared.
 */

interface Found {
  query: string;
  code: CodeAnswer | null;
  titles: TitleAnswer[];
  codes: CodeAnswer[];
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; previous: Found | null }
  | { kind: "done"; found: Found }
  | { kind: "error"; message: string };

const MIN = 2;
const MAX = 80;
const WAIT_MS = 300;

export function SocFinder({ examples }: { examples: { slug: string; title: string }[] }) {
  const params = useUrlSearchParams();
  const initial = (params.get("q") ?? "").slice(0, MAX);
  const inputId = useId();
  const [text, setText] = useState(initial);
  const [state, setState] = useState<State>({ kind: "idle" });
  const asked = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function ask(raw: string) {
    const q = raw.trim();
    if (q.length < MIN || q.length > MAX || q === asked.current) return;
    asked.current = q;
    setState((s) => ({ kind: "loading", previous: s.kind === "done" ? s.found : s.kind === "loading" ? s.previous : null }));
    try {
      const res = await fetch(`/api/soc?q=${encodeURIComponent(q)}`);
      const j = (await res.json().catch(() => null)) as (Found & { error?: string }) | null;
      if (asked.current !== q) return;
      if (!res.ok || !j || j.error) {
        setState({ kind: "error", message: j?.error ?? "The job codes couldn't be read just now. Try again in a minute." });
        asked.current = "";
        return;
      }
      setState({ kind: "done", found: j });
      const url = new URL(window.location.href);
      url.searchParams.set("q", q);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      if (asked.current === q) {
        setState({ kind: "error", message: "The finder couldn't reach the site. Check the connection and try again." });
        asked.current = "";
      }
    }
  }

  // A shared address answers at once.
  useEffect(() => {
    if (initial.trim().length >= MIN) void ask(initial);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(v: string) {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void ask(v), WAIT_MS);
  }

  const shown = state.kind === "done" ? state.found : state.kind === "loading" ? state.previous : null;
  const short = text.trim().length > 0 && text.trim().length < MIN;

  return (
    <div>
      <form
        role="search"
        className="object p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const v = formText(e.currentTarget, "q", text);
          asked.current = "";
          void ask(v);
        }}
      >
        <label htmlFor={inputId} className="font-heading text-xl font-bold leading-tight">
          A job title or a SOC code
        </label>{" "}
        <div className="mt-3 flex gap-2">
          <input
            id={inputId}
            name="q"
            type="search"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            maxLength={MAX}
            autoComplete="off"
            placeholder="Data scientist"
            className="h-12 min-w-0 flex-1 border-2 border-input bg-card px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />{" "}
          <button type="submit" className={buttonVariants({ size: "lg" })}>
            Find
          </button>
        </div>{" "}
        {short ? (
          <p role="status" className="mt-2 text-sm text-soft">
            Type at least two letters.
          </p>
        ) : null}{" "}
        {!text.trim() && examples.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-soft">Try</span>{" "}
            {examples.map((x) => (
              <Fragment key={x.slug}>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center border-2 border-input bg-card px-3 font-semibold hover:bg-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setText(x.title);
                    asked.current = "";
                    void ask(x.title);
                  }}
                >
                  {x.title}
                </button>{" "}
              </Fragment>
            ))}
          </div>
        ) : null}
      </form>{" "}
      <div aria-live="polite" className={state.kind === "loading" ? "opacity-60 transition-opacity" : undefined}>
        {state.kind === "error" ? (
          <p role="alert" className="mt-6 border-2 border-destructive bg-card p-4 text-base">
            {state.message}
          </p>
        ) : null}{" "}
        {shown ? <Results found={shown} /> : null}
      </div>
    </div>
  );
}

function Results({ found }: { found: Found }) {
  if (found.code) return <CodeResult code={found.code} />;
  if (!found.titles.length && !found.codes.length) {
    return (
      <p className="mt-6 text-base text-soft">
        No title or code matched &ldquo;{found.query}&rdquo;. Try fewer words (&ldquo;engineer&rdquo; rather than the full
        title), or find the job by group below.
      </p>
    );
  }
  return (
    <div className="mt-8 space-y-8">
      <p className="sr-only">
        {found.titles.length} {found.titles.length === 1 ? "title" : "titles"} matched.
      </p>{" "}
      {found.titles.map((t) => (
        <TitleResult key={t.key} title={t} />
      ))}{" "}
      {found.codes.length ? (
        <div>
          <h3 className="font-heading text-lg font-bold">BLS&apos;s own name for the job</h3>{" "}
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {found.codes.map((c) => (
              <li key={c.soc}>
                <Link href={codeHref(c.soc, c.slug)} className="link inline-flex min-h-11 items-center">
                  <span className="whitespace-nowrap font-mono">{c.soc}</span>&nbsp;{c.title}
                </Link>{" "}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function TitleResult({ title }: { title: TitleAnswer }) {
  const filed = title.codes.filter((c) => c.filings > 0);
  const onetOnly = title.codes.filter((c) => c.filings === 0);
  const top = Math.max(0, ...filed.map((c) => c.share ?? 0));
  return (
    <section className="border-2 border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading text-xl font-bold leading-tight">
          {title.slug ? (
            <Link href={`/soc-codes/${title.slug}`} className="link">
              {title.title}
            </Link>
          ) : (
            title.title
          )}
        </h3>{" "}
        {title.total > 0 ? (
          <span className="font-mono text-sm text-soft tabular-nums">
            {title.total.toLocaleString("en-US")} {title.total === 1 ? "filing" : "filings"}
          </span>
        ) : (
          <span className="text-sm text-soft">An O*NET title</span>
        )}
      </div>{" "}
      {filed.length ? (
        <ol className="mt-4 space-y-3" aria-label={`The codes employers filed ${title.title} under`}>
          {filed.map((c) => (
            <li key={c.soc} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4">
              <div className="min-w-0">
                <Link href={codeHref(c.soc, c.slug)} className="link inline-flex min-h-11 items-center text-base font-semibold">
                  <span className="whitespace-nowrap font-mono">{c.soc}</span>&nbsp;{c.codeTitle}
                </Link>{" "}
                {c.becameCodes.length ? (
                  <p className="text-sm text-soft">
                    A 2010 code; BLS replaced it in 2018 with {c.becameCodes.join(" and ")}.
                  </p>
                ) : null}
                <div className="mt-1 h-2.5 w-full bg-sage" aria-hidden="true">
                  <div className="h-full bg-primary" style={{ width: `${top > 0 ? Math.max(1, ((c.share ?? 0) / top) * 100) : 0}%` }} />
                </div>
              </div>{" "}
              <span className="min-w-[5.5rem] text-right font-mono text-base font-bold tabular-nums">{formatShareOf(c.filings, title.total)}</span>
            </li>
          ))}
        </ol>
      ) : null}{" "}
      {onetOnly.length ? (
        <p className="mt-4 text-sm text-soft">
          {filed.length ? "O*NET also lists it under " : "O*NET lists it under "}
          {onetOnly.slice(0, 4).map((c, i) => (
            <Fragment key={c.soc}>
              <Link href={codeHref(c.soc, c.slug)} className="link">
                {c.soc} {c.codeTitle}
              </Link>
              {i < Math.min(onetOnly.length, 4) - 1 ? ", " : "."}{" "}
            </Fragment>
          ))}
        </p>
      ) : null}{" "}
      {filed.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Share of this title&apos;s filings in DOL&apos;s files under each code.</p>
      ) : null}
    </section>
  );
}

function CodeResult({ code }: { code: CodeAnswer }) {
  if (!code.known && !code.became.length) {
    return (
      <p className="mt-6 text-base text-soft">
        <span className="whitespace-nowrap font-mono">{code.soc}</span> isn&apos;t a code in DOL&apos;s files or O*NET&apos;s list. Check the
        digits, or search by the job&apos;s title.
      </p>
    );
  }
  const retired = code.became.length > 0;
  return (
    <section className="mt-8 border-2 border-border bg-card p-5 sm:p-6">
      <h3 className="font-heading text-xl font-bold">
        <span className="whitespace-nowrap font-mono">{code.soc}</span> {code.title !== code.soc ? code.title : ""}
      </h3>{" "}
      <p className="mt-2 text-base text-soft">
        {retired ? "A 2010 code: BLS replaced it in 2018. " : ""}
        {code.filings > 0
          ? `${code.filings.toLocaleString("en-US")} filings under it in DOL's files.`
          : retired
            ? ""
            : "No filings under it in the DOL files this site holds."}
        {code.zone ? ` O*NET Job Zone ${code.zone}.` : ""}
      </p>{" "}
      {retired ? (
        <>
          <p className="mt-3 text-base font-semibold">Filed since under:</p>{" "}
          <ul className="mt-1 space-y-1">
            {code.became.map((b) => (
              <li key={b.soc}>
                <Link href={codeHref(b.soc, b.slug)} className="link inline-flex min-h-11 items-center font-semibold">
                  <span className="whitespace-nowrap font-mono">{b.soc}</span>&nbsp;{b.title}
                </Link>{" "}
              </li>
            ))}
          </ul>
        </>
      ) : null}{" "}
      {code.known ? (
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
          {code.slug ? (
            <Link href={codeHref(code.soc, code.slug)} className="link inline-flex min-h-11 items-center font-semibold">
              The job&apos;s page
            </Link>
          ) : null}{" "}
          {retired ? null : (
            <Link href={`/tools/wage-levels?soc=${code.soc}`} className="link inline-flex min-h-11 items-center">
              Its wage levels by area
            </Link>
          )}
        </p>
      ) : null}
    </section>
  );
}
