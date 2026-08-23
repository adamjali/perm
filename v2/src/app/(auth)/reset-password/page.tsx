import type { Metadata } from "next";
import { openGraphBase } from "@/lib/openGraphBase";
import { ResetPasswordPageClient } from "./ResetPasswordPageClient";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your PERM Tracker account password.",
  alternates: {
    canonical: "/reset-password",
  },
  openGraph: {
    ...openGraphBase,
    title: "Reset Password | PERM Tracker",
    description:
      "Reset your PERM Tracker account password.",
    url: "/reset-password",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
