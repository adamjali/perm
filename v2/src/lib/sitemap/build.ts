import "server-only";

import { getAllPosts } from "@/lib/content";
import { fetchAllEntitiesServer } from "@/lib/entitySeed";
import {
  BROWSE_BUCKETS,
  BROWSE_KINDS,
  browseHref,
  type BrowseBucket,
} from "@/lib/entityBrowse";
import { hasOwnPage, type EntityKind } from "@/lib/entityPayload";
import { captureError } from "@/lib/sentry";
import { browseCounts } from "@/lib/turso/entityBrowse";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { countPageworthy } from "@/lib/turso/publicData";
import { MIRROR_COMPLETE } from "@/lib/liveQueueGate";

/**
 * The sitemap, split into an index and per-kind children.
 *
 * WHY SPLIT AT 21,224 URLs, WHICH IS ONLY 42% OF GOOGLE'S 50,000 CAP.
 * Google publishes two numbers that are in tension and never reconciles them:
 * a sitemap may be 50 MB / 50,000 URLs, but "Googlebot crawls the first 2MB
 * of a supported file type" and that limit "is applied on the uncompressed
 * data". Nothing in Google's docs says whether the 2 MB fetch limit applies
 * to sitemap XML. Our single file was 2.3 MB - right on the line of a rule
 * that may or may not exist.
 *
 * The risk is asymmetric: splitting costs a refactor, truncation costs
 * thousands of URLs silently, and truncation is exactly the failure mode this
 * codebase has already shipped once. So: split, and stop caring which limit
 * applies.
 *
 * The second reason is the better one long-term. Search Console can filter
 * the Page indexing report BY SITEMAP, so per-kind children turn "21,224
 * submitted, N indexed" into three separate coverage numbers. That is the
 * measurement that would show whether law-firm pages index worse than
 * occupation pages - which matters here, because DOL prints one firm under
 * several spellings and each gets its own leaf page.
 *
 * What we deliberately do NOT do:
 *   - no `changefreq` or `priority`. Google's docs say it "ignores <priority>
 *     and <changefreq> values", and Bing said the same in July 2025. We never
 *     emitted them; measured at 115 bytes per URL, which is a bare loc+lastmod.
 *   - no .gz. It buys zero headroom (both limits are measured uncompressed)
 *     and Vercel already serves application/xml compressed.
 *   - no generateSitemaps() in a root sitemap.ts. Next issue #77304 (open)
 *     reports that 404s /sitemap.xml, which is the URL submitted in Search
 *     Console. These are hand-rolled Route Handlers instead.
 */

export interface Entry {
  url: string;
  lastModified: string;
}

/** Children stay well under any limit in play: 5,000 URLs is ~550 KB. */
export const SITEMAP_CHUNK = 5000;

/** Kind -> the URL segment its detail pages live under. */
const KIND_PATH: Record<EntityKind, string> = {
  employer: "perm-employers",
  attorney: "perm-attorneys",
  occupation: "perm-wages",
};

/**
 * A per-kind floor for the catastrophic-loss guard.
 *
 * The old guard summed all three kinds and tripped below 500. Split per kind,
 * a single kind returning nothing has to trip on its own or the other two
 * would mask it.
 */
const MIN_ROWS_PER_KIND = 100;

export function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
}

/** DOL's own as-of stamp, or null. Optional: it degrades one date. */
async function permAsOf(): Promise<string | null> {
  return getProcessingTimes()
    .then((s) => s?.permAsOf ?? null)
    .catch(() => null);
}

/**
 * Static pages plus MDX content.
 *
 * These keep their OWN dates rather than inheriting the DOL stamp. A uniform
 * quarterly date across pages that change on their own schedule is the one
 * place a shared lastmod would be a false claim, and Google only trusts
 * lastmod that is "consistently and verifiably accurate".
 */
