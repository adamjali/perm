import type { MetadataRoute } from 'next'
import { fetchQuery } from 'convex/nextjs'
import { api } from '../../convex/_generated/api'
import { getAllPosts } from '@/lib/content'
import { captureError } from '@/lib/sentry'

// Next.js sitemap routes are cached by default and only regenerated when
// Next.js revalidates them (or a request-time API forces dynamic). Daily
// revalidation keeps the sitemap fresh between deploys without per-request
// regeneration cost — without it, the route would be frozen to build time.
// https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  // Use the most recent content date for listing pages (not build time).
  const allPosts = getAllPosts()
  if (allPosts.length === 0) {
    // Build-time content failure (missing content/ dir, all parse errors swallowed
    // upstream, etc.) would silently fall back to today's date for every URL —
    // teaching Google to ignore our lastmod values. Surface it to Sentry so an
    // empty-posts deploy can be triaged instead of shipping a misleading sitemap.
    captureError(new Error('Sitemap built with zero content posts: content/ may be missing or all MDX parses failed'))
  }
  const latestPostDate = allPosts.length > 0
    ? allPosts.reduce((latest, post) => {
        const date = post.meta.updated ?? post.meta.date
        return date > latest ? date : latest
      }, allPosts[0]!.meta.date)
    : new Date().toISOString().split('T')[0]!

  // DOL's own as-of stamp for the processing-times page. Wrapped because the
  // sitemap must still build if Convex is unreachable: a sitemap with one
  // slightly stale lastmod is fine, a failed build is not.
  const permAsOf = await fetchQuery(api.dolProcessingTimes.getLatest, {})
    .then((snap) => snap?.permAsOf ?? null)
    .catch(() => null)

  // Static pages.
  // - Homepage lastModified is derived from latestPostDate (was hardcoded):
  //   home content references the latest posts, so freshness tracks content.
  // - /login and /signup intentionally omitted: their page metadata sets
  //   `robots: { index: false }`. Advertising them in the sitemap would be
  //   contradictory and risks Search Console "noindex'd URL in sitemap" warnings.
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: latestPostDate },
    { url: `${baseUrl}/blog`, lastModified: latestPostDate },
    { url: `${baseUrl}/guides`, lastModified: latestPostDate },
    { url: `${baseUrl}/changelog`, lastModified: latestPostDate },
    { url: `${baseUrl}/faq`, lastModified: '2026-02-21' },
    // Live DOL figures, refreshed weekly by convex/dolProcessingTimes.ts.
    // lastmod is DOL's own as-of date, which is the only thing that actually
    // changes this page. It previously used latestPostDate, so the date moved
    // whenever an unrelated blog post shipped and stayed put when DOL published
    // — backwards on both counts, and the fastest way to teach a crawler that
    // our lastmod values mean nothing.
    { url: `${baseUrl}/perm-processing-times`, lastModified: permAsOf ?? latestPostDate },
    // Calculators. Their lastmod tracks DOL's own as-of stamp where they render
    // live figures, for the same reason /perm-processing-times does: the date
    // should move when the numbers move, not when an unrelated post ships.
    { url: `${baseUrl}/tools`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/tools/green-card-timeline`, lastModified: permAsOf ?? '2026-08-23' },
    { url: `${baseUrl}/tools/perm-timeline-calculator`, lastModified: permAsOf ?? '2026-08-23' },
    { url: `${baseUrl}/tools/pwd-calculator`, lastModified: permAsOf ?? '2026-08-23' },
    { url: `${baseUrl}/tools/i140-calculator`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/tools/priority-date-calculator`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/tools/perm-deadline-calculator`, lastModified: '2026-08-23' },
    { url: `${baseUrl}/calculators`, lastModified: '2026-08-24' },
    { url: `${baseUrl}/methodology`, lastModified: '2026-08-24' },
    { url: `${baseUrl}/contact`, lastModified: '2026-02-07' },
    { url: `${baseUrl}/terms`, lastModified: '2026-06-15' },
    { url: `${baseUrl}/privacy`, lastModified: '2026-06-15' },
    { url: `${baseUrl}/security`, lastModified: '2026-06-15' },
  ]

  // Dynamic content pages (blog, tutorials, guides, resources)
  const contentPages: MetadataRoute.Sitemap = getAllPosts()
    .filter((post) => post.type !== 'changelog') // Changelog is a single page, no individual routes
    .map((post) => ({
      url: `${baseUrl}/${post.type}/${post.slug}`,
      lastModified: post.meta.updated ?? post.meta.date,
    }))

  return [...staticPages, ...contentPages]
}
