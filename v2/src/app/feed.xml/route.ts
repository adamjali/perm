/**
 * RSS 2.0 Feed
 *
 * Auto-generates RSS feed from all published content.
 * Consumed by AI engines, aggregators, and feed readers.
 */

import { getAllPosts } from "@/lib/content";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const posts = getAllPosts().filter((p) => p.type !== "changelog");

  const items = posts.map((post) => {
    const url = `${BASE_URL}/${post.type}/${post.slug}`;
    const pubDate = new Date(post.meta.date).toUTCString();

    return `    <item>
      <title>${escapeXml(post.meta.title)}</title>
      <link>${url}</link>
      <description>${escapeXml(post.meta.description)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${url}</guid>
      <category>${post.type}</category>
      ${post.meta.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("\n      ")}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PERM Tracker</title>
    <link>${BASE_URL}</link>
    <description>Insights on PERM labor certification, DOL processing data, and case management for applicants and attorneys.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/icon-512.png</url>
      <title>PERM Tracker</title>
      <link>${BASE_URL}</link>
    </image>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
