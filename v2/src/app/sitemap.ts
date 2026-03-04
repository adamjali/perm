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
    : new Date().toISOString().split('T')[0]!

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: '2026-02-15' },
    { url: `${baseUrl}/demo`, lastModified: '2026-02-11' },
    { url: `${baseUrl}/blog`, lastModified: latestPostDate },
    { url: `${baseUrl}/tutorials`, lastModified: latestPostDate },
    { url: `${baseUrl}/guides`, lastModified: latestPostDate },
    { url: `${baseUrl}/changelog`, lastModified: latestPostDate },
    { url: `${baseUrl}/resources`, lastModified: latestPostDate },
    { url: `${baseUrl}/faq`, lastModified: '2026-02-21' },
    { url: `${baseUrl}/login`, lastModified: '2026-02-13' },
    { url: `${baseUrl}/signup`, lastModified: '2026-02-14' },
    { url: `${baseUrl}/contact`, lastModified: '2026-02-07' },
    { url: `${baseUrl}/terms`, lastModified: '2026-02-17' },
    { url: `${baseUrl}/privacy`, lastModified: '2026-02-17' },
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
