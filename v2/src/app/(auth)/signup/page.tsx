import type { Metadata } from "next";
import { SignupPageClient } from "./SignupPageClient";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a free PERM Tracker account to start managing your immigration cases.",
};

export default function SignupPage() {
  return <SignupPageClient />;
}
