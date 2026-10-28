import { ruleCompareCells, type RuleCell } from "@convex/lib/ruleSteps";

import { ComparisonTable } from "@/components/content/ComparisonTable";
import { readRules } from "@/lib/db/rulePipeline";
import { easternDay } from "@/lib/seasonalTiming";

/**
 * Rules side by side for an article, one column a rule: a subject the article writes, then the
 * proposal, its comments, the final rule and whether it's in force, from the rule watch's record,
 * so the table changes the day the Register does. `/api/revalidate-policy` expires every article
 * that uses this. A RIN the record doesn't hold reads "Not in our record" in each of its cells.
 */
export async function RuleCompare({ rules }: { rules: { rin: string; subject: string }[] }) {
  const today = easternDay();
  const held = await readRules(rules.map((r) => r.rin));
  const missing = rules.filter((r) => !held.has(r.rin)).map((r) => r.rin);
  if (missing.length > 0) console.error(`[RuleCompare] not in the rule watch's record: ${missing.join(", ")}`);
  const columns = rules.map((r) => {
    const rec = held.get(r.rin);
    return { subject: r.subject, cells: rec ? ruleCompareCells(rec, today) : null };
  });
  const show = (c: RuleCell | undefined) =>
    !c ? (
      "Not in our record"
    ) : c.href ? (
      <a href={c.href} className="link" target="_blank" rel="noopener">
        {c.text}
      </a>
    ) : (
      c.text
    );
  const row = (label: string, pick: (cells: ReturnType<typeof ruleCompareCells>) => RuleCell) => [
    label,
    ...columns.map((c) => show(c.cells ? pick(c.cells) : undefined)),
  ];
  return (
    <ComparisonTable
      headers={["", ...rules.map((r) => `RIN ${r.rin}`)]}
      rows={[
        ["Subject", ...columns.map((c) => c.subject)],
        row("Proposed rule published", (c) => c.proposed),
        row("Comments", (c) => c.comments),
        row("Final rule", (c) => c.final),
        row("In force", (c) => c.inForce),
      ]}
    />
  );
}
