import { Fragment, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { buttonVariants } from "@/components/ui/button";
import { SpotPicture } from "@/components/ui/spot-picture";
import { topicsFor, type Topic } from "@/lib/content/topics";
import type { ContentType, PostSummary } from "@/lib/content/types";
import { cn } from "@/lib/utils";

import { TopicStackStage } from "./TopicStackStage";

/**
 * "Browse by topic": one card per topic, ahead of the full listing. Each card is the topic's drawing, its name,
 * how many articles it holds, its three newest, a link to its section below, and the newest article's own header
 * picture beside them (pattern 4 of ~/.claude/explanations/20261021_details_so/PATTERNS.md, stacked cards).
 *
 * The topic's name is not a heading: the listing below has an h2 per topic, and two headings with one name read
 * as a broken outline. On a phone each card lies on its side (the topic's drawing at the left, the name and
 * count beside it); at 1024px and up with motion allowed the cards stack as the reader scrolls (TopicStackStage);
 * under reduced motion they're a two-column grid. One set of cards serves every mode.
 */

export interface TopicCardData {
  topic: Topic;
  count: number;
  newest: PostSummary[];
  /** The newest article in the topic that has a header picture. */
  picture: PostSummary | null;
}

export function topicCards(posts: PostSummary[], type: ContentType): TopicCardData[] {
  return topicsFor(type)
    .map((topic) => {
      const list = posts.filter((p) => p.meta.category === topic.id);
      return {
        topic,
        count: list.length,
        newest: list.slice(0, 3),
        picture: list.find((p) => p.meta.image) ?? null,
      };
    })
    .filter((c) => c.count > 0);
}

const NOUN: Record<Exclude<ContentType, "changelog">, [string, string]> = {
  guides: ["guide", "guides"],
  blog: ["post", "posts"],
};

/** With scripts off the stage can't move, so the cards lay out as the grid. */
const NO_SCRIPT = `
[data-topic-stage]{height:auto!important}
[data-topic-stage] [data-stage-frame]{position:static!important;height:auto!important;overflow:visible!important;display:block!important}
[data-topic-stage] [data-stage-deck]{height:auto!important;display:grid!important;gap:1.5rem}
[data-topic-stage] [data-step-item]{position:relative!important;top:auto!important;transform:none!important;height:auto!important}
[data-topic-stage] [data-stage-dim]{display:none!important}
`;

function Card({ data, index, type }: { data: TopicCardData; index: number; type: Exclude<ContentType, "changelog"> }) {
  const { topic, count, newest, picture } = data;
  const [one, many] = NOUN[type];
  const noun = count === 1 ? one : many;
  const meta = picture?.meta;
  return (
    <article
      data-step-item={index}
      data-on={index === 0 ? "true" : "false"}
      aria-label={topic.label}
      style={{ "--i": index, "--stack-y": index === 0 ? "0px" : "120vh" } as CSSProperties}
      className={cn(
        "object relative flex flex-col overflow-hidden",
        "max-sm:grid max-sm:grid-cols-[6.5rem_minmax(0,1fr)]",
        "lg:motion-safe:absolute lg:motion-safe:inset-x-0 lg:motion-safe:top-[calc(var(--i)_*_10px)]",
        "lg:motion-safe:grid lg:motion-safe:h-[var(--card-h)] lg:motion-safe:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
        "lg:motion-safe:origin-top lg:motion-safe:will-change-transform",
        "lg:motion-safe:[transform:translateY(var(--stack-y,0px))_scale(var(--stack-s,1))]",
      )}
    >
      {/* On a phone the topic's drawing leads the row: a screenshot shrunk to a thumbnail says nothing. */}
      <span aria-hidden="true" className="order-first hidden items-center justify-center border-r-2 border-border bg-tint p-2 max-sm:flex">
        <SpotPicture name={topic.picture} alt="" className="w-full" />
      </span>{" "}
      {/* The words. */}
      <div className="flex min-w-0 flex-col p-4 sm:p-6 lg:motion-safe:p-8">
        <div className="flex items-center gap-4">
          <SpotPicture
            name={topic.picture}
            alt=""
            className="w-20 shrink-0 max-sm:hidden lg:motion-safe:w-24"
          />{" "}
          <div className="min-w-0">
            <p className="font-heading text-xl font-bold leading-tight sm:text-2xl lg:motion-safe:text-3xl">
              {topic.label}
            </p>{" "}
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              {count} {noun}
            </p>
          </div>
        </div>{" "}
        <p className="mt-4 text-base leading-relaxed text-soft max-sm:hidden lg:motion-safe:[@media(max-height:840px)]:hidden">
          {topic.blurb}
        </p>{" "}
        <ul className="mt-5 border-t-2 border-border max-sm:hidden lg:motion-safe:[@media(max-height:700px)]:[&>li:nth-of-type(n+3)]:hidden">
          {newest.map((p) => (
            <Fragment key={p.slug}>
              {" "}
              <li className="border-b-2 border-border">
                <Link
                  href={`/${p.type}/${p.slug}`}
                  className="flex min-h-11 items-center gap-2 py-2 text-base font-semibold hover:underline"
                >
                  <span className="min-w-0 lg:motion-safe:line-clamp-2">{p.meta.title}</span>{" "}
                  <ArrowRightIcon aria-hidden="true" weight="bold" className="ml-auto size-4 shrink-0 text-primary-text" />
                </Link>
              </li>
            </Fragment>
          ))}
        </ul>{" "}
        <div className="mt-auto pt-6 max-sm:pt-2">
          <Link
            href={`/${type}?topic=${topic.id}#articles`}
            className={buttonVariants({ variant: "outline", className: "max-sm:min-h-11 max-sm:px-3" })}
          >
            All {count} {noun}
            <span className="sr-only"> in {topic.label}</span>
          </Link>
        </div>
      </div>{" "}
      {/* The newest article's own picture. */}
      {meta?.image ? (
        <figure className="order-first flex min-w-0 flex-col border-b-2 border-border max-sm:hidden lg:motion-safe:order-last lg:motion-safe:border-b-0 lg:motion-safe:border-l-2">
          <div className="relative aspect-[16/9] overflow-hidden lg:motion-safe:aspect-auto lg:motion-safe:flex-1">
            <Image
              src={meta.image}
              alt={meta.imageAlt ?? meta.title}
              fill
              sizes="(min-width: 1024px) 40vw, 50vw"
              className="object-cover"
              style={{ objectPosition: meta.imagePosition ?? "center" }}
            />
          </div>{" "}
          {meta.imageCredit ? (
            <figcaption className="border-t-2 border-border bg-card px-4 py-2 text-sm leading-snug text-muted-foreground max-sm:hidden">
              {meta.imageCredit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      {/* The darkening when the next card covers this one (pinned layout only). */}
      <span
        aria-hidden="true"
        data-stage-dim=""
        className="pointer-events-none absolute inset-0 hidden bg-black opacity-[var(--stack-dim,0)] will-change-[opacity] lg:motion-safe:block"
      />
    </article>
  );
}

export function TopicStack({ posts, type }: { posts: PostSummary[]; type: Exclude<ContentType, "changelog"> }) {
  const cards = topicCards(posts, type);
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="browse-by-topic" className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-8 sm:pt-12">
      <noscript>
        <style>{NO_SCRIPT}</style>
      </noscript>
      <h2 id="browse-by-topic" className="font-heading text-2xl font-bold sm:text-3xl">
        Browse by topic
      </h2>{" "}
      <TopicStackStage count={cards.length}>
        <div
          data-stage-frame=""
          className="mt-6 lg:motion-safe:sticky lg:motion-safe:top-[var(--site-header-h)] lg:motion-safe:mt-0 lg:motion-safe:flex lg:motion-safe:h-[calc(100dvh_-_var(--site-header-h))] lg:motion-safe:items-center lg:motion-safe:overflow-hidden"
        >
          <div
            data-stage-deck=""
            style={
              {
                "--n": cards.length,
                "--card-h": "min(calc(100dvh - var(--site-header-h) - (var(--n) - 1) * 10px - 3rem), 600px)",
              } as CSSProperties
            }
            className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:motion-safe:relative lg:motion-safe:block lg:motion-safe:h-[calc(var(--card-h)_+_(var(--n)_-_1)_*_10px)] lg:motion-safe:w-full"
          >
            {cards.map((c, i) => (
              <Fragment key={c.topic.id}>
                {" "}
                <Card data={c} index={i} type={type} />
              </Fragment>
            ))}
          </div>
        </div>
      </TopicStackStage>
    </section>
  );
}
