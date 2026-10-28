import { hasStagePage, stageSlug } from "@/components/rfi/stageMeta";
import { caseSearchHref } from "@/lib/caseSearchPlan";
import { searchStageSlug } from "@/lib/searchStages";

/**
 * Where a pending status's own cases are listed. For one filing month: the case search at that
 * status and month. For the whole line: the review stage's own page where it has one, the case
 * search at that status otherwise. Null for a status neither can list.
 */
export function statusCasesHref(status: string, month?: string): string | null {
  if (!month && hasStagePage(status)) return `/perm-rfi-audit/${stageSlug(status)}`;
  const stage = searchStageSlug(status);
  if (!stage) return null;
  return caseSearchHref(month ? { stage, from: month, to: month } : { stage });
}
