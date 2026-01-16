import type { Metadata } from "next";
import { LoginPageClient } from "./LoginPageClient";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your PERM Tracker account to manage your immigration cases.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return <LoginPageClient />;
}
