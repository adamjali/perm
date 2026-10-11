"use client";

/**
 * ContentListing
 *
 * The guides and blog listings: one section per topic (lib/content/topics.ts),
 * in the topics' order, with a row of topic buttons that narrows the page to
 * one topic and a search box that narrows by words. Both keep the sections,
 * so a card title is always an <h3> under its topic's <h2>.
 */

import * as React from "react";
import { Fragment } from "react";
import type { ContentType, PostSummary } from "@/lib/content/types";
import { topicsFor } from "@/lib/content/topics";
import { cn } from "@/lib/utils";
import ContentGrid from "./ContentGrid";
import ContentSearch from "./ContentSearch";

interface ContentListingProps {
  posts: PostSummary[];
  type: ContentType;
}

export default function ContentListing({ posts, type }: ContentListingProps) {
  const topics = topicsFor(type);
  const [search, setSearch] = React.useState("");
  const [active, setActive] = React.useState<string | null>(null);

  const matches = React.useMemo(() => {
    if (!search) return posts;
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        p.meta.title.toLowerCase().includes(q) ||
        p.meta.description.toLowerCase().includes(q) ||
        p.meta.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [posts, search]);

  const sections = topics
    .filter((t) => !active || t.id === active)
    .map((t) => ({ topic: t, posts: matches.filter((p) => p.meta.category === t.id) }))
    .filter((s) => s.posts.length > 0);
  const shown = sections.reduce((n, s) => n + s.posts.length, 0);
  const counts = new Map(topics.map((t) => [t.id, posts.filter((p) => p.meta.category === t.id).length]));

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div role="group" aria-label="Topics" className="flex flex-wrap gap-2">
          <TopicButton pressed={active === null} onClick={() => setActive(null)} label="All topics" count={posts.length} />{" "}
          {topics.map((t) => (
            <Fragment key={t.id}>
              {" "}
              <TopicButton
                pressed={active === t.id}
                onClick={() => setActive(active === t.id ? null : t.id)}
                label={t.label}
                count={counts.get(t.id) ?? 0}
              />
            </Fragment>
          ))}
        </div>{" "}
        <div className="w-full shrink-0 lg:max-w-xs">
          <ContentSearch value={search} onChange={setSearch} />
        </div>
      </div>

      {sections.map(({ topic, posts: list }) => (
        <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-h`} className="scroll-mt-[calc(var(--site-header-max-h,4.5rem)+1rem)]">
          <div className="mb-5 border-b-2 border-border pb-3">
            <h2 id={`${topic.id}-h`} className="font-heading text-2xl font-black sm:text-3xl">
              {topic.label}
            </h2>{" "}
            <p className="mt-1 text-base text-foreground/75">{topic.blurb}</p>
          </div>
          <ContentGrid posts={list} headingLevel={3} />
        </section>
      ))}

      {shown === 0 ? (
        <p className="py-16 text-center text-base text-foreground/75">
          Nothing matches &ldquo;{search}&rdquo;. Try a shorter word, or show all topics.
        </p>
      ) : search || active ? (
        <p className="text-center text-sm text-foreground/70">
          Showing {shown} of {posts.length}
          {search ? ` matching "${search}"` : null}
        </p>
      ) : null}
    </div>
  );
}

function TopicButton({ pressed, onClick, label, count }: { pressed: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 border-2 border-border px-3 text-sm font-semibold transition-colors",
        pressed ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-muted",
      )}
    >
      {label}{" "}
      <span className={cn("font-mono text-sm", pressed ? "text-background/75" : "text-foreground/60")}>{count}</span>
    </button>
  );
}
