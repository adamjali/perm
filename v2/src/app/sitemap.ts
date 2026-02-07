import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/content'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    // Primary pages (high priority)
    {
      url: baseUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/demo`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Content hub listing pages
    {
      url: `${baseUrl}/blog`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tutorials`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guides`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/changelog`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/resources`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    // Auth pages (medium priority)
    {
      url: `${baseUrl}/login`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    // Utility pages (low priority)
    {
      url: `${baseUrl}/contact`,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
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
