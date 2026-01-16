import type { Metadata } from "next";
import { ResetPasswordPageClient } from "./ResetPasswordPageClient";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your PERM Tracker account password.",
  alternates: {
    canonical: "/reset-password",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
