/**
 * The review stages the case search can filter by, across the three programs.
 *
 * One list for the select, the route and the stage pages' "open in search"
 * links. PERM's stages come from the registry the stage pages are built from,
 * plus analyst review, which has no page of its own (it is the ordinary queue,
 * drawn by month on /perm-queue) but is a perfectly good search filter with an
 * employer or a filing month beside it. The wage-request and LCA stages are
 * the pending statuses DOL's live record actually carries for those programs
 * (measured Sep 8 2026: wage requests pend at IN PROCESS, RFI ISSUED and
 * PENDING REDETERMINATION; LCAs pend only at IN PROCESS). A stage belongs to
 * exactly one program, and the slug says which. Plain module: the form
 * imports it in the browser and the route on the server.
 */
import { reviewStages, stageMeta, stageSlug } from "@/components/rfi/stageMeta";

export type StageProgram = "perm" | "pwd" | "lca";

export interface SearchStage {
  slug: string;
  status: string;
  program: StageProgram;
  label: string;
}

export const ANALYST_REVIEW = "ANALYST REVIEW";

const FLAG_STAGES: SearchStage[] = [
  { slug: "pwd-in-process", status: "IN PROCESS", program: "pwd", label: "In process" },
  { slug: "pwd-rfi-issued", status: "RFI ISSUED", program: "pwd", label: "RFI issued" },
  { slug: "pwd-pending-redetermination", status: "PENDING REDETERMINATION", program: "pwd", label: "Pending redetermination" },
  { slug: "lca-in-process", status: "IN PROCESS", program: "lca", label: "In process" },
];

export const STAGE_PROGRAM_LABEL: Record<StageProgram, string> = {
  perm: "PERM",
  pwd: "Wage requests",
  lca: "H-1B LCAs",
};

export function searchStages(): SearchStage[] {
  const perm = [{ status: ANALYST_REVIEW, slug: stageSlug(ANALYST_REVIEW) }, ...reviewStages()].map((s) => ({
    ...s,
    program: "perm" as const,
    label: stageMeta(s.status).label,
  }));
  return [...perm, ...FLAG_STAGES];
}

export function searchStageFromSlug(slug: string): { status: string; program: StageProgram } | null {
  const s = searchStages().find((x) => x.slug === slug);
  return s ? { status: s.status, program: s.program } : null;
}

export function searchStageSlug(status: string, program: StageProgram = "perm"): string | null {
  return searchStages().find((s) => s.status === status && s.program === program)?.slug ?? null;
}
