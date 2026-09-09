/**
 * The review stages the case search can filter by, as slug <-> status.
 *
 * One list for the select, the route and the stage pages' "open in search"
 * links, built from the same registry the stage pages use plus analyst
 * review, which has no page of its own (it is the ordinary queue, drawn by
 * month on /perm-queue) but is a perfectly good search filter with an
 * employer or a filing month beside it. Plain module: the form imports it in
 * the browser and the route on the server.
 */
import { reviewStages, stageMeta, stageSlug } from "@/components/rfi/stageMeta";

export interface SearchStage {
  slug: string;
  status: string;
  label: string;
}

export const ANALYST_REVIEW = "ANALYST REVIEW";

export function searchStages(): SearchStage[] {
  const list = [
    { status: ANALYST_REVIEW, slug: stageSlug(ANALYST_REVIEW) },
    ...reviewStages(),
  ];
  return list.map((s) => ({ ...s, label: stageMeta(s.status).label }));
}

export function searchStageFromSlug(slug: string): string | null {
  return searchStages().find((s) => s.slug === slug)?.status ?? null;
}

export function searchStageSlug(status: string): string | null {
  return searchStages().find((s) => s.status === status)?.slug ?? null;
}
