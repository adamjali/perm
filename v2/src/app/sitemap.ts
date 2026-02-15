import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/content'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  // Use the most recent content date for listing pages (not build time)
  const allPosts = getAllPosts()
  const latestPostDate = allPosts.length > 0
    ? allPosts.reduce((latest, post) => {
        const date = post.meta.updated ?? post.meta.date
        return date > latest ? date : latest
      }, allPosts[0]!.meta.date)
    : '2026-01-15'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    // Primary pages (high priority)
    {
      url: baseUrl,
      lastModified: '2026-02-15',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/demo`,
      lastModified: '2026-01-15',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Content hub listing pages (use latest content date)
    {
      url: `${baseUrl}/blog`,
      lastModified: latestPostDate,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tutorials`,
      lastModified: latestPostDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guides`,
      lastModified: latestPostDate,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: latestPostDate,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/resources`,
      lastModified: latestPostDate,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Auth pages (medium priority)
    {
      url: `${baseUrl}/login`,
      lastModified: '2026-01-15',
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: '2026-01-15',
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    // Utility pages (low priority)
    {
      url: `${baseUrl}/contact`,
      lastModified: '2026-01-15',
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: '2026-02-14',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: '2026-02-14',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // Dynamic content pages (blog, tutorials, guides, resources)
  const contentPages: MetadataRoute.Sitemap = getAllPosts()
    .filter((post) => post.type !== 'changelog') // Changelog is a single page, no individual routes
    .map((post) => ({
      url: `${baseUrl}/${post.type}/${post.slug}`,
      lastModified: post.meta.updated ?? post.meta.date,
      changeFrequency: 'monthly' as const,
      priority: post.meta.featured ? 0.8 : 0.6,
    }))

  return [...staticPages, ...contentPages]
}
