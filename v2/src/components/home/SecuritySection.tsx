import { RecordList } from "@/components/data/RecordList";
import { IDLE_SIGN_OUT_MINUTES } from "@/lib/auth/session";

/**
 * How a practice's client data is protected, as one plain list. Each line is
 * a fact about the app, not a promise.
 */
const ROWS = [
  { label: "Sensitive fields encrypted", value: "AES-256-GCM on the employer's FEIN and on sign-in tokens" },
  { label: "Database", value: "Convex, which holds a SOC 2 Type II report" },
  { label: "Session", value: `Signed out after ${IDLE_SIGN_OUT_MINUTES} minutes without activity` },
  { label: "Isolation", value: "Each account's cases are visible to that account only" },
  { label: "Export", value: "Every case as CSV or JSON, at any time" },
];

export function SecuritySection() {
  return (
    <section id="security" aria-labelledby="security-title" className="border-t border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-8 sm:py-20">
        <h2 id="security-title" className="font-heading text-2xl font-bold sm:text-3xl">
          Your client data, protected
        </h2>{" "}
        <RecordList rows={ROWS} className="mt-8" />{" "}
        <p className="mt-6 text-base text-soft">We don&apos;t sell your data or train AI on it.</p>
      </div>
    </section>
  );
}
