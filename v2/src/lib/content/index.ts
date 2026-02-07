/**
 * Content Utility Functions
 *
 * File-based MDX content reading for the content hub.
 * Reads from /content/{type}/*.mdx at build time.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import type { ContentType, Post, PostMeta, PostSummary } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

/** Get all slugs for a content type (for generateStaticParams) */
export function getPostSlugs(type: ContentType): string[] {
  const dir = path.join(CONTENT_DIR, type);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));
}

/** Read and parse a single MDX post by slug and type */
export function getPostBySlug(type: ContentType, slug: string): Post | null {
  const filePath = path.join(CONTENT_DIR, type, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`[content] Failed to read ${type}/${slug}.mdx:`, error);
    return null;
  }

  let data: Record<string, unknown>;
  let content: string;
  try {
    const parsed = matter(raw);
    data = parsed.data;
    content = parsed.content;
  } catch (error) {
    console.error(`[content] Failed to parse frontmatter in ${type}/${slug}.mdx:`, error);
    return null;
  }

  const stats = readingTime(content);

  // Warn about missing required frontmatter fields
  if (!data.title) console.warn(`[content] Missing title in ${type}/${slug}.mdx`);
  if (!data.date) console.warn(`[content] Missing date in ${type}/${slug}.mdx — using today's date`);
  if (data.tags && !Array.isArray(data.tags)) console.warn(`[content] tags should be an array in ${type}/${slug}.mdx`);

  const meta: PostMeta = {
    title: (data.title as string) ?? "Untitled",
    description: (data.description as string) ?? "",
    date: (data.date as string) ?? new Date().toISOString().split("T")[0],
    updated: data.updated as string | undefined,
    author: (data.author as string) ?? "PERM Tracker Team",
    image: data.image as string | undefined,
    imageAlt: data.imageAlt as string | undefined,
    tags: (Array.isArray(data.tags) ? data.tags : []) as string[],
    category: data.category as string | undefined,
    readingTime: stats.text,
    published: data.published !== false,
    featured: (data.featured as boolean | undefined) ?? false,
    seoTitle: data.seoTitle as string | undefined,
    seoDescription: data.seoDescription as string | undefined,
  };

  return { slug, type, meta, content };
}

/** Get all posts, optionally filtered by type. Sorted by date descending. */
export function getAllPosts(type?: ContentType): PostSummary[] {
  const types: ContentType[] = type
    ? [type]
    : ["blog", "tutorials", "guides", "changelog", "resources"];

  const posts: PostSummary[] = [];

  for (const t of types) {
    const slugs = getPostSlugs(t);
    for (const slug of slugs) {
      const post = getPostBySlug(t, slug);
      if (post && post.meta.published) {
        posts.push({ slug, type: t, meta: post.meta });
      }
    }
  }

  return posts.sort(
    (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime()
  );
}

/** Get related posts by matching tags */
export function getRelatedPosts(
  post: PostSummary,
  limit = 3
): PostSummary[] {
  const allPosts = getAllPosts();

  return allPosts
    .filter((p) => !(p.slug === post.slug && p.type === post.type))
    .map((p) => ({
      post: p,
      score: p.meta.tags.filter((tag) => post.meta.tags.includes(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ post }) => post);
}

/** Get all unique tags across all posts of a given type */
export function getAllTags(type?: ContentType): string[] {
  const posts = getAllPosts(type);
  const tagSet = new Set<string>();
  for (const post of posts) {
    for (const tag of post.meta.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

/** Get featured posts (pinned) */
export function getFeaturedPosts(type?: ContentType): PostSummary[] {
  return getAllPosts(type).filter((p) => p.meta.featured);
}
