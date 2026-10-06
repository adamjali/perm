"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { BellIcon } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { formText } from "@/lib/forms/formText";
import { handleOperationError } from "@/lib/errors";
import { toast } from "@/lib/toast";

/**
 * Onboarding for the person a case is about: one box for the case number,
 * and the alert goes to the account's own address. A verified address starts
 * watching at once; an unverified one gets the usual confirmation email
 * (convex/caseAlerts.ts `watchMyCase`). Either way the wizard ends here,
 * because the caseload steps after it are for people who file cases.
 */
export function OwnCaseStep() {
  const [caseNumber, setCaseNumber] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const watch = useMutation(api.caseAlerts.watchMyCase);
  const finish = useMutation(api.onboarding.updateOnboardingStep);

  /** The wizard is over for this account; a failure here mustn't block the page. */
  const leave = async (href: string) => {
    try {
      await finish({ step: "done" });
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn't save your onboarding step.",
        context: { operation: "ownCase.finish" },
        silent: true,
      });
    }
    router.push(href);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = formText(e.currentTarget, "caseNumber", caseNumber).trim();
    if (!value) {
      setNote("Enter your case number, or find the case by employer below.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await watch({ caseNumber: value });
      if (!res.ok) {
        setNote(res.message);
        return;
      }
      toast.success(res.confirmationSent ? "Check your inbox to confirm the alert." : res.message);
      await leave(`/perm-case-status?case=${encodeURIComponent(res.caseNumber ?? value)}`);
    } catch (error) {
      handleOperationError(error, { userMessage: "That didn't go through. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-2">
      <h2 className="mb-1 text-center font-heading text-2xl font-bold sm:text-3xl">
        Watch your case
      </h2>{" "}
      <p className="mb-6 max-w-md text-center text-base text-muted-foreground">
        Enter your case number and we&apos;ll email you when DOL&apos;s status changes. It&apos;s on
        the filing receipt your attorney or employer has.
      </p>{" "}
      <form onSubmit={submit} aria-label="Watch your case" className="w-full max-w-md">
        <label htmlFor="own-case-number" className="sr-only">
          Your case number
        </label>
        <input
          id="own-case-number"
          name="caseNumber"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          placeholder="G-100-26010-550166"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          maxLength={64}
          aria-describedby="own-case-note"
          className="min-h-[48px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 font-mono text-base uppercase focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        />{" "}
        <p id="own-case-note" role="status" className="mt-2 min-h-[1.25rem] text-sm text-data-warn-ink">
          {note ?? ""}
        </p>{" "}
        <Button type="submit" size="lg" loading={busy} loadingText="Saving..." className="mt-2 w-full">
          <BellIcon className="size-4" weight="fill" aria-hidden="true" /> Watch my case
        </Button>
      </form>{" "}
      <div className="mt-6 flex w-full max-w-md flex-col items-center gap-1 text-center text-sm">
        <Link
          href="/case-search"
          className="inline-flex min-h-[44px] items-center font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          Don&apos;t have the number? Find the case by employer name
        </Link>{" "}
        <button
          type="button"
          onClick={() => void leave("/perm-case-status")}
          className="inline-flex min-h-[44px] items-center text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
