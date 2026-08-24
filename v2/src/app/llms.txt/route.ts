/**
 * Dynamic llms.txt route
 *
 * Auto-generates machine-readable site summary for LLMs.
 * Includes all published content and public pages.
 * Replaces the static public/llms.txt file.
 */

import { getAllPosts } from "@/lib/content";
import type { ContentType } from "@/lib/content/types";
import { CONTENT_TYPE_CONFIG } from "@/lib/content/types";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

export function GET() {
  const allPosts = getAllPosts();

  // Group posts by type
  const grouped: Record<ContentType, typeof allPosts> = {
    blog: [],
    guides: [],
    changelog: [],
  };
  for (const post of allPosts) {
    grouped[post.type].push(post);
  }

  const lines: string[] = [
    "# PERM Tracker",
    "",
    "> PERM Tracker (permtracker.app) is a free web app for the Department of Labor PERM (Program Electronic Review Management) process, serving both green-card applicants and immigration attorneys: live DOL queue data and calculators for anyone waiting on a case, and automatic deadline tracking for anyone managing cases.",
    "",
    "It auto-calculates and validates the interdependent PERM deadlines (PWD expiration, the 30-180 day ETA-9089 filing window, recruitment timing, and I-140 deadlines) per 20 CFR 656.40, with Google Calendar sync, email and push reminders, duplicate detection, and an AI assistant that answers PERM questions. Free to use; sign up in under a minute.",
    "",
    "## Key Pages",
    "",
    `- [Home](${BASE_URL}/): Landing page with product overview and features`,
    `- [Sign Up](${BASE_URL}/signup): Create a free account`,
    `- [Login](${BASE_URL}/login): Sign into your account`,
    `- [Demo](${BASE_URL}/demo): Interactive product demo`,
    `- [FAQ](${BASE_URL}/faq): Frequently asked questions about PERM and PERM Tracker`,
    `- [Contact](${BASE_URL}/contact): Get in touch`,
    "",
  ];

  // Content hub section
  lines.push("## Content Hub", "");
  const contentTypes: ContentType[] = ["blog", "guides", "changelog"];
  for (const type of contentTypes) {
    const config = CONTENT_TYPE_CONFIG[type];
    lines.push(`- [${config.plural}](${BASE_URL}/${type}): ${config.description}`);
  }
  lines.push("");

  // Individual articles by type
  for (const type of contentTypes) {
    const posts = grouped[type];
    if (posts.length === 0) continue;

    const config = CONTENT_TYPE_CONFIG[type];
    lines.push(`## ${config.plural}`, "");
    for (const post of posts) {
      const url = type === "changelog"
        ? `${BASE_URL}/changelog`
        : `${BASE_URL}/${type}/${post.slug}`;
      lines.push(`- [${post.meta.title}](${url}): ${post.meta.description}`);
    }
    lines.push("");
  }

  // Legal section
  lines.push(
    "## Legal",
    "",
    `- [Terms of Service](${BASE_URL}/terms)`,
    `- [Privacy Policy](${BASE_URL}/privacy)`,
    `- [Contact](${BASE_URL}/contact)`,
    ""
  );

  const body = lines.join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