export async function pagesEntries(): Promise<Entry[]> {
  const base = baseUrl();
  const allPosts = getAllPosts();
  if (allPosts.length === 0) {
    captureError(
      new Error(
        "Sitemap built with zero content posts: content/ may be missing or all MDX parses failed",
      ),
    );
  }
  const latest =
    allPosts.length > 0
      ? allPosts.reduce((acc, p) => {
          const d = p.meta.updated ?? p.meta.date;
          return d > acc ? d : acc;
        }, allPosts[0]!.meta.date)
      : new Date().toISOString().split("T")[0]!;

  const dol = await permAsOf();
  // lastmod tracks DOL's as-of date wherever the page renders live figures:
  // the date should move when the numbers move, not when an unrelated blog
  // post ships. /login and /signup stay out - their metadata sets
  // robots:{index:false} and advertising them here would contradict that.
  const statics: Entry[] = [
    { url: base, lastModified: latest },
    { url: `${base}/blog`, lastModified: latest },
    { url: `${base}/guides`, lastModified: latest },
    { url: `${base}/changelog`, lastModified: latest },
    { url: `${base}/faq`, lastModified: "2026-08-24" },
    { url: `${base}/for-attorneys`, lastModified: "2026-08-28" },
    { url: `${base}/email-preferences`, lastModified: "2026-08-28" },
    { url: `${base}/perm-processing-times`, lastModified: dol ?? latest },
    { url: `${base}/tools`, lastModified: "2026-08-23" },
    { url: `${base}/tools/green-card-timeline`, lastModified: dol ?? "2026-08-23" },
    { url: `${base}/tools/perm-timeline-calculator`, lastModified: dol ?? "2026-08-23" },
    { url: `${base}/tools/pwd-calculator`, lastModified: dol ?? "2026-08-23" },
    { url: `${base}/tools/i140-calculator`, lastModified: "2026-08-23" },
    { url: `${base}/tools/i485-queue-position`, lastModified: "2026-08-26" },
    { url: `${base}/tools/salary-explorer`, lastModified: "2026-08-26" },
    { url: `${base}/tools/i140-trends`, lastModified: "2026-08-27" },
    // Gated on MIRROR_COMPLETE together with the page's own robots directive
    // and its provisional notice: a page carrying provisional counts must not
    // be listed for search, and one that is listed must not still be calling
    // itself provisional.
    ...(MIRROR_COMPLETE
      ? [{ url: `${base}/perm-queue`, lastModified: "2026-08-26" }]
      : []),
    { url: `${base}/tools/priority-date-calculator`, lastModified: "2026-08-23" },
    { url: `${base}/tools/perm-deadline-calculator`, lastModified: "2026-08-23" },
    { url: `${base}/calculators`, lastModified: "2026-08-24" },
    { url: `${base}/methodology`, lastModified: "2026-08-24" },
    { url: `${base}/perm-by-state`, lastModified: dol ?? "2026-08-24" },
    { url: `${base}/perm-wages`, lastModified: dol ?? "2026-08-24" },
    { url: `${base}/perm-employers`, lastModified: dol ?? "2026-08-24" },
    { url: `${base}/perm-attorneys`, lastModified: dol ?? "2026-08-24" },
    // The A-Z index pages. Written literally rather than generated from
    // BROWSE_KINDS because `scripts/audit_page_registration.py` matches a
    // template literal here against every static route in the app tree, and a
    // generated entry is invisible to it. Their letter children ARE generated,
    // below, since those are dynamic segments the gate skips anyway.
    { url: `${base}/perm-employers/browse`, lastModified: dol ?? "2026-08-24" },
    { url: `${base}/perm-attorneys/browse`, lastModified: dol ?? "2026-08-24" },
    { url: `${base}/perm-wages/browse`, lastModified: dol ?? "2026-08-24" },
    { url: `${base}/perm-cases`, lastModified: dol ?? "2026-08-24" },
    // The bare path only. A `?case=` result sets robots:{index:false} and
    // canonicalises back here, so advertising one would contradict the page's
    // own directive and open ~412,000 URLs of crawl space.
    { url: `${base}/perm-case-status`, lastModified: "2026-08-27" },
    { url: `${base}/perm-denial-risk`, lastModified: dol ?? "2026-08-24" },
    { url: `${base}/perm-rfi-audit`, lastModified: "2026-08-27" },
    { url: `${base}/perm-decision-activity`, lastModified: "2026-08-27" },
    { url: `${base}/contact`, lastModified: "2026-08-24" },
    { url: `${base}/terms`, lastModified: "2026-06-15" },
    { url: `${base}/privacy`, lastModified: "2026-08-24" },
    { url: `${base}/security`, lastModified: "2026-06-15" },
  ];

  const content: Entry[] = allPosts.map((post) => ({
    url: `${base}/${post.type}/${post.slug}`,
    lastModified: post.meta.updated ?? post.meta.date,
  }));

  return [...statics, ...(await browseEntries(dol)), ...content];
}

