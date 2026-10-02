/**
 * RSS 2.0 Feed
 *
 * Auto-generates RSS feed from all published content.
 * Consumed by AI engines, aggregators, and feed readers.
 */

import { getAllPosts } from "@/lib/content";
import { SITE_URL } from "@/lib/constants/site";

const BASE_URL = SITE_URL;

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
    // pubDate stays the publish date, so a revision doesn't re-announce the
    // item to readers; the revision rides alongside as atom:updated.
    const updated =
      post.meta.updated && post.meta.updated > post.meta.date
        ? `\n      <atom:updated>${post.meta.updated}T00:00:00Z</atom:updated>`
        : "";

    return `    <item>
      <title>${escapeXml(post.meta.title)}</title>
      <link>${url}</link>
      <description>${escapeXml(post.meta.description)}</description>
      <dc:creator>${escapeXml(post.meta.author)}</dc:creator>
      <pubDate>${pubDate}</pubDate>${updated}
      <guid isPermaLink="true">${url}</guid>
      <category>${post.type}</category>
      ${post.meta.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("\n      ")}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
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
