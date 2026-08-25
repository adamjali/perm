"use client";

import { useCallback } from "react";

import type { EntityKind, EntityRow } from "@/lib/entityPayload";
import { fetchAllEntities, searchEntities } from "@/lib/fetchEntities";

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
  const searchRemote = useCallback(
    (text: string) => searchEntities(kind, text),
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
