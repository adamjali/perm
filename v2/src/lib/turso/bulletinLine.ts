import "server-only";

import { cache } from "react";

import { rows } from "./client";
import { getEbAwaitingVisa } from "./uscisQuarterly";
import { inventoryRange, uscisCode } from "@/lib/bulletinLines";
import { USCIS_COUNTRY } from "@/lib/greenCardLineSnapshot";
import type { CountryKey } from "@/lib/perm";

/**
 * USCIS's own counts for one bulletin line: approved petitions waiting for a
 * visa number (quarterly), and I-485s pending by visa status (monthly). One
 * read of each per render, shared by every line page through `cache`.
 */

export interface LineCounts {
  awaiting: { asOf: string; count: number } | null;
  inventory: {
    asOf: string;
    /** I-485s pending with a visa number available. */
    available: { low: number; high: number };
    /** I-485s pending and waiting for a visa number (filed on dates for filing). */
    awaiting: { low: number; high: number };
  } | null;
}

const counts = cache(async () => {
  const [awaiting, inv] = await Promise.all([
    getEbAwaitingVisa().catch(() => null),
    rows<{ as_of: string; country: string; category: string; status: string; c: number; s: number }>(
      `SELECT as_of, country, category, status,
              coalesce(sum(count), 0) AS c, coalesce(sum(suppressed), 0) AS s
         FROM i485_inventory
        WHERE as_of = (SELECT max(as_of) FROM i485_inventory)
        GROUP BY as_of, country, category, status`,
    ).catch(() => []),
  ]);
  return { awaiting, inv };
});

export async function getLineCounts(category: string, country: CountryKey): Promise<LineCounts> {
  const { awaiting, inv } = await counts();
  const code = uscisCode(category);
  const isCountry = (c: string) => USCIS_COUNTRY[c] === country;

  const a = awaiting?.cells.find((c) => c.category === code && isCountry(c.country));
  const mine = inv.filter((r) => r.category === code && isCountry(r.country));
  const range = (status: string) => {
    const r = mine.filter((x) => x.status === status);
    return inventoryRange(
      r.reduce((n, x) => n + (Number(x.c) || 0), 0),
      r.reduce((n, x) => n + (Number(x.s) || 0), 0),
    );
  };
  return {
    awaiting: awaiting && a ? { asOf: awaiting.asOf, count: a.count } : null,
    inventory: mine.length
      ? { asOf: mine[0]!.as_of, available: range("available"), awaiting: range("awaiting") }
      : null,
  };
}
