/**
 * ArticleHeader
 *
 * The top of every guide, blog post and changelog entry: the topic it's filed
 * under, the title, the summary and the byline on the left; its picture beside
 * them on a wide screen and under them on a phone, with who made the picture.
 *
 * The picture used to run as a 21:9 banner the full width of the page under
 * the title, which cropped a form or a portrait to a strip and put the first
 * paragraph a screen and a half down. Beside the title it keeps its shape and
 * the article starts on the first screen. Rendered at rest: nothing above the
 * fold animates in.
 */

import Image from "next/image";
import Link from "next/link";
import { CalendarIcon, ClockIcon, UserIcon } from "@phosphor-icons/react/ssr";
import type { PostMeta, ContentType } from "@/lib/content/types";
import { topicFor } from "@/lib/content/topics";

interface ArticleHeaderProps {
  meta: PostMeta;
  type: ContentType;
}

const LONG_DATE: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" };

export default function ArticleHeader({ meta, type }: ArticleHeaderProps) {
  const topic = topicFor(type, meta.category);
  const revised = Boolean(meta.updated && meta.updated !== meta.date);

  return (
    <header className="border-b-2 border-border bg-card">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-12 [&>*]:min-w-0">
        <div>
          {topic ? (
            <Link
              href={`/${type}#${topic.id}`}
              className="link inline-flex min-h-11 items-center text-base"
            >
              {topic.label}
            </Link>
          ) : type === "changelog" && meta.category ? (
            <p className="inline-flex min-h-11 items-center text-base font-semibold text-primary-text">{meta.category}</p>
          ) : null}{" "}
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{meta.title}</h1>{" "}
          <p className="article-description mt-4 max-w-2xl text-lg leading-relaxed text-soft">{meta.description}</p>{" "}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <UserIcon aria-hidden="true" className="size-4" />
              {meta.author}
            </span>{" "}
            <span className="flex items-center gap-1.5">
              <CalendarIcon aria-hidden="true" className="size-4" />
              <time dateTime={meta.date}>{new Date(meta.date).toLocaleDateString("en-US", LONG_DATE)}</time>
            </span>{" "}
            {revised ? (
              <span>
                Updated{" "}
                <time dateTime={meta.updated}>{new Date(meta.updated!).toLocaleDateString("en-US", LONG_DATE)}</time>
              </span>
            ) : null}{" "}
            <span className="flex items-center gap-1.5">
              <ClockIcon aria-hidden="true" className="size-4" />
              {meta.readingTime}
            </span>
          </div>
        </div>{" "}

        {meta.image ? (
          <figure className="m-0">
            <div className="relative aspect-[4/3] overflow-hidden border-border bg-muted border">
              <Image
                src={meta.image}
                alt={meta.imageAlt ?? ""}
                fill
                priority
                className="object-cover"
                style={{ objectPosition: meta.imagePosition ?? "center" }}
                sizes="(max-width: 1024px) 100vw, 560px"
              />
            </div>{" "}
            {meta.imageCredit ? (
              <figcaption className="mt-2 text-sm text-muted-foreground">
                {meta.imageSource ? (
                  <a href={meta.imageSource} rel="noopener" target="_blank" className="underline-offset-4 hover:underline">
                    {meta.imageCredit}
                  </a>
                ) : (
                  meta.imageCredit
                )}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </div>
    </header>
  );
}
