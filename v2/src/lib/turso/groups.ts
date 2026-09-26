import "server-only";

import { cache } from "react";

import { one, rows } from "./client";

/**
 * PERM by worksite city, by industry and by country of citizenship.
 *
 * One `perm_groups` row per group (scripts/build_groups.py), everything a
 * page needs in its `detail` JSON, so a group page is one primary-key read and
 * an index page one indexed read. Built from both case tables, FY2016 to
 * today; a country's citizenship-bearing rows stop at DOL's old form.
 */

export type GroupKind = "city" | "industry" | "country";

export const GROUP_PATH: Record<GroupKind, string> = {
  city: "/perm-cities",
  industry: "/perm-industries",
  country: "/perm-countries",
};

export interface GroupSummary {
  kind: GroupKind;
  slug: string;
  key: string;
  label: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
  medianWage: number | null;
  fyFrom: number | null;
  fyTo: number | null;
}

export interface GroupDetail {
  years: { fy: number; certified: number; denied: number; withdrawn: number }[];
  employers: { slug: string; name: string; n: number }[];
  occupations: { code: string; title: string; slug: string | null; n: number }[];
  states: { key: string; n: number }[];
  cities: { key: string; label: string; slug: string; n: number }[];
  countries: { key: string; label: string; slug: string; n: number }[];
  industries: { code: string; title: string; n: number }[];
  education: { key: string; n: number }[];
  visa: { key: string; n: number }[];
}

type Row = {
  kind: string; slug: string; key: string; label: string; total: number; certified: number;
  denied: number; withdrawn: number; median_wage: number | null; fy_from: number | null;
  fy_to: number | null; detail?: string;
};

function summary(r: Row): GroupSummary {
  return {
    kind: r.kind as GroupKind,
    slug: r.slug,
    key: r.key,
    label: r.label,
    total: Number(r.total),
    certified: Number(r.certified),
    denied: Number(r.denied),
    withdrawn: Number(r.withdrawn),
    medianWage: r.median_wage == null ? null : Number(r.median_wage),
    fyFrom: r.fy_from == null ? null : Number(r.fy_from),
    fyTo: r.fy_to == null ? null : Number(r.fy_to),
  };
}

const SUMMARY_COLS =
  "kind, slug, key, label, total, certified, denied, withdrawn, median_wage, fy_from, fy_to";

/** Every group of one kind, busiest first. Empty when the table is absent. */
export const listGroups = cache(async (kind: GroupKind): Promise<GroupSummary[]> => {
  const got = await rows<Row>(
    `SELECT ${SUMMARY_COLS} FROM perm_groups WHERE kind = ? ORDER BY total DESC`,
    [kind],
  ).catch(() => []);
  return got.map(summary);
});

export const getGroup = cache(
  async (kind: GroupKind, slug: string): Promise<(GroupSummary & { detail: GroupDetail }) | null> => {
    const r = await one<Row>(
      `SELECT ${SUMMARY_COLS}, detail FROM perm_groups WHERE kind = ? AND slug = ?`,
      [kind, slug],
    ).catch(() => null);
    if (!r) return null;
    let detail: GroupDetail;
    try {
      detail = JSON.parse(String(r.detail)) as GroupDetail;
    } catch {
      return null;
    }
    return { ...summary(r), detail };
  },
);

/** A country's decisions by fiscal year from FY2008 (perm_country_years). */
export async function countryYears(
  countryKey: string,
): Promise<{ fy: number; certified: number; denied: number; withdrawn: number }[]> {
  const got = await rows<{ fy: number; certified: number; denied: number; withdrawn: number }>(
    "SELECT fy, certified, denied, withdrawn FROM perm_country_years WHERE country = ? ORDER BY fy",
    [countryKey],
  ).catch(() => []);
  return got.map((r) => ({
    fy: Number(r.fy),
    certified: Number(r.certified),
    denied: Number(r.denied),
    withdrawn: Number(r.withdrawn),
  }));
}