/**
 * The A-Z letter pages, at most 81 of them, in the `pages` child.
 *
 * They belong here rather than in a child of their own: 81 URLs is a rounding
 * error against the 5,000-per-child budget, and putting them beside the hubs
 * keeps Search Console's per-sitemap coverage split reading "the three entity
 * corpora" rather than gaining a fourth line nobody asked a question about.
 *
 * A bucket with nothing in it is OMITTED, and the letter page itself carries
 * `robots: noindex` in the same case. Three occupation letters (X, Y, Z) are
 * genuinely empty, and a sitemap that advertises a page saying "nothing here"
 * is asking for exactly the thin-page judgement the rest of this surface works
 * to avoid. The two halves are separate code and must not drift; the sitemap
 * test asserts the count against `browseCounts`.
 *
 * A failed counts read degrades to no letter URLs rather than throwing. Unlike
 * `entityEntries` there is no catastrophic-loss shape to guard against: the
 * detail pages these letters index are already in their own children, so the
 * worst case is that a crawler discovers them one hop later.
 */
async function browseEntries(dol: string | null): Promise<Entry[]> {
  const root = baseUrl();
  const lastModified = dol ?? "2026-08-24";
  const kinds = Object.values(BROWSE_KINDS);
  const counts = await Promise.all(
    kinds.map((cfg) =>
      browseCounts(cfg.kind).catch((e: unknown) => {
        captureError(
          e instanceof Error ? e : new Error(`browse counts failed: ${String(e)}`),
        );
        return null;
      }),
    ),
  );
  const out: Entry[] = [];
  kinds.forEach((cfg, i) => {
    const byBucket = counts[i];
    if (!byBucket) return;
    for (const bucket of BROWSE_BUCKETS as readonly BrowseBucket[]) {
      if ((byBucket[bucket] ?? 0) === 0) continue;
      out.push({ url: `${root}${browseHref(cfg.base, bucket)}`, lastModified });
    }
  });
  return out;
}

/**
 * One chunk of one entity kind.
 *
 * Slugs come from the entity TABLE, the same source the pages and index
 * tables read. Deriving them here would be a second implementation of the
 * collision rule, and a slug computed two ways is a sitemap entry that 404s.
 */
export async function entityEntries(kind: EntityKind, chunk: number): Promise<Entry[]> {
  const base = baseUrl();
  const rows = await fetchAllEntitiesServer(kind);

  if (rows.length < MIN_ROWS_PER_KIND) {
    const detail =
      `Sitemap child ${kind} built with only ${rows.length} rows. ` +
      `The Turso read failed or returned almost nothing.`;
    captureError(new Error(detail));
    // Throw, do not emit. The previous version REPORTED this and shipped the
    // truncated file anyway: while Convex was disabled it captured "0 entity
    // URLs" on every build and the sitemap went out with 46 URLs, telling
    // Google the site has 46 pages. On revalidation Next keeps serving the
    // last good child, so a transient outage costs freshness, not every URL.
    throw new Error(detail);
  }

  const dol = (await permAsOf()) ?? "2026-08-24";
  // Only entities that HAVE a page. A sitemap must never advertise a 404.
  const pageworthy = rows.filter(hasOwnPage);
  const start = chunk * SITEMAP_CHUNK;
  return pageworthy.slice(start, start + SITEMAP_CHUNK).map(({ slug }) => ({
    url: `${base}/${KIND_PATH[kind]}/${slug}`,
    lastModified: dol,
  }));
}

/** Every child sitemap name, in the order the index lists them. */
export async function childNames(): Promise<string[]> {
  const kinds: EntityKind[] = ["employer", "attorney", "occupation"];
  const counts = await Promise.all(kinds.map((k) => countPageworthy(k)));
  const names = ["pages"];
  kinds.forEach((kind, i) => {
    const n = Math.max(1, Math.ceil((counts[i] ?? 0) / SITEMAP_CHUNK));
    for (let c = 0; c < n; c += 1) names.push(`${kind}-${c + 1}`);
  });
  return names;
}

/** `employer-3` -> { kind: "employer", chunk: 2 }. Null for anything else. */
export function parseChildName(
  name: string,
): { kind: EntityKind; chunk: number } | null {
  const m = /^(employer|attorney|occupation)-(\d+)$/.exec(name);
  if (!m) return null;
  const chunk = Number(m[2]) - 1;
  if (!Number.isInteger(chunk) || chunk < 0 || chunk > 999) return null;
  return { kind: m[1] as EntityKind, chunk };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function urlsetXml(entries: Entry[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map((e) => `<url><loc>${esc(e.url)}</loc><lastmod>${e.lastModified}</lastmod></url>`)
      .join("\n") +
    "\n</urlset>\n"
  );
}

export function indexXml(names: string[], lastmod: string): string {
  const base = baseUrl();
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    names
      .map(
        (n) =>
          `<sitemap><loc>${esc(`${base}/sitemaps/${n}.xml`)}</loc><lastmod>${lastmod}</lastmod></sitemap>`,
      )
      .join("\n") +
    "\n</sitemapindex>\n"
  );
}
