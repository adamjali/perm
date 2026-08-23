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
    description:
      "Sign in to PERM Tracker.",
    url: "/login",
  },
  // Auth pages shouldn't appear in SERPs. `noindex` is the correct signal per
  // Google (robots.txt Disallow ≠ noindex — Disallow blocks crawl, Google may
  // still index a Disallowed URL from inbound links). Keep `follow: true` so
  // any internal links from this page remain discoverable.
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return <LoginPageClient />;
}
