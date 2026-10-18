/**
 * DOL's recruitment record for a PERM case (Form 9089 Section H), as the pages
 * name it. The step and notice-method ids, DOL's columns and the labels live
 * in scripts/data/recruitment_steps.json, which the data scripts read too
 * (scripts/lib_recruitment.py), so a label here is the one the facets carry.
 */

import table from "../../scripts/data/recruitment_steps.json";

export interface RecruitmentStep {
  id: string;
  label: string;
}

export const RECRUITMENT_STEPS: readonly RecruitmentStep[] = table.steps;
export const NOTICE_METHODS: readonly RecruitmentStep[] = table.notice;

export interface LeadBand {
  id: string;
  from: number;
  to: number | null;
  label: string;
}

/** How long before filing the first step ran, in the bands every page groups it by. */
export const LEAD_BANDS: readonly LeadBand[] = table.leadBands;
