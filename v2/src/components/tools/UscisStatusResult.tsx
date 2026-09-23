"use client";

import { useEffect, useState } from "react";
import { WarningIcon } from "@phosphor-icons/react/ssr";

/**
 * The live half of `/uscis-case-status`: asks our own route for the receipt
 * and renders what USCIS said, or why nothing could be said.
 *
 * WHY A CLIENT FETCH AND NOT A SERVER READ. The route carries every guard
 * (length, shape, the pending flag, per-IP, the global budget), and a page
 * render that asked USCIS directly would sit outside them. The page also
 * stays honest about time: the panel says when USCIS last told us this, in
 * Eastern time, because a status without its date is a claim without one.
 *
 * NOTHING HERE IS INVENTED. Every branch below renders either USCIS's own
 * text or a sentence about why there is none.
 */

interface StatusPayload {
  receipt: string;
  status: {
    receipt: string;
    formType: string | null;
    statusText: string;
    statusDesc: string;
    submittedAt: string | null;
    modifiedAt: string | null;
    history: Array<{ date: string; text: string }>;
    seenAt: number;
    firstSeenAt: number;
    lastChangeAt: number;
  };
  source: "stored" | "live";
  stale: boolean;
  failure?: string;
}

interface RefusalPayload {
  error: string;
  reason: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: StatusPayload }
  | { kind: "refused"; httpStatus: number; data: RefusalPayload }
  | { kind: "network" };

const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

/** "Sep 22, 2026, 2:00 PM EDT" from an epoch. */
function whenEt(ms: number): string {
  return ET.format(new Date(ms));
}

/** "September 5, 2023" from USCIS's naive `YYYY-MM-DDTHH:mm:ss` or a bare date. */
function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const USCIS_STATUS_URL = "https://egov.uscis.gov/casestatus/landing.do";

export function UscisStatusResult({ receipt }: { receipt: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetch(`/api/uscis-case-status?receipt=${encodeURIComponent(receipt)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as StatusPayload | RefusalPayload | null;
        if (cancelled) return;
        if (res.ok && body && "status" in body) setState({ kind: "ok", data: body });
        else if (body && "error" in body) setState({ kind: "refused", httpStatus: res.status, data: body });
        else setState({ kind: "network" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "network" });
      });
    return () => {
      cancelled = true;
    };
  }, [receipt]);

  if (state.kind === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-2 border-border bg-card p-5 shadow-hard sm:p-6"
      >
        <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Asking USCIS
        </p>{" "}
        <p className="mt-2 text-base text-foreground/80">
          Checking {receipt} against USCIS&apos;s Case Status API.
        </p>
      </div>
    );
  }

  if (state.kind === "network") {
    return (
      <Refusal title="Nothing came back">
        The request to this site&apos;s own lookup route failed before USCIS was
        reached. Reload, or use{" "}
        <a href={USCIS_STATUS_URL} rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-primary">
          USCIS&apos;s own status page
        </a>
        .
      </Refusal>
    );
  }

  if (state.kind === "refused") {
    const title =
      state.httpStatus === 404
        ? "USCIS has no case under that number"
        : state.httpStatus === 429
          ? "Too many lookups right now"
          : state.httpStatus === 400
            ? "Not a receipt number"
            : "USCIS could not be asked";
    return (
      <Refusal title={title}>
        {state.data.error}{" "}
        <a href={USCIS_STATUS_URL} rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-primary">
          USCIS&apos;s own status page
        </a>{" "}
        is the authority for any receipt.
      </Refusal>
    );
  }

  const { status, source, stale, failure } = state.data;
  const submitted = longDate(status.submittedAt);
  const modified = longDate(status.modifiedAt);

  return (
    <section aria-labelledby="uscis-result-heading" className="border-2 border-border bg-card shadow-hard">
      <div className="border-b-2 border-border p-5 sm:p-6">
        <p className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {status.formType ? `${status.formType} · ` : ""}
          {status.receipt}
        </p>{" "}
        <h2 id="uscis-result-heading" className="mt-2 font-heading text-2xl font-black sm:text-3xl">
          {status.statusText}
        </h2>{" "}
        {status.statusDesc ? (
          <p className="mt-3 max-w-prose text-base leading-relaxed text-foreground/80">{status.statusDesc}</p>
        ) : null}
      </div>{" "}

      {stale ? (
        <p className="flex items-start gap-2 border-b-2 border-data-warn bg-data-warn/8 px-5 py-3 text-sm leading-relaxed text-foreground/80 sm:px-6">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>
            <b className="font-bold text-data-warn-ink">This is our stored copy.</b> USCIS could
            not be asked just now ({failure ?? "unavailable"}), so the status above is as of{" "}
            {whenEt(status.seenAt)}.
          </span>
        </p>
      ) : null}

      <dl className="grid gap-x-8 gap-y-3 p-5 text-sm sm:grid-cols-2 sm:p-6">
        {submitted ? (
          <div>
            <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Received by USCIS</dt>{" "}
            <dd className="mt-1 text-base">{submitted}</dd>
          </div>
        ) : null}{" "}
        {modified ? (
          <div>
            <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Last updated by USCIS</dt>{" "}
            <dd className="mt-1 text-base">{modified}</dd>
          </div>
        ) : null}{" "}
        <div>
          <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Status seen</dt>{" "}
          <dd className="mt-1 text-base">
            {whenEt(status.seenAt)}
            {source === "stored" && !stale ? " (our copy, under six hours old)" : ""}
          </dd>
        </div>{" "}
        <div>
          <dt className="font-mono font-bold uppercase tracking-[0.1em] text-muted-foreground">Status last changed</dt>{" "}
          <dd className="mt-1 text-base">{whenEt(status.lastChangeAt)}</dd>
        </div>
      </dl>{" "}

      {status.history.length > 0 ? (
        <div className="border-t-2 border-border p-5 sm:p-6">
          <h3 className="font-heading text-lg font-bold">History, as USCIS lists it</h3>{" "}
          <ol className="mt-3 space-y-2 text-sm">
            {status.history.map((h) => (
              <li key={`${h.date}-${h.text}`} className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-mono text-muted-foreground">{longDate(h.date) ?? h.date}</span>{" "}
                <span>{h.text}</span>{" "}
              </li>
            ))}
          </ol>
        </div>
      ) : null}{" "}

      <p className="border-t-2 border-border px-5 py-3 text-sm text-muted-foreground sm:px-6">
        USCIS&apos;s own words, from its Case Status API. Nothing on this panel is
        estimated. This lookup is stored as{" "}
        <a href="/privacy#uscis-case-status" className="font-bold underline underline-offset-2 hover:text-primary">
          the privacy policy
        </a>{" "}
        describes.{" "}
        <a href={USCIS_STATUS_URL} rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-primary">
          Check the same receipt at USCIS
        </a>
        .
      </p>
    </section>
  );
}

function Refusal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
      <p className="font-heading text-xl font-black">{title}</p>{" "}
      <p className="mt-2 max-w-prose text-base leading-relaxed text-foreground/80">{children}</p>
    </div>
  );
}
