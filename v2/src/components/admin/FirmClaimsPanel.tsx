"use client";

/**
 * Law firms claiming their pages (convex/firmClaims.ts): claims waiting for a
 * person, profile changes waiting for a read (before and after, approve or
 * decline with a reason the firm is told), the verified claims, and the rest.
 * Waiting claims come first, with the reason the domain check fell short,
 * because that's what decides whether to approve.
 *
 * SECURITY: the rows carry claimants' addresses and roles; admin page only.
 */

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { focusLabel } from "@/lib/firmProfile";

export type FirmClaimsData = FunctionReturnType<typeof api.firmClaims.listForAdmin>;
type Claim = FirmClaimsData["review"][number];
type Edit = FirmClaimsData["edits"][number];
type Version = Edit["after"];

/** A decline's reason; the server cuts at the same length. */
const REASON_MAX = 500;

const REASON: Record<string, string> = {
  personal: "Personal mail (Gmail, Yahoo and the like)",
  shared: "A domain DOL lists for more than three firms",
  not_listed: "A domain DOL never lists for this firm",
  too_few: "DOL lists the domain for this firm only once",
  revoked: "Claimed again after we revoked it",
  rejected: "Claimed again after we rejected it",
};

const BTN =
  "inline-flex min-h-[44px] items-center border-2 border-border px-3 text-sm font-bold shadow-hard-sm transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none";

function when(ms: number | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function ClaimCard({ c }: { c: Claim }) {
  const approve = useMutation(api.firmClaims.approveClaim);
  const reject = useMutation(api.firmClaims.rejectClaim);
  const revoke = useMutation(api.firmClaims.revokeClaim);
  const hide = useMutation(api.firmClaims.setProfileHidden);
  const site = useMutation(api.firmClaims.approveWebsite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const id = c._id as Id<"firmClaims">;
  return (
    <li className="border-2 border-border bg-card p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a href={`/perm-attorneys/${c.slug}`} className="font-heading text-lg font-black underline decoration-primary decoration-2 underline-offset-2">
          {c.firmName}
        </a>{" "}
        <span className="text-sm font-bold">{c.status.replace("_", " ")}</span>
      </div>{" "}
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr] [&>*]:min-w-0">
        <dt className="font-bold">Address</dt> <dd className="break-all">{c.email}</dd>{" "}
        <dt className="font-bold">Role</dt> <dd>{c.role}</dd>{" "}
        <dt className="font-bold">Domain check</dt>{" "}
        <dd>
          {c.domainReason ? (REASON[c.domainReason] ?? c.domainReason) : "Tied to the firm by DOL's files"}
          {` (${c.domainFilings} filing${c.domainFilings === 1 ? "" : "s"} with ${c.domain})`}
        </dd>{" "}
        <dt className="font-bold">Asked</dt> <dd>{when(c.createdAt)}{c.confirmedAt ? `; confirmed ${when(c.confirmedAt)}` : ""}</dd>{" "}
        {c.draft.website ? (
          <>
            <dt className="font-bold">Website</dt> <dd className="break-all">{c.draft.website}</dd>{" "}
          </>
        ) : null}
        {c.draft.focus.length ? (
          <>
            <dt className="font-bold">Handles</dt> <dd>{c.draft.focus.map(focusLabel).join(", ")}</dd>{" "}
          </>
        ) : null}
        {c.draft.languages.length ? (
          <>
            <dt className="font-bold">Languages</dt> <dd>{c.draft.languages.join(", ")}</dd>{" "}
          </>
        ) : null}
        {c.draft.offices.length ? (
          <>
            <dt className="font-bold">Offices</dt> <dd>{c.draft.offices.map((o) => `${o.city}, ${o.state}`).join("; ")}</dd>{" "}
          </>
        ) : null}
      </dl>{" "}
      {c.draft.description ? <p className="mt-2 whitespace-pre-line border-l-4 border-border pl-3 text-sm">{c.draft.description}</p> : null}{" "}
      <div className="mt-3 flex flex-wrap gap-2">
        {c.status === "pending_review" ? (
          <button type="button" disabled={busy} onClick={() => run(() => approve({ claimId: id }))} className={`${BTN} bg-primary text-primary-foreground`}>
            Approve and publish
          </button>
        ) : null}
        {c.status === "pending_review" || c.status === "pending_email" ? (
          <button type="button" disabled={busy} onClick={() => run(() => reject({ claimId: id }))} className={`${BTN} bg-background`}>
            Reject
          </button>
        ) : null}
        {c.status === "verified" ? (
          <button type="button" disabled={busy} onClick={() => run(() => revoke({ claimId: id }))} className={`${BTN} bg-background`}>
            Revoke the claim
          </button>
        ) : null}
        {c.status === "verified" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => hide({ slug: c.slug, hidden: !c.profileHidden }))}
            className={`${BTN} bg-background`}
          >
            {c.profileHidden ? "Show the profile" : "Hide the profile"}
          </button>
        ) : null}
        {c.pendingWebsite ? (
          <button type="button" disabled={busy} onClick={() => run(() => site({ slug: c.slug }))} className={`${BTN} bg-background`}>
            Approve the website {c.pendingWebsite}
          </button>
        ) : null}
      </div>{" "}
      {c.profileHidden ? (
        <p className="mt-2 text-sm font-bold">
          Profile hidden{c.profileHiddenBy ? ` (by ${c.profileHiddenBy === "firm" ? "the firm" : c.profileHiddenBy === "admin" ? "us" : "the revoke"})` : ""}.
        </p>
      ) : null}{" "}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}


