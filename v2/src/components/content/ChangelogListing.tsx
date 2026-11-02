"use client";

import * as React from "react";

import { SelectInput } from "@/components/forms/SelectInput";
import { useQueryParam } from "@/components/ui/pagination";
import { SORTS, sortOf, sortPosts } from "@/lib/content/listing";
import type { PostSummary } from "@/lib/content/types";
import ChangelogTimeline from "./ChangelogTimeline";
import ContentSearch from "./ContentSearch";

/** The changelog's kinds of change, in the order the timeline's chips use them. */
const KINDS = ["Release", "Feature", "Correction"] as const;

/** The changelog's own sorts: a topic order means nothing for release notes. */
const CHANGELOG_SORTS = SORTS.filter((s) => s.id !== "topic" && s.id !== "shortest");

/**
 * The changelog with a search box, a filter by kind of change and a sort beside it (owner, Nov 2 2026), the
 * kind and the sort in the address. The rows are ChangelogTimeline's, newest first unless sorted otherwise.
 */
export default function ChangelogListing({ posts }: { posts: PostSummary[] }) {
  const [search, setSearch] = React.useState("");
  const [kindParam, setQuery] = useQueryParam("kind");
  const [sortParam] = useQueryParam("sort");
  const kind = (KINDS as readonly string[]).includes(kindParam) ? kindParam : "";
  const sort = sortOf(sortParam, "newest");

  const q = search.trim().toLowerCase();
  const shown = sortPosts(
    posts.filter(
      (p) =>
        (!kind || p.meta.category === kind) &&
        (!q || p.meta.title.toLowerCase().includes(q) || p.meta.description.toLowerCase().includes(q)),
    ),
    sort,
  );

  return (
    <div className="space-y-8">
      <div className="grid max-w-3xl grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_10rem_11rem] sm:items-end [&>*]:min-w-0">
        <div className="col-span-2 sm:col-span-1">
          <ContentSearch value={search} onChange={setSearch} placeholder="Search the changelog..." />
        </div>{" "}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Kind
          <SelectInput
            value={kind}
            onChange={(e) => setQuery({ kind: e.target.value || null })}
            options={[{ value: "", label: "Every change" }, ...KINDS.map((k) => ({ value: k, label: `${k}s` }))]}
          />
        </label>{" "}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Sort
          <SelectInput
            value={sort}
            onChange={(e) => setQuery({ sort: e.target.value === "newest" ? null : e.target.value })}
            options={CHANGELOG_SORTS.map((o) => ({ value: o.id, label: o.label }))}
          />
        </label>
      </div>
      {shown.length ? (
        <ChangelogTimeline posts={shown} />
      ) : (
        <p className="py-10 text-base text-soft">
          {q ? <>Nothing in the changelog matches &ldquo;{search}&rdquo;.</> : <>No {kind.toLowerCase()}s yet.</>}
        </p>
      )}
    </div>
  );
}
