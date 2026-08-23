import type { Metadata } from "next";
import { openGraphBase } from "@/lib/openGraphBase";
import { SignupPageClient } from "./SignupPageClient";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create a free PERM Tracker account to start managing your immigration cases. No credit card required.",
  alternates: {
    canonical: "/signup",
  },
  openGraph: {
    ...openGraphBase,
    title: "Create Account | PERM Tracker",
    description:
      "Create a free PERM Tracker account.",
    url: "/signup",
  },
  // See login/page.tsx for the noindex+follow rationale (Google: Disallow ≠ noindex).
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return <SignupPageClient />;
}
