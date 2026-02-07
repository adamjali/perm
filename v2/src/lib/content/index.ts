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

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const stats = readingTime(content);

  const meta: PostMeta = {
    title: data.title ?? "Untitled",
    description: data.description ?? "",
    date: data.date ?? new Date().toISOString().split("T")[0],
    updated: data.updated,
    author: data.author ?? "PERM Tracker Team",
    image: data.image,
    imageAlt: data.imageAlt,
    tags: data.tags ?? [],
    category: data.category,
    readingTime: stats.text,
    published: data.published !== false,
    featured: data.featured ?? false,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
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
