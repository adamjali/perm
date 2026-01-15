import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',        // API routes
          '/dashboard/',  // Authenticated
          '/cases/',      // Authenticated
          '/calendar/',   // Authenticated
          '/timeline/',   // Authenticated
          '/notifications/', // Authenticated
          '/settings/',   // Authenticated
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
