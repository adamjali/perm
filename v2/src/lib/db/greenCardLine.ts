import "server-only";

import { cache } from "react";

import { rows } from "./client";
import { getVisaBulletinSeries } from "./publicData";
import { getEbAwaitingVisa, getI140ClassCountry } from "./uscisQuarterly";
import { getVisaAnnualLimits } from "./visaLimits";
import type { LineSnapshot } from "@/lib/greenCardLine";
import { buildLineSnapshot } from "@/lib/greenCardLineSnapshot";
import type { TableVYear } from "@/lib/visaLimits";

/**
 * The records the green-card line calculator reads, gathered once per render
 * and shaped by `buildLineSnapshot` (pure, tested). Every read is defaulted:
 * a missing source becomes a missing part of the snapshot, and the calculator
 * says which part is missing rather than inventing it.
 *
 * Cost: the I-485 read is one GROUP BY over a single monthly release (about a
 * thousand cells for the three lines), the rest are the same small reads the
 * USCIS pages already make. Nothing here scans a case table.
 */
export const getLineSnapshot = cache(async (): Promise<LineSnapshot> => {
  const [awaiting, i140, limits, bulletins, i485] = await Promise.all([
    getEbAwaitingVisa().catch(() => null),
    getI140ClassCountry().catch(() => null),
    getVisaAnnualLimits().catch(() => null),
    getVisaBulletinSeries().catch(() => []),
    rows<{
      as_of: string;
      country: string;
      category: string;
      status: string;
      pd_year: string;
      pd_month: number;
      c: number;
      s: number;
    }>(
      `SELECT as_of, country, category, status, pd_year, pd_month,
              coalesce(sum(count), 0) AS c, coalesce(sum(suppressed), 0) AS s
         FROM i485_inventory
        WHERE as_of = (SELECT max(as_of) FROM i485_inventory)
          AND category IN ('EB2', 'EB3', 'EW3')
        GROUP BY as_of, country, category, status, pd_year, pd_month`,
    ).catch(() => []),
  ]);

  const years = Object.keys(limits?.table_v ?? {}).map(Number).filter(Number.isFinite);
  const tableV: TableVYear | null = years.length ? (limits!.table_v[String(Math.max(...years))] ?? null) : null;

  const i485AsOf = i485[0]?.as_of ?? null;
  const available = new Map<string, { country: string; category: string; counted: number; suppressed: number }>();
  for (const r of i485) {
    if (r.status !== "available") continue;
    const key = `${r.country}|${r.category}`;
    const cur = available.get(key) ?? { country: r.country, category: r.category, counted: 0, suppressed: 0 };
    cur.counted += Number(r.c) || 0;
    cur.suppressed += Number(r.s) || 0;
    available.set(key, cur);
  }

  return buildLineSnapshot({
    awaiting: awaiting ? { asOf: awaiting.asOf, cells: awaiting.cells } : null,
    i140: i140 ? { asOf: i140.asOf, cells: i140.cells } : null,
    i485Available: i485AsOf ? { asOf: i485AsOf, rows: [...available.values()] } : null,
    i485Filed: i485AsOf
      ? {
          asOf: i485AsOf,
          rows: i485.map((r) => ({
            country: r.country,
            category: r.category,
            pdYear: String(r.pd_year),
            pdMonth: Number(r.pd_month) || 0,
            counted: Number(r.c) || 0,
            suppressed: Number(r.s) || 0,
          })),
        }
      : null,
    tableV,
    bulletins,
  });
});
