/**
 * How the articles are organised: each guide and blog post belongs to one topic,
 * named for the reader's situation ("Your case status", "After PERM"), and the
 * listing pages are built as one section per topic in this order.
 *
 * The topic is the article's `category` frontmatter. Tags stay in frontmatter as
 * keywords for search and related posts, and are no longer shown as filters: at
 * 55 guides they were 102 words like "perm", "dol" and "how-to", most on one
 * article, and a reader can't navigate by them. `topics.test.ts` holds every
 * article to one topic here and every topic to at least one article.
 */

import type { ContentType } from "./types";
import type { SpotPictureName } from "@/lib/spotPictures";

export interface Topic {
  id: string;
  label: string;
  /** One line under the section heading on the listing page. */
  blurb: string;
  /** The small drawing beside the section heading (public/images/spots, scripts/spot-pictures). */
  picture: SpotPictureName;
}

export const TOPICS: Record<Exclude<ContentType, "changelog">, readonly Topic[]> = {
  guides: [
    { id: "start", label: "Start here", blurb: "The whole process in one place, and how to use this site.", picture: "topic-start" },
    { id: "case-status", label: "Your case status", blurb: "Finding the case number, reading DOL's status, and what each status means.", picture: "topic-case-status" },
    { id: "queue", label: "Timing and the queue", blurb: "How DOL works through cases, and how far to trust a date.", picture: "topic-queue" },
    { id: "deadlines", label: "Deadlines and recruitment", blurb: "The dates a PERM case runs on, and the recruitment that has to fit inside them.", picture: "topic-deadlines" },
    { id: "wages", label: "Wages, wage requests and LCAs", blurb: "Prevailing wage requests, H-1B labor condition applications and what jobs pay.", picture: "topic-wages" },
    { id: "employers", label: "Employers and law firms", blurb: "Reading a sponsor's or a firm's record, and what a layoff changes.", picture: "topic-employers" },
    { id: "green-card", label: "After PERM: I-140 to green card", blurb: "The visa bulletin, USCIS forms and the wait for a visa number.", picture: "topic-green-card" },
    { id: "seasonal", label: "H-2A, H-2B and CW-1", blurb: "Seasonal and island work visas on the same DOL system.", picture: "topic-seasonal" },
  ],
  blog: [
    { id: "data-notes", label: "Data notes", blurb: "What DOL's own records show, counted and dated.", picture: "topic-data-notes" },
    { id: "explainers", label: "Explainers", blurb: "How PERM works, for people meeting it for the first time.", picture: "topic-explainers" },
    { id: "practice", label: "For practitioners", blurb: "For attorneys, paralegals and HR teams filing cases.", picture: "topic-practice" },
  ],
};

export function topicsFor(type: ContentType): readonly Topic[] {
  return type === "changelog" ? [] : TOPICS[type];
}

export function topicFor(type: ContentType, id: string | undefined): Topic | null {
  if (!id) return null;
  return topicsFor(type).find((t) => t.id === id) ?? null;
}
