import Link from "next/link";

import { CaseNextStep } from "@/components/tools/CaseNextStep";

/**
 * The end of every article: the next step for the two people who read them.
 *
 * Most readers are waiting on a case (47 of the 53 guides are written for
 * them), so the case lookup leads: status, an estimated date and an email
 * when it moves. People who file cases get a second, smaller door to the
 * attorney page, which explains the app before asking for an account.
 *
 * It used to be one "Get Started Free" button to /signup under a sentence
 * about checking a case number, which sent people waiting on their own case
 * into a caseload manager built for attorneys.
 */
export default function ContentCTA() {
  return (
    <section className="border-y-2 border-border bg-primary/5">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-12">
        <CaseNextStep question="Waiting on a PERM case?" numberKind="DOL" source="article-end" />{" "}
        <p className="mt-6 text-base text-foreground/80">
          File PERM cases for clients or your company?{" "}
          <Link
            href="/for-attorneys"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            See the free deadline tracker
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
