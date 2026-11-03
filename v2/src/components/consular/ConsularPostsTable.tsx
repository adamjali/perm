"use client";

import Link from "next/link";

import { FilterableStatTable, type CsvSpec, type StatColumn } from "@/components/tools/FilterableStatTable";
import { behindLabel, IV_CATEGORY_LABEL, monthsBehind, type IvCategory } from "@/lib/consular/scheduling";
import type { PostSummary } from "@/lib/db/consularPosts";
import { formatInt } from "@/lib/format";

/**
 * Every consulate: the month NVC is scheduling in each category, as State printed it with how far
 * back that is from State's update, and the immigrant visas the post issued in the newest 12
 * published months. Sorted by employment visas, so the posts most PERM cases reach come first.
 */
export function ConsularPostsTable({ posts, asOf }: { posts: PostSummary[]; asOf: string | null }) {
  const month = (cat: IvCategory): StatColumn<PostSummary> => ({
    key: cat,
    label: IV_CATEGORY_LABEL[cat],
    // Sorted by how far back, so "most behind" is one click.
    sortValue: (p) => (asOf ? monthsBehind(p.now?.[cat], asOf) : null),
    numeric: true,
    secondary: cat !== "employment",
    render: (p) =>
      p.now && asOf ? (
        <span className="block whitespace-nowrap">
          <span className="tabular-nums">{p.now[cat].printed || "Not shown"}</span>{" "}
          <span className="block text-sm text-muted-foreground">{behindLabel(p.now[cat], asOf)}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">Not in State&apos;s table</span>
      ),
  });
  const columns: StatColumn<PostSummary>[] = [
    {
      key: "name",
      label: "Consulate",
      sortValue: (p) => p.name,
      render: (p) => (
        <Link href={`/consular-posts/${p.slug}`} className="link inline-flex min-h-11 items-center font-bold">
          {p.name}
        </Link>
      ),
    },
    month("employment"),
    month("family"),
    month("immediate"),
    {
      key: "employmentIssued",
      label: "Employment visas, 12 months",
      numeric: true,
      sortValue: (p) => p.employment,
      render: (p) => <span className="tabular-nums">{formatInt(p.employment)}</span>,
    },
    {
      key: "issued",
      label: "All immigrant visas, 12 months",
      numeric: true,
      secondary: true,
      sortValue: (p) => p.issued,
      render: (p) => <span className="tabular-nums">{formatInt(p.issued)}</span>,
    },
  ];
  const csv: CsvSpec<PostSummary> = {
    filename: "consular-posts.csv",
    header: ["consulate", "employment_month", "family_month", "immediate_month", "state_update", "employment_visas_12m", "immigrant_visas_12m"],
    row: (p) => [p.name, p.now?.employment.printed ?? null, p.now?.family.printed ?? null, p.now?.immediate.printed ?? null, asOf, p.employment, p.issued],
  };
  return (
    <FilterableStatTable
      rows={posts}
      columns={columns}
      searchText={(p) => p.name}
      suggestText={(p) => p.name}
      searchPlaceholder="Manila, Mumbai, Ciudad Juárez…"
      initialSort="employmentIssued"
      caption="Every consulate: the month NVC is scheduling in each category, and the immigrant visas it issued"
      noun="consulates"
      csv={csv}
      pageSize={25}
      queryFromUrl
    />
  );
}
