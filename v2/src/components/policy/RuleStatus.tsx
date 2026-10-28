import { reginfoUrl } from "@convex/lib/ruleSteps";

import { RuleCard } from "@/components/policy/RulePipeline";
import { getCommentCounts } from "@/lib/db/policyComments";
import { readRules } from "@/lib/db/rulePipeline";
import { easternDay } from "@/lib/seasonalTiming";

/**
 * Where one rule stands, from the rule watch's record (`scripts/ingest_rule_pipeline.py`), for an
 * article that follows it: the same card as the policy page, so the day OIRA, public inspection or
 * the Federal Register moves, the article moves with it. `/api/revalidate-policy` expires every
 * article that uses this, read from the articles themselves.
 *
 * A failed read throws (the page keeps its last good render). A RIN the record doesn't hold says
 * so on the page and in the server log: an article quoting a status it can't read must not print
 * a blank where the status was.
 */
export async function RuleStatus({ rin }: { rin: string }) {
  const today = easternDay();
  const [rules, counts] = await Promise.all([readRules([rin]), getCommentCounts()]);
  const rule = rules.get(rin);
  if (!rule) {
    console.error(`[RuleStatus] RIN ${rin} isn't in the rule watch's record`);
    return (
      <div className="not-prose my-8 border-2 border-border bg-tint p-5 text-base">
        RIN {rin} isn&apos;t in our record of rules yet. OIRA&apos;s own record is on{" "}
        <a href={reginfoUrl(rin)} className="link" target="_blank" rel="noopener">
          reginfo.gov
        </a>
        .
      </div>
    );
  }
  return (
    <div className="not-prose prose-reset my-8">
      <RuleCard as="div" rule={rule} today={today} count={rule.proposedDocument ? counts.get(rule.proposedDocument) : undefined} />{" "}
      <p className="mt-3 text-sm text-soft">
        From OIRA&apos;s review record, the Federal Register&apos;s public inspection list and the Register itself. We read
        them every 30 minutes, and this page changes the run one of them does.
      </p>
    </div>
  );
}
