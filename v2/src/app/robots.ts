import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',           // API routes - internal only
          '/dashboard/',     // Authenticated dashboard
          '/cases/',         // Authenticated case management (all /cases/* routes)
          '/calendar/',      // Authenticated calendar view
          '/timeline/',      // Authenticated timeline view
          '/notifications/', // Authenticated notifications
          '/settings/',      // Authenticated user settings
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
