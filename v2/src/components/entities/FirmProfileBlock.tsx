/**
 * What a law firm says about itself, on its page, apart from DOL's figures.
 *
 * Published by a firm that claimed its page (convex/firmClaims.ts). Everything
 * here is the firm's own words: the block says so in its heading and again
 * under it, says how the firm proved it's the firm, and never sits inside the
 * figures. The website link is marked as user content and opens nothing the
 * firm can track back to this page.
 */

import { ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";

import { focusLabel } from "@/lib/firmProfile";
import { US_STATE_NAMES } from "@/lib/usStateNames";

export interface PublishedFirmProfile {
  website?: string;
  description?: string;
  languages: string[];
  offices: { city: string; state: string }[];
  focus: string[];
  verifiedBy: "domain" | "admin";
  updatedAt: number;
}

function host(url: string): string {
  try {
    const h = new URL(url).hostname;
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return url;
  }
}

function longDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export function FirmProfileBlock({ firmName, profile }: { firmName: string; profile: PublishedFirmProfile | null }) {
  if (!profile) return null;
  const rows: { k: string; v: React.ReactNode }[] = [];
  if (profile.website) {
    rows.push({
      k: "Website",
      v: (
        <a
          href={profile.website}
          rel="nofollow ugc noopener noreferrer"
          target="_blank"
          className="inline-flex items-center gap-1 font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          {host(profile.website)}
          <ArrowSquareOutIcon aria-hidden className="size-4" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ),
    });
  }
  if (profile.focus.length > 0) {
    rows.push({
      k: "Handles",
      v: (
        <ul className="flex flex-wrap gap-2">
          {profile.focus.map((f) => (
            <li key={f} className="border-2 border-border bg-background px-2 py-0.5 text-sm font-bold">
              {focusLabel(f)}{" "}
            </li>
          ))}
        </ul>
      ),
    });
  }
  if (profile.languages.length > 0) rows.push({ k: "Languages", v: profile.languages.join(", ") });
  if (profile.offices.length > 0) {
    rows.push({
      k: profile.offices.length === 1 ? "Office" : "Offices",
      v: profile.offices.map((o) => `${o.city}, ${US_STATE_NAMES[o.state] ?? o.state}`).join("; "),
    });
  }

  return (
    <section
      aria-labelledby="from-the-firm"
      className="mt-12 border-2 border-dashed border-border bg-card p-6 shadow-hard-sm sm:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="from-the-firm" className="font-heading text-xl font-black sm:text-2xl">
          From the firm
        </h2>{" "}
        <p className="text-sm font-bold text-foreground/70">In {firmName}&apos;s own words</p>
      </div>{" "}
      {profile.description ? (
        <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-relaxed">{profile.description}</p>
      ) : null}{" "}
      {rows.length > 0 ? (
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[max-content_1fr]">
          {rows.map((r) => (
            <div key={r.k} className="contents">
              <dt className="text-sm font-bold text-foreground/70">{r.k}</dt>{" "}
              <dd className="text-base">{r.v}</dd>{" "}
            </div>
          ))}
        </dl>
      ) : null}{" "}
      <p className="mt-5 border-t-2 border-border pt-3 text-sm text-foreground/70">
        {profile.verifiedBy === "domain"
          ? "Sent by the firm from an address at a domain DOL's own filings list for it."
          : "Sent by the firm and checked by hand."}{" "}
        We don&apos;t check what it says. Every figure on this page comes from DOL. Updated {longDay(profile.updatedAt)}.
      </p>
    </section>
  );
}
