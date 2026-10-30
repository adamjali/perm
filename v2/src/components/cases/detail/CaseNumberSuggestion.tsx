"use client";

/**
 * "Is this your DOL case?" — when a saved case has no DOL number but has an
 * employer and a filing date, this quietly searches DOL's public records
 * (`appCaseMatch.suggestDolCase`) and offers the likely match for one-tap
 * linking, which turns on the live status. It never applies anything on its
 * own, and a "not mine" is remembered so it doesn't nag.
 *
 * @module
 */

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { canonicalStatus } from "@/lib/caseStatusVocabulary";
import { formatDay } from "@/lib/dolFormat";

interface Candidate {
  caseNumber: string;
  status: string;
  employer: string | null;
  jobTitle: string | null;
  filingDate: string | null;
}

const dismissKey = (id: string) => `pt-case-suggest-dismissed-${id}`;

function detail(c: Candidate): string {
  const parts = [canonicalStatus(c.status)];
  if (c.filingDate) parts.push(`filed ${formatDay(c.filingDate)}`);
  if (c.jobTitle) parts.push(c.jobTitle);
  return parts.join(", ");
}

export function CaseNumberSuggestion({
  caseId,
  employerName,
  filingDate,
  program,
}: {
  caseId: Id<"cases">;
  employerName: string;
  filingDate: string;
  program: "perm" | "pwd";
}) {
  const suggest = useAction(api.appCaseMatch.suggestDolCase);
  const updateCase = useMutation(api.cases.update);
  const [result, setResult] = useState<{ candidates: Candidate[]; likely: string | null } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(dismissKey(caseId)) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      // storage blocked: just proceed; the suggestion is per-view then.
    }
    let live = true;
    suggest({ employerName, filingDate, program })
      .then((r) => {
        if (live) setResult(r);
      })
      .catch(() => {
        // a failed match is simply no suggestion.
      });
    return () => {
      live = false;
    };
  }, [caseId, employerName, filingDate, program, suggest]);

  if (dismissed || !result || result.candidates.length === 0) return null;

  const link = async (num: string) => {
    setBusy(num);
    try {
      await updateCase({ id: caseId, caseNumber: num });
      toast.success("Linked DOL's record. We'll watch it for changes.");
    } catch {
      toast.error("Couldn't link that number. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissKey(caseId), "1");
    } catch {
      // nothing to do; the dismiss is session-only then.
    }
  };

  const one = result.likely ? result.candidates.find((c) => c.caseNumber === result.likely) ?? null : null;

  return (
    <div className="border border-dashed border-input p-3 text-sm">
      {one ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-muted-foreground">
            This looks like this case on DOL:{" "}
            <span className="font-mono font-semibold text-foreground">{one.caseNumber}</span> ({detail(one)}). Is this
            it?
          </p>{" "}
          <span className="flex shrink-0 gap-2">
            <Button size="sm" disabled={!!busy} onClick={() => link(one.caseNumber)}>
              Yes, use it
            </Button>
            <Button size="sm" variant="outline" onClick={dismiss}>
              Not mine
            </Button>
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground">
            DOL has a few cases {employerName} filed around then. Pick yours to watch its live status:
          </p>{" "}
          <ul className="space-y-1.5">
            {result.candidates.map((c) => (
              <li key={c.caseNumber} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span>
                  <span className="font-mono text-foreground">{c.caseNumber}</span> ({detail(c)})
                </span>{" "}
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => link(c.caseNumber)}>
                  Use this
                </Button>
              </li>
            ))}
          </ul>
          <button type="button" className="link text-xs" onClick={dismiss}>
            None of these
          </button>
        </div>
      )}
    </div>
  );
}
