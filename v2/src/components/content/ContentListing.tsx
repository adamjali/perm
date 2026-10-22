"use client";

/**
 * ContentListing
 *
 * The guides and blog listings: one section per topic (lib/content/topics.ts),
 * in the topics' order, with a row of topic buttons that narrows the page to
 * one topic and a search box that narrows by words. Both keep the sections,
 * so a card title is always an <h3> under its topic's <h2>. Each section's heading
 * row carries the topic's small drawing, decorative beside the heading that names it.
 */

import * as React from "react";
import { Fragment } from "react";
import type { ContentType, PostSummary } from "@/lib/content/types";
import { topicsFor } from "@/lib/content/topics";
import { rankFuzzy } from "@/lib/fuzzy";
import ContentGrid from "./ContentGrid";
import ContentSearch from "./ContentSearch";
import { choiceVariants } from "@/components/ui/choice";
import { SpotPicture } from "@/components/ui/spot-picture";
import { clampPage, Pagination, usePageParam, useQueryParam } from "@/components/ui/pagination";

/** Articles a page (owner, Oct 21 2026: "pagination not endless scroll"). */
export const PER_PAGE = 12;

interface ContentListingProps {
  posts: PostSummary[];
  type: ContentType;
}

export default function ContentListing({ posts, type }: ContentListingProps) {
  const topics = topicsFor(type);
  const [search, setSearchRaw] = React.useState("");
  // The topic and the page live in the address (?topic=queue&page=2), so a link can open one topic's articles.
  const [topicParam, setQuery] = useQueryParam("topic");
  const active = topics.some((t) => t.id === topicParam) ? topicParam : null;
  const [pageParam, setPage] = usePageParam();
  const top = React.useRef<HTMLDivElement>(null);
  // A new search or topic starts again at the first page.
  const setSearch = (value: string) => {
    setSearchRaw(value);
    if (pageParam !== 1) setPage(1);
  };
  const setActive = (value: string | null) => setQuery({ topic: value, page: null });

  // Words first; when no article holds them, the closest articles by title,
  // tags and description, so a misspelt search still lands somewhere.
  const { matches, closest } = React.useMemo(() => {
    if (!search) return { matches: posts, closest: false };
    const q = search.toLowerCase();
    const exact = posts.filter(
      (p) =>
        p.meta.title.toLowerCase().includes(q) ||
        p.meta.description.toLowerCase().includes(q) ||
        p.meta.tags.some((t) => t.toLowerCase().includes(q)),
    );
    if (exact.length > 0 || search.trim().length < 3) return { matches: exact, closest: false };
    const near = rankFuzzy(search, posts, (p) => [p.meta.title, ...p.meta.tags, p.meta.description], {
      limit: 12,
    }).map((r) => r.item);
    return { matches: near, closest: near.length > 0 };
  }, [posts, search]);

  // Every matching article in reading order (topic by topic), then the page's twelve, still under their topics.
  const ordered = topics
    .filter((t) => !active || t.id === active)
    .flatMap((t) => matches.filter((p) => p.meta.category === t.id));
  const shown = ordered.length;
  const pageCount = Math.max(1, Math.ceil(shown / PER_PAGE));
  const page = clampPage(pageParam, pageCount);
  // Every matching article stays in the page, so each keeps its link from this list (Google follows links, not the
  // page buttons); the ones off the current page are hidden. Measured live Oct 22 2026: cut to twelve, /guides linked
  // 29 of 86 guides and /blog 15 of 27.
  const onPage = new Set(ordered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((p) => p.slug));
  const sections = topics
    .filter((t) => !active || t.id === active)
    .map((t) => {
      const list = matches.filter((p) => p.meta.category === t.id);
      return { topic: t, posts: list, here: list.some((p) => onPage.has(p.slug)) };
    })
    .filter((s) => s.posts.length > 0);
  const counts = new Map(topics.map((t) => [t.id, posts.filter((p) => p.meta.category === t.id).length]));

  return (
    <div ref={top} id="articles" className="scroll-mt-28 space-y-10">
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

      {closest ? (
        <p role="status" className="border-l-4 border-primary bg-tint px-4 py-3 text-base">
          No article holds &ldquo;{search}&rdquo; exactly. These are the closest.
        </p>
      ) : null}

      {sections.map(({ topic, posts: list, here }) => (
        <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-h`} hidden={!here}>
          <div className="mb-5 flex items-center gap-3 border-b-2 border-border pb-3 sm:gap-4">
            <SpotPicture name={topic.picture} alt="" className="w-16 shrink-0 sm:w-24" />{" "}
            <div className="min-w-0">
              <h2 id={`${topic.id}-h`} className="font-heading text-2xl font-bold sm:text-3xl">
                {topic.label}
              </h2>{" "}
              <p className="mt-1 text-base text-soft">{topic.blurb}</p>
            </div>
          </div>
          <ContentGrid posts={list} headingLevel={3} shown={onPage} />
        </section>
      ))}

      {shown === 0 ? (
        <p className="py-16 text-center text-base text-soft">
          Nothing matches &ldquo;{search}&rdquo;. Try a shorter word, or show all topics.
        </p>
      ) : (
        <Pagination
          page={page}
          pageCount={pageCount}
          onPage={setPage}
          total={shown}
          perPage={PER_PAGE}
          noun={search ? (closest ? `close to "${search}"` : `matching "${search}"`) : type === "blog" ? "posts" : "guides"}
          label={type === "blog" ? "Pages of posts" : "Pages of guides"}
          scrollTo={top}
          className="border-t-2 border-border pt-8"
        />
      )}
    </div>
  );
}

function TopicButton({ pressed, onClick, label, count }: { pressed: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={choiceVariants({ on: pressed })}
    >
      {label}{" "}
      {/* On the pressed (lime) button the count takes the button's ink: grey on lime read 3.03:1. */}
      <span className={pressed ? "text-sm" : "text-sm text-muted-foreground"}>{count}</span>
    </button>
  );
}
