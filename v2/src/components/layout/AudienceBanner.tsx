"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { MagnifyingGlassIcon, WarningIcon, XIcon } from "@phosphor-icons/react";

import { api } from "@convex/_generated/api";
import { analytics } from "@/lib/analytics";
import { audienceOf } from "@/lib/audience";

/**
 * Caution tape at the top of the signed-in app for an account that doesn't file cases: who the app is for, and
 * where someone waiting on their own case gets what they came for (the free case lookup and its email alert).
 * It replaced the box that had stood in front of the sign-up form (owner, Oct 26 2026): nobody is turned away
 * before an account, and nobody is sent out of the app after it.
 *
 * Shown to accounts that said they're waiting on their own case or chose Other, and to accounts made since setup
 * began asking the question (Oct 6 2026) that skipped it: the 11 that skipped it by Oct 26 were all individuals.
 * An attorney, paralegal, HR team or employer never sees it, and neither does an older account that gave no role
 * (most of those are firms). Closing it is remembered in this browser for this account; a practice role in
 * Settings removes it everywhere.
 *
 * The tape is fixed black and lime in both themes, like the header and the footer.
 */

const TAPE: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(45deg, #000 0 9px, #2ECC40 9px 18px)",
};

const KEY = "pt-audience-banner-closed:";

/** Setup has asked who an account is for since Oct 6 2026; a newer account without a role skipped the question. */
export const ROLE_ASKED_FROM = Date.parse("2026-10-06T00:00:00-04:00");

/** Who sees the banner: anyone not in practice, except older accounts that never gave a role. */
export function showsAudienceBanner(profile: { jobTitle?: string; createdAt?: number; _creationTime: number }): boolean {
  const audience = audienceOf(profile.jobTitle);
  if (audience === "own-case" || audience === "other") return true;
  return audience === "unstated" && (profile.createdAt ?? profile._creationTime) >= ROLE_ASKED_FROM;
}

export function AudienceBannerView({ onClose }: { onClose: () => void }) {
  return (
    <section aria-label="Who this app is for" className="relative z-10 border-b-2 border-border bg-card">
      <div className="h-2 border-b-2 border-border" style={TAPE} aria-hidden="true" />
      <div className="mx-auto flex max-w-[1400px] items-start gap-3 px-4 py-3 sm:items-center sm:px-8">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center border-2 border-border bg-black sm:mt-0"
        >
          <WarningIcon size={20} weight="fill" className="text-[#2ECC40]" />
        </span>{" "}
        <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="font-heading text-base font-bold leading-snug">This app is for people who file PERM cases</p>{" "}
            <p className="mt-0.5 text-sm leading-snug text-soft">
              Waiting on your own case? The free case lookup shows DOL&rsquo;s status and emails you when it moves.
            </p>
          </div>{" "}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 sm:mt-0 sm:shrink-0">
            <Link
              href="/perm-case-status"
              onClick={() => analytics.capture("audience_banner_taken", { door: "case_lookup" })}
              className="inline-flex min-h-11 items-center gap-2 border-2 border-border bg-primary px-3.5 font-heading text-sm font-bold text-black"
            >
              <MagnifyingGlassIcon size={15} weight="bold" aria-hidden="true" />
              Check my case
            </Link>{" "}
            <Link href="/settings#role" className="link inline-flex min-h-11 items-center text-sm font-semibold">
              I file cases
            </Link>
          </div>
        </div>{" "}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close this notice"
          className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center text-soft hover:text-foreground sm:mt-0"
        >
          <XIcon size={18} weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className="h-2 border-t-2 border-border" style={TAPE} aria-hidden="true" />
    </section>
  );
}

export default function AudienceBanner() {
  const profile = useQuery(api.users.currentUserProfile, {});
  // null until this browser's storage is read, so a closed banner never flashes on load.
  const [closed, setClosed] = useState<boolean | null>(null);
  const id = profile?._id;

  useEffect(() => {
    if (!id) return;
    let value = false;
    try {
      value = window.localStorage.getItem(KEY + id) === "1";
    } catch {
      // Storage refused (a private window): the banner shows, and closing it lasts the visit.
    }
    setClosed(value);
  }, [id]);

  if (!profile || closed !== false || !showsAudienceBanner(profile)) return null;

  const close = () => {
    setClosed(true);
    analytics.capture("audience_banner_closed");
    try {
      window.localStorage.setItem(KEY + profile._id, "1");
    } catch {
      // See above.
    }
  };

  return <AudienceBannerView onClose={close} />;
}
