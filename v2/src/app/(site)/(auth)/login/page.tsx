import type { Metadata } from "next";
import { openGraphBase } from "@/lib/openGraphBase";
import { LoginPageClient } from "./LoginPageClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your PERM Tracker account to manage your immigration cases.",
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    ...openGraphBase,
    title: "Sign In | PERM Tracker",
    description: "Sign in to PERM Tracker.",
    url: "/login",
  },
  // Auth pages shouldn’t appear in SERPs. `noindex` is the correct signal per
  // Google (robots.txt Disallow ≠ noindex — Disallow blocks crawl, Google may
  // still index a Disallowed URL from inbound links). Keep `follow: true` so
  // any internal links from this page remain discoverable.
  robots: { index: false, follow: true },
};

/**
 * Sign in. Just the form, and that is a finding rather than the lazy option.
 *
 * SIGN-IN AND SIGN-UP ARE DELIBERATELY ASYMMETRIC, and there is a directly
 * verified example. Vercel's two pages, read an hour apart on 2026-08-31:
 * `/login` is "Log in to Vercel" and carries NO marketing at all, while
 * `/signup` is "Your first deploy is just a sign-up away" with customer proof
 * and logos. It even inverts the method order - email first on sign-in, the
 * one-click providers first on sign-up - because a returning user knows which
 * credential they have and wants the shortest path to it, while a new user has
 * none yet. GitHub, Supabase and Cal.com are bare in the same way.
 *
 * So this page loses the panel it briefly had. A value proposition beside a
 * sign-in form is addressed to somebody who has already decided; it is inert at
 * best, and showing a screenshot of the product to a person one field away from
 * the real thing is faintly absurd.
 *
 * The one pattern worth stealing for a sign-in page is Railway's, which prints
 * "All systems operational" - information exactly when somebody wonders why a
 * login is slow. There is no status endpoint here to read, and inventing one
 * would be worse than the omission, so it stays off until there is something
 * true to put in it.
 *
 * IT KEPT ITS CARD. Adam: "sign in back to the original please, it can be in a
 * square container thing if it was before bring it back." Sign-up lost its box
 * because it now sits in a two-column split where the panel beside it is the
 * frame; sign-in has no such panel, so a bare form on the dotted ground would
 * be floating rather than placed. The two pages diverging here is the same
 * asymmetry as the copy, not an inconsistency.
 */
export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <LoginPageClient />
    </div>
  );
}