function fieldRows(v: Version | null): { label: string; value: string }[] {
  if (!v) return [];
  return [
    { label: "Website", value: v.website ?? "" },
    { label: "Handles", value: v.focus.map(focusLabel).join(", ") },
    { label: "Languages", value: v.languages.join(", ") },
    { label: "Offices", value: v.offices.map((o) => `${o.city}, ${o.state}`).join("; ") },
    { label: "About", value: v.description ?? "" },
  ];
}

function EditCard({ e }: { e: Edit }) {
  const approve = useMutation(api.firmClaims.approveProfile);
  const decline = useMutation(api.firmClaims.rejectProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const before = fieldRows(e.before);
  const after = fieldRows(e.after);
  const reasonId = `decline-${e.slug}`;
  return (
    <li className="border-2 border-border bg-card p-4 shadow-hard-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <a href={`/perm-attorneys/${e.slug}`} className="font-heading text-lg font-black underline decoration-primary decoration-2 underline-offset-2">
          {e.firmName}
        </a>{" "}
        <span className="text-sm font-bold">{e.before ? "changes" : "first profile"}</span>
      </div>{" "}
      <p className="mt-1 text-sm">
        Sent {when(e.submittedAt)} by <span className="break-all">{e.email}</span>
        {e.hidden ? "; the profile is down, so approving won't show it" : ""}
      </p>{" "}
      <dl className="mt-3 grid grid-cols-1 gap-y-2 text-sm [&>*]:min-w-0">
        {after.map((row, i) => {
          const was = before[i]?.value ?? "";
          const changed = e.before !== null && was !== row.value;
          if (!row.value && !was) return null;
          return (
            <div key={row.label} className={changed ? "border-l-4 border-primary pl-3" : "pl-4"}>
              <dt className="font-bold">
                {row.label}
                {changed ? " (changed)" : ""}
                {row.label === "Website" && e.websiteOffDomain ? `, not on ${e.domain}` : ""}
              </dt>{" "}
              {changed ? (
                <dd className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2 [&>*]:min-w-0">
                  <span className="whitespace-pre-line break-words text-foreground/70">
                    <span className="font-bold">Now: </span>
                    {was || "nothing"}
                  </span>{" "}
                  <span className="whitespace-pre-line break-words">
                    <span className="font-bold">New: </span>
                    {row.value || "nothing"}
                  </span>
                </dd>
              ) : (
                <dd className="mt-1 whitespace-pre-line break-words">{row.value}</dd>
              )}
            </div>
          );
        })}
      </dl>{" "}
      <label htmlFor={reasonId} className="mt-4 block text-sm font-bold">
        Reason for a decline <span className="font-normal text-foreground/70">(optional; the firm sees it)</span>
      </label>{" "}
      <textarea
        id={reasonId}
        value={reason}
        maxLength={REASON_MAX}
        placeholder="What should the firm change?"
        onChange={(ev) => setReason(ev.target.value)}
        rows={2}
        className="mt-1 w-full min-w-0 border-2 border-border bg-background p-2 text-sm"
      />{" "}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run(() => approve({ slug: e.slug }))} className={`${BTN} bg-primary text-primary-foreground`}>
          Approve and publish
        </button>{" "}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => decline({ slug: e.slug, reason: reason.trim() || undefined }))}
          className={`${BTN} bg-background`}
        >
          Decline
        </button>
      </div>{" "}
      {error ? (
        <p role="alert" className="mt-2 text-sm font-bold text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function Group({ title, note, claims }: { title: string; note: string; claims: Claim[] }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-black">
        {title} <span className="tabular-nums text-foreground/70">{claims.length}</span>
      </h2>{" "}
      <p className="mt-1 text-sm text-foreground/70">{note}</p>{" "}
      {claims.length === 0 ? (
        <p className="mt-3 text-sm">None.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
          {claims.map((c) => (
            <ClaimCard key={c._id} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function FirmClaimsPanel({ data }: { data: FirmClaimsData | undefined }) {
  if (!data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-10">
      <Group
        title="Claims waiting for a person"
        note="Confirmed by email, but DOL's files don't tie the address's domain to the firm. Approving publishes the profile it came with and emails the firm an edit link."
        claims={data.review}
      />{" "}
      <section>
        <h2 className="font-heading text-xl font-black">
          Profile changes waiting <span className="tabular-nums text-foreground/70">{data.edits.length}</span>
        </h2>{" "}
        <p className="mt-1 text-sm text-foreground/70">
          A verified firm&apos;s words show on its page only after you approve them. The page keeps what it shows until then. Either way the firm gets an email.
        </p>{" "}
        {data.edits.length === 0 ? (
          <p className="mt-3 text-sm">None.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 [&>*]:min-w-0">
            {data.edits.map((e) => (
              <EditCard key={e.slug} e={e} />
            ))}
          </ul>
        )}
      </section>{" "}
      <Group title="Verified" note="Live claims. Revoking the last one on a firm takes its profile down." claims={data.verified} />
      <Group title="Unconfirmed, rejected and revoked" note="Newest first." claims={data.other} />
    </div>
  );
}
