"use client";

import { useCallback } from "react";

import type { EntityKind, EntityRow } from "@/lib/entityPayload";
import { fetchAllEntities, searchEntities } from "@/lib/fetchEntities";
import { LiveOnlyEmployerResults } from "@/components/entities/LiveOnlyEmployerResults";

import {
  ATTORNEY_COLUMNS,
  ATTORNEY_CSV,
  EMPLOYER_COLUMNS,
  EMPLOYER_CSV,
  OCCUPATION_COLUMNS,
  OCCUPATION_CSV,
  socFacet,
  stateFacet,
} from "./entityColumns";
import { FilterableStatTable } from "./FilterableStatTable";

/**
 * The searchable index of one entity kind.
 *
 * The page hands it a server-rendered seed; the whole corpus arrives from
 * `/api/perm-entities/<kind>` the moment a visitor does anything that a
 * partial list would answer wrongly.
 */

const CONFIG = {
  employer: {
    columns: EMPLOYER_COLUMNS,
    csv: EMPLOYER_CSV,
    facets: [stateFacet],
    noun: "employers",
    placeholder: "Microsoft, Deloitte, a hospital…",
    caption:
      "Every PERM sponsor with filings, certifications, denials, approval rate and median processing days",
    searchText: (e: EntityRow) => `${e.name} ${e.state ?? ""}`,
  },
  attorney: {
    columns: ATTORNEY_COLUMNS,
    csv: ATTORNEY_CSV,
    facets: [stateFacet],
    noun: "law firms",
    placeholder: "Fragomen, Berry Appleman…",
    caption:
      "Every law firm filing PERM cases with volume, approval rate and median processing days",
    searchText: (e: EntityRow) => `${e.name} ${e.state ?? ""}`,
  },
  occupation: {
    columns: OCCUPATION_COLUMNS,
    csv: OCCUPATION_CSV,
    facets: [socFacet],
    noun: "occupations",
    placeholder: "Software developers, 15-1252…",
    caption:
      "Every PERM occupation with filings, median offered wage, approval rate and median processing days",
    searchText: (e: EntityRow) => `${e.name} ${e.code ?? ""}`,
  },
} as const;

export function EntityExplorer({
  kind,
  rows,
  total,
}: {
  kind: EntityKind;
  rows: EntityRow[];
  total: number;
}) {
  const cfg = CONFIG[kind];
  const loadAll = useCallback(() => fetchAllEntities(kind), [kind]);
  // The search answers from two corpora. `rows` is the published disclosure
  // record and goes in the table; `live` is employers we only know about from
  // DOL's live per-case feed - 21,495 of them on 2026-08-30, 23% of the
  // 93,007 we hold - and they carry none of the table's figures, so they
  // render underneath it in their own words. `live` is always empty for
  // law firms and occupations: the live feed names neither.
  //
  // `localHasRows` decides HOW MUCH to ask for, and that is what keeps a
  // wider trigger from being a cost regression:
  //
  //   table came up empty -> both halves, exactly as before. The published
  //     search is a LIKE the database serves by walking 71,512 rows, and this
  //     is the only case where its rows are wanted.
  //   table answered      -> the live half alone, an indexed prefix range
  //     (worst measured 2-char prefix: 5,365 rows). Needed because a search
  //     matching a published sponsor tells us nothing about whether an
  //     unpublished one matches too - "lorenz" matches 5 of the former and
  //     hides LORENZ BUS SERVICE INC, which has 174 live cases.
  //
  // For law firms and occupations that second case is a request that can only
  // ever return an empty list, so it is not made at all.
  const searchRemote = useCallback(
    async (text: string, localHasRows: boolean) => {
      if (localHasRows && kind !== "employer") return { rows: [] };
      const { rows: found, live } = await searchEntities(kind, text, {
        onlyLive: localHasRows,
      });
      return {
        rows: found,
        extra:
          live.length > 0 ? (
            <LiveOnlyEmployerResults hits={live} query={text} />
          ) : undefined,
      };
    },
    [kind],
  );

  return (
    <FilterableStatTable<EntityRow>
      rows={rows}
      columns={[...cfg.columns]}
      facets={[...cfg.facets]}
      csv={cfg.csv}
      searchText={cfg.searchText}
      searchPlaceholder={cfg.placeholder}
      initialSort="total"
      caption={cfg.caption}
      noun={cfg.noun}
      totalCount={total}
      loadAll={loadAll}
      searchRemote={searchRemote}
    />
  );
}
